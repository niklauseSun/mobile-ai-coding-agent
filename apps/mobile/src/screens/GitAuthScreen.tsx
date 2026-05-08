import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  GitHubDeviceFlowError,
  type GitHubDeviceCodeResponse,
  pollGitHubDeviceAccessToken,
  requestGitHubDeviceCode,
} from '@/api/github/oauth';
import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { GitHubProviderAdapter } from '@/providers/git';
import { useAuthStore } from '@/state/auth-store';

type GitAuthScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.gitAuth
>;

const githubOAuthClientId = process.env.EXPO_PUBLIC_GITHUB_OAUTH_CLIENT_ID;
const githubOAuthScope = 'repo workflow read:user';

export function GitAuthScreen({ navigation }: GitAuthScreenProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [deviceCode, setDeviceCode] = useState<GitHubDeviceCodeResponse | undefined>();
  const [isStartingDeviceFlow, setIsStartingDeviceFlow] = useState(false);
  const [isPollingDeviceFlow, setIsPollingDeviceFlow] = useState(false);
  const [isTestingPat, setIsTestingPat] = useState(false);
  const [isPatExpanded, setIsPatExpanded] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const cancelDevicePollingRef = useRef(false);

  const connectedAccount = useAuthStore((state) => state.connectedAccount);
  const hasGitHubAccessToken = useAuthStore((state) => state.hasGitHubAccessToken);
  const setGitHubAccessToken = useAuthStore((state) => state.setGitHubAccessToken);
  const getGitHubAccessToken = useAuthStore((state) => state.getGitHubAccessToken);
  const setConnectedAccount = useAuthStore((state) => state.setConnectedAccount);
  const refreshGitHubAccessTokenState = useAuthStore(
    (state) => state.refreshGitHubAccessTokenState,
  );
  const signOut = useAuthStore((state) => state.signOut);

  const savedTokenAdapter = useMemo(
    () =>
      new GitHubProviderAdapter({
        getToken: getGitHubAccessToken,
      }),
    [getGitHubAccessToken],
  );

  useEffect(() => {
    void refreshGitHubAccessTokenState();

    return () => {
      cancelDevicePollingRef.current = true;
    };
  }, [refreshGitHubAccessTokenState]);

  const saveVerifiedToken = useCallback(
    async (accessToken: string) => {
      const adapter = new GitHubProviderAdapter({
        getToken: async () => accessToken,
      });
      const account = await adapter.getCurrentUser();

      await setGitHubAccessToken(accessToken);
      setConnectedAccount(account);
      return account;
    },
    [setConnectedAccount, setGitHubAccessToken],
  );

  const pollDeviceFlowUntilAuthorized = useCallback(
    async (code: GitHubDeviceCodeResponse) => {
      if (!githubOAuthClientId) {
        setErrorMessage('GitHub OAuth Device Flow is not configured.');
        return;
      }

      setIsPollingDeviceFlow(true);
      cancelDevicePollingRef.current = false;
      let nextInterval = code.interval;
      const expiresAt = Date.now() + code.expiresIn * 1000;

      try {
        while (!cancelDevicePollingRef.current && Date.now() < expiresAt) {
          await wait(nextInterval * 1000);

          if (cancelDevicePollingRef.current) {
            return;
          }

          const result = await pollGitHubDeviceAccessToken({
            clientId: githubOAuthClientId,
            deviceCode: code.deviceCode,
            interval: nextInterval,
          });

          if (result.status === 'authorized') {
            const account = await saveVerifiedToken(result.token.accessToken);
            setDeviceCode(undefined);
            setMessage(`Connected as ${account.username}.`);
            setErrorMessage(undefined);
            return;
          }

          nextInterval = result.interval;
          setMessage('Waiting for GitHub authorization...');
        }

        if (!cancelDevicePollingRef.current) {
          setErrorMessage('The GitHub authorization code expired. Start a new sign-in.');
        }
      } catch (error) {
        setErrorMessage(getDeviceFlowErrorMessage(error));
      } finally {
        setIsPollingDeviceFlow(false);
      }
    },
    [saveVerifiedToken],
  );

  const startDeviceFlow = useCallback(async () => {
    if (!githubOAuthClientId) {
      setMessage(undefined);
      setErrorMessage(
        'Set EXPO_PUBLIC_GITHUB_OAUTH_CLIENT_ID to enable GitHub Device Flow.',
      );
      return;
    }

    setIsStartingDeviceFlow(true);
    setMessage(undefined);
    setErrorMessage(undefined);

    try {
      const code = await requestGitHubDeviceCode({
        clientId: githubOAuthClientId,
        scope: githubOAuthScope,
      });

      setDeviceCode(code);
      setMessage('Enter the code on GitHub, then leave this screen open.');
      void Linking.openURL(code.verificationUri);
      void pollDeviceFlowUntilAuthorized(code);
    } catch {
      setErrorMessage('Unable to start GitHub Device Flow.');
    } finally {
      setIsStartingDeviceFlow(false);
    }
  }, [pollDeviceFlowUntilAuthorized]);

  const testPatToken = useCallback(async () => {
    const trimmedToken = tokenInput.trim();
    const shouldTestNewToken = trimmedToken.length > 0;

    if (!shouldTestNewToken && !hasGitHubAccessToken) {
      setMessage(undefined);
      setErrorMessage('Paste a GitHub token before testing the connection.');
      return;
    }

    setIsTestingPat(true);
    setMessage(undefined);
    setErrorMessage(undefined);

    try {
      if (shouldTestNewToken) {
        const account = await saveVerifiedToken(trimmedToken);
        setTokenInput('');
        setMessage(`Connected as ${account.username}.`);
        return;
      }

      const account = await savedTokenAdapter.getCurrentUser();
      setConnectedAccount(account);
      setMessage(`Connected as ${account.username}.`);
    } catch {
      setErrorMessage('GitHub rejected the token. Check its value and permissions.');
    } finally {
      setIsTestingPat(false);
    }
  }, [
    hasGitHubAccessToken,
    saveVerifiedToken,
    savedTokenAdapter,
    setConnectedAccount,
    tokenInput,
  ]);

  const disconnect = useCallback(async () => {
    cancelDevicePollingRef.current = true;
    await signOut();
    setDeviceCode(undefined);
    setTokenInput('');
    setMessage('GitHub token removed from secure storage.');
    setErrorMessage(undefined);
  }, [signOut]);

  const isDeviceFlowConfigured = Boolean(githubOAuthClientId);
  const isBusy = isStartingDeviceFlow || isPollingDeviceFlow;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Git provider</Text>
          <Text style={styles.title}>Connect GitHub</Text>
          <Text style={styles.description}>
            Sign in with GitHub Device Flow. No backend or client secret is used.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.statusLabel}>Connection</Text>
          {connectedAccount ? (
            <Text style={styles.statusValue}>Connected as {connectedAccount.username}</Text>
          ) : hasGitHubAccessToken ? (
            <Text style={styles.statusValue}>Token saved. Test it to load the user.</Text>
          ) : (
            <Text style={styles.missingValue}>Missing GitHub token</Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>GitHub Device Flow</Text>
          <Text style={styles.bodyText}>
            Start sign-in, enter the code on GitHub, and this app will finish once
            authorization succeeds.
          </Text>

          {!isDeviceFlowConfigured ? (
            <Text style={styles.errorText}>
              Device Flow needs EXPO_PUBLIC_GITHUB_OAUTH_CLIENT_ID.
            </Text>
          ) : null}

          {deviceCode ? (
            <View style={styles.codePanel}>
              <Text style={styles.codeLabel}>Code</Text>
              <Text selectable style={styles.userCode}>
                {deviceCode.userCode}
              </Text>
              <Text selectable style={styles.verificationUrl}>
                {deviceCode.verificationUri}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={startDeviceFlow}
            disabled={!isDeviceFlowConfigured || isBusy}
            style={({ pressed }) => [
              styles.primaryButton,
              (!isDeviceFlowConfigured || isBusy || pressed) && styles.pressedButton,
            ]}
          >
            {isBusy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign in with GitHub</Text>
            )}
          </Pressable>

          {deviceCode ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL(deviceCode.verificationUri)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Open GitHub Code Page</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.panel}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsPatExpanded((current) => !current)}
            style={({ pressed }) => [styles.inlineButton, pressed && styles.pressedButton]}
          >
            <Text style={styles.inlineButtonText}>
              {isPatExpanded ? 'Hide Advanced PAT Login' : 'Advanced: Use PAT'}
            </Text>
          </Pressable>

          {isPatExpanded ? (
            <View style={styles.form}>
              <Text style={styles.inputLabel}>Personal access token</Text>
              <TextInput
                value={tokenInput}
                onChangeText={setTokenInput}
                placeholder="github_pat_..."
                placeholderTextColor="#94A3B8"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                style={styles.input}
              />

              <Pressable
                accessibilityRole="button"
                onPress={testPatToken}
                disabled={isTestingPat}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (pressed || isTestingPat) && styles.pressedButton,
                ]}
              >
                {isTestingPat ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.secondaryButtonText}>
                    {tokenInput.trim() ? 'Test and Save Token' : 'Test Saved Token'}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {message ? <Text style={styles.successText}>{message}</Text> : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate(routes.gitProviderSettings)}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedButton]}
        >
          <Text style={styles.secondaryButtonText}>Provider Settings</Text>
        </Pressable>

        {hasGitHubAccessToken ? (
          <Pressable
            accessibilityRole="button"
            onPress={disconnect}
            style={({ pressed }) => [styles.dangerButton, pressed && styles.pressedButton]}
          >
            <Text style={styles.dangerButtonText}>Remove Token</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function getDeviceFlowErrorMessage(error: unknown) {
  if (error instanceof GitHubDeviceFlowError) {
    if (error.code === 'access_denied') {
      return 'GitHub authorization was cancelled.';
    }

    if (error.code === 'expired_token') {
      return 'The GitHub authorization code expired. Start a new sign-in.';
    }

    if (error.code === 'device_flow_disabled') {
      return 'Device Flow is disabled for this GitHub OAuth app.';
    }

    if (error.code === 'incorrect_client_credentials') {
      return 'The configured GitHub OAuth client ID is invalid.';
    }
  }

  return 'GitHub Device Flow could not complete.';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    gap: 20,
    padding: 24,
  },
  header: {
    gap: 10,
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
  description: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
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
    fontSize: 17,
    fontWeight: '700',
  },
  missingValue: {
    color: '#B45309',
    fontSize: 17,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
  },
  bodyText: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  codePanel: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  codeLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  userCode: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  verificationUrl: {
    color: '#2563EB',
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    gap: 12,
  },
  inputLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0F172A',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
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
  inlineButton: {
    alignItems: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
  },
  inlineButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '800',
  },
  dangerButton: {
    alignItems: 'center',
    borderColor: '#FCA5A5',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dangerButtonText: {
    color: '#B91C1C',
    fontSize: 16,
    fontWeight: '800',
  },
  pressedButton: {
    opacity: 0.75,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
  successText: {
    color: '#047857',
    fontSize: 14,
    lineHeight: 20,
  },
});

