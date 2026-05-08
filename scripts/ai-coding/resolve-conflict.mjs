#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_CONFLICT_FILES = Number(process.env.AI_CONFLICT_MAX_FILES ?? 20);
const MAX_CONFLICT_FILE_BYTES = Number(process.env.AI_CONFLICT_MAX_FILE_BYTES ?? 80_000);
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4.1';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
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
    const stderr = String(error.stderr ?? '').trim();
    throw new Error(stderr || `git ${args.join(' ')} failed`);
  }
}

function conflictFiles() {
  return git(['diff', '--name-only', '--diff-filter=U'], { optional: true })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

function assertSafeRepoPath(repoPath) {
  const resolved = path.resolve(repoPath);
  const root = `${process.cwd()}${path.sep}`;
  const normalized = repoPath.replace(/\\/g, '/');
  const segments = normalized.split('/');

  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('\0') ||
    segments.includes('..') ||
    !resolved.startsWith(root) ||
    isSensitivePath(normalized)
  ) {
    throw new Error(`Refusing to resolve unsafe path: ${repoPath}`);
  }
}

function isSensitivePath(repoPath) {
  const lowerPath = repoPath.toLowerCase();
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

function readConflictFile(repoPath) {
  assertSafeRepoPath(repoPath);

  const stat = statSync(repoPath);
  if (!stat.isFile()) {
    throw new Error(`Conflict path is not a file: ${repoPath}`);
  }
  if (stat.size > MAX_CONFLICT_FILE_BYTES) {
    throw new Error(`Conflict file is too large for automated resolution: ${repoPath}`);
  }

  const buffer = readFileSync(repoPath);
  if (buffer.includes(0)) {
    throw new Error(`Conflict file appears to be binary: ${repoPath}`);
  }

  const content = buffer.toString('utf8');
  if (!content.includes('<<<<<<<') || !content.includes('=======') || !content.includes('>>>>>>>')) {
    throw new Error(`Conflict markers were not found in ${repoPath}`);
  }

  return {
    path: repoPath,
    content,
  };
}

function chatCompletionsEndpoint(baseUrl) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

function redact(value) {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) {
    return value;
  }
  return value.split(apiKey).join('[REDACTED_API_KEY]');
}

function extractAssistantText(responseJson) {
  const choice = responseJson.choices?.[0];
  const content = choice?.message?.content ?? choice?.text;

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('AI provider response did not include assistant content.');
  }

  return content;
}

function parseResolutionJson(text) {
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI provider did not return a JSON object.');
  }

  return JSON.parse(withoutFence.slice(start, end + 1));
}

async function requestResolution({ apiKey, baseUrl, model, files }) {
  const response = await fetch(chatCompletionsEndpoint(baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: Number(process.env.AI_PROVIDER_TEMPERATURE ?? 0.1),
      messages: [
        {
          role: 'system',
          content: [
            'You are resolving Git merge conflicts in a repository automation runner.',
            'Return only JSON with this shape: {"files":[{"path":"relative/path","content":"full resolved file content"}]}.',
            'Do not include markdown fences, prose, comments outside JSON, or partial snippets.',
            'Resolve only the listed files. Do not invent credentials, tokens, or secret files.',
            'The returned file contents must not contain Git conflict markers.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            prNumber: process.env.PR_NUMBER ?? '',
            sourceBranch: process.env.SOURCE_BRANCH ?? '',
            targetBranch: process.env.TARGET_BRANCH ?? '',
            files,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = redact(await response.text());
    throw new Error(`AI provider request failed with ${response.status}: ${errorText.slice(0, 800)}`);
  }

  return parseResolutionJson(extractAssistantText(await response.json()));
}

function applyResolution(resolution, allowedFiles) {
  if (!Array.isArray(resolution.files) || resolution.files.length === 0) {
    throw new Error('AI provider returned no resolved files.');
  }

  const allowed = new Set(allowedFiles);
  const resolvedPaths = [];

  for (const file of resolution.files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('AI provider returned an invalid file entry.');
    }
    if (!allowed.has(file.path)) {
      throw new Error(`AI provider tried to modify a non-conflicted file: ${file.path}`);
    }
    if (file.content.includes('<<<<<<<') || file.content.includes('=======') || file.content.includes('>>>>>>>')) {
      throw new Error(`Resolved content still contains conflict markers: ${file.path}`);
    }

    assertSafeRepoPath(file.path);
    writeFileSync(file.path, file.content.endsWith('\n') ? file.content : `${file.content}\n`, 'utf8');
    resolvedPaths.push(file.path);
  }

  git(['add', '--', ...resolvedPaths]);
  return resolvedPaths;
}

export async function resolveConflict() {
  const files = conflictFiles();

  if (files.length === 0) {
    console.log('No conflicted files found.');
    return [];
  }
  if (files.length > MAX_CONFLICT_FILES) {
    throw new Error(`Too many conflicted files for automated resolution: ${files.length}`);
  }

  const apiKey = requiredEnv('AI_PROVIDER_API_KEY');
  const baseUrl = process.env.AI_PROVIDER_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.AI_PROVIDER_MODEL || DEFAULT_MODEL;
  const payloadFiles = files.map(readConflictFile);
  const resolution = await requestResolution({ apiKey, baseUrl, model, files: payloadFiles });
  const resolvedPaths = applyResolution(resolution, files);

  mkdirSync('.ai-coding', { recursive: true });
  writeFileSync(
    '.ai-coding/conflict-resolution-summary.json',
    `${JSON.stringify({ resolvedFiles: resolvedPaths }, null, 2)}\n`,
    'utf8'
  );

  console.log(`Resolved ${resolvedPaths.length} conflicted file(s).`);
  return resolvedPaths;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  resolveConflict().catch((error) => {
    console.error(redact(error.message));
    process.exit(1);
  });
}
