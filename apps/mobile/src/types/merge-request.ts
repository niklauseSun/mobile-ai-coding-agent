import type { DiffFile, ReviewFinding } from './diff';
import type { GitProviderType, ProviderExternalIds } from './git-provider';
import type { Branch, Repository } from './repository';
import type { MergeConflictStatus } from './workflow';

export type MergeMethod = 'merge' | 'squash' | 'rebase';

export type MergeRequestState = 'draft' | 'open' | 'closed' | 'merged';

export type ReviewDecision = 'approved' | 'changes_requested' | 'commented' | 'pending';

export type MergeRequestAuthor = {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
};

export type MergeRequestBranchRef = Pick<Branch, 'name' | 'sha'> & {
  repositoryId: Repository['id'];
};

export type MergeRequest = {
  id: string;
  providerType: GitProviderType;
  repositoryId: Repository['id'];
  number: number;
  title: string;
  body?: string;
  state: MergeRequestState;
  author?: MergeRequestAuthor;
  sourceBranch: MergeRequestBranchRef;
  targetBranch: MergeRequestBranchRef;
  isDraft: boolean;
  isMergeable?: boolean;
  mergeConflictStatus: MergeConflictStatus;
  allowedMergeMethods: MergeMethod[];
  reviewDecision?: ReviewDecision;
  diffFiles?: DiffFile[];
  reviewFindings?: ReviewFinding[];
  webUrl?: string;
  externalIds?: ProviderExternalIds;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  closedAt?: string;
};
