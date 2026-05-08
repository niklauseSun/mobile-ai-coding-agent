import { create } from 'zustand';

import type { AiProviderType, GitProviderType, MergeMethod, RepositoryVisibility } from '@/types';
import { deleteSecureItem, getSecureItem, setSecureItem } from '@/utils/secure-storage';

const aiProviderApiKeyPrefix = 'settings.aiProvider.apiKey';

type SettingsState = {
  selectedGitProvider: GitProviderType;
  selectedAiProvider: AiProviderType;
  aiProviderBaseUrl: string;
  aiProviderModel: string;
  hasSelectedAiProviderApiKey: boolean;
  defaultMergeMethod: MergeMethod;
  preferredRepoVisibility: RepositoryVisibility;
  setSelectedGitProvider: (selectedGitProvider: GitProviderType) => void;
  setSelectedAiProvider: (selectedAiProvider: AiProviderType) => void;
  setAiProviderBaseUrl: (aiProviderBaseUrl: string) => void;
  setAiProviderModel: (aiProviderModel: string) => void;
  setDefaultMergeMethod: (defaultMergeMethod: MergeMethod) => void;
  setPreferredRepoVisibility: (preferredRepoVisibility: RepositoryVisibility) => void;
  setAiProviderApiKey: (providerType: AiProviderType, apiKey: string) => Promise<void>;
  getAiProviderApiKey: (providerType: AiProviderType) => Promise<string | null>;
  deleteAiProviderApiKey: (providerType: AiProviderType) => Promise<void>;
  refreshSelectedAiProviderApiKeyState: () => Promise<boolean>;
};

function getAiProviderApiKeyStorageKey(providerType: AiProviderType) {
  return `${aiProviderApiKeyPrefix}.${providerType}`;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  selectedGitProvider: 'github',
  selectedAiProvider: 'openai',
  aiProviderBaseUrl: 'https://api.openai.com/v1',
  aiProviderModel: 'gpt-4.1',
  hasSelectedAiProviderApiKey: false,
  defaultMergeMethod: 'squash',
  preferredRepoVisibility: 'private',
  setSelectedGitProvider: (selectedGitProvider) => set({ selectedGitProvider }),
  setSelectedAiProvider: (selectedAiProvider) => set({ selectedAiProvider }),
  setAiProviderBaseUrl: (aiProviderBaseUrl) => set({ aiProviderBaseUrl }),
  setAiProviderModel: (aiProviderModel) => set({ aiProviderModel }),
  setDefaultMergeMethod: (defaultMergeMethod) => set({ defaultMergeMethod }),
  setPreferredRepoVisibility: (preferredRepoVisibility) => set({ preferredRepoVisibility }),
  setAiProviderApiKey: async (providerType, apiKey) => {
    await setSecureItem(getAiProviderApiKeyStorageKey(providerType), apiKey);
    set((state) => ({
      hasSelectedAiProviderApiKey:
        state.selectedAiProvider === providerType ? true : state.hasSelectedAiProviderApiKey,
    }));
  },
  getAiProviderApiKey: (providerType) =>
    getSecureItem(getAiProviderApiKeyStorageKey(providerType)),
  deleteAiProviderApiKey: async (providerType) => {
    await deleteSecureItem(getAiProviderApiKeyStorageKey(providerType));
    set((state) => ({
      hasSelectedAiProviderApiKey:
        state.selectedAiProvider === providerType ? false : state.hasSelectedAiProviderApiKey,
    }));
  },
  refreshSelectedAiProviderApiKeyState: async (): Promise<boolean> => {
    const { selectedAiProvider } = get();
    const hasSelectedAiProviderApiKey = Boolean(
      await getSecureItem(getAiProviderApiKeyStorageKey(selectedAiProvider)),
    );
    set({ hasSelectedAiProviderApiKey });
    return hasSelectedAiProviderApiKey;
  },
}));
