import { useMemo } from 'react';

import { useAuthStore } from '@/state/auth-store';
import { useSettingsStore } from '@/state/settings-store';

import { GitHubProviderAdapter } from '../GitHubProviderAdapter';
import { MockGitProviderAdapter } from '../MockGitProviderAdapter';

export function useGitProviderAdapter() {
  const getGitHubAccessToken = useAuthStore((state) => state.getGitHubAccessToken);
  const selectedGitProvider = useSettingsStore((state) => state.selectedGitProvider);

  return useMemo(() => {
    if (selectedGitProvider === 'mock') {
      return new MockGitProviderAdapter();
    }

    return new GitHubProviderAdapter({
      getToken: getGitHubAccessToken,
    });
  }, [getGitHubAccessToken, selectedGitProvider]);
}
