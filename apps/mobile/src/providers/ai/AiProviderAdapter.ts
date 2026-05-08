import type { AiProviderType, AiReviewResult, DiffFile, MergeRequest, Repository } from '@/types';

export type ReviewMergeRequestDiffInput = {
  repository: Repository;
  mergeRequest: MergeRequest;
  diffFiles: DiffFile[];
};

export type AiProviderCapabilities = {
  supportsMergeRequestReview: boolean;
  supportsMobileCodeGeneration: boolean;
};

export type AiProviderAdapter = {
  readonly type: AiProviderType;
  readonly label: string;
  readonly capabilities: AiProviderCapabilities;
  reviewMergeRequestDiff: (input: ReviewMergeRequestDiffInput) => Promise<AiReviewResult>;
};

