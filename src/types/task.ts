export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | null;

export interface Task {
  id: string;
  title: string;
  notes: string;
  dueDate: string; // YYYY-MM-DD local calendar date, or empty for someday
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  conflictOf?: string;
  isRecurring: boolean;
  recurrenceType: RecurrenceType;
  tags: string[];
  /** UI-only occurrence projected from an active recurring task. Never persisted. */
  isRecurrencePreview?: boolean;
  recurrenceSourceId?: string;
}

export interface TaskGroup {
  label: string;
  date: string;
  tasks: Task[];
}
