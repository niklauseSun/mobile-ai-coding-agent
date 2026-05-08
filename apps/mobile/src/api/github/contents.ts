import {
  createContentsPath,
  createRepositoryPath,
  GitHubApiError,
  GitHubClient,
  type RepositoryRef,
} from './client';

export type RepositoryFileMetadata = {
  path: string;
  sha: string;
  webUrl?: string;
};

export type CreateOrUpdateFileInput = {
  path: string;
  message: string;
  content: string;
  branch?: string;
  sha?: string;
  committer?: {
    name: string;
    email: string;
  };
  author?: {
    name: string;
    email: string;
  };
};

export type CreateOrUpdateFileResult = {
  content?: {
    name: string;
    path: string;
    sha: string;
    html_url?: string;
  };
  commit: {
    sha: string;
    html_url?: string;
  };
};

export type CommitRepositoryFilesInput = {
  branch: string;
  files: {
    path: string;
    content: string;
  }[];
  message: string;
};

export type CommitRepositoryFilesResult = {
  sha: string;
  webUrl?: string;
};

type GitHubContentFileResponse = {
  type: 'file' | 'dir' | 'submodule' | 'symlink';
  path: string;
  sha: string;
  html_url?: string;
};

type GitHubReference = {
  ref: string;
  node_id: string;
  object: {
    type: string;
    sha: string;
    url: string;
  };
};

type GitHubTree = {
  sha: string;
  url: string;
};

type GitHubCommit = {
  sha: string;
  html_url?: string;
  tree: {
    sha: string;
    url: string;
  };
};

export async function getRepositoryFileMetadata(
  client: GitHubClient,
  repository: RepositoryRef,
  path: string,
  ref?: string,
): Promise<RepositoryFileMetadata | null> {
  try {
    const content = await client.request<GitHubContentFileResponse | GitHubContentFileResponse[]>(
      createContentsPath(repository, path),
      {
        query: {
          ref,
        },
      },
    );

    if (Array.isArray(content) || content.type !== 'file') {
      return null;
    }

    return {
      path: content.path,
      sha: content.sha,
      webUrl: content.html_url,
    };
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function commitRepositoryFiles(
  client: GitHubClient,
  repository: RepositoryRef,
  input: CommitRepositoryFilesInput,
): Promise<CommitRepositoryFilesResult> {
  if (input.files.length === 0) {
    throw new Error('At least one file is required for a repository file commit.');
  }

  const headRef = await client.request<GitHubReference>(
    `${createRepositoryPath(repository)}/git/ref/heads/${encodeRefPath(input.branch)}`,
  );
  const headCommit = await client.request<GitHubCommit>(
    `${createRepositoryPath(repository)}/git/commits/${headRef.object.sha}`,
  );

  const tree = await client.request<GitHubTree>(
    `${createRepositoryPath(repository)}/git/trees`,
    {
      method: 'POST',
      body: {
        base_tree: headCommit.tree.sha,
        tree: input.files.map((file) => ({
          path: file.path,
          mode: '100644',
          type: 'blob',
          content: file.content,
        })),
      },
    },
  );

  const commit = await client.request<GitHubCommit>(
    `${createRepositoryPath(repository)}/git/commits`,
    {
      method: 'POST',
      body: {
        message: input.message,
        tree: tree.sha,
        parents: [headRef.object.sha],
      },
    },
  );

  await client.request<GitHubReference>(
    `${createRepositoryPath(repository)}/git/refs/heads/${encodeRefPath(input.branch)}`,
    {
      method: 'PATCH',
      body: {
        sha: commit.sha,
        force: false,
      },
    },
  );

  return {
    sha: commit.sha,
    webUrl: commit.html_url,
  };
}

export async function createOrUpdateFile(
  client: GitHubClient,
  repository: RepositoryRef,
  input: CreateOrUpdateFileInput,
): Promise<CreateOrUpdateFileResult> {
  return client.request<CreateOrUpdateFileResult>(createContentsPath(repository, input.path), {
    method: 'PUT',
    body: {
      message: input.message,
      content: encodeBase64(input.content),
      branch: input.branch,
      sha: input.sha,
      committer: input.committer,
      author: input.author,
    },
  });
}

function encodeBase64(value: string) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function encodeRefPath(ref: string) {
  return ref
    .replace(/^refs\/heads\//, '')
    .replace(/^heads\//, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
}
