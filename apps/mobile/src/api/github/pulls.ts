import type { DiffFile, MergeMethod, MergeRequest } from '@/types';

import {
  createRepositoryPath,
  GitHubClient,
  type GitHubPullRequest,
  type GitHubPullRequestFile,
  mapGitHubDiffFile,
  mapGitHubPullRequest,
  type RepositoryRef,
} from './client';

export type ListPullRequestsParams = {
  state?: 'all' | 'closed' | 'open';
  base?: string;
  head?: string;
  page?: number;
  perPage?: number;
};

export type CreatePullRequestInput = {
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
  maintainerCanModify?: boolean;
};

export type MergePullRequestInput = {
  commitTitle?: string;
  commitMessage?: string;
  method?: MergeMethod;
  expectedHeadSha?: string;
};

export type MergePullRequestResult = {
  sha: string;
  merged: boolean;
  message: string;
};

export async function listPullRequests(
  client: GitHubClient,
  repository: RepositoryRef,
  params: ListPullRequestsParams = {},
): Promise<MergeRequest[]> {
  const pullRequests = await client.request<GitHubPullRequest[]>(
    `${createRepositoryPath(repository)}/pulls`,
    {
      query: {
        state: params.state ?? 'open',
        base: params.base,
        head: params.head,
        page: params.page,
        per_page: params.perPage,
      },
    },
  );

  return pullRequests.map(mapGitHubPullRequest);
}

export async function getPullRequest(
  client: GitHubClient,
  repository: RepositoryRef,
  pullNumber: number,
): Promise<MergeRequest> {
  const pullRequest = await client.request<GitHubPullRequest>(
    `${createRepositoryPath(repository)}/pulls/${pullNumber}`,
  );

  return mapGitHubPullRequest(pullRequest);
}

export async function listPullRequestFiles(
  client: GitHubClient,
  repository: RepositoryRef,
  pullNumber: number,
  params: { page?: number; perPage?: number } = {},
): Promise<DiffFile[]> {
  const files = await client.request<GitHubPullRequestFile[]>(
    `${createRepositoryPath(repository)}/pulls/${pullNumber}/files`,
    {
      query: {
        page: params.page,
        per_page: params.perPage,
      },
    },
  );

  return files.map(mapGitHubDiffFile);
}

export async function createPullRequest(
  client: GitHubClient,
  repository: RepositoryRef,
  input: CreatePullRequestInput,
): Promise<MergeRequest> {
  const pullRequest = await client.request<GitHubPullRequest>(
    `${createRepositoryPath(repository)}/pulls`,
    {
      method: 'POST',
      body: {
        title: input.title,
        head: input.head,
        base: input.base,
        body: input.body,
        draft: input.draft ?? false,
        maintainer_can_modify: input.maintainerCanModify ?? true,
      },
    },
  );

  return mapGitHubPullRequest(pullRequest);
}

export async function mergePullRequest(
  client: GitHubClient,
  repository: RepositoryRef,
  pullNumber: number,
  input: MergePullRequestInput = {},
): Promise<MergePullRequestResult> {
  return client.request<MergePullRequestResult>(
    `${createRepositoryPath(repository)}/pulls/${pullNumber}/merge`,
    {
      method: 'PUT',
      body: {
        commit_title: input.commitTitle,
        commit_message: input.commitMessage,
        merge_method: input.method ?? 'squash',
        sha: input.expectedHeadSha,
      },
    },
  );
}

export async function createPullRequestGeneralComment(
  client: GitHubClient,
  repository: RepositoryRef,
  pullNumber: number,
  body: string,
): Promise<void> {
  await createMergeRequestComment(client, repository, pullNumber, body);
}

export async function createMergeRequestComment(
  client: GitHubClient,
  repository: RepositoryRef,
  mergeRequestNumber: number,
  body: string,
): Promise<void> {
  await client.request<void>(
    `${createRepositoryPath(repository)}/issues/${mergeRequestNumber}/comments`,
    {
      method: 'POST',
      body: {
        body,
      },
    },
  );
}

export async function submitReviewApprove(
  client: GitHubClient,
  repository: RepositoryRef,
  mergeRequestNumber: number,
  body?: string,
): Promise<void> {
  await submitPullRequestReview(client, repository, mergeRequestNumber, {
    body,
    event: 'APPROVE',
  });
}

export async function submitReviewRequestChanges(
  client: GitHubClient,
  repository: RepositoryRef,
  mergeRequestNumber: number,
  body: string,
): Promise<void> {
  await submitPullRequestReview(client, repository, mergeRequestNumber, {
    body,
    event: 'REQUEST_CHANGES',
  });
}

async function submitPullRequestReview(
  client: GitHubClient,
  repository: RepositoryRef,
  mergeRequestNumber: number,
  input: {
    body?: string;
    event: 'APPROVE' | 'REQUEST_CHANGES';
  },
): Promise<void> {
  await client.request<void>(
    `${createRepositoryPath(repository)}/pulls/${mergeRequestNumber}/reviews`,
    {
      method: 'POST',
      body: {
        event: input.event,
        body: input.body,
      },
    },
  );
}
