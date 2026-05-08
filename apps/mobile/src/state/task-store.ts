import { create } from 'zustand';

import type {
  AiCodingTask,
  AiCodingTaskStatus,
  AiReviewResult,
  MergeRequest,
  WorkflowRun,
} from '@/types';

type TaskState = {
  tasks: AiCodingTask[];
  reviewResults: AiReviewResult[];
  workflowRuns: WorkflowRun[];
  activeTaskId?: AiCodingTask['id'];
  setActiveTaskId: (activeTaskId?: AiCodingTask['id']) => void;
  upsertTask: (task: AiCodingTask) => void;
  updateTaskStatus: (
    taskId: AiCodingTask['id'],
    status: AiCodingTaskStatus,
    errorMessage?: string,
  ) => void;
  updateTaskWorkflowRun: (
    taskId: AiCodingTask['id'],
    workflowRun: WorkflowRun,
  ) => void;
  updateTaskMergeRequest: (
    taskId: AiCodingTask['id'],
    mergeRequest: MergeRequest,
  ) => void;
  removeTask: (taskId: AiCodingTask['id']) => void;
  addReviewResult: (reviewResult: AiReviewResult) => void;
  upsertWorkflowRun: (workflowRun: WorkflowRun) => void;
  resetTasks: () => void;
};

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  reviewResults: [],
  workflowRuns: [],
  setActiveTaskId: (activeTaskId) => set({ activeTaskId }),
  upsertTask: (task) =>
    set((state) => ({
      tasks: [task, ...state.tasks.filter((existingTask) => existingTask.id !== task.id)],
    })),
  updateTaskStatus: (taskId, status, errorMessage) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              errorMessage,
              updatedAt: new Date().toISOString(),
              completedAt: ['succeeded', 'failed', 'cancelled'].includes(status)
                ? new Date().toISOString()
                : task.completedAt,
            }
          : task,
      ),
    })),
  updateTaskWorkflowRun: (taskId, workflowRun) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: mapWorkflowRunStatusToTaskStatus(workflowRun.status),
              workflowLogUrl: workflowRun.logUrl,
              workflowRunId: workflowRun.id,
              workflowRunUrl: workflowRun.webUrl,
              updatedAt: new Date().toISOString(),
              completedAt: isTerminalWorkflowRunStatus(workflowRun.status)
                ? workflowRun.completedAt ?? new Date().toISOString()
                : task.completedAt,
            }
          : task,
      ),
    })),
  updateTaskMergeRequest: (taskId, mergeRequest) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              mergeRequestId: mergeRequest.id,
              mergeRequestNumber: mergeRequest.number,
              mergeRequestUrl: mergeRequest.webUrl,
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    })),
  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== taskId),
      activeTaskId: state.activeTaskId === taskId ? undefined : state.activeTaskId,
    })),
  addReviewResult: (reviewResult) =>
    set((state) => ({
      reviewResults: [
        reviewResult,
        ...state.reviewResults.filter((result) => result.id !== reviewResult.id),
      ],
    })),
  upsertWorkflowRun: (workflowRun) =>
    set((state) => ({
      workflowRuns: [
        workflowRun,
        ...state.workflowRuns.filter((run) => run.id !== workflowRun.id),
      ],
    })),
  resetTasks: () =>
    set({
      tasks: [],
      reviewResults: [],
      workflowRuns: [],
      activeTaskId: undefined,
    }),
}));

function mapWorkflowRunStatusToTaskStatus(
  status: WorkflowRun['status'],
): AiCodingTaskStatus {
  if (status === 'queued' || status === 'waiting') {
    return 'queued';
  }

  if (status === 'in_progress') {
    return 'running';
  }

  if (status === 'succeeded') {
    return 'succeeded';
  }

  if (status === 'cancelled') {
    return 'cancelled';
  }

  return 'failed';
}

function isTerminalWorkflowRunStatus(status: WorkflowRun['status']) {
  return ['cancelled', 'failed', 'skipped', 'succeeded'].includes(status);
}
