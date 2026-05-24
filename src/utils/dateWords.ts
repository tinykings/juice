import { startOfDay, addDays, addMonths, startOfMonth } from 'date-fns';

export interface DateWordMatch {
  word: string;
  date: Date;
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

interface Entry {
  pattern: RegExp;
  compute: () => Date;
}

function buildEntries(): Entry[] {
  const entries: Entry[] = [
    { pattern: /\bnext week\b/i, compute: computeNextWeekMonday },
    { pattern: /\bnext month\b/i, compute: computeNextMonthFirst },
    { pattern: /\btomorrow\b/i, compute: () => addDays(startOfDay(new Date()), 1) },
    { pattern: /\btoday\b/i, compute: () => startOfDay(new Date()) },
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
          date: entry.compute(),
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
