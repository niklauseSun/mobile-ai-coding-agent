import {
  dispatchWorkflow,
  getWorkflowRun,
  listWorkflowRuns,
} from '@/api/github/actions';
import {
  createBranchFromRef,
  deleteBranch,
  getBranch,
  listBranches,
} from '@/api/github/branches';
import { getCheckRunSummary } from '@/api/github/checks';
import {
  GitHubClient,
  GitHubApiError,
  type GitHubClientConfig,
  type RepositoryRef,
} from '@/api/github/client';
import {
  commitRepositoryFiles,
  getRepositoryFileMetadata,
} from '@/api/github/contents';
import { getIssue, listIssues } from '@/api/github/issues';
import {
  createPullRequest,
  createMergeRequestComment,
  getPullRequest,
  listPullRequestFiles,
  listPullRequests,
  mergePullRequest,
  submitReviewApprove,
  submitReviewRequestChanges,
} from '@/api/github/pulls';
import {
  createRepository,
  getAuthenticatedUser,
  listRepositories,
} from '@/api/github/repos';

import type {
  GitProviderAdapter,
  GitProviderCapabilities,
  RepositorySelector,
} from './GitProviderAdapter';

export class GitHubProviderAdapter implements GitProviderAdapter {
  readonly type = 'github';
  readonly label = 'GitHub';
  readonly capabilities: GitProviderCapabilities = {
    supportsCreateRepository: true,
    supportsWorkflowDispatch: true,
    supportsDraftMergeRequest: true,
    supportsMergeRequestComments: true,
    supportsReviewApproval: true,
    supportsMerge: true,
    supportsConflictStatus: true,
    supportsDeleteSourceBranch: true,
    supportsRepositoryFileRead: true,
    supportsRepositoryFileWrite: true,
  };

  private readonly client: GitHubClient;

  constructor(config: GitHubClientConfig | GitHubClient) {
    this.client = config instanceof GitHubClient ? config : new GitHubClient(config);
  }

  getCurrentUser: GitProviderAdapter['getCurrentUser'] = () =>
    getAuthenticatedUser(this.client);

  listRepositories: GitProviderAdapter['listRepositories'] = (options = {}) =>
    listRepositories(this.client, options);

  listBranches: GitProviderAdapter['listBranches'] = (repository, options = {}) =>
    listBranches(this.client, toRepositoryRef(repository), options);

  createRepository: GitProviderAdapter['createRepository'] = (options) =>
    createRepository(this.client, options);

  getRepositoryFile: NonNullable<GitProviderAdapter['getRepositoryFile']> = (
    repository,
    path,
    ref,
  ) => getRepositoryFileMetadata(this.client, toRepositoryRef(repository), path, ref);

