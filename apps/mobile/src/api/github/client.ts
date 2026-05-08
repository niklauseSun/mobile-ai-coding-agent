import type {
  Branch,
  DiffFile,
  DiffFileStatus,
  GitProviderAccount,
  MergeConflictStatus,
  MergeMethod,
  MergeRequest,
  Repository,
  RepositoryPermission,
  RepositoryVisibility,
  WorkflowRun,
  WorkflowRunStatus,
} from '@/types';

export type GitHubTokenGetter = () => Promise<string | null>;

export type GitHubClientConfig = {
  getToken: GitHubTokenGetter;
  baseUrl?: string;
};

export type GitHubRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, boolean | number | string | undefined>;
  body?: unknown;
  headers?: HeadersInit;
  requiresAuth?: boolean;
};

export type GitHubApiErrorPayload = {
  message?: string;
  documentation_url?: string;
  errors?: unknown;
};

export class GitHubApiError extends Error {
  readonly status: number;
  readonly documentationUrl?: string;
  readonly errors?: unknown;
  readonly requestId?: string | null;

  constructor(response: Response, payload?: GitHubApiErrorPayload | string) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.message || `GitHub API request failed with status ${response.status}`;

    super(message);
    this.name = 'GitHubApiError';
    this.status = response.status;
    this.requestId = response.headers.get('x-github-request-id');

    if (typeof payload !== 'string') {
      this.documentationUrl = payload?.documentation_url;
      this.errors = payload?.errors;
    }
  }
}

export class GitHubAuthenticationError extends Error {
  constructor() {
    super('GitHub access token is not available.');
    this.name = 'GitHubAuthenticationError';
  }
}

export class GitHubClient {
  private readonly baseUrl: string;
  private readonly getToken: GitHubTokenGetter;

  constructor(config: GitHubClientConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.github.com';
    this.getToken = config.getToken;
  }

  async request<TResponse>(path: string, options: GitHubRequestOptions = {}) {
    const token = await this.getToken();

    if (options.requiresAuth !== false && !token) {
      throw new GitHubAuthenticationError();
    }

    const response = await fetch(this.buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : undefined),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      throw new GitHubApiError(response, await readGitHubErrorPayload(response));
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  }

  private buildUrl(path: string, query?: GitHubRequestOptions['query']) {
    const url = new URL(path, this.baseUrl);

    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }
}

export type RepositoryRef = {
  owner: string;
  repo: string;
};

