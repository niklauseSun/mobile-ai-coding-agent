import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MergeRequest } from '@/types';

type ConflictStatusTone = 'blocked' | 'info' | 'ok' | 'warning';

type ConflictStatusCardProps = {
  isRefreshing?: boolean;
  mergeRequest: MergeRequest;
  onRefresh?: () => void;
  onResolveWithAi?: () => void;
  providerSupportsConflictStatus: boolean;
  resolveDisabled?: boolean;
};

export function ConflictStatusCard({
  isRefreshing = false,
  mergeRequest,
  onRefresh,
  onResolveWithAi,
  providerSupportsConflictStatus,
  resolveDisabled = false,
}: ConflictStatusCardProps) {
  const presentation = getConflictStatusPresentation(
    mergeRequest,
    providerSupportsConflictStatus,
  );
  const canResolve =
    Boolean(onResolveWithAi) &&
    providerSupportsConflictStatus &&
    isMergeRequestBlockedByConflict(mergeRequest) &&
    mergeRequest.state === 'open';

  return (
    <View style={[styles.card, getToneContainerStyle(presentation.tone)]}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Conflict status</Text>
          <Text style={[styles.title, getToneTitleStyle(presentation.tone)]}>
            {presentation.title}
          </Text>
        </View>
        <Text style={[styles.badge, getToneBadgeStyle(presentation.tone)]}>
          {presentation.label}
        </Text>
      </View>

      <Text style={styles.body}>{presentation.description}</Text>

      {presentation.shouldWarnReview ? (
        <Text style={styles.warningText}>
          AI conflict resolution updates must be reviewed in the diff before merge.
        </Text>
      ) : null}

      <View style={styles.actions}>
        {onRefresh ? (
          <Pressable
            accessibilityRole="button"
            disabled={isRefreshing}
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.secondaryButton,
              (isRefreshing || pressed) && styles.pressedButton,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isRefreshing ? 'Refreshing' : 'Refresh Status'}
            </Text>
          </Pressable>
        ) : null}

        {canResolve ? (
          <Pressable
            accessibilityRole="button"
            disabled={resolveDisabled}
            onPress={onResolveWithAi}
            style={({ pressed }) => [
              styles.primaryButton,
              (resolveDisabled || pressed) && styles.pressedButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>Resolve with AI</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function isMergeRequestBlockedByConflict(mergeRequest: MergeRequest) {
  return (
    mergeRequest.mergeConflictStatus === 'conflicted' ||
    mergeRequest.mergeConflictStatus === 'unresolved' ||
    mergeRequest.isMergeable === false
  );
}

export function isConflictResolutionUseful(mergeRequest: MergeRequest) {
  return (
    isMergeRequestBlockedByConflict(mergeRequest) ||
    mergeRequest.mergeConflictStatus === 'unknown' ||
    mergeRequest.mergeConflictStatus === 'resolution_running'
  );
}

function getConflictStatusPresentation(
  mergeRequest: MergeRequest,
  providerSupportsConflictStatus: boolean,
): {
  description: string;
  label: string;
  shouldWarnReview: boolean;
  title: string;
  tone: ConflictStatusTone;
} {
  if (!providerSupportsConflictStatus) {
    return {
      description:
        'This provider does not expose merge conflict status through the current adapter.',
      label: 'unavailable',
      shouldWarnReview: false,
      title: 'Status unavailable',
      tone: 'info',
    };
  }

  if (mergeRequest.state !== 'open') {
    return {
      description: 'Conflict resolution is only available for open change requests.',
      label: mergeRequest.state,
      shouldWarnReview: false,
      title: 'Change request is not open',
      tone: 'info',
    };
  }

  if (isMergeRequestBlockedByConflict(mergeRequest)) {
    return {
      description:
        'This change request cannot be merged until its source branch is updated and conflicts are resolved.',
      label: 'conflict',
      shouldWarnReview: true,
      title: 'Conflicts detected',
      tone: 'blocked',
    };
  }

  if (mergeRequest.mergeConflictStatus === 'resolution_running') {
    return {
      description:
        'A conflict resolution automation run is in progress for this change request.',
      label: 'running',
      shouldWarnReview: true,
      title: 'Resolution running',
      tone: 'warning',
    };
  }

  if (
    mergeRequest.mergeConflictStatus === 'resolved' ||
    mergeRequest.mergeConflictStatus === 'clean' ||
    mergeRequest.isMergeable === true
  ) {
    return {
      description:
        'No merge conflicts are currently reported. Review checks and the diff before merging.',
      label: mergeRequest.mergeConflictStatus === 'resolved' ? 'resolved' : 'clean',
      shouldWarnReview: mergeRequest.mergeConflictStatus === 'resolved',
      title: 'No conflicts reported',
      tone: 'ok',
    };
  }

  return {
    description:
      'The provider has not reported mergeability yet. Refresh after a few seconds if this pull request was just updated.',
    label: 'unknown',
    shouldWarnReview: false,
    title: 'Status pending',
    tone: 'warning',
  };
}

function getToneContainerStyle(tone: ConflictStatusTone) {
  if (tone === 'blocked') {
    return styles.blockedCard;
  }

  if (tone === 'ok') {
    return styles.okCard;
  }

  if (tone === 'warning') {
    return styles.warningCard;
  }

  return styles.infoCard;
}

function getToneTitleStyle(tone: ConflictStatusTone) {
  if (tone === 'blocked') {
    return styles.blockedTitle;
  }

  if (tone === 'ok') {
    return styles.okTitle;
  }

  if (tone === 'warning') {
    return styles.warningTitle;
  }

  return styles.infoTitle;
}

function getToneBadgeStyle(tone: ConflictStatusTone) {
  if (tone === 'blocked') {
    return styles.blockedBadge;
  }

  if (tone === 'ok') {
    return styles.okBadge;
  }

  if (tone === 'warning') {
    return styles.warningBadge;
  }

  return styles.infoBadge;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  okCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  warningCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  blockedCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  infoTitle: {
    color: '#1D4ED8',
  },
  okTitle: {
    color: '#047857',
  },
  warningTitle: {
    color: '#B45309',
  },
  blockedTitle: {
    color: '#B91C1C',
  },
  badge: {
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  infoBadge: {
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
  },
  okBadge: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  warningBadge: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  blockedBadge: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  body: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },
  warningText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  pressedButton: {
    opacity: 0.65,
  },
});
