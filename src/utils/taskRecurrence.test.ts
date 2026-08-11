import { describe, expect, it } from 'vitest';
import { Task } from '@/types/task';
import { getNextRecurrenceDate, withRecurrencePreviews } from './taskRecurrence';

const recurringTask: Task = {
  id: 'task-1',
  title: 'Water plants',
  notes: '',
  dueDate: '2026-03-10',
  completed: false,
  completedAt: null,
  createdAt: '2026-03-01T12:00:00.000Z',
  pinned: false,
  isRecurring: true,
  recurrenceType: 'weekly',
  tags: [],
};

describe('recurrence previews', () => {
  it('calculates next recurrence using calendar dates', () => {
    expect(getNextRecurrenceDate('2026-03-10', 'daily')).toBe('2026-03-11');
    expect(getNextRecurrenceDate('2026-03-10', 'weekly')).toBe('2026-03-17');
    expect(getNextRecurrenceDate('2026-03-10', 'monthly')).toBe('2026-04-10');
    expect(getNextRecurrenceDate('2026-03-10', 'yearly')).toBe('2027-03-10');
  });

  it('adds marked previews without making a blank future month visible', () => {
    const result = withRecurrencePreviews([recurringTask], new Date(2026, 2, 1));
    const previews = result.filter(task => task.isRecurrencePreview);

    expect(previews.map(task => task.dueDate)).toEqual([
      '2026-03-17',
      '2026-03-24',
      '2026-03-31',
    ]);
    expect(previews[0]).toMatchObject({
      id: 'recurrence-preview:task-1:2026-03-17',
      recurrenceSourceId: 'task-1',
    });
  });

  it('fills later months that are visible because they contain real tasks', () => {
    const normalTask: Task = {
      ...recurringTask,
      id: 'task-2',
      title: 'May appointment',
      dueDate: '2026-05-08',
      isRecurring: false,
      recurrenceType: null,
    };
    const result = withRecurrencePreviews([recurringTask, normalTask], new Date(2026, 2, 1));
    const previewDates = result.filter(task => task.isRecurrencePreview).map(task => task.dueDate);

    expect(previewDates).toEqual([
      '2026-03-17',
      '2026-03-24',
      '2026-03-31',
      '2026-05-05',
      '2026-05-12',
      '2026-05-19',
      '2026-05-26',
    ]);
    expect(previewDates.some(date => date.startsWith('2026-04'))).toBe(false);
  });

  it('does not preview completed, deleted, undated, or non-recurring tasks', () => {
    const variants: Task[] = [
      { ...recurringTask, id: 'completed', completed: true },
      { ...recurringTask, id: 'deleted', deletedAt: '2026-03-02T12:00:00.000Z' },
      { ...recurringTask, id: 'undated', dueDate: '' },
      { ...recurringTask, id: 'single', isRecurring: false, recurrenceType: null },
    ];

    expect(withRecurrencePreviews(variants, new Date(2026, 2, 1))).toEqual(variants);
  });
});
