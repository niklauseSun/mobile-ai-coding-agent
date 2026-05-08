import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

export function ScreenSection({ children }: PropsWithChildren) {
  return <View style={styles.section}>{children}</View>;
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
});

