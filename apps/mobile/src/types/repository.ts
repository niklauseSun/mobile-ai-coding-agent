import type { GitProviderType, ProviderExternalIds } from './git-provider';

export type RepositoryVisibility = 'public' | 'private' | 'internal';

export type RepositoryPermission = 'read' | 'triage' | 'write' | 'maintain' | 'admin';

export type RepositoryOwner = {
  id: string;
  providerType: GitProviderType;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  externalIds?: ProviderExternalIds;
};

export type Branch = {
  name: string;
  sha: string;
  isDefault: boolean;
  isProtected?: boolean;
};

export type Repository = {
  id: string;
  providerType: GitProviderType;
  name: string;
  fullName: string;
  owner: RepositoryOwner;
  defaultBranch: Branch;
  visibility: RepositoryVisibility;
  permissions: RepositoryPermission[];
  description?: string;
  webUrl?: string;
  cloneUrl?: string;
  externalIds?: ProviderExternalIds;
  createdAt?: string;
  updatedAt?: string;
};
