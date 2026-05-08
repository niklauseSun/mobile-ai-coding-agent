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
import { useAuthStore } from '@/state/auth-store';
import type { Repository } from '@/types';

type RepositoryListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.repositoryList
>;

export function RepositoryListScreen({ navigation }: RepositoryListScreenProps) {
  const adapter = useGitProviderAdapter();
  const hasGitHubAccessToken = useAuthStore((state) => state.hasGitHubAccessToken);
  const canUseProvider = adapter.type === 'mock' || hasGitHubAccessToken;

  const repositoriesQuery = useQuery({
    queryKey: ['repositories', adapter.type],
    queryFn: () => adapter.listRepositories({ perPage: 50 }),
    enabled: canUseProvider,
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Repositories</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!canUseProvider}
            onPress={() => navigation.navigate(routes.newRepository)}
            style={({ pressed }) => [
              styles.newButton,
              (!canUseProvider || pressed) && styles.pressedButton,
            ]}
          >
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>
        </View>

        {!canUseProvider ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>GitHub is not connected</Text>
            <Text style={styles.emptyText}>
              Connect GitHub or switch to Mock in Provider Settings for local
              development without a token.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate(routes.gitAuth)}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>Connect GitHub</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate(routes.gitProviderSettings)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Provider Settings</Text>
            </Pressable>
          </View>
        ) : repositoriesQuery.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#2563EB" />
          </View>
        ) : repositoriesQuery.isError ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>Could not load repositories</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => repositoriesQuery.refetch()}
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
            data={repositoriesQuery.data ?? []}
            keyExtractor={(repository) => repository.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={repositoriesQuery.isRefetching}
                onRefresh={repositoriesQuery.refetch}
              />
            }
            renderItem={({ item }) => (
              <RepositoryRow
                repository={item}
                onPress={() =>
                  navigation.navigate(routes.repositoryDetail, {
                    repository: item,
                  })
                }
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>No repositories found</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function RepositoryRow({
  repository,
  onPress,
}: {
  repository: Repository;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressedRow]}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.repoName}>{repository.fullName}</Text>
        <Text style={styles.visibilityBadge}>{repository.visibility}</Text>
      </View>
      <Text style={styles.repoMeta}>Default branch: {repository.defaultBranch.name}</Text>
      {repository.description ? (
        <Text numberOfLines={2} style={styles.repoDescription}>
          {repository.description}
        </Text>
      ) : null}
    </Pressable>
  );
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
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
  },
  newButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
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
  repoName: {
    color: '#0F172A',
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
  },
  visibilityBadge: {
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
  repoMeta: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  repoDescription: {
    color: '#475569',
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
  emptyText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
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
    opacity: 0.75,
  },
});
