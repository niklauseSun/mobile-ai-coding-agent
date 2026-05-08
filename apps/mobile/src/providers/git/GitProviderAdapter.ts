import type {
  Branch,
  CheckRunSummary,
  DiffFile,
  GitProviderAccount,
  GitProviderType,
  Issue,
  MergeMethod,
  MergeRequest,
  Repository,
  RepositoryVisibility,
  WorkflowRun,
} from '@/types';

export type GitProviderCapabilities = {
  supportsCreateRepository: boolean;
  supportsWorkflowDispatch: boolean;
  supportsDraftMergeRequest: boolean;
  supportsMergeRequestComments: boolean;
  supportsReviewApproval: boolean;
  supportsMerge: boolean;
  supportsConflictStatus: boolean;
  supportsDeleteSourceBranch: boolean;
  supportsRepositoryFileRead: boolean;
  supportsRepositoryFileWrite: boolean;
};

export type RepositorySelector = {
  owner: string;
  name: string;
};

export type ListRepositoriesOptions = {
  page?: number;
  perPage?: number;
  visibility?: 'all' | RepositoryVisibility;
};

export type ListBranchesOptions = {
  page?: number;
  perPage?: number;
  protected?: boolean;
};

export type CreateRepositoryOptions = {
  name: string;
  description?: string;
  visibility?: RepositoryVisibility;
  autoInit?: boolean;
};

export type RepositoryFile = {
  path: string;
  sha: string;
  webUrl?: string;
};

export type CreateBranchOptions = {
  branchName: string;
  sourceBranch: string;
};

export type CommitRepositoryFilesOptions = {
  branchName: string;
  files: {
    path: string;
    content: string;
  }[];
  message: string;
};

export type CommitRepositoryFilesResult = {
  commitSha: string;
  commitUrl?: string;
};

export type ListIssuesOptions = {
  state?: 'all' | 'closed' | 'open';
  labels?: string[];
  page?: number;
  perPage?: number;
};

export type ListMergeRequestsOptions = {
  state?: 'all' | 'closed' | 'open';
  targetBranch?: string;
  sourceBranch?: string;
  page?: number;
  perPage?: number;
};

export type CreateMergeRequestOptions = {
  title: string;
  sourceBranch: string;
  targetBranch: string;
  body?: string;
  draft?: boolean;
};

export type MergeMergeRequestOptions = {
  method?: MergeMethod;
  commitTitle?: string;
  commitMessage?: string;
  expectedHeadSha?: string;
};

export type MergeMergeRequestResult = {
  sha: string;
  merged: boolean;
  message: string;
};

export type DispatchAiCodingWorkflowOptions = {
  workflowId: number | string;
  ref: string;
  taskPrompt: string;
  baseBranch: string;
  branchName?: string;
  issueNumber?: string;
  targetBranch?: string;
  techStack?: string;
  inputs?: Record<string, boolean | number | string>;
};

export type DispatchConflictResolutionWorkflowOptions = {
  workflowId: number | string;
  ref: string;
  mergeRequestNumber: number;
  sourceBranch?: string;
  targetBranch?: string;
  inputs?: Record<string, boolean | number | string>;
};

export type ListWorkflowRunsOptions = {
  branch?: string;
  event?: string;
  page?: number;
  perPage?: number;
  status?: string;
  workflowId?: number | string;
};

export type GitProviderAdapter = {
  readonly type: GitProviderType;
  readonly label: string;
  readonly capabilities: GitProviderCapabilities;
  getCurrentUser: () => Promise<GitProviderAccount>;
  listRepositories: (options?: ListRepositoriesOptions) => Promise<Repository[]>;
  listBranches: (
    repository: RepositorySelector,
    options?: ListBranchesOptions,
  ) => Promise<Branch[]>;
  createRepository: (options: CreateRepositoryOptions) => Promise<Repository>;
  getRepositoryFile?: (
    repository: RepositorySelector,
    path: string,
    ref?: string,
  ) => Promise<RepositoryFile | null>;
  createBranch?: (
    repository: RepositorySelector,
    options: CreateBranchOptions,
  ) => Promise<Branch>;
  commitRepositoryFiles?: (
    repository: RepositorySelector,
    options: CommitRepositoryFilesOptions,
  ) => Promise<CommitRepositoryFilesResult>;
  listIssues: (repository: RepositorySelector, options?: ListIssuesOptions) => Promise<Issue[]>;
  getIssue: (repository: RepositorySelector, issueNumber: number) => Promise<Issue>;
  listMergeRequests: (
    repository: RepositorySelector,
    options?: ListMergeRequestsOptions,
  ) => Promise<MergeRequest[]>;
  getMergeRequest: (
    repository: RepositorySelector,
    mergeRequestNumber: number,
  ) => Promise<MergeRequest>;
  listMergeRequestFiles: (
    repository: RepositorySelector,
    mergeRequestNumber: number,
  ) => Promise<DiffFile[]>;
  createMergeRequest: (
    repository: RepositorySelector,
    options: CreateMergeRequestOptions,
  ) => Promise<MergeRequest>;
  approveMergeRequest?: (
    repository: RepositorySelector,
    mergeRequestNumber: number,
    body?: string,
  ) => Promise<void>;
  submitReviewApprove?: (
    repository: RepositorySelector,
    mergeRequestNumber: number,
    body?: string,
  ) => Promise<void>;
  requestChanges?: (
    repository: RepositorySelector,
    mergeRequestNumber: number,
    body: string,
  ) => Promise<void>;
  submitReviewRequestChanges?: (
    repository: RepositorySelector,
    mergeRequestNumber: number,
    body: string,
  ) => Promise<void>;
  createMergeRequestComment?: (
    repository: RepositorySelector,
    mergeRequestNumber: number,
    body: string,
  ) => Promise<void>;
  submitMergeRequestComment?: (
    repository: RepositorySelector,
    mergeRequestNumber: number,
    body: string,
  ) => Promise<void>;
  mergeMergeRequest: (
    repository: RepositorySelector,
    mergeRequestNumber: number,
    options?: MergeMergeRequestOptions,
  ) => Promise<MergeMergeRequestResult>;
  deleteBranch?: (
    repository: RepositorySelector,
    branchName: string,
  ) => Promise<void>;
  dispatchAiCodingWorkflow: (
    repository: RepositorySelector,
    options: DispatchAiCodingWorkflowOptions,
  ) => Promise<void>;
  dispatchConflictResolutionWorkflow: (
    repository: RepositorySelector,
    options: DispatchConflictResolutionWorkflowOptions,
  ) => Promise<void>;
  getWorkflowStatus: (
    repository: RepositorySelector,
    workflowRunId: number | string,
  ) => Promise<WorkflowRun>;
  listWorkflowRuns: (
    repository: RepositorySelector,
    options?: ListWorkflowRunsOptions,
  ) => Promise<WorkflowRun[]>;
  getMergeRequestChecks?: (
    repository: RepositorySelector,
    mergeRequest: MergeRequest,
  ) => Promise<CheckRunSummary>;
};
