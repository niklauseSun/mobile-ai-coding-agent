import { create } from 'zustand';

import type { GitProviderAccount, GitProviderType } from '@/types';
import { deleteSecureItem, getSecureItem, setSecureItem } from '@/utils/secure-storage';

const githubAccessTokenKey = 'auth.github.accessToken';

type AuthStatus = 'signed_out' | 'connecting' | 'signed_in';

type AuthState = {
  status: AuthStatus;
  connectedAccount?: GitProviderAccount;
  hasGitHubAccessToken: boolean;
  setConnecting: () => void;
  setConnectedAccount: (account: GitProviderAccount) => void;
  clearConnectedAccount: () => void;
  setGitHubAccessToken: (accessToken: string) => Promise<void>;
  getGitHubAccessToken: () => Promise<string | null>;
  clearGitHubAccessToken: () => Promise<void>;
  refreshGitHubAccessTokenState: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'signed_out',
  hasGitHubAccessToken: false,
  setConnecting: () => set({ status: 'connecting' }),
  setConnectedAccount: (account) =>
    set({
      status: 'signed_in',
      connectedAccount: account,
    }),
  clearConnectedAccount: () =>
    set({
      status: 'signed_out',
      connectedAccount: undefined,
      hasGitHubAccessToken: false,
    }),
  setGitHubAccessToken: async (accessToken) => {
    await setSecureItem(githubAccessTokenKey, accessToken);
    set({ hasGitHubAccessToken: true });
  },
  getGitHubAccessToken: () => getSecureItem(githubAccessTokenKey),
  clearGitHubAccessToken: async () => {
    await deleteSecureItem(githubAccessTokenKey);
    set({ hasGitHubAccessToken: false });
  },
  refreshGitHubAccessTokenState: async () => {
    const hasGitHubAccessToken = Boolean(await getSecureItem(githubAccessTokenKey));
    set({ hasGitHubAccessToken });
    return hasGitHubAccessToken;
  },
  signOut: async () => {
    await get().clearGitHubAccessToken();
    get().clearConnectedAccount();
  },
}));

export function getAccessTokenKeyForProvider(providerType: GitProviderType) {
  if (providerType === 'github') {
    return githubAccessTokenKey;
  }

  return `auth.${providerType}.accessToken`;
}
