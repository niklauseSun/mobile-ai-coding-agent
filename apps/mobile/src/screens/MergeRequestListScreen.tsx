import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { useGitProviderAdapter } from '@/providers/git';
import type { MergeRequest, Repository } from '@/types';

type MergeRequestListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.mergeRequestList
>;

export function MergeRequestListScreen({ navigation, route }: MergeRequestListScreenProps) {
  const adapter = useGitProviderAdapter();
  const { repository } = route.params;

  const mergeRequestsQuery = useQuery({
    queryKey: ['merge-requests', repository.id, 'open'],
    queryFn: () =>
      adapter.listMergeRequests(toRepositorySelector(repository), {
        state: 'open',
        perPage: 50,
      }),
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{repository.fullName}</Text>
          <Text style={styles.title}>Open PR/MR</Text>
        </View>

        {mergeRequestsQuery.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#2563EB" />
          </View>
        ) : mergeRequestsQuery.isError ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>Could not load pull requests</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => mergeRequestsQuery.refetch()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>Refresh</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={mergeRequestsQuery.data ?? []}
            keyExtractor={(mergeRequest) => mergeRequest.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={mergeRequestsQuery.isRefetching}
                onRefresh={mergeRequestsQuery.refetch}
              />
            }
            renderItem={({ item }) => (
              <MergeRequestRow
                mergeRequest={item}
                onPress={() =>
                  navigation.navigate(routes.mergeRequestDetail, {
                    mergeRequest: item,
                    repository,
                  })
                }
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>No open pull requests</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function MergeRequestRow({
  mergeRequest,
  onPress,
}: {
  mergeRequest: MergeRequest;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressedRow]}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>
          #{mergeRequest.number} {mergeRequest.title}
        </Text>
        <Text style={styles.statusBadge}>{getStatusLabel(mergeRequest)}</Text>
      </View>

      <Text style={styles.rowMeta}>
        {mergeRequest.sourceBranch.name} into {mergeRequest.targetBranch.name}
      </Text>
      <Text style={styles.rowMeta}>
        Author: {mergeRequest.author?.username ?? 'unknown'}
      </Text>
    </Pressable>
  );
}

function getStatusLabel(mergeRequest: MergeRequest) {
  if (mergeRequest.isDraft) {
    return 'draft';
  }

  if (mergeRequest.mergeConflictStatus === 'conflicted') {
    return 'conflict';
  }

  return mergeRequest.state;
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
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    gap: 6,
    marginBottom: 12,
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
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  pressedRow: {
    backgroundColor: '#F1F5F9',
  },
  rowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  rowTitle: {
    color: '#0F172A',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  statusBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  rowMeta: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
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
    opacity: 0.75,
  },
});
