export const routes = {
  aiReview: 'AiReview',
  aiProviderSettings: 'AiProviderSettings',
  gitAuth: 'GitAuth',
  gitProviderSettings: 'GitProviderSettings',
  home: 'Home',
  mergeConfirm: 'MergeConfirm',
  mergeRequestDetail: 'MergeRequestDetail',
  mergeRequestDiff: 'MergeRequestDiff',
  mergeRequestList: 'MergeRequestList',
  mergeRequestReview: 'MergeRequestReview',
  newRepository: 'NewRepository',
  repositoryDetail: 'RepositoryDetail',
  repositoryList: 'RepositoryList',
  resolveConflict: 'ResolveConflict',
  startAiCoding: 'StartAiCoding',
  taskProgress: 'TaskProgress',
  workflowInstall: 'WorkflowInstall',
} as const;

export type RootStackParamList = {
  [routes.aiReview]: {
    repository: import('@/types').Repository;
    mergeRequest: import('@/types').MergeRequest;
  };
  [routes.aiProviderSettings]: undefined;
  [routes.gitAuth]: undefined;
  [routes.gitProviderSettings]: undefined;
  [routes.home]: undefined;
  [routes.mergeConfirm]: {
    repository: import('@/types').Repository;
    mergeRequest: import('@/types').MergeRequest;
  };
  [routes.mergeRequestDetail]: {
    repository: import('@/types').Repository;
    mergeRequest: import('@/types').MergeRequest;
  };
  [routes.mergeRequestDiff]: {
    repository: import('@/types').Repository;
    mergeRequest: import('@/types').MergeRequest;
  };
  [routes.mergeRequestList]: {
    repository: import('@/types').Repository;
  };
  [routes.mergeRequestReview]: {
    repository: import('@/types').Repository;
    mergeRequest: import('@/types').MergeRequest;
  };
  [routes.newRepository]: undefined;
  [routes.repositoryDetail]: {
    repository: import('@/types').Repository;
  };
  [routes.repositoryList]: undefined;
  [routes.resolveConflict]: {
    repository: import('@/types').Repository;
    mergeRequest: import('@/types').MergeRequest;
  };
  [routes.startAiCoding]:
    | {
        repository?: import('@/types').Repository;
      }
    | undefined;
  [routes.taskProgress]: {
    autoOpenReview?: boolean;
    repository: import('@/types').Repository;
    taskId: string;
  };
  [routes.workflowInstall]: {
    repository: import('@/types').Repository;
  };
};
