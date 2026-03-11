'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
} from 'date-fns';
import { Task } from '@/types/task';

interface CalendarViewProps {
  tasks: Task[];
  onDaySelect: (date: Date, tasks: Task[]) => void;
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarView({ tasks, onDaySelect }: CalendarViewProps) {
  const [today, setToday] = useState<Date | null>(null);
  const thisMonth = today ? startOfMonth(today) : null;

  useEffect(() => {
    setToday(new Date());
  }, []);

  // Map of date string -> tasks (incomplete only)
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(task => {
      if (task.completed) return;
      const key = format(new Date(task.dueDate), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(task);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.title.localeCompare(b.title)));
    return map;
  }, [tasks]);

  // Only show current month + future months that have at least one task
  const months = useMemo(() => {
    if (!thisMonth) return [];
    const monthSet = new Set<string>();
    // Always include current month
    monthSet.add(format(thisMonth, 'yyyy-MM'));
    // Add months for every incomplete task that's in current or future months
    tasks.forEach(task => {
      if (task.completed) return;
      const taskMonth = startOfMonth(new Date(task.dueDate));
      if (!isBefore(taskMonth, thisMonth)) {
        monthSet.add(format(taskMonth, 'yyyy-MM'));
      }
    });
    return Array.from(monthSet)
      .sort()
      .map(key => {
        const [y, m] = key.split('-').map(Number);
        return new Date(y, m - 1, 1);
      });
  }, [tasks, thisMonth]);

  if (!today) return null;

  return (
    <div style={{ padding: '0 0 100px' }}>
      {/* Sticky day headers */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'var(--background)',
        borderBottom: '1px solid var(--border)',
        padding: '0 16px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          textAlign: 'center',
        }}>
          {DAY_HEADERS.map(d => (
            <div key={d} style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--muted)',
              padding: '8px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable months */}
      {months.map(month => {
        const isCurrentMonth = isSameMonth(month, today);
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const calStart = startOfWeek(monthStart);
        const calEnd = endOfWeek(monthEnd);
        const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

        return (
          <div
            key={month.toISOString()}
            style={{ padding: '0 16px' }}
          >
            {/* Month label */}
            <h2 style={{
              fontSize: 17,
              fontWeight: 600,
              margin: 0,
              padding: '16px 0 8px',
              fontFamily: 'var(--font-display)',
              color: isCurrentMonth ? 'var(--foreground)' : 'var(--muted)',
              letterSpacing: '0.02em',
            }}>
              {format(month, 'MMMM yyyy')}
            </h2>

            {/* Day grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 2,
              background: 'var(--border)',
              borderBottom: '1px solid var(--border)',
              paddingBottom: 8,
            }}>
              {allDays.map(day => {
                const inMonth = isSameMonth(day, month);
                const isToday = isSameDay(day, today);
                const key = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate[key] || [];

                const color = inMonth ? 'var(--foreground)' : 'var(--muted-light)';
                let fontWeight = 400;
                const border = inMonth ? '1px solid var(--border)' : '1px solid transparent';
                let background = 'var(--card)';

                if (isToday) {
                  fontWeight = 600;
                  background = 'var(--accent-light)';
                }

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => onDaySelect(day, dayTasks)}
                    style={{
                      width: '100%',
                      minHeight: 64,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      fontSize: 13,
                      fontWeight,
                      background,
                      color,
                      border: isToday ? '2px solid var(--accent)' : border,
                      cursor: 'pointer',
                      borderRadius: 0,
                      padding: '3px 2px',
                      transition: 'background 0.1s',
                      overflow: 'hidden',
                      verticalAlign: 'top',
                    }}
                  >
                    <span style={{
                      fontSize: 12,
                      fontWeight,
                      marginBottom: 2,
                      alignSelf: 'flex-end',
                      paddingRight: 2,
                      width: '100%',
                    }}>
                      {day.getDate()}
                    </span>
                    {inMonth && dayTasks.slice(0, 2).map(task => (
                      <div key={task.id} style={{
                        fontSize: 10,
                        lineHeight: 1.2,
                        padding: '1px 2px',
                        marginBottom: 1,
                        color: 'var(--accent)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                      }}>
                        {task.title}
                      </div>
                    ))}
                    {inMonth && dayTasks.length > 2 && (
                      <div style={{
                        fontSize: 9,
                        color: 'var(--muted)',
                        padding: '0 2px',
                        fontWeight: 600,
                      }}>
                        +{dayTasks.length - 2} more
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
