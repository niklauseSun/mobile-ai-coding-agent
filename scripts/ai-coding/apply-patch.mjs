#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_PATCH_PATH = '.ai-coding/generated.patch';

function stripCodeFences(text) {
  return text
    .replace(/^```(?:diff|patch)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function extractGitPatch(rawPatch) {
  const text = stripCodeFences(rawPatch);
  const start = text.indexOf('diff --git ');

  if (start === -1) {
    throw new Error('AI response did not contain a git unified diff.');
  }

  return `${text.slice(start).trimEnd()}\n`;
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

function assertSafeRepoPath(repoPath) {
  const normalized = repoPath.replace(/\\/g, '/');
  const segments = normalized.split('/');

  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('\0') ||
    segments.includes('..') ||
    isSensitivePath(normalized)
  ) {
    throw new Error(`Patch targets an unsafe repository path: ${repoPath}`);
  }
}

function validatePatchPaths(patch) {
  const matches = [...patch.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)];

  if (matches.length === 0) {
    throw new Error('Patch does not contain diff headers.');
  }

  for (const match of matches) {
    assertSafeRepoPath(match[1]);
    assertSafeRepoPath(match[2]);
  }
}

function git(args) {
  try {
    execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = String(error.stderr ?? '').trim();
    throw new Error(stderr || `git ${args.join(' ')} failed`);
  }
}

export function applyPatchFile(patchPath = DEFAULT_PATCH_PATH) {
  const rawPatch = readFileSync(patchPath, 'utf8');
  const patch = extractGitPatch(rawPatch);

  validatePatchPaths(patch);
  writeFileSync(patchPath, patch, 'utf8');

  git(['apply', '--check', patchPath]);
  git(['apply', '--whitespace=fix', patchPath]);
}

function main() {
  const patchPath = process.argv[2] ?? DEFAULT_PATCH_PATH;
  applyPatchFile(patchPath);
  console.log(`Applied AI patch from ${patchPath}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
