import type { Issue, IssueLabel } from '@/types';

import { createRepositoryPath, GitHubClient, type GitHubUser, type RepositoryRef } from './client';

export type ListIssuesParams = {
  state?: 'all' | 'closed' | 'open';
  labels?: string[];
  page?: number;
  perPage?: number;
};

type GitHubIssue = {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body?: string | null;
  state: 'open' | 'closed';
  html_url?: string;
  user?: GitHubUser | null;
  labels: (string | GitHubIssueLabel)[];
  pull_request?: unknown;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
};

type GitHubIssueLabel = {
  id?: number;
  node_id?: string;
  name: string;
  color?: string;
  description?: string | null;
};

export async function listIssues(
  client: GitHubClient,
  repository: RepositoryRef,
  params: ListIssuesParams = {},
): Promise<Issue[]> {
  const issues = await client.request<GitHubIssue[]>(`${createRepositoryPath(repository)}/issues`, {
    query: {
      state: params.state ?? 'open',
      labels: params.labels?.join(','),
      page: params.page,
      per_page: params.perPage,
    },
  });

  return issues.filter((issue) => !issue.pull_request).map((issue) => mapGitHubIssue(issue, repository));
}

export async function getIssue(
  client: GitHubClient,
  repository: RepositoryRef,
  issueNumber: number,
): Promise<Issue> {
  const issue = await client.request<GitHubIssue>(
    `${createRepositoryPath(repository)}/issues/${issueNumber}`,
  );

  return mapGitHubIssue(issue, repository);
}

function mapGitHubIssue(issue: GitHubIssue, repository: RepositoryRef): Issue {
  return {
    id: String(issue.id),
    providerType: 'github',
    repositoryId: `${repository.owner}/${repository.repo}`,
    number: issue.number,
    title: issue.title,
    body: issue.body ?? undefined,
    state: issue.state,
    author: issue.user
      ? {
          id: String(issue.user.id),
          username: issue.user.login,
          displayName: issue.user.name ?? undefined,
          avatarUrl: issue.user.avatar_url ?? undefined,
        }
      : undefined,
    labels: issue.labels.map(mapGitHubIssueLabel),
    webUrl: issue.html_url,
    externalIds: {
      github: {
        id: issue.id,
        nodeId: issue.node_id,
      },
    },
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at ?? undefined,
  };
}

function mapGitHubIssueLabel(label: string | GitHubIssueLabel): IssueLabel {
  if (typeof label === 'string') {
    return {
      id: label,
      name: label,
    };
  }

  return {
    id: String(label.id ?? label.node_id ?? label.name),
    name: label.name,
    color: label.color,
    description: label.description ?? undefined,
  };
}
