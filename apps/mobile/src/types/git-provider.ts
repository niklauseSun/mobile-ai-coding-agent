export type GitProviderType = 'github' | 'gitee' | 'gitlab' | 'mock';

export type ProviderExternalIds = {
  github?: {
    id?: number;
    nodeId?: string;
    fullName?: string;
  };
  gitee?: {
    id?: number | string;
    path?: string;
  };
  gitlab?: {
    id?: number;
    fullPath?: string;
  };
  mock?: {
    id?: string;
  };
};

export type GitProviderAccount = {
  id: string;
  providerType: GitProviderType;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  externalIds?: ProviderExternalIds;
};

export type GitProvider = {
  type: GitProviderType;
  label: string;
  baseUrl: string;
  account?: GitProviderAccount;
  isConnected: boolean;
};
