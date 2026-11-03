export const TASK_TIME_PATTERN = /@(\d+(?::\d{2})?(?:pm|am)?)/i;

/**
 * Minutes after midnight for a task's @time (e.g. @9am, @530, @2:30pm), or
 * null. Without am/pm, 1–6 o'clock reads as afternoon and 7–11 as morning,
 * which matches how people jot down times without depending on the clock.
 */
export function parseTaskTimeMinutes(title: string): number | null {
  const match = title.match(TASK_TIME_PATTERN);
  if (!match) return null;

  const clean = match[1].toLowerCase();
  const isPm = clean.endsWith('pm');
  const isAm = clean.endsWith('am');
  const digits = clean.replace(/am|pm/, '');
  let hours: number;
  let minutes = 0;

  if (digits.includes(':')) {
    const [h, m] = digits.split(':').map(Number);
    hours = h;
    minutes = m || 0;
  } else {
    const num = parseInt(digits, 10) || 0;
    hours = num >= 100 ? Math.floor(num / 100) : num;
    minutes = num >= 100 ? num % 100 : 0;
  }

  if (isPm && hours < 12) hours += 12;
  else if (isAm && hours === 12) hours = 0;
  else if (!isPm && !isAm && hours >= 1 && hours <= 6) hours += 12;

  return hours * 60 + minutes;
}

/** Display label for a task's @time, e.g. "2 pm" or "9:30 am", read the same way it sorts. */
export function formatTaskTime(title: string): string | null {
  const minutes = parseTaskTimeMinutes(title);
  if (minutes === null) return null;

  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  if (Math.floor(minutes / 60) > 23 || mins > 59) return null;

  const suffix = hours24 >= 12 ? 'pm' : 'am';
  const hours12 = hours24 % 12 || 12;
  return mins ? `${hours12}:${String(mins).padStart(2, '0')} ${suffix}` : `${hours12} ${suffix}`;
}

/** Title with any @time tokens removed. */
export function stripTaskTime(title: string): string {
  return title.replace(new RegExp(TASK_TIME_PATTERN.source, 'gi'), '').replace(/\s{2,}/g, ' ').trim();
}
