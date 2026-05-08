import { useMutation } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReviewFindingCard } from '@/components/review/ReviewFindingCard';
import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { OpenAICompatibleProvider } from '@/providers/ai';
import { useGitProviderAdapter, type GitProviderAdapter } from '@/providers/git';
import {
  buildSelectedFindingsComment,
  runAiMergeRequestReview,
} from '@/services/ai-review-service';
import { useSettingsStore } from '@/state/settings-store';
import { useTaskStore } from '@/state/task-store';
import type {
  Repository,
  ReviewFinding,
  ReviewFindingSeverity,
} from '@/types';
import { getSecretLikeFiles } from '@/utils/security-guardrails';

type AiReviewScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.aiReview
>;

const severityOrder: ReviewFindingSeverity[] = ['error', 'warning', 'info'];

export function AiReviewScreen({ route }: AiReviewScreenProps) {
  const { mergeRequest, repository } = route.params;
  const gitProvider: GitProviderAdapter = useGitProviderAdapter();
  const addReviewResult = useTaskStore((state) => state.addReviewResult);
  const selectedAiProvider = useSettingsStore((state) => state.selectedAiProvider);
  const aiProviderBaseUrl = useSettingsStore((state) => state.aiProviderBaseUrl);
  const aiProviderModel = useSettingsStore((state) => state.aiProviderModel);
  const getAiProviderApiKey = useSettingsStore((state) => state.getAiProviderApiKey);
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>([]);
  const [reviewMessage, setReviewMessage] = useState('');

  const aiProvider = useMemo(
    () =>
      new OpenAICompatibleProvider({
        baseUrl: aiProviderBaseUrl,
        model: aiProviderModel,
        getApiKey: () => getAiProviderApiKey(selectedAiProvider),
      }),
    [aiProviderBaseUrl, aiProviderModel, getAiProviderApiKey, selectedAiProvider],
  );

  const reviewMutation = useMutation({
    mutationFn: () =>
      runAiMergeRequestReview({
        aiProvider,
        gitProvider,
        mergeRequest,
        repository,
      }),
    onSuccess: ({ reviewResult }) => {
      addReviewResult(reviewResult);
      setSelectedFindingIds(getDefaultSelectedFindingIds(reviewResult.findings));
    },
  });

  const submitCommentMutation = useMutation({
    mutationFn: async () => {
      if (!gitProvider.createMergeRequestComment) {
        throw new Error('This Git provider does not support PR comments yet.');
      }

      const reviewResult = reviewMutation.data?.reviewResult;

      if (!reviewResult || selectedFindingIds.length === 0) {
        throw new Error('Select at least one finding before submitting comments.');
      }

      await gitProvider.createMergeRequestComment(
        toRepositorySelector(repository),
        mergeRequest.number,
        buildSelectedFindingsComment(reviewResult, selectedFindingIds),
      );
    },
    onSuccess: () => {
      Alert.alert('Comment submitted', 'Selected AI findings were added as a PR comment.');
    },
  });

  const approveReviewMutation = useMutation({
    mutationFn: async () => {
      if (!gitProvider.submitReviewApprove) {
        throw new Error('This Git provider does not support approval reviews.');
      }

      await gitProvider.submitReviewApprove(
        toRepositorySelector(repository),
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
      if (!gitProvider.submitReviewRequestChanges) {
        throw new Error('This Git provider does not support request-changes reviews.');
      }

      const message = reviewMessage.trim();

      if (!message) {
        throw new Error('Add a message before requesting changes.');
      }

      await gitProvider.submitReviewRequestChanges(
        toRepositorySelector(repository),
        mergeRequest.number,
        message,
      );
    },
    onSuccess: () => {
      setReviewMessage('');
      Alert.alert('Review submitted', 'Changes were requested.');
    },
  });

  useEffect(() => {
    if (reviewMutation.status === 'idle') {
      reviewMutation.mutate();
    }
  }, [reviewMutation]);

  const reviewResult = reviewMutation.data?.reviewResult;
  const diffFiles = reviewMutation.data?.diffFiles ?? [];
  const groupedFindings = useMemo(
    () => groupFindingsBySeverity(reviewResult?.findings ?? []),
    [reviewResult],
  );
  const secretLikeFiles = getSecretLikeFiles(diffFiles);
  const canSubmitComment =
    gitProvider.capabilities.supportsMergeRequestComments &&
    Boolean(gitProvider.createMergeRequestComment);
  const canSubmitReview =
    gitProvider.capabilities.supportsReviewApproval &&
    Boolean(gitProvider.submitReviewApprove && gitProvider.submitReviewRequestChanges);
  const isReviewSubmitting =
    approveReviewMutation.isPending || requestChangesMutation.isPending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{repository.fullName}</Text>
          <Text style={styles.title}>AI Review</Text>
          <Text numberOfLines={2} style={styles.description}>
            #{mergeRequest.number} {mergeRequest.title}
          </Text>
        </View>

        {reviewMutation.isPending ? (
          <View style={styles.panel}>
            <View style={styles.inlineLoading}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.bodyText}>Loading diff and running AI review...</Text>
            </View>
          </View>
        ) : reviewMutation.isError ? (
          <View style={styles.panel}>
            <Text style={styles.errorText}>{getErrorMessage(reviewMutation.error)}</Text>
            <ActionButton label="Retry AI Review" onPress={() => reviewMutation.mutate()} />
          </View>
        ) : reviewResult ? (
          <>
            {secretLikeFiles.length > 0 ? (
              <SecretLikeFileWarning files={secretLikeFiles} />
            ) : null}

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Summary</Text>
              <Text style={styles.bodyText}>{reviewResult.summary}</Text>
              <MetadataItem label="Risk" value={reviewResult.riskLevel} />
              <MetadataItem label="Recommendation" value={reviewResult.recommendation} />
              <MetadataItem label="Files reviewed" value={String(diffFiles.length)} />
            </View>

            <View style={styles.panel}>
              <View style={styles.findingsHeader}>
                <Text style={styles.panelTitle}>Findings</Text>
                <Text style={styles.selectionCount}>
                  {selectedFindingIds.length} selected
                </Text>
              </View>

              {reviewResult.findings.length === 0 ? (
                <Text style={styles.bodyText}>No findings returned.</Text>
              ) : (
                severityOrder.map((severity) => {
                  const findings = groupedFindings[severity];

                  if (findings.length === 0) {
                    return null;
                  }

                  return (
                    <View key={severity} style={styles.findingGroup}>
                      <Text style={styles.groupTitle}>{severity}</Text>
                      {findings.map((finding) => (
                        <ReviewFindingCard
                          key={finding.id}
                          finding={finding}
                          isSelected={selectedFindingIds.includes(finding.id)}
                          onToggleSelected={() =>
                            setSelectedFindingIds((current) =>
                              toggleFindingId(current, finding.id),
                            )
                          }
                        />
                      ))}
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Submit comments</Text>
              <Text style={styles.bodyText}>
                MVP submits selected findings as one general PR comment. Inline comments can
                be added later per provider.
              </Text>
              {canSubmitComment ? (
                <ActionButton
                  label={
                    submitCommentMutation.isPending
                      ? 'Submitting Comments'
                      : 'Submit Selected Findings'
                  }
                  disabled={
                    selectedFindingIds.length === 0 || submitCommentMutation.isPending
                  }
                  onPress={() => submitCommentMutation.mutate()}
                />
              ) : (
                <Text style={styles.bodyText}>
                  General PR comments are unavailable for this provider or token.
                </Text>
              )}
              {submitCommentMutation.isError ? (
                <Text style={styles.errorText}>
                  {getErrorMessage(submitCommentMutation.error)}
                </Text>
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
                    label={
                      approveReviewMutation.isPending ? 'Approving' : 'Approve PR'
                    }
                    disabled={isReviewSubmitting}
                    onPress={() =>
                      confirmReviewApprove(mergeRequest.number, () =>
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
                    disabled={
                      isReviewSubmitting || reviewMessage.trim().length === 0
                    }
                    onPress={() =>
                      confirmReviewRequestChanges(mergeRequest.number, () =>
                        requestChangesMutation.mutate(),
                      )
                    }
                  />
                </>
              ) : (
                <Text style={styles.bodyText}>
                  Review approval and request-changes actions are unavailable for this
                  provider or token.
                </Text>
              )}
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
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SecretLikeFileWarning({ files }: { files: string[] }) {
  return (
    <View style={styles.warningPanel}>
      <Text style={styles.warningTitle}>Secret-like files changed</Text>
      <Text style={styles.warningText}>
        These files match the app secret denylist. Their patch content is omitted
        from the AI review request, and the final diff still needs human review.
      </Text>
      {files.slice(0, 6).map((file) => (
        <Text key={file} style={styles.warningFile}>
          {file}
        </Text>
      ))}
      {files.length > 6 ? (
        <Text style={styles.warningText}>{files.length - 6} more file(s)</Text>
      ) : null}
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
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        (disabled || pressed) && styles.pressedButton,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function groupFindingsBySeverity(findings: ReviewFinding[]) {
  return findings.reduce<Record<ReviewFindingSeverity, ReviewFinding[]>>(
    (groups, finding) => ({
      ...groups,
      [finding.severity]: [...groups[finding.severity], finding],
    }),
    {
      error: [],
      info: [],
      warning: [],
    },
  );
}

function getDefaultSelectedFindingIds(findings: ReviewFinding[]) {
  return findings
    .filter((finding) => finding.severity === 'error' || finding.severity === 'warning')
    .map((finding) => finding.id);
}

function toggleFindingId(findingIds: string[], findingId: string) {
  if (findingIds.includes(findingId)) {
    return findingIds.filter((existingFindingId) => existingFindingId !== findingId);
  }

  return [...findingIds, findingId];
}

function confirmReviewApprove(mergeRequestNumber: number, onConfirm: () => void) {
  Alert.alert(
    'Approve pull request?',
    `Submit an approval review for #${mergeRequestNumber}.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: onConfirm },
    ],
  );
}

function confirmReviewRequestChanges(
  mergeRequestNumber: number,
  onConfirm: () => void,
) {
  Alert.alert(
    'Request changes?',
    `Submit a request-changes review for #${mergeRequestNumber}.`,
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
  return error instanceof Error ? error.message : 'AI review failed.';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    gap: 16,
    padding: 20,
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
  warningFile: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  panelTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  bodyText: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
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
  findingsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectionCount: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
  },
  findingGroup: {
    gap: 10,
  },
  groupTitle: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
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
  pressedButton: {
    opacity: 0.65,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
});
