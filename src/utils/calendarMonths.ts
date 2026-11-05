import { addMonths, eachMonthOfInterval, format, isAfter, isBefore, startOfMonth } from 'date-fns';
import { Task } from '@/types/task';
import { parseTaskDate } from '@/utils/taskDate';

/** The calendar always shows this many months after the current one. */
export const MONTHS_ALWAYS_AHEAD = 3;
/** Empty months are filled in up to a task this far ahead; beyond that only the task's month shows. */
export const MAX_FILLED_MONTHS_AHEAD = 12;

/**
 * Months the calendar shows, oldest first: always starting at the current month,
 * then onward without gaps, plus any months scrolled to. Overdue tasks from
 * earlier months stay in the list instead.
 */
export function getCalendarMonths(
  tasks: Task[],
  now: Date,
  navigatedEnd: Date | null = null
): Date[] {
  const current = startOfMonth(now);
  const taskMonths = tasks
    .filter(task => !task.completed && task.dueDate)
    .map(task => startOfMonth(parseTaskDate(task.dueDate)))
    .filter(month => !isBefore(month, current));

  const latest = (dates: Date[]) => dates.reduce((a, b) => (isAfter(b, a) ? b : a));

  const furthestFilledTask = taskMonths.filter(month => !isAfter(month, addMonths(current, MAX_FILLED_MONTHS_AHEAD)));
  const end = latest([
    addMonths(current, MONTHS_ALWAYS_AHEAD),
    ...furthestFilledTask,
    ...(navigatedEnd ? [startOfMonth(navigatedEnd)] : []),
  ]);

  const months = new Map<string, Date>();
  for (const month of [...eachMonthOfInterval({ start: current, end }), ...taskMonths]) {
    months.set(format(month, 'yyyy-MM'), month);
  }

  return Array.from(months.keys()).sort().map(key => months.get(key)!);
}

/**
 * The month to extend to when scrolling down: a couple past the unbroken run from
 * the current month, so a task years away doesn't fill in everything before it.
 */
export function getNextMonthsEnd(months: Date[], now: Date, monthsToAdd = 2): Date {
  const shown = new Set(months.map(month => format(month, 'yyyy-MM')));
  let last = startOfMonth(now);
  while (shown.has(format(addMonths(last, 1), 'yyyy-MM'))) last = addMonths(last, 1);
  return addMonths(last, monthsToAdd);
}
