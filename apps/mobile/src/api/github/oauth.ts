const githubOAuthBaseUrl = 'https://github.com';
const deviceGrantType = 'urn:ietf:params:oauth:grant-type:device_code';

export type GitHubDeviceCodeResponse = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
};

export type GitHubDeviceAccessTokenResponse = {
  accessToken: string;
  tokenType: string;
  scope: string;
};

export type GitHubDeviceAccessTokenPending = {
  status: 'pending';
  interval: number;
};

export type GitHubDeviceAccessTokenResult =
  | { status: 'authorized'; token: GitHubDeviceAccessTokenResponse }
  | GitHubDeviceAccessTokenPending;

type GitHubDeviceCodeApiResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

type GitHubDeviceAccessTokenApiResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: GitHubDeviceFlowErrorCode;
  error_description?: string;
};

type GitHubDeviceFlowErrorCode =
  | 'access_denied'
  | 'authorization_pending'
  | 'device_flow_disabled'
  | 'expired_token'
  | 'incorrect_client_credentials'
  | 'incorrect_device_code'
  | 'slow_down'
  | 'unsupported_grant_type';

export class GitHubDeviceFlowError extends Error {
  readonly code: GitHubDeviceFlowErrorCode;

  constructor(code: GitHubDeviceFlowErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'GitHubDeviceFlowError';
    this.code = code;
  }
}

export async function requestGitHubDeviceCode(input: {
  clientId: string;
  scope?: string;
}): Promise<GitHubDeviceCodeResponse> {
  const response = await fetch(`${githubOAuthBaseUrl}/login/device/code`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: toFormBody({
      client_id: input.clientId,
      scope: input.scope,
    }),
  });

  const payload = (await response.json()) as GitHubDeviceCodeApiResponse;

  if (!response.ok) {
    throw new Error('Unable to start GitHub device authorization.');
  }

  return {
    deviceCode: payload.device_code,
    userCode: payload.user_code,
    verificationUri: payload.verification_uri,
    expiresIn: payload.expires_in,
    interval: payload.interval,
  };
}

export async function pollGitHubDeviceAccessToken(input: {
  clientId: string;
  deviceCode: string;
  interval: number;
}): Promise<GitHubDeviceAccessTokenResult> {
  const response = await fetch(`${githubOAuthBaseUrl}/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: toFormBody({
      client_id: input.clientId,
      device_code: input.deviceCode,
      grant_type: deviceGrantType,
    }),
  });

  const payload = (await response.json()) as GitHubDeviceAccessTokenApiResponse;

  if (payload.error === 'authorization_pending') {
    return {
      status: 'pending',
      interval: input.interval,
    };
  }

  if (payload.error === 'slow_down') {
    return {
      status: 'pending',
      interval: input.interval + 5,
    };
  }

  if (payload.error) {
    throw new GitHubDeviceFlowError(payload.error, payload.error_description);
  }

  if (!response.ok || !payload.access_token || !payload.token_type) {
    throw new Error('GitHub did not return an OAuth access token.');
  }

  return {
    status: 'authorized',
    token: {
      accessToken: payload.access_token,
      tokenType: payload.token_type,
      scope: payload.scope ?? '',
    },
  };
}

function toFormBody(values: Record<string, string | undefined>) {
  const body = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      body.set(key, value);
    }
  });

  return body.toString();
}

