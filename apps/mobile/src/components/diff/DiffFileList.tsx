import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DiffFile } from '@/types';

import { InlineDiffViewer } from './InlineDiffViewer';

type DiffFileListProps = {
  files: DiffFile[];
};

export function DiffFileList({ files }: DiffFileListProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());

  if (files.length === 0) {
    return (
      <View style={styles.emptyPanel}>
        <Text style={styles.emptyText}>No changed files were returned.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {files.map((file) => {
        const isExpanded = expandedPaths.has(file.path);

        return (
          <View key={file.path} style={styles.filePanel}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setExpandedPaths((current) => toggleExpandedPath(current, file.path))
              }
              style={({ pressed }) => [
                styles.fileHeader,
                pressed && styles.pressedHeader,
              ]}
            >
              <View style={styles.fileTitleBlock}>
                <Text style={styles.filePath}>{file.path}</Text>
                {file.oldPath ? (
                  <Text style={styles.oldPath}>Renamed from {file.oldPath}</Text>
                ) : null}
              </View>

              <View style={styles.fileMeta}>
                <Text style={styles.statusBadge}>{file.status}</Text>
                <Text style={styles.additions}>+{file.additions}</Text>
                <Text style={styles.deletions}>-{file.deletions}</Text>
                <Text style={styles.expandLabel}>{isExpanded ? 'Hide' : 'Show'}</Text>
              </View>
            </Pressable>

            {isExpanded ? (
              <View style={styles.expandedContent}>
                {file.isBinary ? (
                  <View style={styles.noticePanel}>
                    <Text style={styles.noticeText}>Binary file diff cannot be rendered.</Text>
                  </View>
                ) : (
                  <InlineDiffViewer patch={file.patch} />
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function toggleExpandedPath(paths: Set<string>, path: string) {
  const nextPaths = new Set(paths);

  if (nextPaths.has(path)) {
    nextPaths.delete(path);
  } else {
    nextPaths.add(path);
  }

  return nextPaths;
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  emptyPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
  },
  filePanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fileHeader: {
    gap: 10,
    padding: 14,
  },
  pressedHeader: {
    backgroundColor: '#F1F5F9',
  },
  fileTitleBlock: {
    gap: 4,
  },
  filePath: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  oldPath: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  fileMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  additions: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '800',
  },
  deletions: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '800',
  },
  expandLabel: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
  },
  expandedContent: {
    borderColor: '#E2E8F0',
    borderTopWidth: 1,
    padding: 10,
  },
  noticePanel: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  noticeText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
});
