import type { Branch } from '@/types';

import {
  createRepositoryPath,
  GitHubClient,
  type GitHubBranch,
  mapGitHubBranch,
  type RepositoryRef,
} from './client';

export type ListBranchesParams = {
  page?: number;
  perPage?: number;
  protected?: boolean;
};

type GitHubReference = {
  ref: string;
  node_id: string;
  object: {
    type: string;
    sha: string;
    url: string;
  };
};

export type CreateBranchFromRefInput = {
  fromRef: string;
  newBranchName: string;
};

export async function listBranches(
  client: GitHubClient,
  repository: RepositoryRef,
  params: ListBranchesParams = {},
): Promise<Branch[]> {
  const branches = await client.request<GitHubBranch[]>(
    `${createRepositoryPath(repository)}/branches`,
    {
      query: {
        page: params.page,
        per_page: params.perPage,
        protected: params.protected,
      },
    },
  );

  return branches.map((branch) => mapGitHubBranch(branch));
}

export async function getBranch(
  client: GitHubClient,
  repository: RepositoryRef,
  branchName: string,
): Promise<Branch> {
  const branch = await client.request<GitHubBranch>(
    `${createRepositoryPath(repository)}/branches/${encodeRefPath(branchName)}`,
  );

  return mapGitHubBranch(branch);
}

export async function createBranchFromRef(
  client: GitHubClient,
  repository: RepositoryRef,
  input: CreateBranchFromRefInput,
): Promise<Branch> {
  const sourceRef = await client.request<GitHubReference>(
    `${createRepositoryPath(repository)}/git/ref/${formatHeadRef(input.fromRef)}`,
  );

  const createdRef = await client.request<GitHubReference>(
    `${createRepositoryPath(repository)}/git/refs`,
    {
      method: 'POST',
      body: {
        ref: `refs/heads/${input.newBranchName}`,
        sha: sourceRef.object.sha,
      },
    },
  );

  return mapGitHubBranch({
    name: input.newBranchName,
    commit: {
      sha: createdRef.object.sha,
      url: createdRef.object.url,
    },
    protected: false,
  } satisfies GitHubBranch);
}

export async function deleteBranch(
  client: GitHubClient,
  repository: RepositoryRef,
  branchName: string,
): Promise<void> {
  await client.request<void>(
    `${createRepositoryPath(repository)}/git/refs/heads/${encodeRefPath(branchName)}`,
    {
      method: 'DELETE',
    },
  );
}

function formatHeadRef(ref: string) {
  if (ref.startsWith('refs/heads/')) {
    return ref.replace(/^refs\//, '');
  }

  if (ref.startsWith('heads/')) {
    return ref;
  }

  return `heads/${ref}`;
}

function encodeRefPath(ref: string) {
  return ref
    .replace(/^refs\/heads\//, '')
    .replace(/^heads\//, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
}
