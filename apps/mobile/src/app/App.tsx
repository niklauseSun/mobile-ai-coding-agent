import { StatusBar } from 'expo-status-bar';

import { AppNavigator } from '@/navigation/AppNavigator';
import { AppProviders } from '@/providers/AppProviders';

export function App() {
  return (
    <AppProviders>
      <StatusBar style="auto" />
      <AppNavigator />
    </AppProviders>
  );
}

