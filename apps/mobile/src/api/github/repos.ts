import type { GitProviderAccount, Repository, RepositoryVisibility } from '@/types';

import {
  createRepositoryPath,
  GitHubClient,
  type GitHubRepository,
  type GitHubUser,
  mapGitHubRepository,
  mapGitHubUser,
  type RepositoryRef,
} from './client';

export type ListRepositoriesParams = {
  affiliation?: 'collaborator' | 'organization_member' | 'owner';
  page?: number;
  perPage?: number;
  sort?: 'created' | 'full_name' | 'pushed' | 'updated';
  visibility?: 'all' | RepositoryVisibility;
};

export type CreateRepositoryInput = {
  name: string;
  description?: string;
  visibility?: RepositoryVisibility;
  autoInit?: boolean;
};

export async function getAuthenticatedUser(client: GitHubClient): Promise<GitProviderAccount> {
  const user = await client.request<GitHubUser>('/user');
  return mapGitHubUser(user);
}

export async function listRepositories(
  client: GitHubClient,
  params: ListRepositoriesParams = {},
): Promise<Repository[]> {
  const repositories = await client.request<GitHubRepository[]>('/user/repos', {
    query: {
      affiliation: params.affiliation,
      page: params.page,
      per_page: params.perPage,
      sort: params.sort ?? 'updated',
      visibility: params.visibility ?? 'all',
    },
  });

  return repositories.map(mapGitHubRepository);
}

export async function createRepository(
  client: GitHubClient,
  input: CreateRepositoryInput,
): Promise<Repository> {
  const repository = await client.request<GitHubRepository>('/user/repos', {
    method: 'POST',
    body: {
      name: input.name,
      description: input.description,
      private: input.visibility !== 'public',
      auto_init: input.autoInit ?? true,
    },
  });

  return mapGitHubRepository(repository);
}

export async function getRepository(
  client: GitHubClient,
  repository: RepositoryRef,
): Promise<Repository> {
  const githubRepository = await client.request<GitHubRepository>(
    createRepositoryPath(repository),
  );

  return mapGitHubRepository(githubRepository);
}

