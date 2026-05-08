import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiffFileList } from '@/components/diff';
import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { useGitProviderAdapter } from '@/providers/git';
import type { DiffFile, Repository } from '@/types';
import { getSecretLikeFiles } from '@/utils/security-guardrails';

type MergeRequestDiffScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.mergeRequestDiff
>;

export function MergeRequestDiffScreen({ route }: MergeRequestDiffScreenProps) {
  const adapter = useGitProviderAdapter();
  const { mergeRequest, repository } = route.params;

  const filesQuery = useQuery({
    queryKey: ['merge-request-files', repository.id, mergeRequest.number],
    queryFn: () =>
      adapter.listMergeRequestFiles(
        toRepositorySelector(repository),
        mergeRequest.number,
      ),
  });

  const fileSummary = summarizeFiles(filesQuery.data ?? []);
  const secretLikeFiles = getSecretLikeFiles(filesQuery.data ?? []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={filesQuery.isRefetching}
            onRefresh={filesQuery.refetch}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{repository.fullName}</Text>
          <Text style={styles.title}>PR #{mergeRequest.number} Diff</Text>
          <Text numberOfLines={2} style={styles.description}>
            {mergeRequest.title}
          </Text>
        </View>

        <View style={styles.summaryPanel}>
          <SummaryItem label="Files" value={String(fileSummary.fileCount)} />
          <SummaryItem label="Additions" value={`+${fileSummary.additions}`} tone="added" />
          <SummaryItem label="Deletions" value={`-${fileSummary.deletions}`} tone="removed" />
        </View>

        {secretLikeFiles.length > 0 ? (
          <SecretLikeFileWarning files={secretLikeFiles} />
        ) : null}

        {filesQuery.isPending ? (
          <View style={styles.centeredPanel}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.bodyText}>Loading changed files...</Text>
          </View>
        ) : filesQuery.isError ? (
          <View style={styles.centeredPanel}>
            <Text style={styles.errorText}>Could not load changed files.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => filesQuery.refetch()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <DiffFileList files={filesQuery.data ?? []} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SecretLikeFileWarning({ files }: { files: string[] }) {
  return (
    <View style={styles.warningPanel}>
      <Text style={styles.warningTitle}>Secret-like files changed</Text>
      <Text style={styles.warningText}>
        Review these files carefully. They match the app secret denylist and may
        contain credentials or private keys.
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

function SummaryItem({
  label,
  tone = 'default',
  value,
}: {
  label: string;
  tone?: 'added' | 'default' | 'removed';
  value: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, getSummaryToneStyle(tone)]}>{value}</Text>
    </View>
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

function getSummaryToneStyle(tone: 'added' | 'default' | 'removed') {
  if (tone === 'added') {
    return styles.addedSummary;
  }

  if (tone === 'removed') {
    return styles.removedSummary;
  }

  return styles.defaultSummary;
}

function toRepositorySelector(repository: Repository) {
  return {
    owner: repository.owner.username,
    name: repository.name,
  };
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
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 34,
  },
  description: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  summaryPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  summaryItem: {
    flex: 1,
    gap: 4,
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  defaultSummary: {
    color: '#0F172A',
  },
  addedSummary: {
    color: '#047857',
  },
  removedSummary: {
    color: '#B91C1C',
  },
  centeredPanel: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 18,
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
  bodyText: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
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