  createBranch: NonNullable<GitProviderAdapter['createBranch']> = async (
    repository,
    options,
  ) => {
    try {
      return await createBranchFromRef(this.client, toRepositoryRef(repository), {
        fromRef: options.sourceBranch,
        newBranchName: options.branchName,
      });
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 422) {
        return getBranch(this.client, toRepositoryRef(repository), options.branchName);
      }

      throw error;
    }
  };

  commitRepositoryFiles: NonNullable<GitProviderAdapter['commitRepositoryFiles']> = (
    repository,
    options,
  ) =>
    commitRepositoryFiles(this.client, toRepositoryRef(repository), {
      branch: options.branchName,
      files: options.files,
      message: options.message,
    }).then((commit) => ({
      commitSha: commit.sha,
      commitUrl: commit.webUrl,
    }));

  listIssues: GitProviderAdapter['listIssues'] = (repository, options = {}) =>
    listIssues(this.client, toRepositoryRef(repository), options);

  getIssue: GitProviderAdapter['getIssue'] = (repository, issueNumber) =>
    getIssue(this.client, toRepositoryRef(repository), issueNumber);

  listMergeRequests: GitProviderAdapter['listMergeRequests'] = (repository, options = {}) =>
    listPullRequests(this.client, toRepositoryRef(repository), {
      state: options.state,
      base: options.targetBranch,
      head: formatPullRequestHead(repository, options.sourceBranch),
      page: options.page,
      perPage: options.perPage,
    });

  getMergeRequest: GitProviderAdapter['getMergeRequest'] = (
    repository,
    mergeRequestNumber,
  ) => getPullRequest(this.client, toRepositoryRef(repository), mergeRequestNumber);

  listMergeRequestFiles: GitProviderAdapter['listMergeRequestFiles'] = (
    repository,
    mergeRequestNumber,
  ) => listPullRequestFiles(this.client, toRepositoryRef(repository), mergeRequestNumber);

  createMergeRequest: GitProviderAdapter['createMergeRequest'] = (repository, options) =>
    createPullRequest(this.client, toRepositoryRef(repository), {
      title: options.title,
      body: options.body,
      base: options.targetBranch,
      head: options.sourceBranch,
      draft: options.draft,
    });

  approveMergeRequest: NonNullable<GitProviderAdapter['approveMergeRequest']> = (
    repository,
    mergeRequestNumber,
    body,
  ) => this.submitReviewApprove(repository, mergeRequestNumber, body);

  submitReviewApprove: NonNullable<GitProviderAdapter['submitReviewApprove']> = (
    repository,
    mergeRequestNumber,
    body,
  ) =>
    submitReviewApprove(
      this.client,
      toRepositoryRef(repository),
      mergeRequestNumber,
      body,
    );

  requestChanges: NonNullable<GitProviderAdapter['requestChanges']> = (
    repository,
    mergeRequestNumber,
    body,
  ) => this.submitReviewRequestChanges(repository, mergeRequestNumber, body);

  submitReviewRequestChanges: NonNullable<
    GitProviderAdapter['submitReviewRequestChanges']
  > = (repository, mergeRequestNumber, body) =>
    submitReviewRequestChanges(
      this.client,
      toRepositoryRef(repository),
      mergeRequestNumber,
      body,
    );

  createMergeRequestComment: NonNullable<
    GitProviderAdapter['createMergeRequestComment']
  > = (repository, mergeRequestNumber, body) =>
    createMergeRequestComment(
      this.client,
      toRepositoryRef(repository),
      mergeRequestNumber,
      body,
    );

  submitMergeRequestComment: NonNullable<
    GitProviderAdapter['submitMergeRequestComment']
  > = (repository, mergeRequestNumber, body) =>
    this.createMergeRequestComment(repository, mergeRequestNumber, body);

  mergeMergeRequest: GitProviderAdapter['mergeMergeRequest'] = (
    repository,
    mergeRequestNumber,
    options = {},
  ) =>
    mergePullRequest(this.client, toRepositoryRef(repository), mergeRequestNumber, {
      method: options.method,
      commitTitle: options.commitTitle,
      commitMessage: options.commitMessage,
      expectedHeadSha: options.expectedHeadSha,
    });

  deleteBranch: NonNullable<GitProviderAdapter['deleteBranch']> = (
    repository,
    branchName,
  ) => deleteBranch(this.client, toRepositoryRef(repository), branchName);

  dispatchAiCodingWorkflow: GitProviderAdapter['dispatchAiCodingWorkflow'] = (
    repository,
    options,
  ) =>
    dispatchWorkflow(this.client, toRepositoryRef(repository), {
      workflowId: options.workflowId,
      ref: options.ref,
      inputs: {
        task_prompt: options.taskPrompt,
        base_branch: options.baseBranch,
        ...(options.branchName ? { branch_name: options.branchName } : undefined),
        ...(options.issueNumber ? { issue_number: options.issueNumber } : undefined),
        ...(options.targetBranch ? { target_branch: options.targetBranch } : undefined),
        ...(options.techStack ? { tech_stack: options.techStack } : undefined),
        ...options.inputs,
      },
    });

  dispatchConflictResolutionWorkflow: GitProviderAdapter['dispatchConflictResolutionWorkflow'] = (
    repository,
    options,
  ) =>
    dispatchWorkflow(this.client, toRepositoryRef(repository), {
      workflowId: options.workflowId,
      ref: options.ref,
      inputs: {
        pr_number: options.mergeRequestNumber,
        source_branch: options.sourceBranch ?? '',
        target_branch: options.targetBranch ?? '',
        ...options.inputs,
      },
    });

  getWorkflowStatus: GitProviderAdapter['getWorkflowStatus'] = (
    repository,
    workflowRunId,
  ) => getWorkflowRun(this.client, toRepositoryRef(repository), workflowRunId);

  listWorkflowRuns: GitProviderAdapter['listWorkflowRuns'] = (
    repository,
    options = {},
  ) => listWorkflowRuns(this.client, toRepositoryRef(repository), options);

  getMergeRequestChecks: NonNullable<GitProviderAdapter['getMergeRequestChecks']> = (
    repository,
    mergeRequest,
  ) =>
    getCheckRunSummary(
      this.client,
      toRepositoryRef(repository),
      mergeRequest.sourceBranch.sha,
    );
}

function toRepositoryRef(repository: RepositorySelector): RepositoryRef {
  return {
    owner: repository.owner,
    repo: repository.name,
  };
}

function formatPullRequestHead(
  repository: RepositorySelector,
  sourceBranch?: string,
) {
  if (!sourceBranch || sourceBranch.includes(':')) {
    return sourceBranch;
  }

  return `${repository.owner}:${sourceBranch}`;
}
