import type { GitProviderType, ProviderExternalIds } from './git-provider';
import type { Repository } from './repository';

export type IssueState = 'open' | 'closed';

export type IssueLabel = {
  id: string;
  name: string;
  color?: string;
  description?: string;
};

export type IssueAuthor = {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
};

export type Issue = {
  id: string;
  providerType: GitProviderType;
  repositoryId: Repository['id'];
  number: number;
  title: string;
  body?: string;
  state: IssueState;
  author?: IssueAuthor;
  labels: IssueLabel[];
  webUrl?: string;
  externalIds?: ProviderExternalIds;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
};
