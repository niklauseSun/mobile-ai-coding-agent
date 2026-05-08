import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReviewFinding } from '@/types';

type ReviewFindingCardProps = {
  finding: ReviewFinding;
  isSelected: boolean;
  onToggleSelected: () => void;
};

export function ReviewFindingCard({
  finding,
  isSelected,
  onToggleSelected,
}: ReviewFindingCardProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      onPress={onToggleSelected}
      style={({ pressed }) => [
        styles.card,
        isSelected && styles.selectedCard,
        pressed && styles.pressedCard,
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.severityBadge, getSeverityStyle(finding.severity)]}>
          {finding.severity}
        </Text>
        <Text style={styles.selectionLabel}>{isSelected ? 'Selected' : 'Select'}</Text>
      </View>

      <Text style={styles.title}>{finding.title}</Text>
      <Text style={styles.filePath}>
        {finding.filePath}
        {finding.lineNumber ? `:${finding.lineNumber}` : ''}
      </Text>
      <Text style={styles.message}>{finding.message}</Text>

      {finding.suggestedChange ? (
        <View style={styles.suggestionPanel}>
          <Text style={styles.suggestionLabel}>Suggested change</Text>
          <Text style={styles.suggestionText}>{finding.suggestedChange}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function getSeverityStyle(severity: ReviewFinding['severity']) {
  if (severity === 'error') {
    return styles.errorSeverity;
  }

  if (severity === 'warning') {
    return styles.warningSeverity;
  }

  return styles.infoSeverity;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  selectedCard: {
    borderColor: '#2563EB',
  },
  pressedCard: {
    backgroundColor: '#F8FAFC',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  severityBadge: {
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  errorSeverity: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
  },
  warningSeverity: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  infoSeverity: {
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
  },
  selectionLabel: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  filePath: {
    color: '#64748B',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  message: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
  suggestionPanel: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  suggestionLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  suggestionText: {
    color: '#0F172A',
    fontSize: 13,
    lineHeight: 19,
  },
});
