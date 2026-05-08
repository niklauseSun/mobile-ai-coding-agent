import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import type { DiffFile, Repository } from '@/types';

type MergeRequestReviewScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.mergeRequestReview
>;

export function MergeRequestReviewScreen({ route }: MergeRequestReviewScreenProps) {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{repository.fullName}</Text>
          <Text style={styles.title}>PR #{mergeRequest.number}</Text>
          <Text style={styles.description}>{mergeRequest.title}</Text>
        </View>

        <View style={styles.panel}>
          <MetadataItem label="State" value={mergeRequest.state} />
          <MetadataItem
            label="Branches"
            value={`${mergeRequest.sourceBranch.name} into ${mergeRequest.targetBranch.name}`}
          />
          <MetadataItem
            label="Mergeability"
            value={mergeRequest.mergeConflictStatus}
          />

          {mergeRequest.webUrl ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL(mergeRequest.webUrl as string)}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>Open Pull Request</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Changed files</Text>
          {filesQuery.isPending ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.bodyText}>Loading files...</Text>
            </View>
          ) : filesQuery.isError ? (
            <Text style={styles.errorText}>Could not load pull request files.</Text>
          ) : filesQuery.data?.length ? (
            <View style={styles.fileList}>
              {filesQuery.data.map((file) => (
                <FileRow key={file.path} file={file} />
              ))}
            </View>
          ) : (
            <Text style={styles.bodyText}>No changed files were returned.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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

function FileRow({ file }: { file: DiffFile }) {
  return (
    <View style={styles.fileRow}>
      <Text style={styles.filePath}>{file.path}</Text>
      <View style={styles.fileMeta}>
        <Text style={styles.fileStatus}>{file.status}</Text>
        <Text style={styles.additions}>+{file.additions}</Text>
        <Text style={styles.deletions}>-{file.deletions}</Text>
      </View>
    </View>
  );
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
  },
  description: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 23,
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
  fileList: {
    gap: 8,
  },
  fileRow: {
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  filePath: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  fileMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  fileStatus: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  additions: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '800',
  },
  deletions: {
    color: '#B91C1C',
    fontSize: 13,
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
