'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({ tasks, onDaySelect }: CalendarViewProps) {
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

  const hasAutoScrolledRef = useRef(false);

  useEffect(() => {
    if (hasAutoScrolledRef.current || monthsWithTasks.length === 0) return;

    const targetDate = format(startOfWeek(new Date()), 'yyyy-MM-dd');
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-date="${targetDate}"]`)?.scrollIntoView({
        block: 'start',
        behavior: 'auto',
      });
      hasAutoScrolledRef.current = true;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [monthsWithTasks.length]);

  return (
    <div style={{ padding: '20px 2px 120px', minWidth: 0, width: '100%', maxWidth: 1120, margin: '0 auto' }}>
      <ContinuousCalendar
        months={monthsWithTasks}
        tasksByDate={tasksByDate}
        onDaySelect={onDaySelect}
      />
    </div>
  );
}

function ContinuousCalendar({
  months,
  tasksByDate,
  onDaySelect,
}: {
  months: Date[];
  tasksByDate: Record<string, Task[]>;
  onDaySelect: (date: Date, tasks: Task[]) => void;
}) {
  const today = new Date();

  const calendarDays = useMemo(() => {
    if (months.length === 0) return [];

    const firstMonth = months[0];
    const lastMonth = months[months.length - 1];
    const calendarStart = startOfWeek(startOfMonth(firstMonth));
    const calendarEnd = endOfWeek(endOfMonth(lastMonth));

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [months]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
      columnGap: 2,
      rowGap: 3,
      width: '100%',
    }}>
      {WEEKDAYS.map((day, index) => (
        <div style={{
          gridColumn: `${index + 1} / ${index + 2}`,
          gridRow: 1,
          textAlign: 'center',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--muted)',
          padding: '6px 0',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }} key={day}>
          {day}
        </div>
      ))}

      {calendarDays.map((day, index) => {
        const key = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDate[key] || [];
        const inVisibleMonth = months.some(month => isSameMonth(day, month));
        const isMonthStart = day.getDate() === 1 && inVisibleMonth;
        const row = Math.floor(index / 7) + 2;
        const column = (index % 7) + 1;

        return (
          <DayCell
            key={day.toISOString()}
            day={day}
            inVisibleMonth={inVisibleMonth}
            isMonthStart={isMonthStart}
            today={today}
            dayTasks={dayTasks}
            onDaySelect={onDaySelect}
            gridColumn={column}
            gridRow={row}
            monthLabel={isMonthStart ? format(day, 'MMMM') : undefined}
            dayKey={key}
          />
        );
      })}
    </div>
  );
}

function DayCell({
  day,
  inVisibleMonth,
  isMonthStart,
  today,
  dayTasks,
  onDaySelect,
  gridColumn,
  gridRow,
  monthLabel,
  dayKey,
}: {
  day: Date;
  inVisibleMonth: boolean;
  isMonthStart: boolean;
  today: Date;
  dayTasks: Task[];
  onDaySelect: (date: Date, tasks: Task[]) => void;
  gridColumn: number;
  gridRow: number;
  monthLabel?: string;
  dayKey: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isTodayCell = isSameDay(day, today);
  const hasTasks = dayTasks.length > 0;
  const showTasks = hasTasks;
  const selectableTasks = dayTasks;

  return (
    <button
      onClick={() => onDaySelect(day, selectableTasks)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-date={dayKey}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: '6px 0',
        minHeight: 150,
        fontSize: 13,
        fontWeight: isTodayCell ? 600 : 400,
        background: isHovered
          ? 'var(--accent-subtle)'
          : (isTodayCell
            ? 'var(--accent-subtle)'
            : (isMonthStart && inVisibleMonth
              ? 'var(--calendar-month-start)'
              : (inVisibleMonth ? 'var(--surface-inset)' : 'transparent'))),
        color: inVisibleMonth
          ? (isTodayCell ? 'var(--accent)' : 'var(--foreground)')
          : 'var(--muted-light)',
        border: isTodayCell ? '1px solid var(--accent)' : '1px solid transparent',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        textAlign: 'left',
        overflow: 'hidden',
        gridColumn: `${gridColumn} / ${gridColumn + 1}`,
        gridRow: `${gridRow} / ${gridRow + 1}`,
      }}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        fontSize: 12,
        fontWeight: isTodayCell ? 600 : 400,
        marginBottom: showTasks ? 4 : 0,
        minWidth: 0,
      }}>
        {day.getDate()}
        {monthLabel && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {monthLabel}
          </span>
        )}
      </span>

      {showTasks && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          width: '100%',
        }}>
          {dayTasks.map(task => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'transparent',
                border: '1px solid var(--calendar-event-border)',
                borderRadius: 6,
                padding: '2px 6px 2px',
                marginBottom: 2,
                whiteSpace: 'normal',
                overflow: 'visible',
                textOverflow: 'clip',
                lineHeight: 1.2,
              }}
            >
              <span style={{ minWidth: 0 }}>{task.title}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
