#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BODY_PATH = '.ai-coding/pr-body.md';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function redact(value) {
  const token = process.env.GH_TOKEN;

  if (!token) {
    return value;
  }

  return value.split(token).join('[REDACTED_GITHUB_TOKEN]');
}

function gh(args, options = {}) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (error) {
    const stderr = String(error.stderr ?? '').trim();
    throw new Error(stderr || `gh ${args.join(' ')} failed`);
  }
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 15).trimEnd()}... [truncated]`;
}

function titleFromPrompt(prompt) {
  const firstLine = prompt.split('\n').map((line) => line.trim()).find(Boolean) ?? 'AI coding changes';
  const cleaned = firstLine.replace(/\s+/g, ' ');
  return truncate(cleaned, 70);
}

function createBody({ prompt, issueNumber, techStack, workflowUrl }) {
  const lines = [
    '## Summary',
    '',
    'This pull request was created by the mobile AI coding workflow.',
    '',
    '## Automation',
    '',
    `- Workflow run: ${workflowUrl || 'Unavailable'}`,
    `- Tech stack hint: ${techStack || 'Not provided'}`,
  ];

  if (issueNumber) {
    lines.push(`- Related issue: #${issueNumber}`);
  }

  lines.push(
    '',
    '## Review Notes',
    '',
    '- Review the generated diff before merging.',
    '- Confirm no secrets, credentials, or sensitive repository context were added.',
    '- Run any project-specific checks that are not covered by this workflow.'
  );

  if (process.env.AI_PR_BODY_INCLUDE_PROMPT === 'true') {
    lines.push(
      '',
      '<details>',
      '<summary>Task prompt</summary>',
      '',
      '```text',
      truncate(prompt, 2_000),
      '```',
      '</details>'
    );
  }

  return `${lines.join('\n')}\n`;
}

function listExistingPullRequest({ baseBranch, headBranch }) {
  const output = gh([
    'pr',
    'list',
    '--state',
    'open',
    '--base',
    baseBranch,
    '--head',
    headBranch,
    '--json',
    'number,url',
    '--limit',
    '1',
  ]);

  const prs = JSON.parse(output || '[]');
  return prs[0] ?? null;
}

export function createOrUpdatePullRequest() {
  requiredEnv('GH_TOKEN');

  const baseBranch = requiredEnv('BASE_BRANCH');
  const headBranch = requiredEnv('AGENT_BRANCH');
  const prompt = requiredEnv('TASK_PROMPT');
  const issueNumber = process.env.ISSUE_NUMBER ?? '';
  const techStack = process.env.TECH_STACK ?? '';
  const workflowUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : '';
  const title = process.env.PR_TITLE || titleFromPrompt(prompt);
  const body = createBody({ prompt, issueNumber, techStack, workflowUrl });

  mkdirSync(path.dirname(BODY_PATH), { recursive: true });
  writeFileSync(BODY_PATH, body, 'utf8');

  const existingPr = listExistingPullRequest({ baseBranch, headBranch });

  if (existingPr) {
    gh(['pr', 'edit', String(existingPr.number), '--title', title, '--body-file', BODY_PATH], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log(`Updated pull request ${existingPr.url}.`);
    return existingPr;
  }

  const url = gh([
    'pr',
    'create',
    '--base',
    baseBranch,
    '--head',
    headBranch,
    '--title',
    title,
    '--body-file',
    BODY_PATH,
  ]);
  console.log(`Created pull request ${url}.`);
  return { url };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    createOrUpdatePullRequest();
  } catch (error) {
    console.error(redact(error.message));
    process.exit(1);
  }
}
