import { describe, expect, it } from 'vitest';
import { getTaskDisplayTitle } from './taskTitle';

describe('getTaskDisplayTitle', () => {
  it('removes the time and note from a task', () => {
    expect(getTaskDisplayTitle({ title: 'Dentist @9:30am. Bring the card' })).toBe('Dentist');
  });

  it('leaves subscribed calendar events as written', () => {
    expect(getTaskDisplayTitle({ title: 'Dr. Smith @ clinic', isCalendarEvent: true })).toBe('Dr. Smith @ clinic');
  });
});
