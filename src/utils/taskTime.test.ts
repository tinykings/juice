import { describe, expect, it } from 'vitest';
import { formatTaskTime, stripTaskTime } from './taskTime';

describe('formatTaskTime', () => {
  it.each([
    ['Call dentist @2', '2 pm'],
    ['Standup @930', '9:30 am'],
    ['Lunch @12', '12 pm'],
    ['Gym @6am', '6 am'],
    ['Dinner @7:15pm', '7:15 pm'],
    ['Movie @530', '5:30 pm'],
  ])('reads "%s" as %s', (title, expected) => {
    expect(formatTaskTime(title)).toBe(expected);
  });

  it('returns null without a time', () => {
    expect(formatTaskTime('Water plants')).toBeNull();
  });

  it('strips the time from the title', () => {
    expect(stripTaskTime('Call @2 dentist')).toBe('Call dentist');
  });
});
