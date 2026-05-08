import type {
  Branch,
  CheckRunSummary,
  DiffFile,
  GitProviderAccount,
  Issue,
  MergeRequest,
  Repository,
  WorkflowRun,
} from '@/types';

import type {
  CommitRepositoryFilesResult,
  GitProviderAdapter,
  GitProviderCapabilities,
  RepositorySelector,
} from './GitProviderAdapter';

const now = new Date('2026-05-07T09:00:00.000Z').toISOString();

const mockAccount: GitProviderAccount = {
  id: 'mock-user-1',
  providerType: 'mock',
  username: 'mobile-dev',
  displayName: 'Mobile Developer',
  externalIds: {
    mock: {
      id: 'mock-user-1',
    },
  },
};

const mockRepositories: Repository[] = [
  {
    id: 'mock-repo-mobile',
    providerType: 'mock',
    name: 'mobile-agent-demo',
    fullName: 'mobile-dev/mobile-agent-demo',
    owner: mockAccount,
    defaultBranch: {
      name: 'main',
      sha: 'mock-main-sha',
      isDefault: true,
    },
    visibility: 'private',
    permissions: ['read', 'write', 'maintain'],
    description: 'Mock repository for local mobile AI coding flows.',
    webUrl: 'https://mock.local/mobile-dev/mobile-agent-demo',
    cloneUrl: 'https://mock.local/mobile-dev/mobile-agent-demo.git',
    externalIds: {
      mock: {
        id: 'mock-repo-mobile',
      },
    },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mock-repo-api',
    providerType: 'mock',
    name: 'api-service-demo',
    fullName: 'mobile-dev/api-service-demo',
    owner: mockAccount,
    defaultBranch: {
      name: 'main',
      sha: 'mock-api-main-sha',
      isDefault: true,
    },
    visibility: 'internal',
    permissions: ['read', 'write'],
    description: 'Mock service repo with auth and payment changes.',
    webUrl: 'https://mock.local/mobile-dev/api-service-demo',
    cloneUrl: 'https://mock.local/mobile-dev/api-service-demo.git',
    externalIds: {
      mock: {
        id: 'mock-repo-api',
      },
    },
    createdAt: now,
    updatedAt: now,
  },
];

const mockBranchesByRepositoryId: Record<string, Branch[]> = {
  'mock-repo-mobile': [
    { name: 'main', sha: 'mock-main-sha', isDefault: true },
    { name: 'feature/mobile-empty-state', sha: 'mock-feature-sha', isDefault: false },
    { name: 'bugfix/conflict-demo', sha: 'mock-conflict-sha', isDefault: false },
  ],
  'mock-repo-api': [
    { name: 'main', sha: 'mock-api-main-sha', isDefault: true },
    { name: 'feature/payment-hardening', sha: 'mock-payment-sha', isDefault: false },
  ],
};

const mockIssuesByRepositoryId: Record<string, Issue[]> = {
  'mock-repo-mobile': [
    {
      id: 'mock-issue-101',
      providerType: 'mock',
      repositoryId: 'mock-repo-mobile',
      number: 101,
      title: 'Improve the empty repository state',
      body: 'Make the empty state clearer for first-time mobile users.',
      state: 'open',
      author: {
        id: 'mock-user-1',
        username: 'mobile-dev',
      },
      labels: [{ id: 'label-ui', name: 'ui', color: '2563EB' }],
      webUrl: 'https://mock.local/mobile-dev/mobile-agent-demo/issues/101',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mock-issue-102',
      providerType: 'mock',
      repositoryId: 'mock-repo-mobile',
      number: 102,
      title: 'Resolve settings copy conflict',
      state: 'open',
      author: {
        id: 'mock-user-2',
        username: 'reviewer',
      },
      labels: [{ id: 'label-conflict', name: 'conflict', color: 'DC2626' }],
      webUrl: 'https://mock.local/mobile-dev/mobile-agent-demo/issues/102',
      createdAt: now,
      updatedAt: now,
    },
  ],
  'mock-repo-api': [
    {
      id: 'mock-issue-201',
      providerType: 'mock',
      repositoryId: 'mock-repo-api',
      number: 201,
      title: 'Review payment permission handling',
      state: 'open',
      author: {
        id: 'mock-user-1',
        username: 'mobile-dev',
      },
      labels: [{ id: 'label-security', name: 'security', color: 'B91C1C' }],
      webUrl: 'https://mock.local/mobile-dev/api-service-demo/issues/201',
      createdAt: now,
      updatedAt: now,
    },
  ],
};

