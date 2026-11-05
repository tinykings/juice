import { stripTaskTime } from '@/utils/taskTime';

// A period after one of these belongs to the name ("Dr. Smith"), not the end of the title.
const ABBREVIATIONS = new Set(['dr', 'mr', 'mrs', 'ms', 'mx', 'prof', 'st', 'mt', 'vs', 'jr', 'sr']);

/**
 * Where the title ends and the note begins: the first period followed by a space
 * or the end of the text. Periods inside "$12.50" or "example.com" don't count.
 */
export function findNoteSeparator(value: string): number {
  for (const match of value.matchAll(/\.(?=\s|$)/g)) {
    const word = value.slice(0, match.index).match(/\S+$/)?.[0].toLowerCase();
    if (!word || !ABBREVIATIONS.has(word)) return match.index;
  }
  return -1;
}

export function splitTaskTitle(value: string): { title: string; note: string } {
  const trimmed = value.trim();
  const separatorIndex = findNoteSeparator(trimmed);

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
 * A task's title and note for display. The note is whatever follows the title
 * plus the separate `notes` field, which other Juice clients can fill in.
 */
export function getTaskTitleParts(task: { title: string; notes?: string }): { title: string; note: string } {
  const parts = splitTaskTitle(stripTaskTime(task.title) || task.title);
  return {
    title: parts.title,
    note: [parts.note, task.notes?.trim()].filter(Boolean).join('\n'),
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
