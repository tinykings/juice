import { describe, expect, it } from 'vitest';
import { normalizeCalendarUrl, parseIcsEvents } from './ics';

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const WINDOW: [number, number] = [day(2026, 11, 1), day(2026, 12, 31)];

describe('parseIcsEvents', () => {
  it('reads a timed UTC event with folded, escaped summary', () => {
    const events = parseIcsEvents(wrap([
      'BEGIN:VEVENT',
      'UID:a',
      'DTSTART:20261105T170000Z',
      'SUMMARY:Team\\, weekly',
      '  sync',
      'END:VEVENT',
    ].join('\r\n')), ...WINDOW);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Team, weekly sync');
    expect(events[0].allDay).toBe(false);
    expect(events[0].start).toBe(Date.UTC(2026, 10, 5, 17));
  });

  it('converts TZID times to the right instant', () => {
    const [event] = parseIcsEvents(wrap([
      'BEGIN:VEVENT',
      'UID:tz',
      'DTSTART;TZID=America/New_York:20261110T090000',
      'SUMMARY:Standup',
      'END:VEVENT',
    ].join('\n')), ...WINDOW);
    expect(event.start).toBe(Date.UTC(2026, 10, 10, 14)); // EST = UTC-5
  });

  it('spreads multi-day all-day events across each day', () => {
    const events = parseIcsEvents(wrap([
      'BEGIN:VEVENT',
      'UID:trip',
      'DTSTART;VALUE=DATE:20261120',
      'DTEND;VALUE=DATE:20261123',
      'SUMMARY:Trip',
      'END:VEVENT',
    ].join('\n')), ...WINDOW);
    expect(events.map(e => e.date)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    expect(events.every(e => e.allDay)).toBe(true);
  });

  it('expands weekly BYDAY rules with COUNT and EXDATE', () => {
    const events = parseIcsEvents(wrap([
      'BEGIN:VEVENT',
      'UID:w',
      'DTSTART:20261102T150000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=5',
      'EXDATE:20261104T150000',
      'SUMMARY:Gym',
      'END:VEVENT',
    ].join('\n')), ...WINDOW);
    expect(events.map(e => e.date)).toEqual(['2026-11-02', '2026-11-09', '2026-11-11', '2026-11-16']);
  });

  it('expands monthly nth-weekday rules and stops at UNTIL', () => {
    const events = parseIcsEvents(wrap([
      'BEGIN:VEVENT',
      'UID:m',
      'DTSTART;VALUE=DATE:20260901',
      'RRULE:FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20261201',
      'SUMMARY:Review',
      'END:VEVENT',
    ].join('\n')), day(2026, 9, 1), day(2027, 3, 1));
    expect(events.map(e => e.date)).toEqual(['2026-09-25', '2026-10-30', '2026-11-27']);
  });

  it('counts occurrences from DTSTART even before the window', () => {
    const events = parseIcsEvents(wrap([
      'BEGIN:VEVENT',
      'UID:d',
      'DTSTART;VALUE=DATE:20261028',
      'RRULE:FREQ=DAILY;COUNT=6',
      'SUMMARY:Daily',
      'END:VEVENT',
    ].join('\n')), ...WINDOW);
    expect(events.map(e => e.date)).toEqual(['2026-11-01', '2026-11-02']);
  });

  it('applies RECURRENCE-ID overrides and skips cancelled events', () => {
    const events = parseIcsEvents(wrap([
      'BEGIN:VEVENT',
      'UID:r',
      'DTSTART:20261103T100000Z',
      'RRULE:FREQ=WEEKLY;COUNT=3',
      'SUMMARY:1:1',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:r',
      'RECURRENCE-ID:20261110T100000Z',
      'DTSTART:20261111T120000Z',
      'SUMMARY:1:1 (moved)',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:x',
      'DTSTART:20261105T100000Z',
      'STATUS:CANCELLED',
      'SUMMARY:Gone',
      'END:VEVENT',
    ].join('\n')), ...WINDOW);
    expect(events.map(e => e.title)).toEqual(['1:1', '1:1 (moved)', '1:1']);
    expect(events[1].start).toBe(Date.UTC(2026, 10, 11, 12));
  });

  it('ignores properties inside nested components like VALARM', () => {
    const [event] = parseIcsEvents(wrap([
      'BEGIN:VEVENT',
      'UID:al',
      'DTSTART;VALUE=DATE:20261112',
      'SUMMARY:Real title',
      'BEGIN:VALARM',
      'SUMMARY:Alarm title',
      'END:VALARM',
      'END:VEVENT',
    ].join('\n')), ...WINDOW);
    expect(event.title).toBe('Real title');
  });
});

describe('normalizeCalendarUrl', () => {
  it('turns webcal links into https', () => {
    expect(normalizeCalendarUrl(' webcal://p01.icloud.com/x.ics ')).toBe('https://p01.icloud.com/x.ics');
  });
});
