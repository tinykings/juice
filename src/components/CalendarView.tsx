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
import TaskItem from '@/components/TaskItem';

interface CalendarViewProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onCompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarView({ tasks, onEditTask, onCompleteTask, onDeleteTask }: CalendarViewProps) {
  const [today, setToday] = useState<Date | null>(null);
  const thisMonth = today ? startOfMonth(today) : null;
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Defer date to client to avoid hydration mismatch
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

  const selectedDayTasks = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, 'yyyy-MM-dd');
    return tasksByDate[key] || [];
  }, [selectedDay, tasksByDate]);


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
              gap: 1,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 8,
            }}>
              {allDays.map(day => {
                const inMonth = isSameMonth(day, month);
                const isToday = isSameDay(day, today);
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                const key = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate[key] || [];

                let bg = 'transparent';
                let color = inMonth ? 'var(--foreground)' : 'var(--muted-light)';
                let fontWeight = 400;
                let border = '1px solid transparent';

                if (isSelected) {
                  bg = 'var(--accent)';
                  color = 'var(--background)';
                  fontWeight = 700;
                } else if (isToday) {
                  border = '1px solid var(--accent)';
                  fontWeight = 600;
                }

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    style={{
                      width: '100%',
                      minHeight: 64,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      fontSize: 13,
                      fontWeight,
                      background: bg,
                      color,
                      border,
                      cursor: 'pointer',
                      borderRadius: 0,
                      padding: '3px 2px',
                      transition: 'background 0.1s',
                      overflow: 'hidden',
                      textAlign: 'left',
                      verticalAlign: 'top',
                    }}
                  >
                    <span style={{
                      fontSize: 12,
                      fontWeight,
                      marginBottom: 2,
                      alignSelf: 'flex-end',
                      paddingRight: 2,
                    }}>
                      {day.getDate()}
                    </span>
                    {inMonth && dayTasks.slice(0, 2).map(task => (
                      <div key={task.id} style={{
                        fontSize: 10,
                        lineHeight: 1.2,
                        padding: '1px 2px',
                        marginBottom: 1,
                        color: isSelected ? 'var(--background)' : 'var(--accent)',
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
                        color: isSelected ? 'var(--background)' : 'var(--muted)',
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

      {/* Selected day tasks */}
      {selectedDay && (
        <div style={{
          padding: '16px 16px 0',
          animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}>
          <h3 style={{
            fontSize: 15,
            fontWeight: 600,
            color: isSameDay(selectedDay, today) ? 'var(--foreground)' : 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 12,
            fontFamily: 'var(--font-display)',
          }}>
            {isSameDay(selectedDay, today) ? 'Today' : format(selectedDay, 'EEEE, MMMM d')}
          </h3>
          <div style={{ borderTop: '2px solid var(--border)' }}>
            {selectedDayTasks.length > 0 ? (
              selectedDayTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={() => onCompleteTask(task.id)}
                  onEdit={() => onEditTask(task)}
                  onDelete={() => onDeleteTask(task.id)}
                  showDate={false}
                />
              ))
            ) : (
              <div style={{
                padding: '24px 0',
                textAlign: 'center',
                color: 'var(--muted)',
                fontSize: 15,
              }}>
                No tasks for this day
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
