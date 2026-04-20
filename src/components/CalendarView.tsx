'use client';

import { useMemo, useEffect, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { Task } from '@/types/task';

interface CalendarViewProps {
  tasks: Task[];
  onDaySelect: (date: Date, tasks: Task[]) => void;
  isGistConfigured?: boolean;
  isSyncing?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({ tasks, onDaySelect, isGistConfigured, isSyncing }: CalendarViewProps) {
  // Get unique months that have tasks
  const monthsWithTasks = useMemo(() => {
    const monthSet = new Set<string>();
    
    // Always include current month
    const now = new Date();
    monthSet.add(format(now, 'yyyy-MM'));
    
    // Add months with incomplete tasks
    tasks.filter(t => !t.completed).forEach(task => {
      monthSet.add(format(new Date(task.dueDate), 'yyyy-MM'));
    });
    
    return Array.from(monthSet)
      .sort()
      .map(key => {
        const [y, m] = key.split('-').map(Number);
        return new Date(y, m - 1, 1);
      });
  }, [tasks]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.filter(t => !t.completed).forEach(task => {
      const key = format(new Date(task.dueDate), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(task);
    });
    // Sort tasks by title within each day
    Object.values(map).forEach(arr => arr.sort((a, b) => a.title.localeCompare(b.title)));
    return map;
  }, [tasks]);

  const topPadding = (isGistConfigured && isSyncing) ? 44 : 20;
  
  return (
    <div style={{ padding: `${topPadding}px 16px 120px`, minWidth: 0 }}>
      {monthsWithTasks.map(month => (
        <MonthGrid 
          key={month.toISOString()} 
          month={month} 
          tasksByDate={tasksByDate}
          onDaySelect={onDaySelect}
        />
      ))}
    </div>
  );
}

function MonthGrid({ 
  month, 
  tasksByDate,
  onDaySelect 
}: { 
  month: Date;
  tasksByDate: Record<string, Task[]>;
  onDaySelect: (date: Date, tasks: Task[]) => void;
}) {
  const today = new Date();
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Check if this month has any tasks
  const hasTasksInMonth = allDays.some(day => {
    const key = format(day, 'yyyy-MM-dd');
    return tasksByDate[key] && tasksByDate[key].length > 0;
  });

  // Don't render months without tasks (except current month)
  const isCurrentMonth = isSameMonth(month, today);
  if (!hasTasksInMonth && !isCurrentMonth) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Month header */}
      <h2 style={{
        fontSize: 18,
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        color: 'var(--foreground)',
        marginBottom: 16,
        paddingBottom: 8,
        borderBottom: '1px solid var(--border)',
      }}>
        {format(month, 'MMMM yyyy')}
      </h2>

      {/* Weekday headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        marginBottom: 4,
      }}>
        {WEEKDAYS.map(day => (
          <div key={day} style={{
            textAlign: 'center',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--muted)',
            padding: '6px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 3,
        width: '100%',
      }}>
        {allDays.map(day => {
          const inMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const key = format(day, 'yyyy-MM-dd');
          const [isHovered, setIsHovered] = useState(false);
          const dayTasks = tasksByDate[key] || [];
          const hasTasks = dayTasks.length > 0;

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDaySelect(day, dayTasks)}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                padding: '6px 4px',
                minHeight: 90,
                fontSize: 13,
                fontWeight: isToday ? 600 : 400,
                background: isHovered ? 'var(--accent-subtle)' : (isToday ? 'var(--accent-subtle)' : (inMonth ? 'var(--surface-inset)' : 'transparent')),
                color: inMonth 
                  ? (isToday ? 'var(--accent)' : 'var(--foreground)') 
                  : 'var(--muted-light)',
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                overflow: 'hidden',
              }}
            >
              <span style={{ 
                fontSize: 12, 
                fontWeight: isToday ? 600 : 400,
                marginBottom: hasTasks ? 4 : 0,
              }}>
                {day.getDate()}
              </span>
              
              {/* Task names */}
              {hasTasks && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  width: '100%',
                  overflow: 'hidden',
                }}>
                  {dayTasks.map(task => (
                    <div
                      key={task.id}
                      style={{
                        fontSize: 9,
                        fontWeight: 500,
                        color: 'var(--accent)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        lineHeight: 1.3,
                      }}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}