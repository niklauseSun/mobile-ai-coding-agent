#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_CONTEXT_PATH = '.ai-coding/context.json';
const MAX_CONTEXT_BYTES = toNumber(process.env.AI_CONTEXT_MAX_BYTES, 120_000);
const MAX_FILE_BYTES = toNumber(process.env.AI_CONTEXT_MAX_FILE_BYTES, 16_000);
const MAX_FILES = toNumber(process.env.AI_CONTEXT_MAX_FILES, 80);

const TEXT_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.css',
  '.go',
  '.h',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.kt',
  '.mjs',
  '.md',
  '.py',
  '.rb',
  '.rs',
  '.sh',
  '.swift',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const EXCLUDED_SEGMENTS = new Set([
  '.expo',
  '.git',
  '.next',
  '.pnpm-store',
  '.turbo',
  '.vercel',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function git(args, options = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (error) {
    if (options.optional) {
      return '';
    }
    throw error;
  }
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function repoFiles() {
  const output = git(['ls-files', '--cached', '--others', '--exclude-standard'], { optional: true });
  return uniqueSorted(output.split('\n')).filter((file) => file && !isExcludedPath(file));
}

function isExcludedPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const segments = lower.split('/');

  if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) {
    return true;
  }

  if (isSensitivePath(lower)) {
    return true;
  }

  if (lower.endsWith('.lock') || lower.endsWith('.log') || lower.endsWith('.map')) {
    return true;
  }

  return false;
}

function isSensitivePath(lowerPath) {
  const basename = lowerPath.split('/').at(-1) ?? lowerPath;

  return (
    basename === '.env' ||
    basename.startsWith('.env.') ||
    basename === '.npmrc' ||
    basename === '.netrc' ||
    basename === 'id_rsa' ||
    basename === 'id_dsa' ||
    basename === 'id_ed25519' ||
    (basename.startsWith('secrets.') && basename.length > 'secrets.'.length) ||
    (basename.startsWith('credentials.') && basename.length > 'credentials.'.length) ||
    basename === 'google-services.json' ||
    basename === 'googleservice-info.plist' ||
    lowerPath.endsWith('.key') ||
    lowerPath.endsWith('.pem') ||
    lowerPath.endsWith('.p12') ||
    lowerPath.endsWith('.jks') ||
    lowerPath.endsWith('.keystore') ||
    lowerPath.includes('/secrets/') ||
    lowerPath.includes('/credentials/')
  );
}

function scoreFile(filePath, prompt) {
  const lowerPath = filePath.toLowerCase();
  const lowerPrompt = prompt.toLowerCase();
  const basename = path.posix.basename(lowerPath);
  const extension = path.posix.extname(lowerPath);
  let score = 0;

  if (lowerPath === 'agents.md') score += 120;
  if (lowerPath === 'readme.md') score += 100;
  if (lowerPath.startsWith('docs/') && lowerPath.endsWith('.md')) score += 85;
  if (basename === 'package.json') score += 75;
  if (lowerPath.startsWith('.github/workflows/')) score += 70;
  if (lowerPath.startsWith('scripts/ai-coding/')) score += 70;
  if (lowerPath.includes('/src/') || lowerPath.startsWith('src/')) score += 45;
  if (TEXT_EXTENSIONS.has(extension)) score += 10;

  for (const token of promptTokens(lowerPrompt)) {
    if (token.length >= 4 && lowerPath.includes(token)) {
      score += 35;
    }
  }

  if (lowerPrompt.includes(basename)) {
    score += 60;
  }

  return score;
}

function promptTokens(prompt) {
  return prompt.split(/[^a-z0-9._/-]+/).filter(Boolean);
}

function readContextFile(filePath) {
  const stat = statSync(filePath);
  if (!stat.isFile()) {
    return null;
  }

  const extension = path.posix.extname(filePath.toLowerCase());
  if (!TEXT_EXTENSIONS.has(extension) && !isKnownTextFile(filePath)) {
    return null;
  }

  const buffer = readFileSync(filePath);
  if (buffer.includes(0)) {
    return null;
  }

  const truncated = buffer.length > MAX_FILE_BYTES;
  const content = buffer.subarray(0, MAX_FILE_BYTES).toString('utf8');

  return {
    path: filePath,
    size: stat.size,
    truncated,
    content,
  };
}

function isKnownTextFile(filePath) {
  const basename = path.posix.basename(filePath.toLowerCase());
  return (
    basename === '.gitignore' ||
    basename === 'agents.md' ||
    basename === 'dockerfile' ||
    basename === 'makefile'
  );
}

function currentBranch() {
  return git(['branch', '--show-current'], { optional: true });
}

function currentSha() {
  return git(['rev-parse', '--short=12', 'HEAD'], { optional: true });
}

export function buildContext() {
  const prompt = process.env.TASK_PROMPT ?? '';
  const allFiles = repoFiles();
  const rankedFiles = [...allFiles].sort((left, right) => {
    const scoreDelta = scoreFile(right, prompt) - scoreFile(left, prompt);
    return scoreDelta || left.localeCompare(right);
  });

  const selectedFiles = [];
  let totalBytes = 0;

  for (const filePath of rankedFiles) {
    if (selectedFiles.length >= MAX_FILES || totalBytes >= MAX_CONTEXT_BYTES) {
      break;
    }

    const file = readContextFile(filePath);
    if (!file) {
      continue;
    }

    const nextBytes = Buffer.byteLength(file.content, 'utf8');
    if (totalBytes + nextBytes > MAX_CONTEXT_BYTES && selectedFiles.length > 0) {
      continue;
    }

    selectedFiles.push(file);
    totalBytes += nextBytes;
  }

  return {
    generatedAt: new Date().toISOString(),
    repository: {
      branch: currentBranch(),
      headSha: currentSha(),
      fileCount: allFiles.length,
    },
    task: {
      prompt,
      baseBranch: process.env.BASE_BRANCH ?? '',
      targetBranch: process.env.AGENT_BRANCH ?? process.env.TARGET_BRANCH ?? '',
      issueNumber: process.env.ISSUE_NUMBER ?? '',
      techStack: process.env.TECH_STACK ?? '',
    },
    limits: {
      maxContextBytes: MAX_CONTEXT_BYTES,
      maxFileBytes: MAX_FILE_BYTES,
      maxFiles: MAX_FILES,
      selectedBytes: totalBytes,
    },
    fileList: allFiles,
    files: selectedFiles,
  };
}

export function writeContextFile(context, outputPath = process.env.AI_CONTEXT_PATH ?? DEFAULT_CONTEXT_PATH) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(context, null, 2)}\n`, 'utf8');
  return outputPath;
}

function main() {
  const context = buildContext();
  const outputPath = writeContextFile(context);
  console.log(`Wrote AI context to ${outputPath} (${context.files.length} files selected).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
