export type DiffFileStatus =
  | 'added'
  | 'modified'
  | 'removed'
  | 'renamed'
  | 'copied'
  | 'changed'
  | 'unchanged';

export type DiffLineType = 'context' | 'added' | 'removed';

export type DiffLine = {
  type: DiffLineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
};

export type DiffHunk = {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
};

export type DiffFile = {
  path: string;
  oldPath?: string;
  status: DiffFileStatus;
  additions: number;
  deletions: number;
  changes: number;
  isBinary: boolean;
  isGenerated?: boolean;
  patch?: string;
  hunks?: DiffHunk[];
};

export type ReviewFindingSeverity = 'info' | 'warning' | 'error';

export type ReviewFinding = {
  id: string;
  filePath: string;
  lineNumber?: number;
  title: string;
  message: string;
  severity: ReviewFindingSeverity;
  suggestedChange?: string;
};

