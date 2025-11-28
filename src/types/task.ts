export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | null;

export interface Task {
  id: string;
  title: string;
  notes: string;
  dueDate: string; // ISO date string
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  isRecurring: boolean;
  recurrenceType: RecurrenceType;
  tags: string[];
}

export interface TaskGroup {
  label: string;
  date: string;
  tasks: Task[];
}

