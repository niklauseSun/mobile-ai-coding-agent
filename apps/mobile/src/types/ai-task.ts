import type { ReviewFinding } from './diff';
import type { MergeRequest } from './merge-request';
import type { Repository } from './repository';

export type AiCodingTaskType = 'generate' | 'modify' | 'review' | 'resolve_conflict';

export type AiCodingTaskStatus =
  | 'queued'
  | 'running'
  | 'needs_user_input'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type AiReviewRiskLevel = 'low' | 'medium' | 'high';

export type AiReviewRecommendation =
  | 'approve'
  | 'approve_with_comments'
  | 'request_changes';

export type AiCodingTask = {
  id: string;
  type: AiCodingTaskType;
  status: AiCodingTaskStatus;
  repositoryId: Repository['id'];
  repositoryFullName?: Repository['fullName'];
  repositoryName?: Repository['name'];
  repositoryOwner?: Repository['owner']['username'];
  mergeRequestId?: MergeRequest['id'];
  mergeRequestNumber?: MergeRequest['number'];
  mergeRequestUrl?: string;
  prompt: string;
  baseBranch?: string;
  issueNumber?: string;
  targetBranch?: string;
  sourceBranch?: string;
  techStack?: string;
  workflowId?: string;
  workflowLogUrl?: string;
  workflowRunId?: string;
  workflowRunUrl?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
};

export type AiReviewResult = {
  id: string;
  taskId: AiCodingTask['id'];
  repositoryId: Repository['id'];
  mergeRequestId?: MergeRequest['id'];
  summary: string;
  riskLevel: AiReviewRiskLevel;
  findings: ReviewFinding[];
  recommendation: AiReviewRecommendation;
  isApprovedSuggestion?: boolean;
  createdAt: string;
};
