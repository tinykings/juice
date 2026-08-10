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
 * Add read-only recurring previews only within months already visible from
 * real tasks (plus current month). Previews never make blank future months
 * appear, persist, or sync.
 */
export function withRecurrencePreviews(tasks: Task[], now = new Date()): Task[] {
  const visibleMonths = new Set<string>([formatTaskDate(now).slice(0, 7)]);

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
