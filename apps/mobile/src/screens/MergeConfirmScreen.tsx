import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import {
  useGitProviderAdapter,
  type GitProviderAdapter,
  type MergeMergeRequestResult,
} from '@/providers/git';
import type {
  MergeConflictStatus,
  MergeMethod,
  MergeRequest,
  Repository,
} from '@/types';
import {
  getHighRiskFileGroups,
  type HighRiskFileGroup,
} from '@/utils/security-guardrails';

type MergeConfirmScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.mergeConfirm
>;

type MergeFlowResult = {
  deletedSourceBranch: boolean;
  mergeResult: MergeMergeRequestResult;
};

type RiskScanQueryState = {
  isError: boolean;
  isPending: boolean;
  isSuccess: boolean;
};

const mergeMethods: MergeMethod[] = ['squash', 'merge', 'rebase'];

export function MergeConfirmScreen({ navigation, route }: MergeConfirmScreenProps) {
  const adapter: GitProviderAdapter = useGitProviderAdapter();
  const queryClient = useQueryClient();
  const { mergeRequest: initialMergeRequest, repository } = route.params;
  const [mergeMethod, setMergeMethod] = useState<MergeMethod>('squash');
  const [shouldDeleteSourceBranch, setShouldDeleteSourceBranch] = useState(false);

  const repositorySelector = toRepositorySelector(repository);

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
  const highRiskFileGroups = getHighRiskFileGroups(filesQuery.data ?? []);
  const canDeleteSourceBranch = canDeleteMergeRequestSourceBranch(
    adapter,
    repository,
    mergeRequest,
  );
  const hasKnownConflict = hasKnownMergeConflict(mergeRequest);
  const isMethodAllowed = isMergeMethodAllowed(mergeRequest, mergeMethod);

  const mergeMutation = useMutation({
    mutationFn: async (): Promise<MergeFlowResult> => {
      assertMergeIsAllowed(mergeRequest, mergeMethod);

      const mergeResult = await adapter.mergeMergeRequest(
        repositorySelector,
        mergeRequest.number,
        {
          method: mergeMethod,
          expectedHeadSha: mergeRequest.sourceBranch.sha,
        },
      );

      let deletedSourceBranch = false;

      if (shouldDeleteSourceBranch && canDeleteSourceBranch && adapter.deleteBranch) {
        await adapter.deleteBranch(repositorySelector, mergeRequest.sourceBranch.name);
        deletedSourceBranch = true;
      }

      return {
        deletedSourceBranch,
        mergeResult,
      };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['merge-requests', repository.id, 'open'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['merge-request', repository.id, mergeRequest.number],
      });
    },
  });

  const isMerging = mergeMutation.isPending;
  const canSubmitMerge =
    mergeRequest.state === 'open' &&
    !hasKnownConflict &&
    isMethodAllowed &&
    filesQuery.isSuccess &&
    !isMerging;
  const shouldShowResolveConflict =
    hasKnownConflict || isConflictLikeError(mergeMutation.error);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{repository.fullName}</Text>
          <Text style={styles.title}>Merge PR #{mergeRequest.number}</Text>
          <Text style={styles.description}>{mergeRequest.title}</Text>
        </View>

        {mergeRequestQuery.isFetching ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.bodyText}>Refreshing pull request state...</Text>
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Pre-merge checks</Text>
          <StatusRow
            label="Pull request state"
            status={mergeRequest.state === 'open' ? 'ok' : 'blocked'}
            value={mergeRequest.state}
          />
          <StatusRow
            label="Conflict status"
            status={hasKnownConflict ? 'blocked' : 'ok'}
            value={formatConflictStatus(mergeRequest.mergeConflictStatus)}
          />
          <StatusRow
            label="Head branch"
            status="info"
            value={mergeRequest.sourceBranch.name}
          />
          <StatusRow
            label="Risk scan"
            status={getRiskScanStatus(filesQuery, highRiskFileGroups)}
            value={formatRiskScanStatus(filesQuery, highRiskFileGroups)}
          />
          {!isMethodAllowed ? (
            <Text style={styles.errorText}>
              This repository does not allow {mergeMethod} merges for this pull request.
            </Text>
          ) : null}
          {filesQuery.isError ? (
            <Text style={styles.errorText}>
              Could not load changed files for the pre-merge risk scan.
            </Text>
          ) : null}
          {hasKnownConflict ? (
            <ActionButton
              label="Resolve with AI"
              onPress={() =>
                navigation.navigate(routes.resolveConflict, {
                  mergeRequest,
                  repository,
                })
              }
              variant="secondary"
            />
          ) : null}
        </View>

        {highRiskFileGroups.length > 0 ? (
          <HighRiskMergeWarning groups={highRiskFileGroups} />
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Merge method</Text>
          <View style={styles.methodList}>
            {mergeMethods.map((method) => {
              const methodAllowed = isMergeMethodAllowed(mergeRequest, method);

              return (
                <Pressable
                  key={method}
                  accessibilityRole="button"
                  disabled={!methodAllowed}
                  onPress={() => setMergeMethod(method)}
                  style={({ pressed }) => [
                    styles.methodOption,
                    mergeMethod === method && styles.selectedMethodOption,
                    (!methodAllowed || pressed) && styles.pressedButton,
                  ]}
                >
                  <Text
                    style={[
                      styles.methodText,
                      mergeMethod === method && styles.selectedMethodText,
                    ]}
                  >
                    {method}
                  </Text>
                  {!methodAllowed ? (
                    <Text style={styles.methodHint}>Unavailable</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.panelTitle}>Delete source branch</Text>
              <Text style={styles.bodyText}>
                {canDeleteSourceBranch
                  ? `Delete ${mergeRequest.sourceBranch.name} after merge.`
                  : 'Source branch deletion is unavailable for this provider, fork, or protected branch.'}
              </Text>
            </View>
            <Switch
              disabled={!canDeleteSourceBranch || isMerging}
              value={shouldDeleteSourceBranch && canDeleteSourceBranch}
              onValueChange={setShouldDeleteSourceBranch}
            />
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Confirm</Text>
          <Text style={styles.bodyText}>
            Merging changes the target branch. Review the diff and checks before
            confirming.
          </Text>
          <ActionButton
            label={isMerging ? 'Merging' : 'Confirm Merge'}
            disabled={!canSubmitMerge}
            onPress={() =>
              confirmMerge({
                highRiskFileGroups,
                mergeMethod,
                mergeRequest,
                onConfirm: () => mergeMutation.mutate(),
              })
            }
          />
        </View>

        {mergeMutation.data ? (
          <View style={styles.successPanel}>
            <Text style={styles.successTitle}>Merge completed</Text>
            <Text style={styles.successText}>{mergeMutation.data.mergeResult.message}</Text>
            <Text style={styles.successText}>Commit: {mergeMutation.data.mergeResult.sha}</Text>
            <Text style={styles.successText}>
              Source branch deleted: {mergeMutation.data.deletedSourceBranch ? 'yes' : 'no'}
            </Text>
          </View>
        ) : null}

        {mergeMutation.isError ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Merge failed</Text>
            <Text style={styles.errorText}>{getErrorMessage(mergeMutation.error)}</Text>
            {shouldShowResolveConflict ? (
              <ActionButton
                label="Resolve with AI"
                onPress={() =>
                  navigation.navigate(routes.resolveConflict, {
                    mergeRequest,
                    repository,
                  })
                }
                variant="secondary"
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusRow({
  label,
  status,
  value,
}: {
  label: string;
  status: 'blocked' | 'info' | 'ok';
  value: string;
}) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, getStatusDotStyle(status)]} />
      <View style={styles.statusCopy}>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.statusValue}>{value}</Text>
      </View>
    </View>
  );
}

function HighRiskMergeWarning({ groups }: { groups: HighRiskFileGroup[] }) {
  return (
    <View style={styles.warningPanel}>
      <Text style={styles.warningTitle}>High-risk files changed</Text>
      <Text style={styles.warningText}>
        Review these changes carefully before merge. They can affect automation,
        deployment, identity, authorization, billing, dependencies, or secrets.
      </Text>
      {groups.map((group) => (
        <View key={group.id} style={styles.riskGroup}>
          <Text style={styles.riskGroupTitle}>{group.label}</Text>
          <Text style={styles.warningText}>{group.description}</Text>
          {group.files.slice(0, 4).map((file) => (
            <Text key={file} style={styles.warningFile}>
              {file}
            </Text>
          ))}
          {group.files.length > 4 ? (
            <Text style={styles.warningText}>
              {group.files.length - 4} more file(s)
            </Text>
          ) : null}
        </View>
      ))}
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

function assertMergeIsAllowed(mergeRequest: MergeRequest, mergeMethod: MergeMethod) {
  if (mergeRequest.state !== 'open') {
    throw new Error('The pull request is not open.');
  }

  if (hasKnownMergeConflict(mergeRequest)) {
    throw new Error('The pull request has a known merge conflict.');
  }

  if (!isMergeMethodAllowed(mergeRequest, mergeMethod)) {
    throw new Error(`The repository does not allow ${mergeMethod} merges.`);
  }
}

function canDeleteMergeRequestSourceBranch(
  adapter: GitProviderAdapter,
  repository: Repository,
  mergeRequest: MergeRequest,
) {
  return (
    adapter.capabilities.supportsDeleteSourceBranch &&
    Boolean(adapter.deleteBranch) &&
    mergeRequest.sourceBranch.repositoryId === repository.id &&
    mergeRequest.sourceBranch.name !== mergeRequest.targetBranch.name &&
    mergeRequest.sourceBranch.name !== repository.defaultBranch.name
  );
}

function hasKnownMergeConflict(mergeRequest: MergeRequest) {
  return (
    mergeRequest.mergeConflictStatus === 'conflicted' ||
    mergeRequest.mergeConflictStatus === 'unresolved' ||
    mergeRequest.isMergeable === false
  );
}

function isMergeMethodAllowed(mergeRequest: MergeRequest, mergeMethod: MergeMethod) {
  return (
    mergeRequest.allowedMergeMethods.length === 0 ||
    mergeRequest.allowedMergeMethods.includes(mergeMethod)
  );
}

function isConflictLikeError(error: unknown) {
  if (!error) {
    return false;
  }

  const status = typeof error === 'object' && 'status' in error ? error.status : undefined;
  const message = getErrorMessage(error).toLowerCase();

  return (
    status === 409 ||
    message.includes('conflict') ||
    message.includes('mergeable') ||
    message.includes('not merge')
  );
}

function formatConflictStatus(status: MergeConflictStatus) {
  if (status === 'unknown') {
    return 'unknown';
  }

  return status;
}

function confirmMerge({
  highRiskFileGroups,
  mergeMethod,
  mergeRequest,
  onConfirm,
}: {
  highRiskFileGroups: HighRiskFileGroup[];
  mergeMethod: MergeMethod;
  mergeRequest: MergeRequest;
  onConfirm: () => void;
}) {
  if (highRiskFileGroups.length > 0) {
    Alert.alert(
      'High-risk files changed',
      buildHighRiskAlertMessage(highRiskFileGroups),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => confirmFinalMerge(mergeRequest, mergeMethod, onConfirm),
        },
      ],
    );
    return;
  }

  confirmFinalMerge(mergeRequest, mergeMethod, onConfirm);
}

function confirmFinalMerge(
  mergeRequest: MergeRequest,
  mergeMethod: MergeMethod,
  onConfirm: () => void,
) {
  Alert.alert(
    'Final merge confirmation',
    `Merge PR #${mergeRequest.number} with ${mergeMethod}? This updates the target branch.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Merge', style: 'destructive', onPress: onConfirm },
    ],
  );
}

function buildHighRiskAlertMessage(groups: HighRiskFileGroup[]) {
  const labels = groups.map((group) => group.label).join(', ');

  return `This PR changes: ${labels}. Continue only after reviewing the diff and checks.`;
}

function getRiskScanStatus(
  filesQuery: RiskScanQueryState,
  highRiskFileGroups: HighRiskFileGroup[],
): 'blocked' | 'info' | 'ok' {
  if (filesQuery.isError) {
    return 'blocked';
  }

  if (filesQuery.isPending) {
    return 'info';
  }

  return highRiskFileGroups.length > 0 ? 'blocked' : 'ok';
}

function formatRiskScanStatus(
  filesQuery: RiskScanQueryState,
  highRiskFileGroups: HighRiskFileGroup[],
) {
  if (filesQuery.isPending) {
    return 'loading changed files';
  }

  if (filesQuery.isError) {
    return 'unavailable';
  }

  if (highRiskFileGroups.length > 0) {
    return `${highRiskFileGroups.length} risk group(s)`;
  }

  return 'no high-risk files';
}

function toRepositorySelector(repository: Repository) {
  return {
    owner: repository.owner.username,
    name: repository.name,
  };
}

function getStatusDotStyle(status: 'blocked' | 'info' | 'ok') {
  if (status === 'blocked') {
    return styles.blockedDot;
  }

  if (status === 'ok') {
    return styles.okDot;
  }

  return styles.infoDot;
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
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  statusDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  okDot: {
    backgroundColor: '#059669',
  },
  blockedDot: {
    backgroundColor: '#DC2626',
  },
  infoDot: {
    backgroundColor: '#2563EB',
  },
  statusCopy: {
    flex: 1,
    gap: 2,
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
    fontSize: 15,
    fontWeight: '700',
  },
  methodList: {
    gap: 8,
  },
  methodOption: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  selectedMethodOption: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  methodText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '800',
  },
  selectedMethodText: {
    color: '#1D4ED8',
  },
  methodHint: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  toggleCopy: {
    flex: 1,
    gap: 6,
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
    minHeight: 46,
    justifyContent: 'center',
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
  errorPanel: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  warningPanel: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
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
  warningFile: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  riskGroup: {
    gap: 6,
  },
  riskGroupTitle: {
    color: '#78350F',
    fontSize: 14,
    fontWeight: '800',
  },
  errorTitle: {
    color: '#991B1B',
    fontSize: 18,
    fontWeight: '800',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
});
