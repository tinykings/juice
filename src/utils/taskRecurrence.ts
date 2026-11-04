import { addDays, addMonths, addWeeks, addYears } from 'date-fns';
import { RecurrenceType, Task } from '@/types/task';
import { formatTaskDate, normalizeTaskDate, parseTaskDate } from '@/utils/taskDate';

export function getNextRecurrenceDate(currentDate: string, recurrenceType: RecurrenceType): string {
  const date = parseTaskDate(currentDate);

  switch (recurrenceType) {
    case 'daily':
      return formatTaskDate(addDays(date, 1));
    case 'weekly':
      return formatTaskDate(addWeeks(date, 1));
    case 'monthly':
      return formatTaskDate(addMonths(date, 1));
    case 'yearly':
      return formatTaskDate(addYears(date, 1));
    default:
      return normalizeTaskDate(currentDate);
  }
}

/**
 * Date for the occurrence that replaces a completed recurring task. Overdue
 * tasks skip missed occurrences so the new one is not already overdue.
 */
export function getNextRecurrenceDateAfterCompletion(
  currentDate: string,
  recurrenceType: RecurrenceType,
  now = new Date()
): string {
  const today = formatTaskDate(now);
  let nextDate = getNextRecurrenceDate(currentDate, recurrenceType);

  for (let step = 0; step < 100_000 && nextDate <= today; step += 1) {
    const following = getNextRecurrenceDate(nextDate, recurrenceType);
    if (following <= nextDate) break;
    nextDate = following;
  }

  return nextDate;
}

/**
 * The untouched occurrence created when `task` was completed, if any. It
 * shares the completion timestamp as its creation time.
 */
export function findSpawnedRecurrence(tasks: Task[], task: Task): Task | undefined {
  if (!task.isRecurring || !task.recurrenceType || !task.completedAt) return undefined;

  return tasks.find((candidate) => (
    candidate.id !== task.id &&
    !candidate.completed &&
    !candidate.deletedAt &&
    candidate.isRecurring &&
    candidate.recurrenceType === task.recurrenceType &&
    candidate.title === task.title &&
    candidate.createdAt === task.completedAt &&
    (candidate.updatedAt ?? candidate.createdAt) === candidate.createdAt
  ));
}

/**
 * Add read-only recurring previews only within months already visible from
 * real tasks (plus current month and any `extraVisibleMonths`, as yyyy-MM, that
 * the caller is already showing). Previews never make blank future months
 * appear, persist, or sync.
 */
export function withRecurrencePreviews(tasks: Task[], now = new Date(), extraVisibleMonths: string[] = []): Task[] {
  const visibleMonths = new Set<string>([formatTaskDate(now).slice(0, 7), ...extraVisibleMonths]);

  for (const task of tasks) {
    if (!task.completed && !task.deletedAt && task.dueDate) {
      visibleMonths.add(normalizeTaskDate(task.dueDate).slice(0, 7));
    }
  }

  const lastVisibleMonth = Array.from(visibleMonths).sort().at(-1);
  if (!lastVisibleMonth) return tasks;

  const previews = tasks.flatMap((task): Task[] => {
    if (task.completed || task.deletedAt || !task.dueDate || !task.isRecurring || !task.recurrenceType) {
      return [];
    }

    const taskPreviews: Task[] = [];
    let occurrenceDate = normalizeTaskDate(task.dueDate);

    // Limit protects malformed ancient data while allowing over 270 years of daily recurrences.
    for (let occurrence = 0; occurrence < 100_000; occurrence += 1) {
      const nextDate = getNextRecurrenceDate(occurrenceDate, task.recurrenceType);
      if (nextDate <= occurrenceDate || nextDate.slice(0, 7) > lastVisibleMonth) break;
      occurrenceDate = nextDate;

      if (visibleMonths.has(nextDate.slice(0, 7))) {
        taskPreviews.push({
          ...task,
          id: `recurrence-preview:${task.id}:${nextDate}`,
          dueDate: nextDate,
          isRecurrencePreview: true,
          recurrenceSourceId: task.id,
        });
      }
    }

    return taskPreviews;
  });

  return [...tasks, ...previews];
}
