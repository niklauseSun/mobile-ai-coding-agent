import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ConflictStatusCard,
  isConflictResolutionUseful,
} from '@/components/merge';
import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { useGitProviderAdapter } from '@/providers/git';
import type { DiffFile, Repository, WorkflowRun } from '@/types';

type ResolveConflictScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.resolveConflict
>;

type ResolveDisplayStatus = 'completed' | 'failed' | 'in_progress' | 'queued' | 'ready';

const conflictWorkflowId = 'mobile-ai-resolve-conflict.yml';

export function ResolveConflictScreen({
  navigation,
  route,
}: ResolveConflictScreenProps) {
  const adapter = useGitProviderAdapter();
  const queryClient = useQueryClient();
  const { mergeRequest: initialMergeRequest, repository } = route.params;
  const [dispatchStartedAt, setDispatchStartedAt] = useState<string>();
  const didRefreshAfterCompletionRef = useRef(false);

  const repositorySelector = useMemo(() => toRepositorySelector(repository), [repository]);

  const mergeRequestQuery = useQuery({
    queryKey: ['merge-request', repository.id, initialMergeRequest.number],
    queryFn: () =>
      adapter.getMergeRequest(repositorySelector, initialMergeRequest.number),
    initialData: initialMergeRequest,
  });

  const mergeRequest = mergeRequestQuery.data;

  const filesQuery = useQuery({
    queryKey: ['merge-request-files', repository.id, mergeRequest.number],
    queryFn: () => adapter.listMergeRequestFiles(repositorySelector, mergeRequest.number),
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!adapter.capabilities.supportsWorkflowDispatch) {
        throw new Error('This provider does not support workflow dispatch.');
      }

      const startedAt = new Date().toISOString();

      await adapter.dispatchConflictResolutionWorkflow(repositorySelector, {
        workflowId: conflictWorkflowId,
        ref: mergeRequest.targetBranch.name,
        mergeRequestNumber: mergeRequest.number,
        sourceBranch: mergeRequest.sourceBranch.name,
        targetBranch: mergeRequest.targetBranch.name,
      });

      return startedAt;
    },
    onSuccess: (startedAt) => {
      didRefreshAfterCompletionRef.current = false;
      setDispatchStartedAt(startedAt);
    },
  });

  const workflowRunQuery = useQuery({
    queryKey: [
      'conflict-resolution-workflow-run',
      repository.id,
      mergeRequest.number,
      dispatchStartedAt,
    ],
    queryFn: async () => {
      if (!dispatchStartedAt) {
        return null;
      }

      const runs = await adapter.listWorkflowRuns(repositorySelector, {
        event: 'workflow_dispatch',
        perPage: 20,
        workflowId: conflictWorkflowId,
      });

      return findMatchingConflictRun(runs, dispatchStartedAt, mergeRequest);
    },
    enabled: Boolean(dispatchStartedAt),
    refetchInterval: (query) => {
      const run = query.state.data;
      return run && isTerminalWorkflowRun(run.status) ? false : 5_000;
    },
  });

  const workflowRun = workflowRunQuery.data ?? undefined;
  const displayStatus = getResolveDisplayStatus(
    dispatchMutation.isPending,
    dispatchStartedAt,
    workflowRun,
  );
  const fileSummary = summarizeFiles(filesQuery.data ?? []);
  const canStartResolution =
    mergeRequest.state === 'open' &&
    adapter.capabilities.supportsWorkflowDispatch &&
    !dispatchMutation.isPending &&
    !isWorkflowRunning(workflowRun) &&
    isConflictResolutionUseful(mergeRequest);

  useEffect(() => {
    if (
      !workflowRun ||
      !isTerminalWorkflowRun(workflowRun.status) ||
      didRefreshAfterCompletionRef.current
    ) {
      return;
    }

    didRefreshAfterCompletionRef.current = true;

    void queryClient.invalidateQueries({
      queryKey: ['merge-request', repository.id, mergeRequest.number],
    });
    void queryClient.invalidateQueries({
      queryKey: ['merge-request-files', repository.id, mergeRequest.number],
    });
    void queryClient.invalidateQueries({
      queryKey: ['merge-request-checks', repository.id, mergeRequest.number],
    });
    void queryClient.invalidateQueries({
      queryKey: ['merge-requests', repository.id, 'open'],
    });
    void mergeRequestQuery.refetch();
    void filesQuery.refetch();
  }, [
    filesQuery,
    mergeRequest.number,
    mergeRequestQuery,
    queryClient,
    repository.id,
    workflowRun,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={mergeRequestQuery.isRefetching || filesQuery.isRefetching}
            onRefresh={() => {
              void mergeRequestQuery.refetch();
              void filesQuery.refetch();
            }}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{repository.fullName}</Text>
          <Text style={styles.title}>Resolve PR #{mergeRequest.number}</Text>
          <Text numberOfLines={3} style={styles.description}>
            {mergeRequest.title}
          </Text>
        </View>

        <ConflictStatusCard
          isRefreshing={mergeRequestQuery.isFetching}
          mergeRequest={mergeRequest}
          onRefresh={() => mergeRequestQuery.refetch()}
          providerSupportsConflictStatus={adapter.capabilities.supportsConflictStatus}
        />

        <View style={styles.warningPanel}>
          <Text style={styles.warningTitle}>Review required before merge</Text>
          <Text style={styles.warningText}>
            AI conflict resolution can choose the wrong side of a change. Inspect the
            updated diff and checks before approving or merging this PR.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Workflow</Text>
          <MetadataRow label="Status" value={formatResolveDisplayStatus(displayStatus)} />
          <MetadataRow
            label="Branches"
            value={`${mergeRequest.sourceBranch.name} into ${mergeRequest.targetBranch.name}`}
          />
          {workflowRun ? (
            <>
              <MetadataRow label="Run ID" value={workflowRun.id} />
              <MetadataRow label="Runner status" value={workflowRun.status} />
              <View style={styles.actions}>
                {workflowRun.webUrl ? (
                  <LinkButton label="Open Workflow" url={workflowRun.webUrl} />
                ) : null}
                {workflowRun.logUrl ? (
                  <LinkButton label="Open Latest Logs" url={workflowRun.logUrl} />
                ) : null}
              </View>
            </>
          ) : dispatchStartedAt ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.bodyText}>
                Waiting for GitHub Actions to list the workflow run...
              </Text>
            </View>
          ) : null}

          <ActionButton
            label={dispatchMutation.isPending ? 'Starting Resolution' : 'Start AI Resolution'}
            disabled={!canStartResolution}
            onPress={() =>
              confirmConflictResolution(mergeRequest.number, () =>
                dispatchMutation.mutate(),
              )
            }
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Updated diff</Text>
          {filesQuery.isPending ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.bodyText}>Loading diff summary...</Text>
            </View>
          ) : filesQuery.isError ? (
            <Text style={styles.errorText}>Could not reload changed files.</Text>
          ) : (
            <>
              <MetadataRow label="Files" value={String(fileSummary.fileCount)} />
              <MetadataRow
                label="Additions / Deletions"
                value={`+${fileSummary.additions} / -${fileSummary.deletions}`}
              />
            </>
          )}

          <ActionButton
            label="Review Updated Diff"
            onPress={() =>
              navigation.navigate(routes.mergeRequestDiff, {
                mergeRequest,
                repository,
              })
            }
            variant="secondary"
          />
          <ActionButton
            label="Back to PR Details"
            onPress={() =>
              navigation.navigate(routes.mergeRequestDetail, {
                mergeRequest,
                repository,
              })
            }
            variant="secondary"
          />
        </View>

        {workflowRun && workflowRun.status === 'succeeded' ? (
          <View style={styles.successPanel}>
            <Text style={styles.successTitle}>Resolution workflow completed</Text>
            <Text style={styles.successText}>
              The PR detail and diff were refreshed. Review the updated diff before
              merging.
            </Text>
          </View>
        ) : null}

        {dispatchMutation.isError ? (
          <Text style={styles.errorText}>{getErrorMessage(dispatchMutation.error)}</Text>
        ) : null}
        {workflowRunQuery.isError ? (
          <Text style={styles.errorText}>Could not poll the workflow run.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text style={styles.metadataValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  disabled = false,
  label,
  onPress,
  variant = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        (disabled || pressed) && styles.pressedButton,
      ]}
    >
      <Text
        style={
          variant === 'primary'
            ? styles.primaryButtonText
            : styles.secondaryButtonText
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LinkButton({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedButton]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function findMatchingConflictRun(
  runs: WorkflowRun[],
  dispatchStartedAt: string,
  mergeRequest: RootStackParamList[typeof routes.resolveConflict]['mergeRequest'],
) {
  const dispatchTime = new Date(dispatchStartedAt).getTime();
  const branchCandidates = new Set([
    mergeRequest.targetBranch.name,
    mergeRequest.sourceBranch.name,
  ]);

  return runs.find((run) => {
    const createdAt = new Date(run.createdAt).getTime();
    const isRecent = Number.isFinite(createdAt) && createdAt >= dispatchTime - 3_000;
    const branchMatches = !run.branchName || branchCandidates.has(run.branchName);

    return isRecent && branchMatches;
  }) ?? null;
}

function getResolveDisplayStatus(
  dispatchPending: boolean,
  dispatchStartedAt: string | undefined,
  workflowRun: WorkflowRun | undefined,
): ResolveDisplayStatus {
  if (dispatchPending || (dispatchStartedAt && !workflowRun)) {
    return 'queued';
  }

  if (!workflowRun) {
    return 'ready';
  }

  if (workflowRun.status === 'queued' || workflowRun.status === 'waiting') {
    return 'queued';
  }

  if (workflowRun.status === 'in_progress') {
    return 'in_progress';
  }

  if (workflowRun.status === 'succeeded') {
    return 'completed';
  }

  return 'failed';
}

function formatResolveDisplayStatus(status: ResolveDisplayStatus) {
  if (status === 'in_progress') {
    return 'in progress';
  }

  return status;
}

function isWorkflowRunning(workflowRun: WorkflowRun | undefined) {
  return (
    workflowRun?.status === 'queued' ||
    workflowRun?.status === 'waiting' ||
    workflowRun?.status === 'in_progress'
  );
}

function isTerminalWorkflowRun(status: WorkflowRun['status']) {
  return ['cancelled', 'failed', 'skipped', 'succeeded'].includes(status);
}

function summarizeFiles(files: DiffFile[]) {
  return files.reduce(
    (summary, file) => ({
      additions: summary.additions + file.additions,
      deletions: summary.deletions + file.deletions,
      fileCount: summary.fileCount + 1,
    }),
    {
      additions: 0,
      deletions: 0,
      fileCount: 0,
    },
  );
}

function confirmConflictResolution(mergeRequestNumber: number, onConfirm: () => void) {
  Alert.alert(
    'Start AI conflict resolution?',
    `Dispatch the conflict resolution workflow for PR #${mergeRequestNumber}. Review the result before merging.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start Resolution', onPress: onConfirm },
    ],
  );
}

function toRepositorySelector(repository: Repository) {
  return {
    owner: repository.owner.username,
    name: repository.name,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Action failed.';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    gap: 18,
    padding: 24,
  },
  header: {
    gap: 8,
  },
  eyebrow: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  title: {
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 36,
  },
  description: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  panelTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  metadataRow: {
    gap: 4,
  },
  metadataLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  metadataValue: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  bodyText: {
    color: '#475569',
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    gap: 10,
  },
  warningPanel: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  warningTitle: {
    color: '#92400E',
    fontSize: 18,
    fontWeight: '800',
  },
  warningText: {
    color: '#92400E',
    fontSize: 14,
    lineHeight: 20,
  },
  successPanel: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  successTitle: {
    color: '#065F46',
    fontSize: 18,
    fontWeight: '800',
  },
  successText: {
    color: '#047857',
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  pressedButton: {
    opacity: 0.65,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
});
