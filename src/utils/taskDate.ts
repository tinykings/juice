import { format, isValid, parse } from 'date-fns';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Convert current and legacy task dates to the date-only format used for due dates. */
export function normalizeTaskDate(value: string): string {
  if (!value) return '';
  if (DATE_ONLY_PATTERN.test(value)) return value;

  const legacyDate = new Date(value);
  return isValid(legacyDate) ? format(legacyDate, 'yyyy-MM-dd') : '';
}

/** Parse a task due date at midnight in the user's local calendar. */
export function parseTaskDate(value: string): Date {
  const normalized = normalizeTaskDate(value);
  return parse(normalized, 'yyyy-MM-dd', new Date());
}

export function formatTaskDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
