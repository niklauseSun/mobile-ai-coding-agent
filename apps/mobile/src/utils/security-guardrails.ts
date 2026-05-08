import type { DiffFile } from '@/types';

export type HighRiskFileGroup = {
  id:
    | 'auth_code'
    | 'deployment_config'
    | 'github_actions'
    | 'lockfile'
    | 'payment_code'
    | 'permission_code'
    | 'secret_like_file';
  description: string;
  files: string[];
  label: string;
};

const deploymentConfigBasenames = new Set([
  'app.yaml',
  'app.yml',
  'cloudbuild.yaml',
  'cloudbuild.yml',
  'docker-compose.yaml',
  'docker-compose.yml',
  'dockerfile',
  'fly.toml',
  'netlify.toml',
  'render.yaml',
  'render.yml',
  'serverless.yaml',
  'serverless.yml',
  'vercel.json',
]);

const lockfileBasenames = new Set([
  'bun.lock',
  'bun.lockb',
  'cargo.lock',
  'composer.lock',
  'gemfile.lock',
  'go.sum',
  'package-lock.json',
  'pipfile.lock',
  'pnpm-lock.yaml',
  'poetry.lock',
  'yarn.lock',
]);

export function getSecretLikeFiles(files: DiffFile[]) {
  return uniquePaths(
    files
      .flatMap((file) => [file.path, file.oldPath])
      .filter((path): path is string => Boolean(path))
      .filter(isSecretLikePath),
  );
}

export function isSecretLikePath(filePath: string) {
  const normalized = normalizePath(filePath);
  const basename = getBasename(normalized);

  return (
    basename === '.env' ||
    basename.startsWith('.env.') ||
    basename.endsWith('.pem') ||
    basename.endsWith('.key') ||
    basename === 'id_rsa' ||
    basename === 'id_ed25519' ||
    (basename.startsWith('secrets.') && basename.length > 'secrets.'.length) ||
    (basename.startsWith('credentials.') && basename.length > 'credentials.'.length)
  );
}

export function getHighRiskFileGroups(files: DiffFile[]): HighRiskFileGroup[] {
  const paths = uniquePaths(
    files
      .flatMap((file) => [file.path, file.oldPath])
      .filter((path): path is string => Boolean(path)),
  );

  return [
    createGroup({
      description: 'Workflow changes can alter repository automation and secret access.',
      files: paths.filter(isGitHubActionsWorkflowPath),
      id: 'github_actions',
      label: 'GitHub Actions workflows',
    }),
    createGroup({
      description: 'Deployment config changes can affect production release behavior.',
      files: paths.filter(isDeploymentConfigPath),
      id: 'deployment_config',
      label: 'Deployment config',
    }),
    createGroup({
      description: 'Authentication changes can affect login, sessions, or identity checks.',
      files: paths.filter(isAuthCodePath),
      id: 'auth_code',
      label: 'Auth code',
    }),
    createGroup({
      description: 'Payment changes can affect billing, checkout, or subscriptions.',
      files: paths.filter(isPaymentCodePath),
      id: 'payment_code',
      label: 'Payment code',
    }),
    createGroup({
      description: 'Permission changes can affect authorization, roles, or access control.',
      files: paths.filter(isPermissionCodePath),
      id: 'permission_code',
      label: 'Permission code',
    }),
    createGroup({
      description: 'Lockfile changes can alter installed dependency versions.',
      files: paths.filter(isLockfilePath),
      id: 'lockfile',
      label: 'Lockfiles',
    }),
    createGroup({
      description: 'Secret-like file changes may expose credentials or private keys.',
      files: paths.filter(isSecretLikePath),
      id: 'secret_like_file',
      label: 'Secret-like files',
    }),
  ].filter((group): group is HighRiskFileGroup => Boolean(group));
}

export function redactKnownSecrets(value: string, secrets: (string | null | undefined)[]) {
  let redacted = value;

  for (const secret of secrets) {
    if (!secret) {
      continue;
    }

    redacted = redacted.split(secret).join('[REDACTED_SECRET]');
  }

  return redacted;
}

function createGroup(input: HighRiskFileGroup): HighRiskFileGroup | null {
  const files = uniquePaths(input.files);

  if (files.length === 0) {
    return null;
  }

  return {
    ...input,
    files,
  };
}

function isGitHubActionsWorkflowPath(filePath: string) {
  return normalizePath(filePath).startsWith('.github/workflows/');
}

function isDeploymentConfigPath(filePath: string) {
  const normalized = normalizePath(filePath);
  const basename = getBasename(normalized);

  return (
    deploymentConfigBasenames.has(basename) ||
    normalized.startsWith('deploy/') ||
    normalized.startsWith('deployment/') ||
    normalized.startsWith('deployments/') ||
    normalized.startsWith('helm/') ||
    normalized.startsWith('k8s/') ||
    normalized.startsWith('kubernetes/') ||
    normalized.includes('/deploy/') ||
    normalized.includes('/deployment/') ||
    normalized.includes('/deployments/') ||
    normalized.includes('/helm/') ||
    normalized.includes('/k8s/') ||
    normalized.includes('/kubernetes/')
  );
}

function isAuthCodePath(filePath: string) {
  const normalized = normalizePath(filePath);

  return includesAnyPathToken(normalized, [
    'auth',
    'authentication',
    'jwt',
    'login',
    'oauth',
    'session',
    'signin',
    'sso',
  ]);
}

function isPaymentCodePath(filePath: string) {
  const normalized = normalizePath(filePath);

  return includesAnyPathToken(normalized, [
    'billing',
    'checkout',
    'invoice',
    'payment',
    'payments',
    'stripe',
    'subscription',
  ]);
}

function isPermissionCodePath(filePath: string) {
  const normalized = normalizePath(filePath);

  return includesAnyPathToken(normalized, [
    'access',
    'acl',
    'authorization',
    'permission',
    'permissions',
    'policy',
    'rbac',
    'role',
    'roles',
  ]);
}

function isLockfilePath(filePath: string) {
  return lockfileBasenames.has(getBasename(normalizePath(filePath)));
}

function includesAnyPathToken(normalizedPath: string, tokens: string[]) {
  const pathTokens = normalizedPath.split(/[^a-z0-9]+/).filter(Boolean);

  return tokens.some((token) => pathTokens.includes(token));
}

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function getBasename(normalizedPath: string) {
  return normalizedPath.split('/').at(-1) ?? normalizedPath;
}

function uniquePaths(paths: string[]) {
  return [...new Set(paths)].sort((left, right) => left.localeCompare(right));
}
