import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { Task } from '@/types/task';
import { getCalendarMonths, getNextMonthsEnd } from './calendarMonths';

const NOW = new Date(2026, 10, 4);

function task(dueDate: string, overrides: Partial<Task> = {}): Task {
  return {
    id: dueDate,
    title: 'Task',
    notes: '',
    dueDate,
    completed: false,
    completedAt: null,
    createdAt: '',
    pinned: false,
    isRecurring: false,
    recurrenceType: null,
    tags: [],
    ...overrides,
  };
}

const keys = (months: Date[]) => months.map(month => format(month, 'yyyy-MM'));

describe('getCalendarMonths', () => {
  it('shows upcoming months even with no tasks', () => {
    expect(keys(getCalendarMonths([], NOW))).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('fills empty months up to a later task', () => {
    expect(keys(getCalendarMonths([task('2027-04-02')], NOW))).toEqual([
      '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04',
    ]);
  });

  it('does not fill years of empty months for a far-off task', () => {
    const months = keys(getCalendarMonths([task('2030-06-01')], NOW));
    expect(months).toHaveLength(5);
    expect(months.at(-1)).toBe('2030-06');
  });

  it('starts at the current month even with overdue tasks from earlier months', () => {
    const months = keys(getCalendarMonths([task('2026-07-10')], NOW));
    expect(months[0]).toBe('2026-11');
    expect(months).not.toContain('2026-07');
  });

  it('includes months scrolled to', () => {
    const months = keys(getCalendarMonths([], NOW, new Date(2027, 3, 1)));
    expect(months[0]).toBe('2026-11');
    expect(months.at(-1)).toBe('2027-04');
  });
});

describe('getNextMonthsEnd', () => {
  it('extends past the last month shown', () => {
    const months = getCalendarMonths([], NOW);
    expect(format(getNextMonthsEnd(months, NOW), 'yyyy-MM')).toBe('2027-04');
  });

  it('does not jump to a far-off task', () => {
    const months = getCalendarMonths([task('2030-06-01')], NOW);
    expect(format(getNextMonthsEnd(months, NOW), 'yyyy-MM')).toBe('2027-04');
  });
});
