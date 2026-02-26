export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked' | 'deferred';
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
