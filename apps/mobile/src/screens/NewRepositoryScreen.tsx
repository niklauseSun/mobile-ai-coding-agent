import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { useGitProviderAdapter } from '@/providers/git';
import type { RepositoryVisibility } from '@/types';

type NewRepositoryScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.newRepository
>;

type RepositoryTemplate = 'blank' | 'react-native-expo' | 'node-api' | 'web-app';

const repositoryTemplates: RepositoryTemplate[] = [
  'blank',
  'react-native-expo',
  'node-api',
  'web-app',
];

export function NewRepositoryScreen({ navigation }: NewRepositoryScreenProps) {
  const adapter = useGitProviderAdapter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<RepositoryVisibility>('private');
  const [template, setTemplate] = useState<RepositoryTemplate>('blank');

  const createRepositoryMutation = useMutation({
    mutationFn: () =>
      adapter.createRepository({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        autoInit: true,
      }),
    onSuccess: async (repository) => {
      await queryClient.invalidateQueries({ queryKey: ['repositories', adapter.type] });
      navigation.replace(routes.repositoryDetail, { repository });
    },
  });

  const canSubmit = name.trim().length > 0 && !createRepositoryMutation.isPending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>New Repository</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Repository name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="mobile-agent-demo"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional"
              placeholderTextColor="#94A3B8"
              multiline
              style={[styles.input, styles.textArea]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Visibility</Text>
            <View style={styles.segmentedControl}>
              {(['private', 'public'] satisfies RepositoryVisibility[]).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  onPress={() => setVisibility(option)}
                  style={[
                    styles.segment,
                    visibility === option && styles.selectedSegment,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      visibility === option && styles.selectedSegmentText,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Template</Text>
            <View style={styles.templateGrid}>
              {repositoryTemplates.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  onPress={() => setTemplate(option)}
                  style={[
                    styles.templateOption,
                    template === option && styles.selectedTemplate,
                  ]}
                >
                  <Text
                    style={[
                      styles.templateText,
                      template === option && styles.selectedTemplateText,
                    ]}
                  >
                    {formatTemplateLabel(option)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {createRepositoryMutation.isError ? (
            <Text style={styles.errorText}>Repository creation failed.</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() => createRepositoryMutation.mutate()}
            style={({ pressed }) => [
              styles.primaryButton,
              (!canSubmit || pressed) && styles.pressedButton,
            ]}
          >
            {createRepositoryMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Repository</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatTemplateLabel(template: RepositoryTemplate) {
  return template
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
    gap: 8,
  },
  title: {
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0,
  },
  form: {
    gap: 18,
  },
  field: {
    gap: 8,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
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
  textArea: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: 'top',
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
    textTransform: 'capitalize',
  },
  selectedSegmentText: {
    color: '#0F172A',
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateOption: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  selectedTemplate: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  templateText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  selectedTemplateText: {
    color: '#1D4ED8',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pressedButton: {
    opacity: 0.7,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
});

