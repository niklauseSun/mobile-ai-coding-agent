import { describe, expect, it } from 'vitest';

import { MockGitProviderAdapter } from './MockGitProviderAdapter';
import type { RepositorySelector } from './GitProviderAdapter';

const repository: RepositorySelector = {
  owner: 'mobile-dev',
  name: 'mobile-agent-demo',
};

describe('GitProviderAdapter mock implementation', () => {
  it('exposes repositories, issues, merge requests, diffs, and workflow runs', async () => {
    const adapter = new MockGitProviderAdapter();

    const repositories = await adapter.listRepositories({ perPage: 10 });
    const issues = await adapter.listIssues(repository, { state: 'open' });
    const mergeRequests = await adapter.listMergeRequests(repository, { state: 'open' });
    const files = await adapter.listMergeRequestFiles(repository, 12);
    const workflowRuns = await adapter.listWorkflowRuns(repository, { branch: 'main' });

    expect(repositories.map((item) => item.fullName)).toContain(
      'mobile-dev/mobile-agent-demo',
    );
    expect(issues.map((issue) => issue.number)).toContain(101);
    expect(mergeRequests.map((mergeRequest) => mergeRequest.number)).toContain(12);
    expect(files.length).toBeGreaterThan(0);
    expect(workflowRuns.some((run) => run.status === 'succeeded')).toBe(true);
  });

  it('dispatches AI coding workflow and creates a matching PR', async () => {
    const adapter = new MockGitProviderAdapter();
    const branchName = `mobile-ai/test-${Date.now()}`;

    await adapter.dispatchAiCodingWorkflow(repository, {
      workflowId: 'mobile-ai-coding.yml',
      ref: 'main',
      taskPrompt: 'Add a local test task',
      baseBranch: 'main',
      branchName,
      techStack: 'react-native-expo',
    });

    const runs = await adapter.listWorkflowRuns(repository, { branch: 'main' });
    const mergeRequests = await adapter.listMergeRequests(repository, {
      sourceBranch: branchName,
      state: 'open',
      targetBranch: 'main',
    });

    expect(runs[0]).toMatchObject({
      providerType: 'mock',
      operation: 'modify',
      status: 'succeeded',
    });
    expect(mergeRequests[0]).toMatchObject({
      sourceBranch: {
        name: branchName,
      },
      targetBranch: {
        name: 'main',
      },
      mergeConflictStatus: 'clean',
    });
  });

  it('merges a clean PR and rejects a conflicted PR', async () => {
    const adapter = new MockGitProviderAdapter();
    const sourceBranch = `quality/test-merge-${Date.now()}`;
    const mergeRequest = await adapter.createMergeRequest(repository, {
      title: 'Quality setup smoke PR',
      sourceBranch,
      targetBranch: 'main',
      body: 'Created by adapter unit tests.',
    });

    await expect(adapter.mergeMergeRequest(repository, mergeRequest.number)).resolves.toMatchObject({
      merged: true,
      message: 'Mock merge completed successfully.',
    });
    await expect(adapter.mergeMergeRequest(repository, 13)).rejects.toMatchObject({
      status: 409,
    });
  });
});
