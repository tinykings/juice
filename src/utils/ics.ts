/**
 * Minimal iCalendar (.ics) reader for showing a subscribed calendar's events.
 *
 * Supports: line folding, text escapes, all-day and timed events (UTC, TZID or
 * floating), multi-day all-day events, RRULE (DAILY/WEEKLY/MONTHLY/YEARLY with
 * INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY, BYMONTH), EXDATE, RECURRENCE-ID
 * overrides and STATUS:CANCELLED. Events are expanded into the given window.
 */

export interface CalendarEvent {
  /** Unique per occurrence. */
  id: string;
  title: string;
  /** Local calendar date, yyyy-MM-dd. */
  date: string;
  allDay: boolean;
  /** Start instant (ms); for all-day events, local midnight of `date`. */
  start: number;
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface RawEvent {
  props: Prop[];
}

interface DateValue {
  /** Wall-clock components in `tz` (or local time when tz is undefined). */
  y: number;
  m: number; // 1-12
  d: number;
  h: number;
  min: number;
  s: number;
  allDay: boolean;
  /** 'UTC', an IANA zone, or undefined for floating/local time. */
  tz?: string;
}

const MAX_ITERATIONS = 20000;
const MAX_ALL_DAY_SPAN = 31;

function unfold(text: string): string[] {
  return text.replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line: string): Prop | null {
  // Split name;params from value at the first colon outside quotes.
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) { colon = i; break; }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(';');
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: parts[0].toUpperCase(), params, value };
}

function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === 'n' || ch === 'N' ? ' ' : ch)).trim();
}

function parseEvents(text: string): RawEvent[] {
  const events: RawEvent[] = [];
  const stack: string[] = [];
  let current: RawEvent | null = null;
  for (const line of unfold(text)) {
    if (!line) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    if (prop.name === 'BEGIN') {
      const component = prop.value.trim().toUpperCase();
      stack.push(component);
      if (component === 'VEVENT') current = { props: [] };
      continue;
    }
    if (prop.name === 'END') {
      const component = stack.pop();
      if (component === 'VEVENT' && current) {
        events.push(current);
        current = null;
      }
      continue;
    }
    if (current && stack[stack.length - 1] === 'VEVENT') current.props.push(prop);
  }
  return events;
}

function parseDateValue(prop: Prop, raw = prop.value): DateValue | null {
  const value = raw.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly || prop.params.VALUE === 'DATE') {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(value);
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3], h: 0, min: 0, s: 0, allDay: true };
  }
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
  if (!dt) return null;
  const tz = dt[7] ? 'UTC' : normalizeTz(prop.params.TZID);
  return { y: +dt[1], m: +dt[2], d: +dt[3], h: +dt[4], min: +dt[5], s: +(dt[6] ?? 0), allDay: false, tz };
}

const WINDOWS_ZONES: Record<string, string> = {
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'GMT Standard Time': 'Europe/London',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'India Standard Time': 'Asia/Kolkata',
  UTC: 'UTC',
};

