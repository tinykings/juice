import { describe, expect, it } from 'vitest';
import { formatTaskDate, normalizeTaskDate, parseTaskDate } from './taskDate';

describe('task date helpers', () => {
  it('keeps date-only values unchanged', () => {
    expect(normalizeTaskDate('2026-07-04')).toBe('2026-07-04');
  });

  it('rejects invalid legacy timestamps', () => {
    expect(normalizeTaskDate('not-a-date')).toBe('');
  });

  it('round-trips a local calendar date without shifting the day', () => {
    const value = '2026-11-01';
    expect(formatTaskDate(parseTaskDate(value))).toBe(value);
  });

  it('formats calendar dates with zero-padded fields', () => {
    expect(formatTaskDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
