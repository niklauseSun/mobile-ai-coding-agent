import { StyleSheet, Text, View } from 'react-native';

import type { DiffHunk as DiffHunkModel, DiffLine } from '@/types';

type DiffHunkProps = {
  hunk: DiffHunkModel;
};

export function DiffHunk({ hunk }: DiffHunkProps) {
  return (
    <View style={styles.hunk}>
      <Text selectable style={styles.hunkHeader}>
        {hunk.header}
      </Text>

      <View style={styles.lines}>
        {hunk.lines.map((line, index) => (
          <DiffLineRow key={`${line.oldLineNumber ?? '-'}-${line.newLineNumber ?? '-'}-${index}`} line={line} />
        ))}
      </View>
    </View>
  );
}

function DiffLineRow({ line }: { line: DiffLine }) {
  return (
    <View style={[styles.lineRow, getLineBackgroundStyle(line.type)]}>
      <Text style={styles.lineNumber}>{line.oldLineNumber ?? ''}</Text>
      <Text style={styles.lineNumber}>{line.newLineNumber ?? ''}</Text>
      <Text style={[styles.lineMarker, getLineMarkerStyle(line.type)]}>
        {getLineMarker(line.type)}
      </Text>
      <Text selectable style={styles.lineContent}>
        {line.content || ' '}
      </Text>
    </View>
  );
}

function getLineMarker(type: DiffLine['type']) {
  if (type === 'added') {
    return '+';
  }

  if (type === 'removed') {
    return '-';
  }

  return ' ';
}

function getLineBackgroundStyle(type: DiffLine['type']) {
  if (type === 'added') {
    return styles.addedLine;
  }

  if (type === 'removed') {
    return styles.removedLine;
  }

  return styles.contextLine;
}

function getLineMarkerStyle(type: DiffLine['type']) {
  if (type === 'added') {
    return styles.addedMarker;
  }

  if (type === 'removed') {
    return styles.removedMarker;
  }

  return styles.contextMarker;
}

const styles = StyleSheet.create({
  hunk: {
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hunkHeader: {
    backgroundColor: '#E2E8F0',
    color: '#334155',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  lines: {
    backgroundColor: '#FFFFFF',
  },
  lineRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  contextLine: {
    backgroundColor: '#FFFFFF',
  },
  addedLine: {
    backgroundColor: '#ECFDF5',
  },
  removedLine: {
    backgroundColor: '#FEF2F2',
  },
  lineNumber: {
    color: '#94A3B8',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    minWidth: 34,
    textAlign: 'right',
  },
  lineMarker: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    minWidth: 10,
    textAlign: 'center',
  },
  contextMarker: {
    color: '#94A3B8',
  },
  addedMarker: {
    color: '#047857',
  },
  removedMarker: {
    color: '#B91C1C',
  },
  lineContent: {
    color: '#0F172A',
    flex: 1,
    flexShrink: 1,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});
