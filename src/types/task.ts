export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | null;

export interface Task {
  id: string;
  title: string;
  notes: string;
  dueDate: string; // YYYY-MM-DD local calendar date, or empty when pinned
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  conflictOf?: string;
  pinned: boolean;
  isRecurring: boolean;
  recurrenceType: RecurrenceType;
  tags: string[];
  /** UI-only occurrence projected from an active recurring task. Never persisted. */
  isRecurrencePreview?: boolean;
  recurrenceSourceId?: string;
  /** UI-only, read-only event from the device's subscribed .ics calendar. Never persisted. */
  isCalendarEvent?: boolean;
  /** Display time for timed calendar events (e.g. "9:30 AM"); absent for all-day. */
  eventTime?: string;
  /** Start instant used to order calendar events within a day. */
  eventStart?: number;
}

export interface TaskGroup {
  label: string;
  date: string;
  tasks: Task[];
}
