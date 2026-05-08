import { useMutation, useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
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
import { useAuthStore } from '@/state/auth-store';
import { useTaskStore } from '@/state/task-store';
import type { AiCodingTask, Repository } from '@/types';
import {
  createAutoBranchName,
  createBranchSeed,
  isValidBranchName,
} from '@/utils/branch-name';

type StartAiCodingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.startAiCoding
>;

type TechStackOption = {
  id: string;
  label: string;
};

const aiCodingWorkflowId = 'mobile-ai-coding.yml';

const techStackOptions: TechStackOption[] = [
  { id: 'react-native-expo', label: 'Expo' },
  { id: 'web-app', label: 'Web' },
  { id: 'node-api', label: 'Node API' },
  { id: 'docs', label: 'Docs' },
  { id: 'general', label: 'General' },
];

export function StartAiCodingScreen({ navigation, route }: StartAiCodingScreenProps) {
  const adapter = useGitProviderAdapter();
  const hasGitHubAccessToken = useAuthStore((state) => state.hasGitHubAccessToken);
  const canUseProvider = adapter.type === 'mock' || hasGitHubAccessToken;
  const upsertTask = useTaskStore((state) => state.upsertTask);
  const setActiveTaskId = useTaskStore((state) => state.setActiveTaskId);
  const updateTaskStatus = useTaskStore((state) => state.updateTaskStatus);

  const [selectedRepository, setSelectedRepository] = useState<Repository | undefined>(
    route.params?.repository,
  );
  const [baseBranch, setBaseBranch] = useState(
    route.params?.repository?.defaultBranch.name ?? '',
  );
  const [issueNumber, setIssueNumber] = useState('');
  const [taskPrompt, setTaskPrompt] = useState('');
  const [branchName, setBranchName] = useState('');
  const [techStack, setTechStack] = useState<TechStackOption['id']>('react-native-expo');
  const [branchSeed] = useState(() => createBranchSeed());

  const repositoriesQuery = useQuery({
    queryKey: ['repositories', adapter.type],
    queryFn: () => adapter.listRepositories({ perPage: 50 }),
    enabled: canUseProvider,
  });

  const branchesQuery = useQuery({
    queryKey: ['branches', adapter.type, selectedRepository?.id],
    queryFn: () => {
      if (!selectedRepository) {
        return Promise.resolve([]);
      }

      return adapter.listBranches(toRepositorySelector(selectedRepository), {
        perPage: 30,
      });
    },
    enabled: canUseProvider && Boolean(selectedRepository),
  });

  useEffect(() => {
    if (selectedRepository) {
      setBaseBranch(selectedRepository.defaultBranch.name);
    }
  }, [selectedRepository]);

  const autoBranchName = useMemo(
    () => createAutoBranchName(taskPrompt, branchSeed),
    [branchSeed, taskPrompt],
  );
  const resolvedBranchName = branchName.trim() || autoBranchName;
  const trimmedPrompt = taskPrompt.trim();
  const trimmedIssueNumber = issueNumber.trim();
  const isBranchValid = isValidBranchName(resolvedBranchName);

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRepository) {
        throw new Error('Choose a repository before starting the task.');
      }

      if (!baseBranch.trim()) {
        throw new Error('Choose a base branch before starting the task.');
      }

      if (!isBranchValid) {
        throw new Error('Use a valid Git branch name.');
      }

      const now = new Date().toISOString();
      const taskId = `task_${Date.now()}`;
      const task: AiCodingTask = {
        id: taskId,
        type: 'modify',
        status: 'queued',
        repositoryId: selectedRepository.id,
        repositoryFullName: selectedRepository.fullName,
        repositoryName: selectedRepository.name,
        repositoryOwner: selectedRepository.owner.username,
        prompt: trimmedPrompt,
        baseBranch: baseBranch.trim(),
        issueNumber: trimmedIssueNumber || undefined,
        sourceBranch: resolvedBranchName,
        targetBranch: baseBranch.trim(),
        techStack,
        workflowId: aiCodingWorkflowId,
        createdAt: now,
        updatedAt: now,
      };

      upsertTask(task);
      setActiveTaskId(task.id);

      try {
        await adapter.dispatchAiCodingWorkflow(toRepositorySelector(selectedRepository), {
          workflowId: aiCodingWorkflowId,
          ref: baseBranch.trim(),
          taskPrompt: trimmedPrompt,
          baseBranch: baseBranch.trim(),
          branchName: resolvedBranchName,
          issueNumber: trimmedIssueNumber || undefined,
          techStack,
        });
      } catch (error) {
        updateTaskStatus(task.id, 'failed', getErrorMessage(error));
        throw error;
      }

      return { repository: selectedRepository, task };
    },
    onSuccess: ({ repository, task }) => {
      navigation.navigate(routes.taskProgress, {
        autoOpenReview: true,
        repository,
        taskId: task.id,
      });
    },
  });

  const repositories = repositoriesQuery.data ?? [];
  const canSubmit =
    canUseProvider &&
    Boolean(selectedRepository) &&
    baseBranch.trim().length > 0 &&
    trimmedPrompt.length > 0 &&
    isBranchValid &&
    !dispatchMutation.isPending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Runner mode</Text>
          <Text style={styles.title}>Start AI Coding</Text>
          <Text style={styles.description}>
            Dispatch the repository workflow, create an agent branch, and open a pull
            request after the runner finishes.
          </Text>
        </View>

        {!canUseProvider ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>GitHub is not connected</Text>
            <Text style={styles.helpText}>
              Connect GitHub, or switch to Mock in Provider Settings to test the full
              flow with local sample repositories.
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
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Repository</Text>
              {repositoriesQuery.isPending ? (
                <View style={styles.loadingPanel}>
                  <ActivityIndicator color="#2563EB" />
                </View>
              ) : repositoriesQuery.isError ? (
                <View style={styles.panel}>
                  <Text style={styles.errorText}>Could not load repositories.</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => repositoriesQuery.refetch()}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressedButton,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Retry</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.optionList}>
                  {repositories.slice(0, 12).map((repository) => (
                    <SelectableRow
                      key={repository.id}
                      label={repository.fullName}
                      detail={repository.visibility}
                      selected={selectedRepository?.id === repository.id}
                      onPress={() => setSelectedRepository(repository)}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Base branch</Text>
              <TextInput
                value={baseBranch}
                onChangeText={setBaseBranch}
                placeholder="main"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />

              {branchesQuery.data?.length ? (
                <View style={styles.chipGrid}>
                  {branchesQuery.data.slice(0, 12).map((branch) => (
                    <ChoiceChip
                      key={branch.name}
                      label={branch.name}
                      selected={baseBranch === branch.name}
                      onPress={() => setBaseBranch(branch.name)}
                    />
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Issue number</Text>
              <TextInput
                value={issueNumber}
                onChangeText={setIssueNumber}
                placeholder="Optional"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Task prompt</Text>
              <TextInput
                value={taskPrompt}
                onChangeText={setTaskPrompt}
                placeholder="Describe the code change"
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.textArea]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Agent branch</Text>
              <TextInput
                value={branchName}
                onChangeText={setBranchName}
                placeholder={autoBranchName}
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <Text style={[styles.helpText, !isBranchValid && styles.errorText]}>
                {branchName.trim()
                  ? `Using ${resolvedBranchName}`
                  : `Auto-generated: ${resolvedBranchName}`}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Tech stack</Text>
              <View style={styles.chipGrid}>
                {techStackOptions.map((option) => (
                  <ChoiceChip
                    key={option.id}
                    label={option.label}
                    selected={techStack === option.id}
                    onPress={() => setTechStack(option.id)}
                  />
                ))}
              </View>
            </View>

            {dispatchMutation.isError ? (
              <Text style={styles.errorText}>{getErrorMessage(dispatchMutation.error)}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => dispatchMutation.mutate()}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                (!canSubmit || pressed) && styles.pressedButton,
              ]}
            >
              {dispatchMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Dispatch Workflow</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SelectableRow({
  detail,
  label,
  onPress,
  selected,
}: {
  detail: string;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.repositoryRow,
        selected && styles.selectedRow,
        pressed && styles.pressedRow,
      ]}
    >
      <Text style={styles.repositoryName}>{label}</Text>
      <Text style={styles.repositoryDetail}>{detail}</Text>
    </Pressable>
  );
}

function ChoiceChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selectedChip,
        pressed && styles.pressedButton,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.selectedChipText]}>{label}</Text>
    </Pressable>
  );
}

function toRepositorySelector(repository: Repository) {
  return {
    owner: repository.owner.username,
    name: repository.name,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to start AI coding workflow.';
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
    textTransform: 'uppercase',
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
    fontSize: 17,
    fontWeight: '800',
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
    minHeight: 132,
    paddingTop: 12,
  },
  helpText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  optionList: {
    gap: 8,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 72,
    justifyContent: 'center',
  },
  repositoryRow: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  selectedRow: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  pressedRow: {
    backgroundColor: '#F1F5F9',
  },
  repositoryName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  repositoryDetail: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  selectedChip: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  chipText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
  selectedChipText: {
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
    opacity: 0.72,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
});
