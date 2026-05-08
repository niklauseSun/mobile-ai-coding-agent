import type { WorkflowRun } from '@/types';

import {
  createRepositoryPath,
  GitHubClient,
  type GitHubWorkflowRun,
  mapGitHubWorkflowRun,
  type RepositoryRef,
} from './client';

export type DispatchWorkflowInput = {
  workflowId: number | string;
  ref: string;
  inputs?: Record<string, boolean | number | string>;
};

export type ListWorkflowRunsParams = {
  branch?: string;
  event?: string;
  status?: string;
  workflowId?: number | string;
  page?: number;
  perPage?: number;
};

type GitHubWorkflowRunsResponse = {
  total_count: number;
  workflow_runs: GitHubWorkflowRun[];
};

export async function dispatchWorkflow(
  client: GitHubClient,
  repository: RepositoryRef,
  input: DispatchWorkflowInput,
): Promise<void> {
  await client.request<void>(
    `${createRepositoryPath(repository)}/actions/workflows/${encodeURIComponent(
      String(input.workflowId),
    )}/dispatches`,
    {
      method: 'POST',
      body: {
        ref: input.ref,
        inputs: input.inputs,
      },
    },
  );
}

export async function getWorkflowRun(
  client: GitHubClient,
  repository: RepositoryRef,
  runId: number | string,
): Promise<WorkflowRun> {
  const run = await client.request<GitHubWorkflowRun>(
    `${createRepositoryPath(repository)}/actions/runs/${runId}`,
  );

  return mapGitHubWorkflowRun(run);
}

export async function listWorkflowRuns(
  client: GitHubClient,
  repository: RepositoryRef,
  params: ListWorkflowRunsParams = {},
): Promise<WorkflowRun[]> {
  const workflowRunsPath = params.workflowId
    ? `${createRepositoryPath(repository)}/actions/workflows/${encodeURIComponent(
        String(params.workflowId),
      )}/runs`
    : `${createRepositoryPath(repository)}/actions/runs`;

  const response = await client.request<GitHubWorkflowRunsResponse>(
    workflowRunsPath,
    {
      query: {
        branch: params.branch,
        event: params.event,
        status: params.status,
        page: params.page,
        per_page: params.perPage,
      },
    },
  );

  return response.workflow_runs.map(mapGitHubWorkflowRun);
}
