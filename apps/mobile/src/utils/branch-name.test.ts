import { describe, expect, it } from 'vitest';

import {
  createAutoBranchName,
  createBranchSeed,
  isValidBranchName,
} from './branch-name';

describe('branch name generation', () => {
  it('creates deterministic seeds from dates', () => {
    expect(createBranchSeed(new Date('2026-05-08T01:02:03.000Z'))).toBe(
      '20260508-010203',
    );
  });

  it('generates mobile AI branch names from task prompts', () => {
    expect(createAutoBranchName('Add review + merge flow!', '20260508-010203')).toBe(
      'mobile-ai/20260508-010203-add-review-merge-flow',
    );
    expect(createAutoBranchName('!!!', '20260508-010203')).toBe(
      'mobile-ai/20260508-010203-task',
    );
  });

  it('validates branch names before workflow dispatch', () => {
    expect(isValidBranchName('mobile-ai/20260508-010203-task')).toBe(true);
    expect(isValidBranchName('HEAD')).toBe(false);
    expect(isValidBranchName('/starts-with-slash')).toBe(false);
    expect(isValidBranchName('contains//double-slash')).toBe(false);
    expect(isValidBranchName('contains..dots')).toBe(false);
    expect(isValidBranchName('contains@{sequence')).toBe(false);
  });
});
