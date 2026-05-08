import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { useSettingsStore } from '@/state/settings-store';
import type { AiProviderType } from '@/types';

type AiProviderSettingsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.aiProviderSettings
>;

const supportedProviderTypes: AiProviderType[] = ['openai', 'custom'];

export function AiProviderSettingsScreen(_props: AiProviderSettingsScreenProps) {
  const selectedAiProvider = useSettingsStore((state) => state.selectedAiProvider);
  const aiProviderBaseUrl = useSettingsStore((state) => state.aiProviderBaseUrl);
  const aiProviderModel = useSettingsStore((state) => state.aiProviderModel);
  const hasSelectedAiProviderApiKey = useSettingsStore(
    (state) => state.hasSelectedAiProviderApiKey,
  );
  const setSelectedAiProvider = useSettingsStore((state) => state.setSelectedAiProvider);
  const setAiProviderBaseUrl = useSettingsStore((state) => state.setAiProviderBaseUrl);
  const setAiProviderModel = useSettingsStore((state) => state.setAiProviderModel);
  const setAiProviderApiKey = useSettingsStore((state) => state.setAiProviderApiKey);
  const deleteAiProviderApiKey = useSettingsStore((state) => state.deleteAiProviderApiKey);
  const refreshSelectedAiProviderApiKeyState = useSettingsStore(
    (state) => state.refreshSelectedAiProviderApiKeyState,
  );
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    void refreshSelectedAiProviderApiKeyState();
  }, [refreshSelectedAiProviderApiKeyState, selectedAiProvider]);

  async function saveApiKey() {
    const trimmedApiKey = apiKeyInput.trim();

    if (!trimmedApiKey) {
      setMessage('Paste an API key before saving.');
      return;
    }

    await setAiProviderApiKey(selectedAiProvider, trimmedApiKey);
    setApiKeyInput('');
    setMessage('AI API key saved in secure storage.');
  }

  async function removeApiKey() {
    await deleteAiProviderApiKey(selectedAiProvider);
    setApiKeyInput('');
    setMessage('AI API key removed from secure storage.');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>AI provider</Text>
          <Text style={styles.title}>OpenAI-compatible API</Text>
        </View>

        <View style={styles.warningPanel}>
          <Text style={styles.warningTitle}>Local review only</Text>
          <Text style={styles.warningText}>
            Mobile-stored AI keys should only be used for local diff review. Code
            generation should preferably run in GitHub Actions with repository secrets.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Provider</Text>
          <View style={styles.segmentedControl}>
            {supportedProviderTypes.map((providerType) => (
              <Pressable
                key={providerType}
                accessibilityRole="button"
                onPress={() => {
                  setSelectedAiProvider(providerType);
                  setMessage(undefined);
                }}
                style={[
                  styles.segment,
                  selectedAiProvider === providerType && styles.selectedSegment,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    selectedAiProvider === providerType && styles.selectedSegmentText,
                  ]}
                >
                  {providerType === 'openai' ? 'OpenAI' : 'Custom'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Base URL</Text>
          <TextInput
            value={aiProviderBaseUrl}
            onChangeText={setAiProviderBaseUrl}
            placeholder="https://api.openai.com/v1"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Model</Text>
          <TextInput
            value={aiProviderModel}
            onChangeText={setAiProviderModel}
            placeholder="gpt-4.1"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>API key</Text>
          <Text style={hasSelectedAiProviderApiKey ? styles.value : styles.missingValue}>
            {hasSelectedAiProviderApiKey
              ? 'Saved in secure storage, value hidden'
              : 'Missing API key'}
          </Text>
          <TextInput
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            placeholder="sk-..."
            placeholderTextColor="#94A3B8"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            style={styles.input}
          />

          <Pressable
            accessibilityRole="button"
            onPress={saveApiKey}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedButton]}
          >
            <Text style={styles.primaryButtonText}>Save API Key</Text>
          </Pressable>

          {hasSelectedAiProviderApiKey ? (
            <Pressable
              accessibilityRole="button"
              onPress={removeApiKey}
              style={({ pressed }) => [styles.dangerButton, pressed && styles.pressedButton]}
            >
              <Text style={styles.dangerButtonText}>Remove API Key</Text>
            </Pressable>
          ) : null}
        </View>

        {message ? <Text style={styles.messageText}>{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
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
  warningPanel: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  warningTitle: {
    color: '#92400E',
    fontSize: 16,
    fontWeight: '800',
  },
  warningText: {
    color: '#92400E',
    fontSize: 14,
    lineHeight: 20,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
  value: {
    color: '#047857',
    fontSize: 15,
    fontWeight: '700',
  },
  missingValue: {
    color: '#B45309',
    fontSize: 15,
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
  messageText: {
    color: '#047857',
    fontSize: 14,
    lineHeight: 20,
  },
});
