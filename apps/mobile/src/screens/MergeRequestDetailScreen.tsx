import { useMutation, useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConflictStatusCard } from '@/components/merge';
import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { useGitProviderAdapter, type GitProviderAdapter } from '@/providers/git';
import type {
  CheckRunSummary,
  DiffFile,
  MergeRequest,
  Repository,
} from '@/types';

type MergeRequestDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.mergeRequestDetail
>;

export function MergeRequestDetailScreen({
  navigation,
  route,
}: MergeRequestDetailScreenProps) {
  const adapter: GitProviderAdapter = useGitProviderAdapter();
  const { mergeRequest: initialMergeRequest, repository } = route.params;
  const [reviewMessage, setReviewMessage] = useState('');

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

  const checksQuery = useQuery({
    queryKey: ['merge-request-checks', repository.id, mergeRequest.number, mergeRequest.sourceBranch.sha],
    queryFn: () => {
      if (!adapter.getMergeRequestChecks) {
        return Promise.resolve<CheckRunSummary | null>(null);
      }

      return adapter.getMergeRequestChecks(repositorySelector, mergeRequest);
    },
  });

  const approveReviewMutation = useMutation({
    mutationFn: async () => {
      if (!adapter.submitReviewApprove) {
        throw new Error('This Git provider does not support approval reviews.');
      }

      await adapter.submitReviewApprove(
        repositorySelector,
        mergeRequest.number,
        reviewMessage.trim() || undefined,
      );
    },
    onSuccess: () => {
      setReviewMessage('');
      Alert.alert('Review submitted', 'The pull request was approved.');
    },
  });

  const requestChangesMutation = useMutation({
    mutationFn: async () => {
      if (!adapter.submitReviewRequestChanges) {
        throw new Error('This Git provider does not support request-changes reviews.');
      }

      const message = reviewMessage.trim();

      if (!message) {
        throw new Error('Add a message before requesting changes.');
      }

      await adapter.submitReviewRequestChanges(
        repositorySelector,
        mergeRequest.number,
        message,
      );
    },
    onSuccess: () => {
      setReviewMessage('');
      Alert.alert('Review submitted', 'Changes were requested.');
    },
  });

  const fileSummary = summarizeFiles(filesQuery.data ?? []);
  const canMerge =
    mergeRequest.state === 'open' &&
    !mergeRequest.isDraft &&
    mergeRequest.mergeConflictStatus !== 'conflicted' &&
    mergeRequest.mergeConflictStatus !== 'unresolved' &&
    mergeRequest.isMergeable !== false;
  const canSubmitReview =
    mergeRequest.state === 'open' &&
    adapter.capabilities.supportsReviewApproval &&
    Boolean(adapter.submitReviewApprove && adapter.submitReviewRequestChanges);
  const isReviewSubmitting =
    approveReviewMutation.isPending || requestChangesMutation.isPending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{repository.fullName}</Text>
          <Text style={styles.title}>#{mergeRequest.number} {mergeRequest.title}</Text>
          {mergeRequest.body ? (
            <Text style={styles.body}>{mergeRequest.body}</Text>
          ) : (
            <Text style={styles.emptyBody}>No description provided.</Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Overview</Text>
          <MetadataItem
            label="Branches"
            value={`${mergeRequest.sourceBranch.name} into ${mergeRequest.targetBranch.name}`}
          />
          <MetadataItem label="Author" value={mergeRequest.author?.username ?? 'unknown'} />
          <MetadataItem label="State" value={mergeRequest.state} />
          <MetadataItem
            label="Mergeability"
            value={formatMergeability(mergeRequest)}
          />
        </View>

        <ConflictStatusCard
          isRefreshing={mergeRequestQuery.isFetching}
          mergeRequest={mergeRequest}
          onRefresh={() => mergeRequestQuery.refetch()}
          onResolveWithAi={
            adapter.capabilities.supportsWorkflowDispatch
              ? () =>
                  navigation.navigate(routes.resolveConflict, {
                    mergeRequest,
                    repository,
                  })
              : undefined
          }
          providerSupportsConflictStatus={adapter.capabilities.supportsConflictStatus}
        />

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Changes</Text>
          <MetadataItem
            label="Files"
            value={
              filesQuery.isPending
                ? 'loading'
                : filesQuery.isError
                  ? 'unavailable'
                  : String(fileSummary.fileCount)
            }
          />
          <MetadataItem
            label="Additions / Deletions"
            value={`+${fileSummary.additions} / -${fileSummary.deletions}`}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Checks</Text>
          {checksQuery.isPending ? (
            <Text style={styles.bodyText}>Loading checks...</Text>
          ) : checksQuery.isError || !checksQuery.data ? (
            <Text style={styles.bodyText}>Checks unavailable.</Text>
          ) : (
            <ChecksSummary summary={checksQuery.data} />
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Actions</Text>
          <ActionButton
            label="Review Diff"
            onPress={() =>
              navigation.navigate(routes.mergeRequestDiff, {
                mergeRequest,
                repository,
              })
            }
          />
          <ActionButton
            label="AI Review"
            disabled={filesQuery.isPending}
            onPress={() =>
              navigation.navigate(routes.aiReview, {
                mergeRequest,
                repository,
              })
            }
            variant="secondary"
          />
          <ActionButton
            label="Merge"
            disabled={!canMerge}
            onPress={() =>
              navigation.navigate(routes.mergeConfirm, {
                mergeRequest,
                repository,
              })
            }
          />
          {mergeRequest.webUrl ? (
            <ActionButton
              label="Open in GitHub"
              onPress={() => Linking.openURL(mergeRequest.webUrl as string)}
              variant="secondary"
            />
          ) : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Review decision</Text>
          {canSubmitReview ? (
            <>
              <TextInput
                value={reviewMessage}
                onChangeText={setReviewMessage}
                placeholder="Optional approval note, or required request-changes message"
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.textArea]}
              />
              <ActionButton
                label={approveReviewMutation.isPending ? 'Approving' : 'Approve PR'}
                disabled={isReviewSubmitting}
                onPress={() =>
                  confirmReviewApprove(mergeRequest, () =>
                    approveReviewMutation.mutate(),
                  )
                }
              />
              <ActionButton
                label={
                  requestChangesMutation.isPending
                    ? 'Requesting Changes'
                    : 'Request Changes'
                }
                disabled={isReviewSubmitting || reviewMessage.trim().length === 0}
                onPress={() =>
                  confirmReviewRequestChanges(mergeRequest, () =>
                    requestChangesMutation.mutate(),
                  )
                }
                variant="secondary"
              />
            </>
          ) : (
            <Text style={styles.bodyText}>
              Review approval and request-changes actions are unavailable for this
              provider or token.
            </Text>
          )}
        </View>

        {approveReviewMutation.isError ? (
          <Text style={styles.errorText}>
            {getErrorMessage(approveReviewMutation.error)}
          </Text>
        ) : null}
        {requestChangesMutation.isError ? (
          <Text style={styles.errorText}>
            {getErrorMessage(requestChangesMutation.error)}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChecksSummary({ summary }: { summary: CheckRunSummary }) {
  return (
    <View style={styles.checkGrid}>
      <MetadataItem label="Status" value={summary.status} />
      <MetadataItem label="Total" value={String(summary.totalCount)} />
      <MetadataItem
        label="Breakdown"
        value={`${summary.succeededCount} passed, ${summary.failedCount} failed, ${summary.inProgressCount} running`}
      />
    </View>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metadataItem}>
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

function formatMergeability(mergeRequest: MergeRequest) {
  if (mergeRequest.mergeConflictStatus === 'conflicted') {
    return 'conflicted';
  }

  if (mergeRequest.isMergeable === true) {
    return 'mergeable';
  }

  if (mergeRequest.isMergeable === false) {
    return 'not mergeable';
  }

  return mergeRequest.mergeConflictStatus;
}

function confirmReviewApprove(mergeRequest: MergeRequest, onConfirm: () => void) {
  Alert.alert(
    'Approve pull request?',
    `Submit an approval review for #${mergeRequest.number}.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: onConfirm },
    ],
  );
}

function confirmReviewRequestChanges(
  mergeRequest: MergeRequest,
  onConfirm: () => void,
) {
  Alert.alert(
    'Request changes?',
    `Submit a request-changes review for #${mergeRequest.number}.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Request Changes', style: 'destructive', onPress: onConfirm },
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
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 34,
  },
  body: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  emptyBody: {
    color: '#64748B',
    fontSize: 15,
    fontStyle: 'italic',
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
  metadataItem: {
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
  checkGrid: {
    gap: 10,
  },
  bodyText: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0F172A',
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  textArea: {
    minHeight: 96,
    paddingTop: 12,
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
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
});
