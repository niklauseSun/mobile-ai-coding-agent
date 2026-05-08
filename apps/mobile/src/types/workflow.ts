import type { GitProviderType, ProviderExternalIds } from './git-provider';
import type { MergeRequest } from './merge-request';
import type { Repository } from './repository';

export type WorkflowRunnerType = 'github_actions' | 'gitee_go' | 'gitlab_ci';

export type WorkflowRunner = {
  type: WorkflowRunnerType;
  providerType: GitProviderType;
  label: string;
};

export type WorkflowRunStatus =
  | 'queued'
  | 'in_progress'
  | 'waiting'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export type WorkflowRunOperation = 'generate' | 'modify' | 'review' | 'resolve_conflict';

export type MergeConflictStatus =
  | 'unknown'
  | 'clean'
  | 'conflicted'
  | 'resolution_running'
  | 'resolved'
  | 'unresolved';

export type WorkflowRun = {
  id: string;
  providerType: GitProviderType;
  runner: WorkflowRunner;
  repositoryId: Repository['id'];
  mergeRequestId?: MergeRequest['id'];
  operation: WorkflowRunOperation;
  status: WorkflowRunStatus;
  branchName?: string;
  commitSha?: string;
  logUrl?: string;
  webUrl?: string;
  externalIds?: ProviderExternalIds;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CheckRunSummaryStatus =
  | 'queued'
  | 'in_progress'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'unavailable';

export type CheckRunSummary = {
  status: CheckRunSummaryStatus;
  totalCount: number;
  queuedCount: number;
  inProgressCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  completedAt?: string;
};
