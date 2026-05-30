import { startOfDay, addDays, addMonths, startOfMonth } from 'date-fns';

export interface DateWordMatch {
  word: string;
  date: Date | null; // null means "someday" (no date)
  index: number;
}

const dayNames: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thur: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const monthNames: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

function getNextWeekday(targetDay: number, allowToday: boolean): Date {
  const today = startOfDay(new Date());
  const currentDay = today.getDay();
  let diff = targetDay - currentDay;
  if (diff < 0) diff += 7;
  if (diff === 0 && !allowToday) diff = 7;
  return addDays(today, diff);
}

function computeNextWeekMonday(): Date {
  const today = startOfDay(new Date());
  const currentDay = today.getDay();
  const daysUntil = (8 - currentDay) % 7 || 7;
  return addDays(today, daysUntil);
}

function computeNextMonthFirst(): Date {
  return startOfMonth(addMonths(new Date(), 1));
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function computeMonthDay(match: RegExpMatchArray): Date {
  const month = monthNames[match[1].toLowerCase()];
  const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
  const maxDay = daysInMonth(year, month);
  const day = Math.min(parseInt(match[2], 10), maxDay);
  const date = startOfDay(new Date(year, month, day));
  const today = startOfDay(new Date());
  if (!match[3] && date < today) {
    date.setFullYear(year + 1);
  }
  return date;
}

function computeDayMonth(match: RegExpMatchArray): Date {
  const month = monthNames[match[2].toLowerCase()];
  const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
  const maxDay = daysInMonth(year, month);
  const day = Math.min(parseInt(match[1], 10), maxDay);
  const date = startOfDay(new Date(year, month, day));
  const today = startOfDay(new Date());
  if (!match[3] && date < today) {
    date.setFullYear(year + 1);
  }
  return date;
}

interface Entry {
  pattern: RegExp;
  compute: (match: RegExpMatchArray) => Date | null;
}

function buildEntries(): Entry[] {
  const monthPattern = Object.keys(monthNames).join('|');

  const entries: Entry[] = [
    { pattern: /\bnext week\b/i, compute: computeNextWeekMonday },
    { pattern: /\bnext month\b/i, compute: computeNextMonthFirst },
    { pattern: new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?\\b`, 'i'), compute: computeMonthDay },
    { pattern: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern}),?\\s*(\\d{4})?\\b`, 'i'), compute: computeDayMonth },
    { pattern: /\btomorrow\b/i, compute: () => addDays(startOfDay(new Date()), 1) },
    { pattern: /\btoday\b/i, compute: () => startOfDay(new Date()) },
    { pattern: /\bsomeday\b/i, compute: () => null },
    { pattern: /\bfuture\b/i, compute: () => null },
  ];

  for (const [name, day] of Object.entries(dayNames)) {
    entries.push({
      pattern: new RegExp(`\\bnext ${name}\\b`, 'i'),
      compute: () => getNextWeekday(day, false),
    });
    entries.push({
      pattern: new RegExp(`\\b${name}\\b`, 'i'),
      compute: () => getNextWeekday(day, true),
    });
  }

  return entries;
}

const entries = buildEntries();

export function findDateWord(title: string): DateWordMatch | null {
  let earliest: DateWordMatch | null = null;

  for (const entry of entries) {
    const match = title.match(entry.pattern);
    if (match && match.index !== undefined) {
      if (!earliest || match.index < earliest.index) {
        earliest = {
          word: match[0],
          date: entry.compute(match),
          index: match.index,
        };
      }
    }
  }

  return earliest;
}

export function removeDateWord(title: string, match: DateWordMatch): string {
  return (title.slice(0, match.index) + title.slice(match.index + match.word.length))
    .replace(/\s+/g, ' ')
    .trim();
}
