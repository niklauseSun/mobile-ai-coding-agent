import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { useGitProviderAdapter } from '@/providers/git';
import { useAuthStore } from '@/state/auth-store';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, typeof routes.home>;

export function HomeScreen({ navigation }: HomeScreenProps) {
  const adapter = useGitProviderAdapter();
  const connectedAccount = useAuthStore((state) => state.connectedAccount);
  const hasGitHubAccessToken = useAuthStore((state) => state.hasGitHubAccessToken);
  const isMockProvider = adapter.type === 'mock';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>No-backend MVP</Text>
          <Text style={styles.title}>Mobile AI Coding Agent</Text>
          <Text style={styles.description}>
            Create repositories, ask AI for code changes, review diffs, and merge from
            mobile. GitHub is the first provider behind provider-neutral app boundaries.
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.statusPanel}>
            <Text style={styles.statusLabel}>Git provider</Text>
            <Text style={styles.statusValue}>{adapter.label}</Text>
            {isMockProvider ? (
              <Text style={styles.statusDetail}>
                Mock repositories, PRs, diffs, workflow runs, and merges are ready.
              </Text>
            ) : connectedAccount ? (
              <Text style={styles.statusDetail}>Connected as {connectedAccount.username}</Text>
            ) : hasGitHubAccessToken ? (
              <Text style={styles.statusDetail}>Token saved. Test connection to load user.</Text>
            ) : (
              <Text style={styles.missingDetail}>Missing GitHub token</Text>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate(routes.startAiCoding)}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>Start AI Coding</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate(routes.repositoryList)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Repositories</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate(routes.gitAuth)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {hasGitHubAccessToken ? 'Manage GitHub Token' : 'Connect GitHub'}
              </Text>
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

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate(routes.aiProviderSettings)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.secondaryButtonText}>AI Settings</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  header: {
    gap: 12,
  },
  eyebrow: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: '#0F172A',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 40,
  },
  description: {
    color: '#475569',
    fontSize: 17,
    lineHeight: 25,
  },
  statusPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  footer: {
    gap: 14,
  },
  statusLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  statusDetail: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 21,
  },
  missingDetail: {
    color: '#B45309',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  actions: {
    gap: 10,
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
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  pressedButton: {
    opacity: 0.75,
  },
});
