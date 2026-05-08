import { describe, expect, it } from 'vitest';

import type { DiffFile } from '@/types';

import {
  getHighRiskFileGroups,
  getSecretLikeFiles,
  isSecretLikePath,
  redactKnownSecrets,
} from './security-guardrails';

function createDiffFile(path: string, oldPath?: string): DiffFile {
  return {
    path,
    oldPath,
    status: 'modified',
    additions: 1,
    deletions: 1,
    changes: 2,
    isBinary: false,
    patch: '@@ -1 +1 @@\n-old\n+new',
  };
}

describe('security guardrails risk classification', () => {
  it('detects secret-like paths from the denylist', () => {
    expect(isSecretLikePath('.env')).toBe(true);
    expect(isSecretLikePath('apps/mobile/.env.local')).toBe(true);
    expect(isSecretLikePath('keys/deploy.pem')).toBe(true);
    expect(isSecretLikePath('secrets.production')).toBe(true);
    expect(isSecretLikePath('src/features/settings.ts')).toBe(false);
  });

  it('classifies high-risk file groups once per unique path', () => {
    const groups = getHighRiskFileGroups([
      createDiffFile('.github/workflows/deploy.yml'),
      createDiffFile('infra/k8s/deployment.yaml'),
      createDiffFile('src/auth/session.ts'),
      createDiffFile('src/payments/checkout.ts'),
      createDiffFile('src/rbac/permissions.ts'),
      createDiffFile('pnpm-lock.yaml'),
      createDiffFile('.env.local'),
      createDiffFile('src/rbac/permissions.ts'),
    ]);

    expect(groups.map((group) => group.id)).toEqual([
      'github_actions',
      'deployment_config',
      'auth_code',
      'payment_code',
      'permission_code',
      'lockfile',
      'secret_like_file',
    ]);
    expect(groups.find((group) => group.id === 'permission_code')?.files).toEqual([
      'src/rbac/permissions.ts',
    ]);
  });

  it('finds secret-like files and redacts known secret values', () => {
    expect(
      getSecretLikeFiles([
        createDiffFile('src/config.ts', 'credentials.local'),
        createDiffFile('private/id_ed25519'),
      ]),
    ).toEqual(['credentials.local', 'private/id_ed25519']);
    expect(redactKnownSecrets('token=abc123 and key=abc123', ['abc123'])).toBe(
      'token=[REDACTED_SECRET] and key=[REDACTED_SECRET]',
    );
  });
});