export function createRepositoryPath({ owner, repo }: RepositoryRef) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export function createContentsPath(repository: RepositoryRef, path: string) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${createRepositoryPath(repository)}/contents/${encodedPath}`;
}

export function mapGitHubUser(user: GitHubUser): GitProviderAccount {
  return {
    id: String(user.id),
    providerType: 'github',
    username: user.login,
    displayName: user.name ?? undefined,
    avatarUrl: user.avatar_url ?? undefined,
    externalIds: {
      github: {
        id: user.id,
        nodeId: user.node_id,
      },
    },
  };
}

export function mapGitHubRepository(repository: GitHubRepository): Repository {
  return {
    id: String(repository.id),
    providerType: 'github',
    name: repository.name,
    fullName: repository.full_name,
    owner: {
      id: String(repository.owner.id),
      providerType: 'github',
      username: repository.owner.login,
      avatarUrl: repository.owner.avatar_url ?? undefined,
      externalIds: {
        github: {
          id: repository.owner.id,
          nodeId: repository.owner.node_id,
        },
      },
    },
    defaultBranch: {
      name: repository.default_branch,
      sha: '',
      isDefault: true,
    },
    visibility: mapRepositoryVisibility(repository.visibility, repository.private),
    permissions: mapRepositoryPermissions(repository.permissions),
    description: repository.description ?? undefined,
    webUrl: repository.html_url,
    cloneUrl: repository.clone_url,
    externalIds: {
      github: {
        id: repository.id,
        nodeId: repository.node_id,
        fullName: repository.full_name,
      },
    },
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
  };
}

export function mapGitHubBranch(branch: GitHubBranch, isDefault = false): Branch {
  return {
    name: branch.name,
    sha: branch.commit.sha,
    isDefault,
    isProtected: branch.protected,
  };
}

export function mapGitHubPullRequest(pullRequest: GitHubPullRequest): MergeRequest {
  return {
    id: String(pullRequest.id),
    providerType: 'github',
    repositoryId: String(pullRequest.base.repo.id),
    number: pullRequest.number,
    title: pullRequest.title,
    body: pullRequest.body ?? undefined,
    state: mapPullRequestState(pullRequest),
    author: pullRequest.user
      ? {
          id: String(pullRequest.user.id),
          username: pullRequest.user.login,
          avatarUrl: pullRequest.user.avatar_url ?? undefined,
        }
      : undefined,
    sourceBranch: {
      repositoryId: String(pullRequest.head.repo?.id ?? pullRequest.base.repo.id),
      name: pullRequest.head.ref,
      sha: pullRequest.head.sha,
    },
    targetBranch: {
      repositoryId: String(pullRequest.base.repo.id),
      name: pullRequest.base.ref,
      sha: pullRequest.base.sha,
    },
    isDraft: pullRequest.draft,
    isMergeable: pullRequest.mergeable ?? undefined,
    mergeConflictStatus: mapMergeConflictStatus(pullRequest.mergeable ?? null),
    allowedMergeMethods: mapAllowedMergeMethods(pullRequest.base.repo),
    webUrl: pullRequest.html_url,
    externalIds: {
      github: {
        id: pullRequest.id,
        nodeId: pullRequest.node_id,
      },
    },
    createdAt: pullRequest.created_at,
    updatedAt: pullRequest.updated_at,
    mergedAt: pullRequest.merged_at ?? undefined,
    closedAt: pullRequest.closed_at ?? undefined,
  };
}

export function mapGitHubDiffFile(file: GitHubPullRequestFile): DiffFile {
  return {
    path: file.filename,
    oldPath: file.previous_filename,
    status: mapDiffFileStatus(file.status),
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    isBinary: file.patch === undefined,
    patch: file.patch,
  };
}

export function mapGitHubWorkflowRun(run: GitHubWorkflowRun): WorkflowRun {
  return {
    id: String(run.id),
    providerType: 'github',
    runner: {
      type: 'github_actions',
      providerType: 'github',
      label: 'GitHub Actions',
    },
    repositoryId: String(run.repository.id),
    operation: 'modify',
    status: mapWorkflowRunStatus(run.status, run.conclusion),
    branchName: run.head_branch ?? undefined,
    commitSha: run.head_sha,
    logUrl: run.logs_url,
    webUrl: run.html_url,
    externalIds: {
      github: {
        id: run.id,
        nodeId: run.node_id,
      },
    },
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    startedAt: run.run_started_at ?? undefined,
    completedAt: run.updated_at,
  };
}

async function readGitHubErrorPayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as GitHubApiErrorPayload;
  } catch {
    return text;
  }
}

function mapRepositoryVisibility(
  visibility: GitHubRepository['visibility'],
  isPrivate: boolean,
): RepositoryVisibility {
  if (visibility === 'internal') {
    return 'internal';
  }

  return isPrivate ? 'private' : 'public';
}

function mapRepositoryPermissions(
  permissions?: GitHubRepository['permissions'],
): RepositoryPermission[] {
  if (!permissions) {
    return [];
  }

  const mappedPermissions: RepositoryPermission[] = [];

  if (permissions.pull) {
    mappedPermissions.push('read');
  }

  if (permissions.triage) {
    mappedPermissions.push('triage');
  }

  if (permissions.push) {
    mappedPermissions.push('write');
  }

  if (permissions.maintain) {
    mappedPermissions.push('maintain');
  }

  if (permissions.admin) {
    mappedPermissions.push('admin');
  }

  return mappedPermissions;
}

function mapPullRequestState(pullRequest: GitHubPullRequest): MergeRequest['state'] {
  if (pullRequest.merged_at) {
    return 'merged';
  }

  if (pullRequest.draft) {
    return 'draft';
  }

  return pullRequest.state;
}

function mapMergeConflictStatus(mergeable: boolean | null): MergeConflictStatus {
  if (mergeable === true) {
    return 'clean';
  }

  if (mergeable === false) {
    return 'conflicted';
  }

  return 'unknown';
}

function mapAllowedMergeMethods(repository: GitHubRepositorySummary): MergeMethod[] {
  const methods: MergeMethod[] = [];

  if (repository.allow_merge_commit) {
    methods.push('merge');
  }

  if (repository.allow_squash_merge) {
    methods.push('squash');
  }

  if (repository.allow_rebase_merge) {
    methods.push('rebase');
  }

  return methods;
}

function mapDiffFileStatus(status: GitHubPullRequestFile['status']): DiffFileStatus {
  if (status === 'added' || status === 'removed' || status === 'renamed') {
    return status;
  }

  if (status === 'modified') {
    return 'modified';
  }

  if (status === 'copied') {
    return 'copied';
  }

  if (status === 'unchanged') {
    return 'unchanged';
  }

  return 'changed';
}

function mapWorkflowRunStatus(
  status: GitHubWorkflowRun['status'],
  conclusion: GitHubWorkflowRun['conclusion'],
): WorkflowRunStatus {
  if (status === 'queued' || status === 'in_progress' || status === 'waiting') {
    return status;
  }

  if (conclusion === 'success') {
    return 'succeeded';
  }

  if (conclusion === 'cancelled') {
    return 'cancelled';
  }

  if (conclusion === 'skipped') {
    return 'skipped';
  }

  return conclusion ? 'failed' : 'in_progress';
}

export type GitHubUser = {
  id: number;
  node_id: string;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
};

export type GitHubRepositoryOwner = {
  id: number;
  node_id: string;
  login: string;
  avatar_url?: string | null;
};

export type GitHubRepositoryPermissions = {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
};

export type GitHubRepositorySummary = {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: GitHubRepositoryOwner;
  private: boolean;
  html_url?: string;
  clone_url?: string;
  default_branch: string;
  visibility?: 'public' | 'private' | 'internal';
  allow_merge_commit?: boolean;
  allow_squash_merge?: boolean;
  allow_rebase_merge?: boolean;
};

export type GitHubRepository = GitHubRepositorySummary & {
  description?: string | null;
  permissions?: GitHubRepositoryPermissions;
  created_at?: string;
  updated_at?: string;
};

export type GitHubBranch = {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected?: boolean;
};

export type GitHubPullRequest = {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body?: string | null;
  state: 'open' | 'closed';
  draft: boolean;
  html_url?: string;
  user?: GitHubUser | null;
  head: {
    ref: string;
    sha: string;
    repo?: GitHubRepositorySummary | null;
  };
  base: {
    ref: string;
    sha: string;
    repo: GitHubRepositorySummary;
  };
  mergeable?: boolean | null;
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
  closed_at?: string | null;
};

export type GitHubPullRequestFile = {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
};

export type GitHubWorkflowRun = {
  id: number;
  node_id?: string;
  name?: string;
  head_branch?: string | null;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
  conclusion?:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | null;
  html_url?: string;
  logs_url?: string;
  created_at: string;
  updated_at: string;
  run_started_at?: string | null;
  repository: GitHubRepositorySummary;
};
