import { describe, expect, it } from 'vitest';
import { compareTasksByTime, formatTaskTime, stripTaskTime } from './taskTime';

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

  it.each(['Email bob@123.com', 'Ping @99', 'Ping @12:75', 'Read @2nd chapter'])('finds no time in "%s"', (title) => {
    expect(formatTaskTime(title)).toBeNull();
    expect(stripTaskTime(title)).toBe(title);
  });

  it('still reads a time at the end of a sentence', () => {
    expect(formatTaskTime('Dentist @9am. Bring the card')).toBe('9 am');
  });

  it('strips the time from the title', () => {
    expect(stripTaskTime('Call @2 dentist')).toBe('Call dentist');
  });
});

describe('compareTasksByTime', () => {
  it('puts timed tasks first by time, then the rest alphabetically', () => {
    const titles = ['Buy milk', 'Call bank @2pm', 'Apples', 'Dentist @9:30am'];
    const sorted = titles.map(title => ({ title })).sort(compareTasksByTime).map(task => task.title);
    expect(sorted).toEqual(['Dentist @9:30am', 'Call bank @2pm', 'Apples', 'Buy milk']);
  });
});
