import type { CheckRunSummary, CheckRunSummaryStatus } from '@/types';

import {
  createRepositoryPath,
  GitHubClient,
  type RepositoryRef,
} from './client';

type GitHubCheckRun = {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
  conclusion?:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | null;
  completed_at?: string | null;
};

type GitHubCheckRunsResponse = {
  total_count: number;
  check_runs: GitHubCheckRun[];
};

export async function getCheckRunSummary(
  client: GitHubClient,
  repository: RepositoryRef,
  ref: string,
): Promise<CheckRunSummary> {
  const response = await client.request<GitHubCheckRunsResponse>(
    `${createRepositoryPath(repository)}/commits/${encodeURIComponent(ref)}/check-runs`,
    {
      query: {
        per_page: 100,
      },
    },
  );

  return summarizeCheckRuns(response.check_runs, response.total_count);
}

function summarizeCheckRuns(
  checkRuns: GitHubCheckRun[],
  totalCount: number,
): CheckRunSummary {
  const queuedCount = checkRuns.filter((run) =>
    ['pending', 'queued', 'requested', 'waiting'].includes(run.status),
  ).length;
  const inProgressCount = checkRuns.filter((run) => run.status === 'in_progress').length;
  const succeededCount = checkRuns.filter(
    (run) => run.status === 'completed' && run.conclusion === 'success',
  ).length;
  const skippedCount = checkRuns.filter(
    (run) => run.status === 'completed' && run.conclusion === 'skipped',
  ).length;
  const failedCount = checkRuns.filter(
    (run) =>
      run.status === 'completed' &&
      run.conclusion !== 'success' &&
      run.conclusion !== 'skipped',
  ).length;

  return {
    status: getSummaryStatus({
      failedCount,
      inProgressCount,
      queuedCount,
      skippedCount,
      succeededCount,
      totalCount,
    }),
    totalCount,
    queuedCount,
    inProgressCount,
    succeededCount,
    failedCount,
    skippedCount,
    completedAt: getLatestCompletedAt(checkRuns),
  };
}

function getSummaryStatus(counts: {
  failedCount: number;
  inProgressCount: number;
  queuedCount: number;
  skippedCount: number;
  succeededCount: number;
  totalCount: number;
}): CheckRunSummaryStatus {
  if (counts.totalCount === 0) {
    return 'unavailable';
  }

  if (counts.failedCount > 0) {
    return 'failed';
  }

  if (counts.inProgressCount > 0) {
    return 'in_progress';
  }

  if (counts.queuedCount > 0) {
    return 'queued';
  }

  if (counts.succeededCount > 0) {
    return 'succeeded';
  }

  if (counts.skippedCount > 0) {
    return 'skipped';
  }

  return 'unavailable';
}

function getLatestCompletedAt(checkRuns: GitHubCheckRun[]) {
  return checkRuns
    .map((run) => run.completed_at)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}