function normalizeTz(tzid: string | undefined): string | undefined {
  if (!tzid) return undefined;
  const cleaned = tzid.replace(/^\//, '');
  const candidate = WINDOWS_ZONES[cleaned] ?? cleaned;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return undefined; // Unknown zone: treat as local time.
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function tzOffsetMs(instant: number, tz: string): number {
  let formatter = formatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatters.set(tz, formatter);
  }
  const parts = formatter.formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Instant for wall-clock components interpreted in the value's zone. */
function toInstant(v: Pick<DateValue, 'y' | 'm' | 'd' | 'h' | 'min' | 's' | 'allDay' | 'tz'>): number {
  if (v.allDay || !v.tz) return new Date(v.y, v.m - 1, v.d, v.h, v.min, v.s).getTime();
  const guess = Date.UTC(v.y, v.m - 1, v.d, v.h, v.min, v.s);
  if (v.tz === 'UTC') return guess;
  const first = guess - tzOffsetMs(guess, v.tz);
  return guess - tzOffsetMs(first, v.tz);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localDateKey(instant: number): string {
  const d = new Date(instant);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ymdKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Day of week (0=Sunday) for a calendar date, independent of time zones. */
function weekday(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDaysYmd(y: number, m: number, d: number, days: number): [number, number, number] {
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
}

const DAY_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

interface ByDay { day: number; n: number }

function parseByDay(value: string | undefined): ByDay[] {
  if (!value) return [];
  return value.split(',').flatMap(part => {
    const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(part.trim().toUpperCase());
    return m ? [{ day: DAY_CODES[m[2]], n: m[1] ? Number(m[1]) : 0 }] : [];
  });
}

function parseNumberList(value: string | undefined): number[] {
  if (!value) return [];
  return value.split(',').map(Number).filter(n => Number.isInteger(n) && n !== 0);
}

/** Dates in a month matching BYDAY (with optional ordinals) or BYMONTHDAY. */
function monthDays(y: number, m: number, byDay: ByDay[], byMonthDay: number[], fallbackDay: number): number[] {
  const total = daysInMonth(y, m);
  const result = new Set<number>();
  if (byDay.length > 0) {
    for (const { day, n } of byDay) {
      const matches: number[] = [];
      for (let d = 1; d <= total; d += 1) if (weekday(y, m, d) === day) matches.push(d);
      if (n === 0) matches.forEach(d => result.add(d));
      else {
        const pick = n > 0 ? matches[n - 1] : matches[matches.length + n];
        if (pick) result.add(pick);
      }
    }
    if (byMonthDay.length > 0) {
      const allowed = new Set(byMonthDay.map(n => (n > 0 ? n : total + n + 1)));
      return [...result].filter(d => allowed.has(d)).sort((a, b) => a - b);
    }
  } else if (byMonthDay.length > 0) {
    for (const n of byMonthDay) {
      const d = n > 0 ? n : total + n + 1;
      if (d >= 1 && d <= total) result.add(d);
    }
  } else if (fallbackDay <= total) {
    result.add(fallbackDay);
  }
  return [...result].sort((a, b) => a - b);
}

/** Expands an RRULE into occurrence dates (wall-clock y/m/d) in order. */
function* expandRule(
  rule: Record<string, string>,
  start: DateValue,
  windowEnd: number,
): Generator<[number, number, number]> {
  const freq = rule.FREQ;
  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const byDay = parseByDay(rule.BYDAY);
  const byMonthDay = parseNumberList(rule.BYMONTHDAY);
  const byMonth = parseNumberList(rule.BYMONTH);
  const startKey = ymdKey(start.y, start.m, start.d);
  let iterations = 0;

  const pastEnd = (y: number, m: number, d: number) =>
    toInstant({ ...start, y, m, d }) > windowEnd;

  if (freq === 'DAILY') {
    for (let i = 0; iterations < MAX_ITERATIONS; i += interval, iterations += 1) {
      const [y, m, d] = addDaysYmd(start.y, start.m, start.d, i);
      if (pastEnd(y, m, d)) return;
      if (byMonth.length && !byMonth.includes(m)) continue;
      if (byDay.length && !byDay.some(b => b.day === weekday(y, m, d))) continue;
      yield [y, m, d];
    }
  } else if (freq === 'WEEKLY') {
    const days = byDay.length ? [...new Set(byDay.map(b => b.day))] : [weekday(start.y, start.m, start.d)];
    // Week starts Monday (RFC 5545 default WKST).
    const startDow = (weekday(start.y, start.m, start.d) + 6) % 7;
    const [wy, wm, wd] = addDaysYmd(start.y, start.m, start.d, -startDow);
    const offsets = days.map(day => (day + 6) % 7).sort((a, b) => a - b);
    for (let week = 0; iterations < MAX_ITERATIONS; week += interval, iterations += 1) {
      const [by, bm, bd] = addDaysYmd(wy, wm, wd, week * 7);
      if (pastEnd(by, bm, bd)) return;
      for (const offset of offsets) {
        const [y, m, d] = addDaysYmd(by, bm, bd, offset);
        if (ymdKey(y, m, d) < startKey) continue;
        yield [y, m, d];
      }
    }
  } else if (freq === 'MONTHLY') {
    for (let i = 0; iterations < MAX_ITERATIONS; i += interval, iterations += 1) {
      const total = start.m - 1 + i;
      const y = start.y + Math.floor(total / 12);
      const m = (total % 12) + 1;
      if (pastEnd(y, m, 1)) return;
      if (byMonth.length && !byMonth.includes(m)) continue;
      for (const d of monthDays(y, m, byDay, byMonthDay, start.d)) {
        if (ymdKey(y, m, d) < startKey) continue;
        yield [y, m, d];
      }
    }
  } else if (freq === 'YEARLY') {
    const months = byMonth.length ? [...byMonth].sort((a, b) => a - b) : [start.m];
    const dayRule = byDay.length || byMonthDay.length ? null : start.d;
    for (let i = 0; iterations < MAX_ITERATIONS; i += interval, iterations += 1) {
      const y = start.y + i;
      if (pastEnd(y, 1, 1)) return;
      for (const m of months) {
        const days = dayRule !== null
          ? (dayRule <= daysInMonth(y, m) ? [dayRule] : [])
          : monthDays(y, m, byDay, byMonthDay, start.d);
        for (const d of days) {
          if (ymdKey(y, m, d) < startKey) continue;
          yield [y, m, d];
        }
      }
    }
  } else {
    yield [start.y, start.m, start.d];
  }
}

function parseRule(value: string): Record<string, string> {
  const rule: Record<string, string> = {};
  for (const part of value.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return rule;
}

function occurrenceKey(instant: number, allDay: boolean): string {
  return allDay ? localDateKey(instant) : String(instant);
}

/**
 * Parses an .ics feed and returns event occurrences that start within
 * [windowStart, windowEnd], sorted by start time.
 */
export function parseIcsEvents(text: string, windowStart: number, windowEnd: number): CalendarEvent[] {
  const raw = parseEvents(text);
  const overrides = new Map<string, Set<string>>();
  const result: CalendarEvent[] = [];

  const first = (event: RawEvent, name: string) => event.props.find(p => p.name === name);

  // Collect RECURRENCE-ID overrides so the master series skips those slots.
  for (const event of raw) {
    const recurrenceId = first(event, 'RECURRENCE-ID');
    const uid = first(event, 'UID')?.value ?? '';
    if (!recurrenceId) continue;
    const value = parseDateValue(recurrenceId);
    if (!value) continue;
    if (!overrides.has(uid)) overrides.set(uid, new Set());
    overrides.get(uid)!.add(occurrenceKey(toInstant(value), value.allDay));
  }

  for (const event of raw) {
    const status = first(event, 'STATUS')?.value.trim().toUpperCase();
    if (status === 'CANCELLED') continue;
    const dtstartProp = first(event, 'DTSTART');
    if (!dtstartProp) continue;
    const start = parseDateValue(dtstartProp);
    if (!start) continue;

    const uid = first(event, 'UID')?.value ?? `${dtstartProp.value}-${result.length}`;
    const title = unescapeText(first(event, 'SUMMARY')?.value ?? '') || 'Busy';

    // All-day events can span several days (DTEND is exclusive).
    let spanDays = 1;
    const dtendProp = first(event, 'DTEND');
    if (start.allDay && dtendProp) {
      const end = parseDateValue(dtendProp);
      if (end) {
        const diff = Math.round(
          (Date.UTC(end.y, end.m - 1, end.d) - Date.UTC(start.y, start.m - 1, start.d)) / 86400000
        );
        spanDays = Math.min(MAX_ALL_DAY_SPAN, Math.max(1, diff));
      }
    }

    const exdates = new Set<string>();
    for (const prop of event.props.filter(p => p.name === 'EXDATE')) {
      for (const part of prop.value.split(',')) {
        const value = parseDateValue(prop, part);
        if (value) exdates.add(occurrenceKey(toInstant(value), value.allDay || start.allDay));
      }
    }

    const isOverride = Boolean(first(event, 'RECURRENCE-ID'));
    const ruleProp = first(event, 'RRULE');
    const rule = ruleProp && !isOverride ? parseRule(ruleProp.value) : null;
    const count = rule?.COUNT ? Number(rule.COUNT) : Infinity;
    let until = Infinity;
    if (rule?.UNTIL) {
      const untilValue = parseDateValue({ name: 'UNTIL', params: {}, value: rule.UNTIL });
      if (untilValue) {
        until = untilValue.allDay
          ? new Date(untilValue.y, untilValue.m - 1, untilValue.d, 23, 59, 59).getTime()
          : toInstant(untilValue);
      }
    }
    const skipped = overrides.get(uid);

    const dates = rule
      ? expandRule(rule, start, windowEnd)
      : [[start.y, start.m, start.d] as [number, number, number]];

    let produced = 0;
    for (const [y, m, d] of dates) {
      if (produced >= count) break;
      const instant = toInstant({ ...start, y, m, d });
      if (instant > until) break;
      produced += 1;
      const key = occurrenceKey(instant, start.allDay);
      if (exdates.has(key) || (!isOverride && skipped?.has(key))) continue;

      for (let day = 0; day < spanDays; day += 1) {
        const [dy, dm, dd] = addDaysYmd(y, m, d, day);
        const dayStart = start.allDay ? new Date(dy, dm - 1, dd).getTime() : instant;
        // Keep events that overlap the window; multi-day ones only on visible days.
        if (dayStart < windowStart && (start.allDay || day === 0)) {
          if (!start.allDay) break;
          continue;
        }
        if (dayStart > windowEnd) break;
        const date = start.allDay ? ymdKey(dy, dm, dd) : localDateKey(instant);
        result.push({
          id: `${uid}|${key}|${day}`,
          title,
          date,
          allDay: start.allDay,
          start: dayStart,
        });
        if (!start.allDay) break;
      }
    }
  }

  return result.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

/** Accepts webcal:// links (common for calendar subscriptions). */
export function normalizeCalendarUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.replace(/^webcals?:\/\//i, 'https://');
}
