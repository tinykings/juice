// Not part of an email address or handle ("bob@123.com"), and not followed by more of a word.
export const TASK_TIME_PATTERN = /(?<![\w.@])@(\d+(?::\d{2})?(?:pm|am)?)(?![\w:]|\.\w)/i;

/**
 * Minutes after midnight for an @time's text (e.g. 9am, 530, 2:30pm), or null
 * when it isn't a real time. Without am/pm, 1–6 o'clock reads as afternoon and
 * 7–11 as morning, which matches how people jot down times without depending
 * on the clock.
 */
function parseTimeText(text: string): number | null {
  const clean = text.toLowerCase();
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

  return hours > 23 || minutes > 59 ? null : hours * 60 + minutes;
}

/** The first real @time in a title. "@99" and the like stay ordinary text. */
export function findTaskTime(title: string): { index: number; text: string; minutes: number } | null {
  for (const match of title.matchAll(new RegExp(TASK_TIME_PATTERN.source, 'gi'))) {
    const minutes = parseTimeText(match[1]);
    if (minutes !== null) return { index: match.index, text: match[0], minutes };
  }
  return null;
}

export function parseTaskTimeMinutes(title: string): number | null {
  return findTaskTime(title)?.minutes ?? null;
}

/** Display label for a task's @time, e.g. "2 pm" or "9:30 am", read the same way it sorts. */
export function formatTaskTime(title: string): string | null {
  const minutes = parseTaskTimeMinutes(title);
  if (minutes === null) return null;

  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? 'pm' : 'am';
  const hours12 = hours24 % 12 || 12;
  return mins ? `${hours12}:${String(mins).padStart(2, '0')} ${suffix}` : `${hours12} ${suffix}`;
}

/** Timed tasks first, earliest first; everything else alphabetically. Used wherever a day's tasks are listed. */
export function compareTasksByTime(a: { title: string }, b: { title: string }): number {
  const timeA = parseTaskTimeMinutes(a.title);
  const timeB = parseTaskTimeMinutes(b.title);
  if (timeA !== null && timeB === null) return -1;
  if (timeA === null && timeB !== null) return 1;
  if (timeA !== null && timeB !== null && timeA !== timeB) return timeA - timeB;
  return a.title.localeCompare(b.title);
}

/** Title with any @time tokens removed. */
export function stripTaskTime(title: string): string {
  return title
    .replace(new RegExp(TASK_TIME_PATTERN.source, 'gi'), (token, text: string) => (parseTimeText(text) === null ? token : ''))
    .replace(/\s{2,}/g, ' ')
    .trim();
}
