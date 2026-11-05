import { describe, expect, it } from 'vitest';
import { getTaskDisplayTitle, getTaskTitleParts, splitTaskTitle } from './taskTitle';

describe('getTaskDisplayTitle', () => {
  it('removes the time and note from a task', () => {
    expect(getTaskDisplayTitle({ title: 'Dentist @9:30am. Bring the card' })).toBe('Dentist');
  });

  it('leaves subscribed calendar events as written', () => {
    expect(getTaskDisplayTitle({ title: 'Dr. Smith @ clinic', isCalendarEvent: true })).toBe('Dr. Smith @ clinic');
  });
});

describe('splitTaskTitle', () => {
  it.each([
    ['Pay $12.50', 'Pay $12.50', ''],
    ['Check juice.tinyk.ing', 'Check juice.tinyk.ing', ''],
    ['See Dr. Smith', 'See Dr. Smith', ''],
    ['See Dr. Smith. Bring forms', 'See Dr. Smith', 'Bring forms'],
    ['Buy milk. Oat if they have it', 'Buy milk', 'Oat if they have it'],
    ['Buy milk.', 'Buy milk', ''],
  ])('splits "%s"', (value, title, note) => {
    expect(splitTaskTitle(value)).toEqual({ title, note });
  });

  it('keeps an email address that looks like a time intact', () => {
    expect(getTaskTitleParts({ title: 'Email bob@123.com' })).toEqual({ title: 'Email bob@123.com', note: '' });
  });
});

describe('getTaskTitleParts', () => {
  it('includes the separate notes field', () => {
    expect(getTaskTitleParts({ title: 'Call bank. Ask about fees', notes: 'Account 42' })).toEqual({
      title: 'Call bank',
      note: 'Ask about fees\nAccount 42',
    });
  });
});
