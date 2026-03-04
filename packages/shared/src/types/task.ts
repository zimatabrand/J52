export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked' | 'deferred' | 'queued' | 'failed';
export type TaskPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Task {
  taskId: number;
  schemaCode: string | null;
  sessionId: number | null;
  parentTaskId: number | null;
  taskTitle: string;
  taskDescription: string | null;
  taskType: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string | null;
  dueDate: string | null;
  completedDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  // Async execution fields
  workerId: string | null;
  queuedAt: string | null;
  startedAtWorker: string | null;
  resultSummary: string | null;
  resultOutput: string | null;
  errorMessage: string | null;
  projectPath: string | null;
  claudePrompt: string | null;
  executionMetadata: Record<string, unknown> | null;
}

export interface CreateTaskInput {
  taskTitle: string;
  taskDescription?: string;
  taskType?: string;
  priority?: TaskPriority;
  schemaCode?: string;
  sessionId?: number;
  parentTaskId?: number;
  assignedTo?: string;
  dueDate?: string;
  estimatedHours?: number;
  tags?: string[];
}

export interface UpdateTaskInput {
  taskTitle?: string;
  taskDescription?: string;
  taskType?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  dueDate?: string;
  completedDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
}