let mockMergeRequests: MergeRequest[] = [
  createMockMergeRequest({
    id: 'mock-pr-12',
    repositoryId: 'mock-repo-mobile',
    number: 12,
    title: 'Improve repository empty state',
    body: 'Adds friendlier copy and a safer first action.',
    sourceBranch: 'feature/mobile-empty-state',
    sourceSha: 'mock-feature-sha',
    targetBranch: 'main',
    targetSha: 'mock-main-sha',
    isMergeable: true,
    mergeConflictStatus: 'clean',
  }),
  createMockMergeRequest({
    id: 'mock-pr-13',
    repositoryId: 'mock-repo-mobile',
    number: 13,
    title: 'Resolve settings conflict demo',
    body: 'Mock PR intentionally marked conflicted so merge failure and AI conflict resolution can be tested.',
    sourceBranch: 'bugfix/conflict-demo',
    sourceSha: 'mock-conflict-sha',
    targetBranch: 'main',
    targetSha: 'mock-main-sha',
    isMergeable: false,
    mergeConflictStatus: 'conflicted',
  }),
  createMockMergeRequest({
    id: 'mock-pr-21',
    repositoryId: 'mock-repo-api',
    number: 21,
    title: 'Harden payment permissions',
    body: 'Touches payment and permission code to exercise high-risk merge warnings.',
    sourceBranch: 'feature/payment-hardening',
    sourceSha: 'mock-payment-sha',
    targetBranch: 'main',
    targetSha: 'mock-api-main-sha',
    isMergeable: true,
    mergeConflictStatus: 'clean',
  }),
];

let mockWorkflowRuns: WorkflowRun[] = [
  createMockWorkflowRun({
    id: 'mock-run-1001',
    repositoryId: 'mock-repo-mobile',
    operation: 'modify',
    status: 'succeeded',
    branchName: 'main',
  }),
  createMockWorkflowRun({
    id: 'mock-run-1002',
    repositoryId: 'mock-repo-mobile',
    mergeRequestId: 'mock-pr-13',
    operation: 'resolve_conflict',
    status: 'failed',
    branchName: 'bugfix/conflict-demo',
  }),
];

const mockWorkflowFilesByRepositoryId: Record<string, Set<string>> = {
  'mock-repo-mobile': new Set(['.github/workflows/mobile-ai-coding.yml']),
  'mock-repo-api': new Set(),
};

let nextPullRequestNumber = 100;
let nextWorkflowRunNumber = 2000;

export class MockGitProviderAdapter implements GitProviderAdapter {
  readonly type = 'mock';
  readonly label = 'Mock Git';
  readonly capabilities: GitProviderCapabilities = {
    supportsCreateRepository: true,
    supportsWorkflowDispatch: true,
    supportsDraftMergeRequest: true,
    supportsMergeRequestComments: true,
    supportsReviewApproval: true,
    supportsMerge: true,
    supportsConflictStatus: true,
    supportsDeleteSourceBranch: true,
    supportsRepositoryFileRead: true,
    supportsRepositoryFileWrite: true,
  };

  getCurrentUser: GitProviderAdapter['getCurrentUser'] = async () => mockAccount;

  listRepositories: GitProviderAdapter['listRepositories'] = async (options = {}) => {
    const filteredRepositories =
      options.visibility && options.visibility !== 'all'
        ? mockRepositories.filter(
            (repository) => repository.visibility === options.visibility,
          )
        : mockRepositories;

    return delay(paginate(filteredRepositories, options.page, options.perPage));
  };

