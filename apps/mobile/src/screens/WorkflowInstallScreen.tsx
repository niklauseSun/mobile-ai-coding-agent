import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';
import { useGitProviderAdapter } from '@/providers/git';
import {
  getRequiredWorkflowSecretRows,
  workflowInstallBranchName,
  workflowTemplateFiles,
  type WorkflowTemplateFile,
} from '@/services/workflow-templates';
import type { MergeRequest, Repository } from '@/types';

type WorkflowInstallScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.workflowInstall
>;

type WorkflowFileStatus = {
  exists: boolean;
  template: WorkflowTemplateFile;
  webUrl?: string;
};

type InstallMode = 'direct_commit' | 'pull_request';

type WorkflowInstallResult = {
  commitSha: string;
  commitUrl?: string;
  mergeRequest?: MergeRequest;
  mode: InstallMode;
};

export function WorkflowInstallScreen({
  navigation,
  route,
}: WorkflowInstallScreenProps) {
  const adapter = useGitProviderAdapter();
  const queryClient = useQueryClient();
  const { repository } = route.params;
  const [useDirectCommit, setUseDirectCommit] = useState(false);

  const repositorySelector = useMemo(() => toRepositorySelector(repository), [repository]);
  const defaultBranchName = repository.defaultBranch.name;
  const hasWritePermission = canWriteRepository(repository);
  const supportsStatusCheck =
    adapter.capabilities.supportsRepositoryFileRead && Boolean(adapter.getRepositoryFile);
  const supportsInstall =
    adapter.capabilities.supportsRepositoryFileWrite &&
    Boolean(adapter.commitRepositoryFiles) &&
    (useDirectCommit || Boolean(adapter.createBranch));

  const workflowStatusQuery = useQuery({
    queryKey: ['workflow-install-status', repository.id, defaultBranchName],
    queryFn: async (): Promise<WorkflowFileStatus[]> => {
      if (!adapter.getRepositoryFile) {
        throw new Error('This Git provider cannot check repository files.');
      }

      return Promise.all(
        workflowTemplateFiles.map(async (template) => {
          const file = await adapter.getRepositoryFile(
            repositorySelector,
            template.path,
            defaultBranchName,
          );

          return {
            exists: Boolean(file),
            template,
            webUrl: file?.webUrl,
          };
        }),
      );
    },
    enabled: supportsStatusCheck,
  });

  const fileStatuses = workflowStatusQuery.data ?? [];
  const missingTemplates = fileStatuses
    .filter((status) => !status.exists)
    .map((status) => status.template);
  const isEverythingInstalled =
    fileStatuses.length === workflowTemplateFiles.length && missingTemplates.length === 0;
  const installMode: InstallMode = useDirectCommit ? 'direct_commit' : 'pull_request';
  const canInstallBase =
    supportsStatusCheck &&
    supportsInstall &&
    hasWritePermission &&
    missingTemplates.length > 0;

  const installMutation = useMutation({
    mutationFn: async (): Promise<WorkflowInstallResult> => {
      if (!adapter.commitRepositoryFiles) {
        throw new Error('This Git provider cannot commit repository files.');
      }
      if (missingTemplates.length === 0) {
        throw new Error('The workflow templates are already installed.');
      }

      const files = missingTemplates.map((template) => ({
        path: template.path,
        content: template.content,
      }));

      if (installMode === 'direct_commit') {
        const commit = await adapter.commitRepositoryFiles(repositorySelector, {
          branchName: defaultBranchName,
          files,
          message: 'chore: install mobile AI agent workflows',
        });

        return {
          commitSha: commit.commitSha,
          commitUrl: commit.commitUrl,
          mode: installMode,
        };
      }

      if (!adapter.createBranch) {
        throw new Error('This Git provider cannot create installation branches.');
      }

      await adapter.createBranch(repositorySelector, {
        branchName: workflowInstallBranchName,
        sourceBranch: defaultBranchName,
      });

      const commit = await adapter.commitRepositoryFiles(repositorySelector, {
        branchName: workflowInstallBranchName,
        files,
        message: 'chore: install mobile AI agent workflows',
      });

      const existingMergeRequests = await adapter.listMergeRequests(repositorySelector, {
        sourceBranch: workflowInstallBranchName,
        state: 'open',
        targetBranch: defaultBranchName,
        perPage: 5,
      });
      const mergeRequest =
        existingMergeRequests[0] ??
        (await adapter.createMergeRequest(repositorySelector, {
          title: 'Install mobile AI agent workflows',
          sourceBranch: workflowInstallBranchName,
          targetBranch: defaultBranchName,
          body: buildInstallPullRequestBody(missingTemplates),
        }));

      return {
        commitSha: commit.commitSha,
        commitUrl: commit.commitUrl,
        mergeRequest,
        mode: installMode,
      };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['workflow-install-status', repository.id, defaultBranchName],
      });
      await queryClient.invalidateQueries({
        queryKey: ['merge-requests', repository.id, 'open'],
      });
      await workflowStatusQuery.refetch();
    },
  });

  const isInstalling = installMutation.isPending;
  const hasInstallPullRequest = Boolean(installMutation.data?.mergeRequest);
  const effectiveCanInstall = canInstallBase && !isInstalling && !hasInstallPullRequest;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={workflowStatusQuery.isRefetching}
            onRefresh={() => workflowStatusQuery.refetch()}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{repository.fullName}</Text>
          <Text style={styles.title}>Install Workflows</Text>
          <Text style={styles.description}>
            Add the GitHub Actions templates needed for mobile AI coding and AI
            conflict resolution.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Workflow files</Text>
          {!supportsStatusCheck ? (
            <Text style={styles.errorText}>
              This provider cannot check repository workflow files yet.
            </Text>
          ) : workflowStatusQuery.isPending ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.bodyText}>Checking workflow files...</Text>
            </View>
          ) : workflowStatusQuery.isError ? (
            <Text style={styles.errorText}>Could not check workflow files.</Text>
          ) : (
            <View style={styles.fileList}>
              {fileStatuses.map((status) => (
                <WorkflowStatusRow key={status.template.path} status={status} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Repository secrets</Text>
          <Text style={styles.bodyText}>
            Configure these secrets in GitHub after the workflow PR is merged.
          </Text>
          <View style={styles.secretList}>
            {getRequiredWorkflowSecretRows().map((secret) => (
              <View key={secret.name} style={styles.secretRow}>
                <View style={styles.secretCopy}>
                  <Text style={styles.secretName}>{secret.name}</Text>
                  <Text style={styles.secretDescription}>{secret.description}</Text>
                </View>
                <Text style={secret.required ? styles.requiredBadge : styles.optionalBadge}>
                  {secret.required ? 'required' : 'optional'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Install mode</Text>
          <Text style={styles.bodyText}>
            The default path creates {workflowInstallBranchName} and opens a pull
            request. Direct commit writes to {defaultBranchName} immediately.
          </Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Direct commit to default branch</Text>
              <Text style={styles.toggleDescription}>
                Use only when this repository intentionally allows workflow changes
                without review.
              </Text>
            </View>
            <Switch value={useDirectCommit} onValueChange={setUseDirectCommit} />
          </View>
        </View>

        {!hasWritePermission ? (
          <Text style={styles.errorText}>
            Your token needs write, maintain, or admin access to install workflows.
          </Text>
        ) : null}
        {!supportsInstall ? (
          <Text style={styles.errorText}>
            This provider does not support workflow installation from the mobile app.
          </Text>
        ) : null}
        {isEverythingInstalled ? (
          <View style={styles.successPanel}>
            <Text style={styles.successTitle}>Workflows already installed</Text>
            <Text style={styles.successText}>
              Both mobile AI workflow files exist on {defaultBranchName}.
            </Text>
          </View>
        ) : null}

        <ActionButton
          label={getInstallButtonLabel(isInstalling, installMode)}
          disabled={!effectiveCanInstall}
          onPress={() =>
            confirmWorkflowInstall({
              defaultBranchName,
              installMode,
              missingCount: missingTemplates.length,
              onConfirm: () => installMutation.mutate(),
            })
          }
          variant={installMode === 'direct_commit' ? 'danger' : 'primary'}
        />

        {installMutation.data ? (
          <InstallResultPanel
            navigation={navigation}
            repository={repository}
            result={installMutation.data}
          />
        ) : null}
        {installMutation.isError ? (
          <Text style={styles.errorText}>{getErrorMessage(installMutation.error)}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function WorkflowStatusRow({ status }: { status: WorkflowFileStatus }) {
  return (
    <View style={styles.fileRow}>
      <View style={styles.fileCopy}>
        <Text style={styles.fileTitle}>{status.template.title}</Text>
        <Text style={styles.filePath}>{status.template.path}</Text>
        <Text style={styles.fileDescription}>{status.template.description}</Text>
      </View>
      <Text style={status.exists ? styles.installedBadge : styles.missingBadge}>
        {status.exists ? 'installed' : 'missing'}
      </Text>
    </View>
  );
}

function InstallResultPanel({
  navigation,
  repository,
  result,
}: {
  navigation: WorkflowInstallScreenProps['navigation'];
  repository: Repository;
  result: WorkflowInstallResult;
}) {
  return (
    <View style={styles.successPanel}>
      <Text style={styles.successTitle}>
        {result.mode === 'direct_commit' ? 'Workflow commit created' : 'Workflow PR ready'}
      </Text>
      <Text style={styles.successText}>Commit: {result.commitSha}</Text>
      {result.mergeRequest ? (
        <ActionButton
          label={`Review PR #${result.mergeRequest.number}`}
          onPress={() =>
            navigation.navigate(routes.mergeRequestDetail, {
              mergeRequest: result.mergeRequest as MergeRequest,
              repository,
            })
          }
          variant="secondary"
        />
      ) : null}
      {result.mergeRequest?.webUrl ? (
        <LinkButton label="Open PR in GitHub" url={result.mergeRequest.webUrl} />
      ) : null}
      {result.commitUrl ? (
        <LinkButton label="Open Commit in GitHub" url={result.commitUrl} />
      ) : null}
    </View>
  );
}

function ActionButton({
  disabled = false,
  label,
  onPress,
  variant = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'danger' | 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        variant === 'secondary'
          ? styles.secondaryButton
          : variant === 'danger'
            ? styles.dangerButton
            : styles.primaryButton,
        (disabled || pressed) && styles.pressedButton,
      ]}
    >
      <Text
        style={
          variant === 'secondary'
            ? styles.secondaryButtonText
            : styles.primaryButtonText
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LinkButton({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedButton]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function confirmWorkflowInstall({
  defaultBranchName,
  installMode,
  missingCount,
  onConfirm,
}: {
  defaultBranchName: string;
  installMode: InstallMode;
  missingCount: number;
  onConfirm: () => void;
}) {
  if (installMode === 'direct_commit') {
    Alert.alert(
      'Commit workflows directly?',
      `This will commit ${missingCount} workflow file(s) directly to ${defaultBranchName}. The safer default is an installation PR.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Commit Directly', style: 'destructive', onPress: onConfirm },
      ],
    );
    return;
  }

  Alert.alert(
    'Create workflow installation PR?',
    `Create ${workflowInstallBranchName}, commit ${missingCount} workflow file(s), and open a PR into ${defaultBranchName}.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Create PR', onPress: onConfirm },
    ],
  );
}

function buildInstallPullRequestBody(templates: WorkflowTemplateFile[]) {
  return [
    'Installs the mobile AI coding agent GitHub Actions workflows.',
    '',
    'Workflow files:',
    ...templates.map((template) => `- \`${template.path}\``),
    '',
    'Required repository secret:',
    '- `AI_PROVIDER_API_KEY`',
    '',
    'Optional repository secrets:',
    '- `AI_PROVIDER_BASE_URL`',
    '- `AI_PROVIDER_MODEL`',
  ].join('\n');
}

function getInstallButtonLabel(isInstalling: boolean, installMode: InstallMode) {
  if (isInstalling) {
    return installMode === 'direct_commit' ? 'Committing Workflows' : 'Creating Install PR';
  }

  return installMode === 'direct_commit' ? 'Commit Workflows Directly' : 'Create Install PR';
}

function canWriteRepository(repository: Repository) {
  return repository.permissions.some((permission) =>
    ['admin', 'maintain', 'write'].includes(permission),
  );
}

function toRepositorySelector(repository: Repository) {
  return {
    owner: repository.owner.username,
    name: repository.name,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Action failed.';
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
    lineHeight: 36,
  },
  description: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
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
  bodyText: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  fileList: {
    gap: 10,
  },
  fileRow: {
    alignItems: 'flex-start',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 12,
  },
  fileCopy: {
    flex: 1,
    gap: 4,
  },
  fileTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  filePath: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  fileDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  installedBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    color: '#065F46',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  missingBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  secretList: {
    gap: 10,
  },
  secretRow: {
    alignItems: 'flex-start',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 12,
  },
  secretCopy: {
    flex: 1,
    gap: 4,
  },
  secretName: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  secretDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  requiredBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  optionalBadge: {
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
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  toggleDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
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
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  pressedButton: {
    opacity: 0.65,
  },
  successPanel: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  successTitle: {
    color: '#065F46',
    fontSize: 18,
    fontWeight: '800',
  },
  successText: {
    color: '#047857',
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
});
