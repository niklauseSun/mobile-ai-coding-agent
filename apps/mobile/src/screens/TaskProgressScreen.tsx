import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { useGitProviderAdapter } from '@/providers/git';
import { useTaskStore } from '@/state/task-store';
import type { Repository, WorkflowRun } from '@/types';

type TaskProgressScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.taskProgress
>;

type ProgressStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

export function TaskProgressScreen({ navigation, route }: TaskProgressScreenProps) {
  const adapter = useGitProviderAdapter();
  const { autoOpenReview = false, repository, taskId } = route.params;
  const task = useTaskStore((state) =>
    state.tasks.find((candidate) => candidate.id === taskId),
  );
  const upsertWorkflowRun = useTaskStore((state) => state.upsertWorkflowRun);
  const updateTaskWorkflowRun = useTaskStore((state) => state.updateTaskWorkflowRun);
  const updateTaskMergeRequest = useTaskStore((state) => state.updateTaskMergeRequest);
  const didAutoOpenReviewRef = useRef(false);

  const repositorySelector = useMemo(() => toRepositorySelector(repository), [repository]);

  const workflowRunQuery = useQuery({
    queryKey: [
      'ai-coding-workflow-run',
      repository.id,
      task?.workflowId,
      task?.baseBranch,
      task?.sourceBranch,
      task?.createdAt,
    ],
    queryFn: async () => {
      if (!task) {
        return null;
      }

      const runs = await adapter.listWorkflowRuns(repositorySelector, {
        branch: task.baseBranch,
        event: 'workflow_dispatch',
        perPage: 20,
        workflowId: task.workflowId ?? 'mobile-ai-coding.yml',
      });

      return findMatchingWorkflowRun(runs, task.createdAt);
    },
    enabled: Boolean(task),
    refetchInterval: (query) => {
      const run = query.state.data;
      return run && isTerminalWorkflowRun(run.status) ? false : 5_000;
    },
  });

  const workflowRun = workflowRunQuery.data ?? undefined;

  useEffect(() => {
    if (workflowRun) {
      upsertWorkflowRun(workflowRun);
      updateTaskWorkflowRun(taskId, workflowRun);
    }
  }, [taskId, updateTaskWorkflowRun, upsertWorkflowRun, workflowRun]);

  const mergeRequestQuery = useQuery({
    queryKey: [
      'ai-coding-merge-request',
      repository.id,
      task?.sourceBranch,
      task?.targetBranch,
    ],
    queryFn: async () => {
      if (!task?.sourceBranch || !task.targetBranch) {
        return null;
      }

      const mergeRequests = await adapter.listMergeRequests(repositorySelector, {
        sourceBranch: task.sourceBranch,
        state: 'open',
        targetBranch: task.targetBranch,
        perPage: 5,
      });

      return mergeRequests[0] ?? null;
    },
    enabled: Boolean(task?.sourceBranch && task?.targetBranch),
    refetchInterval: (query) => (query.state.data ? false : 6_000),
  });

  const mergeRequest = mergeRequestQuery.data ?? undefined;

  useEffect(() => {
    if (mergeRequest) {
      updateTaskMergeRequest(taskId, mergeRequest);
    }
  }, [mergeRequest, taskId, updateTaskMergeRequest]);

  useEffect(() => {
    if (autoOpenReview && mergeRequest && !didAutoOpenReviewRef.current) {
      didAutoOpenReviewRef.current = true;
      navigation.navigate(routes.mergeRequestReview, {
        mergeRequest,
        repository,
      });
    }
  }, [autoOpenReview, mergeRequest, navigation, repository]);

  if (!task) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.title}>Task not found</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate(routes.startAiCoding, { repository })}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedButton]}
          >
            <Text style={styles.primaryButtonText}>Start New Task</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const displayStatus = getProgressStatus(task.status, workflowRun);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{repository.fullName}</Text>
          <Text style={styles.title}>Task Progress</Text>
          <Text numberOfLines={3} style={styles.description}>
            {task.prompt}
          </Text>
        </View>

        <View style={styles.statusPanel}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>{formatProgressStatus(displayStatus)}</Text>
          <Text style={styles.statusDetail}>
            {task.sourceBranch} into {task.targetBranch}
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Workflow run</Text>
          {workflowRunQuery.isPending ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.bodyText}>Waiting for the workflow run...</Text>
            </View>
          ) : workflowRunQuery.isError ? (
            <Text style={styles.errorText}>Could not load workflow status.</Text>
          ) : workflowRun ? (
            <>
              <MetadataRow label="Runner status" value={workflowRun.status} />
              <MetadataRow
                label="Started"
                value={formatDate(workflowRun.startedAt ?? workflowRun.createdAt)}
              />
              <MetadataRow label="Run ID" value={workflowRun.id} />

              <View style={styles.actions}>
                {workflowRun.webUrl ? (
                  <LinkButton label="Open Workflow" url={workflowRun.webUrl} />
                ) : null}
                {workflowRun.logUrl ? (
                  <LinkButton label="Open Latest Logs" url={workflowRun.logUrl} />
                ) : null}
              </View>
            </>
          ) : (
            <Text style={styles.bodyText}>
              The dispatch was accepted. GitHub may take a few seconds to list the run.
            </Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Pull request</Text>
          {mergeRequestQuery.isPending ? (
            <Text style={styles.bodyText}>Waiting for the runner to create a PR...</Text>
          ) : mergeRequestQuery.isError ? (
            <Text style={styles.errorText}>Could not check for the pull request.</Text>
          ) : mergeRequest ? (
            <>
              <MetadataRow
                label="Pull request"
                value={`#${mergeRequest.number} ${mergeRequest.title}`}
              />
              {mergeRequest.webUrl ? (
                <LinkButton label="Open PR Link" url={mergeRequest.webUrl} />
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate(routes.mergeRequestReview, {
                    mergeRequest,
                    repository,
                  })
                }
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.primaryButtonText}>Review Pull Request</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.bodyText}>
              No PR yet. The workflow creates it after code generation, checks, commit,
              and push complete.
            </Text>
          )}
        </View>

        {task.errorMessage ? (
          <Text style={styles.errorText}>{task.errorMessage}</Text>
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

function toRepositorySelector(repository: Repository) {
  return {
    owner: repository.owner.username,
    name: repository.name,
  };
}

function findMatchingWorkflowRun(runs: WorkflowRun[], taskCreatedAt: string) {
  const taskStartedAt = new Date(taskCreatedAt).getTime() - 60_000;

  return (
    runs
      .filter((run) => new Date(run.createdAt).getTime() >= taskStartedAt)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )[0] ?? null
  );
}

function isTerminalWorkflowRun(status: WorkflowRun['status']) {
  return ['cancelled', 'failed', 'skipped', 'succeeded'].includes(status);
}

function getProgressStatus(
  taskStatus: string,
  workflowRun?: WorkflowRun,
): ProgressStatus {
  if (workflowRun?.status === 'succeeded' || taskStatus === 'succeeded') {
    return 'completed';
  }

  if (
    workflowRun?.status === 'failed' ||
    workflowRun?.status === 'cancelled' ||
    workflowRun?.status === 'skipped' ||
    taskStatus === 'failed' ||
    taskStatus === 'cancelled'
  ) {
    return 'failed';
  }

  if (workflowRun?.status === 'in_progress' || taskStatus === 'running') {
    return 'in_progress';
  }

  return 'queued';
}

function formatProgressStatus(status: ProgressStatus) {
  return status;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
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
  centered: {
    flex: 1,
    gap: 16,
    justifyContent: 'center',
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
  },
  description: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 23,
  },
  statusPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BFDBFE',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  statusLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '800',
  },
  statusDetail: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
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
  bodyText: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  metadataRow: {
    gap: 3,
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
  actions: {
    gap: 8,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
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
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  pressedButton: {
    opacity: 0.72,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
});
