import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/routes';
import { routes } from '@/navigation/routes';

type RepositoryDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof routes.repositoryDetail
>;

export function RepositoryDetailScreen({ navigation, route }: RepositoryDetailScreenProps) {
  const { repository } = route.params;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.owner}>{repository.owner.username}</Text>
          <Text style={styles.title}>{repository.name}</Text>
          {repository.description ? (
            <Text style={styles.description}>{repository.description}</Text>
          ) : null}
        </View>

        <View style={styles.metadataGrid}>
          <MetadataItem label="Visibility" value={repository.visibility} />
          <MetadataItem label="Default branch" value={repository.defaultBranch.name} />
          <MetadataItem label="Provider" value={repository.providerType} />
          <MetadataItem label="Permissions" value={repository.permissions.join(', ') || 'read'} />
        </View>

        <View style={styles.actions}>
          <ActionButton
            label="Start AI Coding"
            onPress={() => navigation.navigate(routes.startAiCoding, { repository })}
          />
          <ActionButton
            label="View PR/MR"
            onPress={() => navigation.navigate(routes.mergeRequestList, { repository })}
          />
          <ActionButton
            label="Install Workflows"
            onPress={() => navigation.navigate(routes.workflowInstall, { repository })}
          />
          <ActionButton label="View Issues" disabled />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metadataItem}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text style={styles.metadataValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.disabledActionButton,
        pressed && styles.pressedButton,
      ]}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    gap: 20,
    padding: 24,
  },
  header: {
    gap: 8,
  },
  owner: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  title: {
    color: '#0F172A',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0,
  },
  description: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
  },
  metadataGrid: {
    gap: 10,
  },
  metadataItem: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  metadataLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  metadataValue: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  actions: {
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  disabledActionButton: {
    opacity: 0.55,
  },
  pressedButton: {
    opacity: 0.75,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
