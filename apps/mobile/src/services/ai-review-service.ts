import type { AiProviderAdapter } from '@/providers/ai';
import type { GitProviderAdapter, RepositorySelector } from '@/providers/git';
import type { AiReviewResult, DiffFile, MergeRequest, Repository } from '@/types';
import { isSecretLikePath } from '@/utils/security-guardrails';

export type RunAiMergeRequestReviewInput = {
  aiProvider: AiProviderAdapter;
  gitProvider: GitProviderAdapter;
  mergeRequest: MergeRequest;
  repository: Repository;
  maxFiles?: number;
  maxPatchCharacters?: number;
  maxPatchCharactersPerFile?: number;
};

export type RunAiMergeRequestReviewResult = {
  diffFiles: DiffFile[];
  reviewResult: AiReviewResult;
};

const defaultMaxFiles = 40;
const defaultMaxPatchCharacters = 48_000;
const defaultMaxPatchCharactersPerFile = 8_000;

export async function runAiMergeRequestReview({
  aiProvider,
  gitProvider,
  maxFiles = defaultMaxFiles,
  maxPatchCharacters = defaultMaxPatchCharacters,
  maxPatchCharactersPerFile = defaultMaxPatchCharactersPerFile,
  mergeRequest,
  repository,
}: RunAiMergeRequestReviewInput): Promise<RunAiMergeRequestReviewResult> {
  const diffFiles = await gitProvider.listMergeRequestFiles(
    toRepositorySelector(repository),
    mergeRequest.number,
  );
  const compactDiffFiles = compactDiffFilesForReview(diffFiles, {
    maxFiles,
    maxPatchCharacters,
    maxPatchCharactersPerFile,
  });

  const reviewResult = await aiProvider.reviewMergeRequestDiff({
    repository,
    mergeRequest,
    diffFiles: compactDiffFiles,
  });

  return {
    diffFiles,
    reviewResult,
  };
}

export function compactDiffFilesForReview(
  diffFiles: DiffFile[],
  options: {
    maxFiles?: number;
    maxPatchCharacters?: number;
    maxPatchCharactersPerFile?: number;
  } = {},
): DiffFile[] {
  const maxFiles = options.maxFiles ?? defaultMaxFiles;
  const maxPatchCharacters = options.maxPatchCharacters ?? defaultMaxPatchCharacters;
  const maxPatchCharactersPerFile =
    options.maxPatchCharactersPerFile ?? defaultMaxPatchCharactersPerFile;
  let remainingPatchCharacters = maxPatchCharacters;

  return diffFiles
    .slice()
    .sort((left, right) => scoreDiffFile(right) - scoreDiffFile(left))
    .slice(0, maxFiles)
    .map((file) => {
      if (isSecretLikeDiffFile(file)) {
        return {
          ...file,
          patch: '[secret-like file patch omitted from mobile AI review]',
        };
      }

      const patch = file.patch ?? '';
      const perFileLimit = Math.min(maxPatchCharactersPerFile, remainingPatchCharacters);
      const compactPatch =
        patch.length > perFileLimit
          ? `${patch.slice(0, Math.max(0, perFileLimit))}\n[diff truncated for mobile AI review]`
          : patch;

      remainingPatchCharacters = Math.max(
        0,
        remainingPatchCharacters - compactPatch.length,
      );

      return {
        ...file,
        patch: compactPatch || undefined,
      };
    });
}

function isSecretLikeDiffFile(file: DiffFile) {
  return isSecretLikePath(file.path) || (file.oldPath ? isSecretLikePath(file.oldPath) : false);
}

export function buildSelectedFindingsComment(reviewResult: AiReviewResult, findingIds: string[]) {
  const selectedFindings = reviewResult.findings.filter((finding) =>
    findingIds.includes(finding.id),
  );

  return [
    'AI review findings selected from mobile:',
    '',
    `Summary: ${reviewResult.summary}`,
    `Risk level: ${reviewResult.riskLevel}`,
    `Recommendation: ${reviewResult.recommendation}`,
    '',
    ...selectedFindings.flatMap((finding, index) => [
      `${index + 1}. [${finding.severity}] ${finding.title}`,
      `File: ${finding.filePath}${finding.lineNumber ? `:${finding.lineNumber}` : ''}`,
      finding.message,
      finding.suggestedChange ? `Suggested change: ${finding.suggestedChange}` : '',
      '',
    ]),
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function scoreDiffFile(file: DiffFile) {
  if (file.isBinary) {
    return -1000;
  }

  let score = 0;
  score += Math.min(file.changes, 500);

  if (file.status === 'modified') {
    score += 50;
  }

  if (file.status === 'added' || file.status === 'removed') {
    score += 20;
  }

  if (file.path.includes('/src/') || file.path.startsWith('src/')) {
    score += 40;
  }

  if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
    score += 25;
  }

  return score;
}

function toRepositorySelector(repository: Repository): RepositorySelector {
  return {
    owner: repository.owner.username,
    name: repository.name,
  };
}
