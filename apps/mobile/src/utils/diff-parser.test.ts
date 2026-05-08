import { describe, expect, it } from 'vitest';

import { parseUnifiedDiffPatch } from './diff-parser';

describe('parseUnifiedDiffPatch', () => {
  it('parses unified diff hunks and preserves old/new line numbers', () => {
    const result = parseUnifiedDiffPatch(
      [
        '@@ -10,3 +10,4 @@ function example() {',
        ' const value = 1;',
        '-return value;',
        '+return value + 1;',
        '+// done',
      ].join('\n'),
    );

    expect(result.isTruncated).toBe(false);
    expect(result.hunks).toHaveLength(1);
    expect(result.hunks[0]).toMatchObject({
      oldStart: 10,
      oldLines: 3,
      newStart: 10,
      newLines: 4,
    });
    expect(result.hunks[0].lines).toEqual([
      {
        type: 'context',
        content: 'const value = 1;',
        oldLineNumber: 10,
        newLineNumber: 10,
      },
      {
        type: 'removed',
        content: 'return value;',
        oldLineNumber: 11,
        newLineNumber: undefined,
      },
      {
        type: 'added',
        content: 'return value + 1;',
        oldLineNumber: undefined,
        newLineNumber: 11,
      },
      {
        type: 'added',
        content: '// done',
        oldLineNumber: undefined,
        newLineNumber: 12,
      },
    ]);
  });

  it('truncates large patches after the requested rendered line count', () => {
    const result = parseUnifiedDiffPatch(
      ['@@ -1,4 +1,4 @@', ' line 1', ' line 2', ' line 3'].join('\n'),
      2,
    );

    expect(result.isTruncated).toBe(true);
    expect(result.hunks[0].lines).toHaveLength(2);
  });
});
