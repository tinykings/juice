import { stripTaskTime } from '@/utils/taskTime';

export function splitTaskTitle(value: string): { title: string; note: string } {
  const trimmed = value.trim();
  const separatorIndex = trimmed.indexOf('.');

  if (separatorIndex === -1) {
    return { title: trimmed, note: '' };
  }

  const title = trimmed.slice(0, separatorIndex).trim();
  const note = trimmed.slice(separatorIndex + 1).trim();

  return {
    title: title || trimmed,
    note,
  };
}

/**
 * A task's one-line title with its @time and note removed. Subscribed calendar
 * events keep their title as written ("Dr. Smith" isn't a title and a note).
 */
export function getTaskDisplayTitle(task: { title: string; isCalendarEvent?: boolean }): string {
  if (task.isCalendarEvent) return task.title;
  return splitTaskTitle(stripTaskTime(task.title) || task.title).title;
}
