import { describe, expect, it } from 'vitest';

import {
  mapGitHubDiffFile,
  mapGitHubPullRequest,
  mapGitHubRepository,
  mapGitHubWorkflowRun,
  type GitHubPullRequest,
  type GitHubRepository,
  type GitHubRepositoryOwner,
  type GitHubRepositorySummary,
  type GitHubWorkflowRun,
} from './client';

const owner: GitHubRepositoryOwner = {
  id: 42,
  node_id: 'OWNER_node',
  login: 'octo-org',
  avatar_url: 'https://example.test/avatar.png',
};

function createRepository(overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    id: 100,
    node_id: 'REPO_node',
    name: 'mobile-agent',
    full_name: 'octo-org/mobile-agent',
    owner,
    private: true,
    html_url: 'https://github.com/octo-org/mobile-agent',
    clone_url: 'https://github.com/octo-org/mobile-agent.git',
    default_branch: 'main',
    visibility: 'private',
    allow_merge_commit: false,
    allow_squash_merge: true,
    allow_rebase_merge: true,
    description: 'Mobile agent repo',
    permissions: {
      pull: true,
      push: true,
      admin: false,
      maintain: true,
      triage: false,
    },
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-02T00:00:00Z',
    ...overrides,
  };
}

function createPullRequest(
  overrides: Partial<GitHubPullRequest> = {},
): GitHubPullRequest {
  const baseRepo = createRepository();
  const headRepo: GitHubRepositorySummary = {
    ...baseRepo,
    id: 101,
    node_id: 'HEAD_REPO_node',
    name: 'mobile-agent-fork',
    full_name: 'octo-dev/mobile-agent-fork',
  };

  return {
    id: 200,
    node_id: 'PR_node',
    number: 17,
    title: 'Add mobile review flow',
    body: 'Adds review state.',
    state: 'open',
    draft: false,
    html_url: 'https://github.com/octo-org/mobile-agent/pull/17',
    user: {
      id: 7,
      node_id: 'USER_node',
      login: 'octo-dev',
      name: 'Octo Dev',
      avatar_url: 'https://example.test/user.png',
    },
    head: {
      ref: 'feature/review-flow',
      sha: 'head-sha',
      repo: headRepo,
    },
    base: {
      ref: 'main',
      sha: 'base-sha',
      repo: baseRepo,
    },
    mergeable: false,
    created_at: '2026-05-03T00:00:00Z',
    updated_at: '2026-05-04T00:00:00Z',
    merged_at: null,
    closed_at: null,
    ...overrides,
  };
}

describe('GitHub API mapping', () => {
  it('maps repository metadata, permissions, and visibility', () => {
    const repository = mapGitHubRepository(createRepository());

    expect(repository).toMatchObject({
      id: '100',
      providerType: 'github',
      name: 'mobile-agent',
      fullName: 'octo-org/mobile-agent',
      visibility: 'private',
      permissions: ['read', 'write', 'maintain'],
      defaultBranch: {
        name: 'main',
        sha: '',
        isDefault: true,
      },
    });
    expect(repository.owner.username).toBe('octo-org');
  });

  it('maps pull request branches, merge methods, and conflict state', () => {
    const mergeRequest = mapGitHubPullRequest(createPullRequest());

    expect(mergeRequest).toMatchObject({
      id: '200',
      providerType: 'github',
      number: 17,
      state: 'open',
      isMergeable: false,
      mergeConflictStatus: 'conflicted',
      allowedMergeMethods: ['squash', 'rebase'],
      sourceBranch: {
        name: 'feature/review-flow',
        sha: 'head-sha',
      },
      targetBranch: {
        name: 'main',
        sha: 'base-sha',
      },
    });
  });

  it('maps renamed and binary pull request files', () => {
    expect(
      mapGitHubDiffFile({
        filename: 'src/new-name.ts',
        previous_filename: 'src/old-name.ts',
        status: 'renamed',
        additions: 5,
        deletions: 2,
        changes: 7,
      }),
    ).toMatchObject({
      path: 'src/new-name.ts',
      oldPath: 'src/old-name.ts',
      status: 'renamed',
      additions: 5,
      deletions: 2,
      changes: 7,
      isBinary: true,
    });
  });

  it('maps completed workflow runs to app workflow status', () => {
    const run: GitHubWorkflowRun = {
      id: 300,
      node_id: 'RUN_node',
      name: 'Mobile AI Coding',
      head_branch: 'main',
      head_sha: 'run-sha',
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://github.com/octo-org/mobile-agent/actions/runs/300',
      logs_url: 'https://api.github.com/repos/octo-org/mobile-agent/actions/runs/300/logs',
      created_at: '2026-05-05T00:00:00Z',
      updated_at: '2026-05-05T00:05:00Z',
      run_started_at: '2026-05-05T00:01:00Z',
      repository: createRepository(),
    };

    expect(mapGitHubWorkflowRun(run)).toMatchObject({
      id: '300',
      providerType: 'github',
      operation: 'modify',
      status: 'succeeded',
      branchName: 'main',
      commitSha: 'run-sha',
    });
  });
});
