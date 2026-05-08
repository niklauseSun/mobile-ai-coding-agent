import type {
  DiffHunk as DiffHunkModel,
  DiffLine,
  DiffLineType,
} from '@/types';

const defaultMaxRenderedLines = 700;

export function parseUnifiedDiffPatch(
  patch = '',
  maxRenderedLines = defaultMaxRenderedLines,
) {
  const hunks: DiffHunkModel[] = [];
  const patchLines = patch.split('\n');
  let currentHunk: DiffHunkModel | undefined;
  let oldLineNumber = 0;
  let newLineNumber = 0;
  let renderedLines = 0;
  let isTruncated = false;

  for (const rawLine of patchLines) {
    const hunkMatch = rawLine.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@.*$/);

    if (hunkMatch) {
      if (renderedLines >= maxRenderedLines) {
        isTruncated = true;
        break;
      }

      oldLineNumber = Number(hunkMatch[1]);
      newLineNumber = Number(hunkMatch[3]);
      currentHunk = {
        header: rawLine,
        oldStart: oldLineNumber,
        oldLines: Number(hunkMatch[2] ?? 1),
        newStart: newLineNumber,
        newLines: Number(hunkMatch[4] ?? 1),
        lines: [],
      };
      hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk || rawLine.startsWith('\\ No newline')) {
      continue;
    }

    if (renderedLines >= maxRenderedLines) {
      isTruncated = true;
      break;
    }

    const lineType = getDiffLineType(rawLine);
    const content = rawLine.length > 0 ? rawLine.slice(1) : '';
    const line: DiffLine = {
      type: lineType,
      content,
      oldLineNumber: lineType === 'added' ? undefined : oldLineNumber,
      newLineNumber: lineType === 'removed' ? undefined : newLineNumber,
    };

    currentHunk.lines.push(line);
    renderedLines += 1;

    if (lineType !== 'added') {
      oldLineNumber += 1;
    }

    if (lineType !== 'removed') {
      newLineNumber += 1;
    }
  }

  return {
    hunks,
    isTruncated,
  };
}

function getDiffLineType(line: string): DiffLineType {
  if (line.startsWith('+')) {
    return 'added';
  }

  if (line.startsWith('-')) {
    return 'removed';
  }

  return 'context';
}
