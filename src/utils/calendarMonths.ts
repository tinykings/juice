import { addMonths, eachMonthOfInterval, format, isAfter, isBefore, startOfMonth } from 'date-fns';
import { Task } from '@/types/task';
import { parseTaskDate } from '@/utils/taskDate';

/** The calendar always shows this many months after the current one. */
export const MONTHS_ALWAYS_AHEAD = 3;
/** Empty months are filled in up to a task this far ahead; beyond that only the task's month shows. */
export const MAX_FILLED_MONTHS_AHEAD = 12;

/**
 * Months the calendar shows, oldest first: past months with open tasks, the
 * current month onward without gaps, and any months the user navigated to.
 */
export function getCalendarMonths(
  tasks: Task[],
  now: Date,
  navigatedStart: Date | null = null,
  navigatedEnd: Date | null = null
): Date[] {
  const current = startOfMonth(now);
  const taskMonths = tasks
    .filter(task => !task.completed && task.dueDate)
    .map(task => startOfMonth(parseTaskDate(task.dueDate)));

  const latest = (dates: Date[]) => dates.reduce((a, b) => (isAfter(b, a) ? b : a));
  const earliest = (dates: Date[]) => dates.reduce((a, b) => (isBefore(b, a) ? b : a));

  const furthestFilledTask = taskMonths.filter(month => !isAfter(month, addMonths(current, MAX_FILLED_MONTHS_AHEAD)));
  const end = latest([
    addMonths(current, MONTHS_ALWAYS_AHEAD),
    ...furthestFilledTask,
    ...(navigatedEnd ? [startOfMonth(navigatedEnd)] : []),
  ]);
  const start = earliest([current, ...(navigatedStart ? [startOfMonth(navigatedStart)] : [])]);

  const months = new Map<string, Date>();
  for (const month of [...eachMonthOfInterval({ start, end }), ...taskMonths]) {
    months.set(format(month, 'yyyy-MM'), month);
  }

  return Array.from(months.keys()).sort().map(key => months.get(key)!);
}
