export type AiProviderType = 'openai' | 'anthropic' | 'google' | 'custom';

export type AiProvider = {
  type: AiProviderType;
  label: string;
  baseUrl?: string;
  isConfigured: boolean;
  defaultModel?: string;
};

export type AiModelCapability = 'code_generation' | 'code_review' | 'conflict_resolution';

export type AiModel = {
  id: string;
  providerType: AiProviderType;
  label: string;
  capabilities: AiModelCapability[];
  contextWindowTokens?: number;
};

