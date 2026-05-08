import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AiProviderSettingsScreen } from '@/screens/AiProviderSettingsScreen';
import { AiReviewScreen } from '@/screens/AiReviewScreen';
import { GitAuthScreen } from '@/screens/GitAuthScreen';
import { GitProviderSettingsScreen } from '@/screens/GitProviderSettingsScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { MergeConfirmScreen } from '@/screens/MergeConfirmScreen';
import { MergeRequestDetailScreen } from '@/screens/MergeRequestDetailScreen';
import { MergeRequestDiffScreen } from '@/screens/MergeRequestDiffScreen';
import { MergeRequestListScreen } from '@/screens/MergeRequestListScreen';
import { MergeRequestReviewScreen } from '@/screens/MergeRequestReviewScreen';
import { NewRepositoryScreen } from '@/screens/NewRepositoryScreen';
import { RepositoryDetailScreen } from '@/screens/RepositoryDetailScreen';
import { RepositoryListScreen } from '@/screens/RepositoryListScreen';
import { ResolveConflictScreen } from '@/screens/ResolveConflictScreen';
import { StartAiCodingScreen } from '@/screens/StartAiCodingScreen';
import { TaskProgressScreen } from '@/screens/TaskProgressScreen';
import { WorkflowInstallScreen } from '@/screens/WorkflowInstallScreen';

import { RootStackParamList, routes } from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerLargeTitle: true,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name={routes.home}
        component={HomeScreen}
        options={{ title: 'AI Coding Agent' }}
      />
      <Stack.Screen
        name={routes.aiReview}
        component={AiReviewScreen}
        options={({ route }) => ({
          title: `AI Review #${route.params.mergeRequest.number}`,
        })}
      />
      <Stack.Screen
        name={routes.gitAuth}
        component={GitAuthScreen}
        options={{ title: 'Connect GitHub' }}
      />
      <Stack.Screen
        name={routes.gitProviderSettings}
        component={GitProviderSettingsScreen}
        options={{ title: 'Git Provider' }}
      />
      <Stack.Screen
        name={routes.aiProviderSettings}
        component={AiProviderSettingsScreen}
        options={{ title: 'AI Provider' }}
      />
      <Stack.Screen
        name={routes.repositoryList}
        component={RepositoryListScreen}
        options={{ title: 'Repositories' }}
      />
      <Stack.Screen
        name={routes.newRepository}
        component={NewRepositoryScreen}
        options={{ title: 'New Repository' }}
      />
      <Stack.Screen
        name={routes.startAiCoding}
        component={StartAiCodingScreen}
        options={{ title: 'Start AI Coding' }}
      />
      <Stack.Screen
        name={routes.taskProgress}
        component={TaskProgressScreen}
        options={{ title: 'Task Progress' }}
      />
      <Stack.Screen
        name={routes.mergeConfirm}
        component={MergeConfirmScreen}
        options={({ route }) => ({
          title: `Merge #${route.params.mergeRequest.number}`,
        })}
      />
      <Stack.Screen
        name={routes.mergeRequestList}
        component={MergeRequestListScreen}
        options={{ title: 'Pull Requests' }}
      />
      <Stack.Screen
        name={routes.mergeRequestDetail}
        component={MergeRequestDetailScreen}
        options={({ route }) => ({
          title: `PR #${route.params.mergeRequest.number}`,
        })}
      />
      <Stack.Screen
        name={routes.mergeRequestDiff}
        component={MergeRequestDiffScreen}
        options={({ route }) => ({
          title: `Diff #${route.params.mergeRequest.number}`,
        })}
      />
      <Stack.Screen
        name={routes.mergeRequestReview}
        component={MergeRequestReviewScreen}
        options={({ route }) => ({
          title: `PR #${route.params.mergeRequest.number}`,
        })}
      />
      <Stack.Screen
        name={routes.repositoryDetail}
        component={RepositoryDetailScreen}
        options={({ route }) => ({ title: route.params.repository.name })}
      />
      <Stack.Screen
        name={routes.resolveConflict}
        component={ResolveConflictScreen}
        options={({ route }) => ({
          title: `Resolve #${route.params.mergeRequest.number}`,
        })}
      />
      <Stack.Screen
        name={routes.workflowInstall}
        component={WorkflowInstallScreen}
        options={{ title: 'Install Workflows' }}
      />
    </Stack.Navigator>
  );
}