  listBranches: GitProviderAdapter['listBranches'] = async (repository, options = {}) =>
    delay(
      paginate(
        [...(mockBranchesByRepositoryId[getRepositoryId(repository)] ?? [])],
        options.page,
        options.perPage,
      ),
    );

  createRepository: GitProviderAdapter['createRepository'] = async (options) => {
    const repository: Repository = {
      id: `mock-repo-${Date.now()}`,
      providerType: 'mock',
      name: options.name,
      fullName: `${mockAccount.username}/${options.name}`,
      owner: mockAccount,
      defaultBranch: {
        name: 'main',
        sha: `mock-${Date.now()}-main-sha`,
        isDefault: true,
      },
      visibility: options.visibility ?? 'private',
      permissions: ['read', 'write', 'maintain'],
      description: options.description,
      webUrl: `https://mock.local/${mockAccount.username}/${options.name}`,
      cloneUrl: `https://mock.local/${mockAccount.username}/${options.name}.git`,
      externalIds: {
        mock: {
          id: `mock-repo-${Date.now()}`,
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepositories.unshift(repository);
    mockBranchesByRepositoryId[repository.id] = [repository.defaultBranch];
    mockIssuesByRepositoryId[repository.id] = [];
    mockWorkflowFilesByRepositoryId[repository.id] = new Set();

    return delay(repository);
  };

  getRepositoryFile: NonNullable<GitProviderAdapter['getRepositoryFile']> = async (
    repository,
    path,
  ) => {
    const repositoryId = getRepositoryId(repository);
    const files = mockWorkflowFilesByRepositoryId[repositoryId] ?? new Set();

    if (!files.has(path)) {
      return delay(null);
    }

    return delay({
      path,
      sha: `mock-file-${path}`,
      webUrl: `https://mock.local/${repository.owner}/${repository.name}/blob/main/${path}`,
    });
  };

  createBranch: NonNullable<GitProviderAdapter['createBranch']> = async (
    repository,
    options,
  ) => {
    const repositoryId = getRepositoryId(repository);
    const branches = mockBranchesByRepositoryId[repositoryId] ?? [];
    const existingBranch = branches.find((branch) => branch.name === options.branchName);

    if (existingBranch) {
      return delay(existingBranch);
    }

    const sourceBranch = branches.find((branch) => branch.name === options.sourceBranch);
    const branch: Branch = {
      name: options.branchName,
      sha: sourceBranch?.sha ?? `mock-${Date.now()}-branch-sha`,
      isDefault: false,
    };

    branches.push(branch);
    mockBranchesByRepositoryId[repositoryId] = branches;

    return delay(branch);
  };

  commitRepositoryFiles: NonNullable<GitProviderAdapter['commitRepositoryFiles']> = async (
    repository,
    options,
  ): Promise<CommitRepositoryFilesResult> => {
    const repositoryId = getRepositoryId(repository);
    const files = mockWorkflowFilesByRepositoryId[repositoryId] ?? new Set();

    options.files.forEach((file) => files.add(file.path));
    mockWorkflowFilesByRepositoryId[repositoryId] = files;

    const commitSha = `mock-commit-${Date.now()}`;

    return delay({
      commitSha,
      commitUrl: `https://mock.local/${repository.owner}/${repository.name}/commit/${commitSha}`,
    });
  };

  listIssues: GitProviderAdapter['listIssues'] = async (repository, options = {}) => {
    const issues = mockIssuesByRepositoryId[getRepositoryId(repository)] ?? [];
    const filteredIssues =
      options.state && options.state !== 'all'
        ? issues.filter((issue) => issue.state === options.state)
        : issues;

    return delay(filteredIssues);
  };

  getIssue: GitProviderAdapter['getIssue'] = async (repository, issueNumber) => {
    const issue = (mockIssuesByRepositoryId[getRepositoryId(repository)] ?? []).find(
      (candidate) => candidate.number === issueNumber,
    );

    if (!issue) {
      throw new Error(`Mock issue #${issueNumber} was not found.`);
    }

    return delay(issue);
  };

  listMergeRequests: GitProviderAdapter['listMergeRequests'] = async (
    repository,
    options = {},
  ) => {
    const repositoryId = getRepositoryId(repository);
    const sourceBranch = normalizeSourceBranch(options.sourceBranch);
    const filteredMergeRequests = mockMergeRequests.filter((mergeRequest) => {
      if (mergeRequest.repositoryId !== repositoryId) {
        return false;
      }
      if (options.state && options.state !== 'all' && mergeRequest.state !== options.state) {
        return false;
      }
      if (options.targetBranch && mergeRequest.targetBranch.name !== options.targetBranch) {
        return false;
      }
      if (sourceBranch && mergeRequest.sourceBranch.name !== sourceBranch) {
        return false;
      }

      return true;
    });

    return delay(paginate(filteredMergeRequests, options.page, options.perPage));
  };

  getMergeRequest: GitProviderAdapter['getMergeRequest'] = async (
    repository,
    mergeRequestNumber,
  ) => {
    const mergeRequest = mockMergeRequests.find(
      (candidate) =>
        candidate.repositoryId === getRepositoryId(repository) &&
        candidate.number === mergeRequestNumber,
    );

    if (!mergeRequest) {
      throw new Error(`Mock PR #${mergeRequestNumber} was not found.`);
    }

    return delay(mergeRequest);
  };

  listMergeRequestFiles: GitProviderAdapter['listMergeRequestFiles'] = async (
    repository,
    mergeRequestNumber,
  ) => delay(getMockDiffFiles(getRepositoryId(repository), mergeRequestNumber));

  createMergeRequest: GitProviderAdapter['createMergeRequest'] = async (
    repository,
    options,
  ) => {
    const repositoryId = getRepositoryId(repository);
    const targetBranch =
      (mockBranchesByRepositoryId[repositoryId] ?? []).find(
        (branch) => branch.name === options.targetBranch,
      ) ?? getRepository(repository).defaultBranch;
    const sourceBranch =
      (mockBranchesByRepositoryId[repositoryId] ?? []).find(
        (branch) => branch.name === options.sourceBranch,
      ) ?? {
        name: options.sourceBranch,
        sha: `mock-${Date.now()}-source-sha`,
        isDefault: false,
      };

    if (
      !(mockBranchesByRepositoryId[repositoryId] ?? []).some(
        (branch) => branch.name === sourceBranch.name,
      )
    ) {
      mockBranchesByRepositoryId[repositoryId] = [
        ...(mockBranchesByRepositoryId[repositoryId] ?? []),
        sourceBranch,
      ];
    }

    const mergeRequest = createMockMergeRequest({
      id: `mock-pr-${nextPullRequestNumber}`,
      repositoryId,
      number: nextPullRequestNumber,
      title: options.title,
      body: options.body,
      sourceBranch: sourceBranch.name,
      sourceSha: sourceBranch.sha,
      targetBranch: targetBranch.name,
      targetSha: targetBranch.sha,
      isMergeable: true,
      mergeConflictStatus: 'clean',
    });

    nextPullRequestNumber += 1;
    mockMergeRequests.unshift(mergeRequest);

    return delay(mergeRequest);
  };

  approveMergeRequest: NonNullable<GitProviderAdapter['approveMergeRequest']> = async () =>
    delay(undefined);

  submitReviewApprove: NonNullable<GitProviderAdapter['submitReviewApprove']> = async () =>
    delay(undefined);

  requestChanges: NonNullable<GitProviderAdapter['requestChanges']> = async () =>
    delay(undefined);

  submitReviewRequestChanges: NonNullable<
    GitProviderAdapter['submitReviewRequestChanges']
  > = async () => delay(undefined);

  createMergeRequestComment: NonNullable<
    GitProviderAdapter['createMergeRequestComment']
  > = async () => delay(undefined);

  submitMergeRequestComment: NonNullable<
    GitProviderAdapter['submitMergeRequestComment']
  > = async () => delay(undefined);

  mergeMergeRequest: GitProviderAdapter['mergeMergeRequest'] = async (
    repository,
    mergeRequestNumber,
  ) => {
    const mergeRequest = await this.getMergeRequest(repository, mergeRequestNumber);

    if (mergeRequest.mergeConflictStatus === 'conflicted' || mergeRequest.isMergeable === false) {
      throw createMockConflictError(`Mock PR #${mergeRequestNumber} has merge conflicts.`);
    }

    mockMergeRequests = mockMergeRequests.map((candidate) =>
      candidate.id === mergeRequest.id
        ? {
            ...candidate,
            closedAt: new Date().toISOString(),
            isMergeable: false,
            mergedAt: new Date().toISOString(),
            state: 'merged',
            updatedAt: new Date().toISOString(),
          }
        : candidate,
    );

    return delay({
      sha: `mock-merge-${Date.now()}`,
      merged: true,
      message: 'Mock merge completed successfully.',
    });
  };

  deleteBranch: NonNullable<GitProviderAdapter['deleteBranch']> = async (
    repository,
    branchName,
  ) => {
    const repositoryId = getRepositoryId(repository);
    mockBranchesByRepositoryId[repositoryId] = (
      mockBranchesByRepositoryId[repositoryId] ?? []
    ).filter((branch) => branch.name !== branchName);

    return delay(undefined);
  };

  dispatchAiCodingWorkflow: GitProviderAdapter['dispatchAiCodingWorkflow'] = async (
    repository,
    options,
  ) => {
    const repositoryId = getRepositoryId(repository);
    const branchName = options.branchName ?? `mock-ai/${Date.now()}`;
    const targetBranchName = options.targetBranch ?? options.baseBranch;

    await this.createBranch(repository, {
      branchName,
      sourceBranch: options.baseBranch,
    });

    mockWorkflowRuns.unshift(
      createMockWorkflowRun({
        id: `mock-run-${nextWorkflowRunNumber++}`,
        repositoryId,
        operation: 'modify',
        status: 'succeeded',
        branchName: options.baseBranch,
      }),
    );

    const existingMergeRequest = mockMergeRequests.find(
      (mergeRequest) =>
        mergeRequest.repositoryId === repositoryId &&
        mergeRequest.sourceBranch.name === branchName &&
        mergeRequest.state === 'open',
    );

    if (!existingMergeRequest) {
      const repositoryRecord = getRepository(repository);
      const mergeRequest = createMockMergeRequest({
        id: `mock-pr-${nextPullRequestNumber}`,
        repositoryId,
        number: nextPullRequestNumber,
        title: `Mock AI task: ${truncate(options.taskPrompt, 42)}`,
        body: 'Created by the mock AI coding workflow.',
        sourceBranch: branchName,
        sourceSha: `mock-${Date.now()}-ai-sha`,
        targetBranch: targetBranchName,
        targetSha:
          (mockBranchesByRepositoryId[repositoryId] ?? []).find(
            (branch) => branch.name === targetBranchName,
          )?.sha ?? repositoryRecord.defaultBranch.sha,
        isMergeable: true,
        mergeConflictStatus: 'clean',
      });

      nextPullRequestNumber += 1;
      mockMergeRequests.unshift(mergeRequest);
    }

    return delay(undefined);
  };

  dispatchConflictResolutionWorkflow: GitProviderAdapter['dispatchConflictResolutionWorkflow'] = async (
    repository,
    options,
  ) => {
    const repositoryId = getRepositoryId(repository);

    mockWorkflowRuns.unshift(
      createMockWorkflowRun({
        id: `mock-run-${nextWorkflowRunNumber++}`,
        repositoryId,
        operation: 'resolve_conflict',
        status: 'succeeded',
        branchName: options.sourceBranch,
      }),
    );

    mockMergeRequests = mockMergeRequests.map((mergeRequest) =>
      mergeRequest.repositoryId === repositoryId &&
      mergeRequest.number === options.mergeRequestNumber
        ? {
            ...mergeRequest,
            isMergeable: true,
            mergeConflictStatus: 'resolved',
            sourceBranch: {
              ...mergeRequest.sourceBranch,
              sha: `mock-resolved-${Date.now()}`,
            },
            updatedAt: new Date().toISOString(),
          }
        : mergeRequest,
    );

    return delay(undefined);
  };

  getWorkflowStatus: GitProviderAdapter['getWorkflowStatus'] = async (
    repository,
    workflowRunId,
  ) => {
    const workflowRun = mockWorkflowRuns.find(
      (run) => run.repositoryId === getRepositoryId(repository) && run.id === String(workflowRunId),
    );

    if (!workflowRun) {
      throw new Error(`Mock workflow run ${workflowRunId} was not found.`);
    }

    return delay(workflowRun);
  };

  listWorkflowRuns: GitProviderAdapter['listWorkflowRuns'] = async (
    repository,
    options = {},
  ) => {
    const repositoryId = getRepositoryId(repository);

    return delay(
      mockWorkflowRuns.filter((run) => {
        if (run.repositoryId !== repositoryId) {
          return false;
        }
        if (options.branch && run.branchName !== options.branch) {
          return false;
        }
        if (options.status && run.status !== options.status) {
          return false;
        }

        return true;
      }),
    );
  };

  getMergeRequestChecks: NonNullable<GitProviderAdapter['getMergeRequestChecks']> = async (
    _repository,
    mergeRequest,
  ): Promise<CheckRunSummary> =>
    delay({
      status: mergeRequest.mergeConflictStatus === 'conflicted' ? 'failed' : 'succeeded',
      totalCount: 3,
      queuedCount: 0,
      inProgressCount: 0,
      succeededCount: mergeRequest.mergeConflictStatus === 'conflicted' ? 2 : 3,
      failedCount: mergeRequest.mergeConflictStatus === 'conflicted' ? 1 : 0,
      skippedCount: 0,
      completedAt: new Date().toISOString(),
    });
}

function createMockMergeRequest(input: {
  body?: string;
  id: string;
  isMergeable: boolean;
  mergeConflictStatus: MergeRequest['mergeConflictStatus'];
  number: number;
  repositoryId: string;
  sourceBranch: string;
  sourceSha: string;
  targetBranch: string;
  targetSha: string;
  title: string;
}): MergeRequest {
  return {
    id: input.id,
    providerType: 'mock',
    repositoryId: input.repositoryId,
    number: input.number,
    title: input.title,
    body: input.body,
    state: 'open',
    author: {
      id: 'mock-user-1',
      username: 'mobile-dev',
    },
    sourceBranch: {
      repositoryId: input.repositoryId,
      name: input.sourceBranch,
      sha: input.sourceSha,
    },
    targetBranch: {
      repositoryId: input.repositoryId,
      name: input.targetBranch,
      sha: input.targetSha,
    },
    isDraft: false,
    isMergeable: input.isMergeable,
    mergeConflictStatus: input.mergeConflictStatus,
    allowedMergeMethods: ['squash', 'merge', 'rebase'],
    webUrl: `https://mock.local/pulls/${input.number}`,
    externalIds: {
      mock: {
        id: input.id,
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createMockWorkflowRun(input: {
  branchName?: string;
  id: string;
  mergeRequestId?: string;
  operation: WorkflowRun['operation'];
  repositoryId: string;
  status: WorkflowRun['status'];
}): WorkflowRun {
  const timestamp = new Date().toISOString();

  return {
    id: input.id,
    providerType: 'mock',
    runner: {
      type: 'github_actions',
      providerType: 'mock',
      label: 'Mock Actions',
    },
    repositoryId: input.repositoryId,
    mergeRequestId: input.mergeRequestId,
    operation: input.operation,
    status: input.status,
    branchName: input.branchName,
    commitSha: `mock-run-sha-${input.id}`,
    logUrl: `https://mock.local/actions/runs/${input.id}/logs`,
    webUrl: `https://mock.local/actions/runs/${input.id}`,
    externalIds: {
      mock: {
        id: input.id,
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: timestamp,
    completedAt: input.status === 'in_progress' || input.status === 'queued' ? undefined : timestamp,
  };
}

function getMockDiffFiles(repositoryId: string, mergeRequestNumber: number): DiffFile[] {
  if (repositoryId === 'mock-repo-api') {
    return [
      {
        path: 'src/auth/permissions.ts',
        status: 'modified',
        additions: 24,
        deletions: 8,
        changes: 32,
        isBinary: false,
        patch: [
          '@@ -4,7 +4,11 @@ export function canRefund(user, invoice) {',
          '-  return user.role === "admin";',
          '+  return user.permissions.includes("billing:refund") && invoice.status === "paid";',
          '+}',
          '+export function canViewPaymentMethods(user) {',
          '+  return user.permissions.includes("payment:read");',
        ].join('\n'),
      },
      {
        path: 'package-lock.json',
        status: 'modified',
        additions: 12,
        deletions: 12,
        changes: 24,
        isBinary: false,
        patch: '@@ -10,7 +10,7 @@\n- "version": "1.0.0"\n+ "version": "1.0.1"',
      },
    ];
  }

  if (mergeRequestNumber === 13) {
    return [
      {
        path: 'apps/mobile/src/screens/GitProviderSettingsScreen.tsx',
        status: 'modified',
        additions: 18,
        deletions: 12,
        changes: 30,
        isBinary: false,
        patch: '@@ -42,7 +42,8 @@\n- <Text>Saved token</Text>\n+ <Text>Saved in secure storage, value hidden</Text>',
      },
      {
        path: '.github/workflows/mobile-ai-coding.yml',
        status: 'modified',
        additions: 5,
        deletions: 1,
        changes: 6,
        isBinary: false,
        patch: '@@ -1,3 +1,5 @@\n name: Mobile AI Coding\n+permissions:\n+  contents: write',
      },
    ];
  }

  return [
    {
      path: 'apps/mobile/src/screens/RepositoryListScreen.tsx',
      status: 'modified',
      additions: 36,
      deletions: 10,
      changes: 46,
      isBinary: false,
      patch: [
        '@@ -10,6 +10,12 @@ export function RepositoryListScreen() {',
        '+function EmptyRepositoryState() {',
        '+  return <Text>No repositories yet.</Text>;',
        '+}',
      ].join('\n'),
    },
    {
      path: '.env.local',
      status: 'modified',
      additions: 1,
      deletions: 1,
      changes: 2,
      isBinary: false,
      patch: '@@ -1 +1 @@\n-API_KEY=old\n+API_KEY=new',
    },
  ];
}

function getRepository(repository: RepositorySelector) {
  const repositoryRecord = mockRepositories.find(
    (candidate) => candidate.owner.username === repository.owner && candidate.name === repository.name,
  );

  if (!repositoryRecord) {
    throw new Error(`${repository.owner}/${repository.name} was not found in mock data.`);
  }

  return repositoryRecord;
}

function getRepositoryId(repository: RepositorySelector) {
  return getRepository(repository).id;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeSourceBranch(sourceBranch?: string) {
  if (!sourceBranch) {
    return undefined;
  }

  const [, branchName] = sourceBranch.split(':');
  return branchName ?? sourceBranch;
}

function paginate<T>(items: T[], page = 1, perPage = items.length) {
  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);
  const start = (safePage - 1) * safePerPage;
  return items.slice(start, start + safePerPage);
}

function createMockConflictError(message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = 409;
  return error;
}

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), 150);
  });
}
