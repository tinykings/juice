import { addDays, endOfDay, format, isAfter, isBefore, isSameDay, startOfDay } from 'date-fns';
import { Task } from '@/types/task';
import { parseTaskDate } from '@/utils/taskDate';
import { compareTasksByTime } from '@/utils/taskTime';

export interface TaskGroup {
  label: string;
  /** Short date shown beside the label, e.g. "Nov 4". */
  detail?: string;
  tasks: Task[];
  isToday?: boolean;
  isOverdue?: boolean;
  date?: Date;
}

export function compareTasksByDateAndTime(a: Task, b: Task): number {
  return parseTaskDate(a.dueDate).getTime() - parseTaskDate(b.dueDate).getTime() || compareTasksByTime(a, b);
}

/** Real tasks first (in the given order), then calendar events by start time. */
export function withEventsLast(items: Task[], compareTasks: (a: Task, b: Task) => number): Task[] {
  const tasks = items.filter(t => !t.isCalendarEvent).sort(compareTasks);
  const events = items
    .filter(t => t.isCalendarEvent)
    .sort((a, b) => (a.eventStart ?? 0) - (b.eventStart ?? 0) || a.title.localeCompare(b.title));
  return [...tasks, ...events];
}

/** The date on a task card, for groups whose header doesn't already say which day it is. */
export function getTaskDateLabel(task: Task, group: TaskGroup, now: Date): string | undefined {
  if (group.isOverdue) {
    if (!task.dueDate) return 'No date';
    const date = parseTaskDate(task.dueDate);
    return format(date, date.getFullYear() === now.getFullYear() ? 'MMM d' : 'MMM d, yyyy');
  }
  return group.date ? undefined : format(parseTaskDate(task.dueDate), 'EEE, MMM d');
}

/** Overdue, today, each of the next seven days, then one group per later month. */
export function buildTaskGroups(incompleteTasks: Task[], undatedTasks: Task[], now: Date): TaskGroup[] {
  const today = startOfDay(now);
  const weekEnd = endOfDay(addDays(today, 7));
  const groups: TaskGroup[] = [];

  const overdueTasks = incompleteTasks.filter(t => isBefore(startOfDay(parseTaskDate(t.dueDate)), today));
  if (overdueTasks.length > 0 || undatedTasks.length > 0) {
    // Oldest first; undated tasks follow the ones that were due.
    groups.push({
      label: 'Overdue',
      tasks: [
        ...[...overdueTasks].sort(compareTasksByDateAndTime),
        ...[...undatedTasks].sort(compareTasksByTime),
      ],
      isOverdue: true,
      date: addDays(today, -1),
    });
  }

  groups.push({
    label: 'Today',
    detail: format(today, 'EEE, MMM d'),
    tasks: withEventsLast(incompleteTasks.filter(t => isSameDay(parseTaskDate(t.dueDate), today)), compareTasksByTime),
    isToday: true,
    date: today,
  });

  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, i);
    groups.push({
      label: i === 1 ? 'Tomorrow' : format(date, 'EEEE'),
      detail: format(date, i === 1 ? 'EEE, MMM d' : 'MMM d'),
      tasks: withEventsLast(incompleteTasks.filter(t => isSameDay(parseTaskDate(t.dueDate), date)), compareTasksByTime),
      date,
    });
  }

  const monthGroups = new Map<string, Task[]>();
  for (const task of incompleteTasks) {
    if (!isAfter(parseTaskDate(task.dueDate), weekEnd)) continue;
    const month = format(parseTaskDate(task.dueDate), 'MMMM yyyy');
    monthGroups.set(month, [...(monthGroups.get(month) ?? []), task]);
  }
  for (const [label, tasks] of monthGroups) {
    groups.push({ label, tasks: [...tasks].sort(compareTasksByDateAndTime) });
  }

  return groups;
}
