import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { useAuthStore } from '@/state/auth-store';
import { useSettingsStore } from '@/state/settings-store';
import type { GitProviderType } from '@/types';

type GitProviderSettingsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.gitProviderSettings
>;

const developerProviderOptions: {
  description: string;
  label: string;
  type: Extract<GitProviderType, 'github' | 'mock'>;
}[] = [
  {
    description: 'Use a saved token and real GitHub API calls.',
    label: 'GitHub',
    type: 'github',
  },
  {
    description: 'Use local mock data with no token.',
    label: 'Mock',
    type: 'mock',
  },
];

export function GitProviderSettingsScreen({
  navigation,
}: GitProviderSettingsScreenProps) {
  const connectedAccount = useAuthStore((state) => state.connectedAccount);
  const hasGitHubAccessToken = useAuthStore((state) => state.hasGitHubAccessToken);
  const refreshGitHubAccessTokenState = useAuthStore(
    (state) => state.refreshGitHubAccessTokenState,
  );
  const selectedGitProvider = useSettingsStore((state) => state.selectedGitProvider);
  const setSelectedGitProvider = useSettingsStore(
    (state) => state.setSelectedGitProvider,
  );
  const isMockProvider = selectedGitProvider === 'mock';

  useEffect(() => {
    void refreshGitHubAccessTokenState();
  }, [refreshGitHubAccessTokenState]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Provider settings</Text>
          <Text style={styles.title}>Git connection</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>Developer provider</Text>
          <View style={styles.segmentedControl}>
            {developerProviderOptions.map((option) => {
              const isSelected = selectedGitProvider === option.type;

              return (
                <Pressable
                  key={option.type}
                  accessibilityRole="button"
                  onPress={() => setSelectedGitProvider(option.type)}
                  style={({ pressed }) => [
                    styles.segment,
                    isSelected && styles.selectedSegment,
                    pressed && styles.pressedButton,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      isSelected && styles.selectedSegmentText,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helpText}>
            {
              developerProviderOptions.find(
                (option) => option.type === selectedGitProvider,
              )?.description
            }
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>{isMockProvider ? 'Mock mode' : 'GitHub token'}</Text>
          {isMockProvider ? (
            <>
              <Text style={styles.value}>Local mock data enabled</Text>
              <Text style={styles.helpText}>
                Repositories, issues, pull requests, diffs, workflow runs, merge
                success, and merge conflicts are simulated in memory.
              </Text>
            </>
          ) : connectedAccount ? (
            <Text style={styles.value}>Connected as {connectedAccount.username}</Text>
          ) : hasGitHubAccessToken ? (
            <Text style={styles.value}>Saved in secure storage, value hidden</Text>
          ) : (
            <Text style={styles.missingValue}>Missing token</Text>
          )}
        </View>

        {!isMockProvider ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate(routes.gitAuth)}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {hasGitHubAccessToken ? 'Manage GitHub Token' : 'Connect GitHub'}
            </Text>
          </Pressable>
        ) : null}
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
    gap: 16,
    padding: 24,
  },
  header: {
    gap: 8,
    marginBottom: 8,
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
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 38,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  label: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  value: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700',
  },
  helpText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  missingValue: {
    color: '#B45309',
    fontSize: 17,
    fontWeight: '700',
  },
  segmentedControl: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  selectedSegment: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '800',
  },
  selectedSegmentText: {
    color: '#0F172A',
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
    opacity: 0.75,
  },
});
