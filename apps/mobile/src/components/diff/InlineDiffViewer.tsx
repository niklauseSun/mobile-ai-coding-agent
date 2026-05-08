import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { parseUnifiedDiffPatch } from '@/utils/diff-parser';

import { DiffHunk } from './DiffHunk';

type InlineDiffViewerProps = {
  maxRenderedLines?: number;
  patch?: string;
};

const defaultMaxRenderedLines = 700;

export function InlineDiffViewer({
  maxRenderedLines = defaultMaxRenderedLines,
  patch,
}: InlineDiffViewerProps) {
  const parsedPatch = useMemo(
    () => parseUnifiedDiffPatch(patch, maxRenderedLines),
    [maxRenderedLines, patch],
  );

  if (!patch) {
    return (
      <View style={styles.emptyPanel}>
        <Text style={styles.emptyText}>Patch unavailable for this file.</Text>
      </View>
    );
  }

  if (parsedPatch.hunks.length === 0) {
    return (
      <View style={styles.emptyPanel}>
        <Text style={styles.emptyText}>No unified diff hunks were returned.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {parsedPatch.hunks.map((hunk, index) => (
        <DiffHunk key={`${hunk.header}-${index}`} hunk={hunk} />
      ))}

      {parsedPatch.isTruncated ? (
        <View style={styles.truncatedPanel}>
          <Text style={styles.truncatedText}>
            Large diff truncated after {maxRenderedLines} lines for mobile rendering.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  emptyPanel: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  truncatedPanel: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  truncatedText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
