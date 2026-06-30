'use client';

import { useEffect, useMemo, useState } from 'react';
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
  selectedDate?: Date | null;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOBILE_BREAKPOINT = 1000;

export default function CalendarView({ tasks, onDaySelect, selectedDate = null }: CalendarViewProps) {
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window === 'undefined' ? MOBILE_BREAKPOINT : window.innerWidth
  );

  useEffect(() => {
    const updateWidth = () => setWindowWidth(window.innerWidth);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const isMobileCalendar = windowWidth < MOBILE_BREAKPOINT;

  const monthsWithTasks = useMemo(() => {
    const monthSet = new Set<string>();
    const now = new Date();
    monthSet.add(format(now, 'yyyy-MM'));

    tasks.filter(t => !t.completed && t.dueDate).forEach(task => {
      monthSet.add(format(new Date(task.dueDate), 'yyyy-MM'));
    });

    return Array.from(monthSet)
      .sort()
      .map(key => {
        const [y, m] = key.split('-').map(Number);
        return new Date(y, m - 1, 1);
      });
  }, [tasks]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.filter(t => !t.completed && t.dueDate).forEach(task => {
      const key = format(new Date(task.dueDate), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(task);
    });

    Object.values(map).forEach(arr => arr.sort((a, b) => a.title.localeCompare(b.title)));
    return map;
  }, [tasks]);

  return (
    <div style={{
      padding: isMobileCalendar ? '18px 10px 110px' : '24px clamp(10px, 2vw, 18px) 120px',
      minWidth: 0,
      width: '100%',
      maxWidth: 1120,
      margin: '0 auto',
    }}>
      {isMobileCalendar ? (
        <MobileCalendar
          months={monthsWithTasks}
          tasksByDate={tasksByDate}
          onDaySelect={onDaySelect}
          selectedDate={selectedDate}
        />
      ) : (
        <ContinuousCalendar
          months={monthsWithTasks}
          tasksByDate={tasksByDate}
          onDaySelect={onDaySelect}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}

function ContinuousCalendar({
  months,
  tasksByDate,
  onDaySelect,
  selectedDate,
}: {
  months: Date[];
  tasksByDate: Record<string, Task[]>;
  onDaySelect: (date: Date, tasks: Task[]) => void;
  selectedDate: Date | null;
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
      gap: 8,
      width: '100%',
    }}>
      {WEEKDAYS.map((day, index) => (
        <div style={{
          gridColumn: `${index + 1} / ${index + 2}`,
          gridRow: 1,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--muted)',
          padding: '0 0 2px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
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
            isSelected={selectedDate ? isSameDay(day, selectedDate) : false}
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
  today,
  isSelected,
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
  isSelected: boolean;
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
  const isActive = isSelected || isTodayCell;
  const selectableTasks = dayTasks;

  return (
    <button
      type="button"
      onClick={() => onDaySelect(day, selectableTasks)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-date={dayKey}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: '10px 9px',
        minHeight: 150,
        fontSize: 13,
        fontWeight: isActive ? 700 : 500,
        background: isActive
          ? 'var(--accent-subtle)'
          : (isHovered
            ? 'var(--task-surface-hover)'
            : (inVisibleMonth ? 'var(--task-surface)' : 'rgba(255, 255, 255, 0.018)')),
        color: inVisibleMonth ? 'var(--foreground)' : 'var(--muted)',
        border: `1px solid ${isActive ? 'var(--accent-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: isHovered ? '0 0 0 1px rgba(255, 255, 255, 0.02)' : 'none',
        cursor: 'pointer',
        textAlign: 'left',
        overflow: 'visible',
        gridColumn: `${gridColumn} / ${gridColumn + 1}`,
        gridRow: `${gridRow} / ${gridRow + 1}`,
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
        opacity: inVisibleMonth ? 1 : 0.55,
      }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          minWidth: 0,
          marginBottom: hasTasks ? 8 : 0,
          color: isActive ? 'var(--accent)' : 'inherit',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 'var(--radius-xs)',
            background: isActive ? 'var(--accent-surface)' : 'transparent',
            fontSize: 13,
            fontWeight: 750,
          }}>
            {day.getDate()}
          </span>
          {monthLabel && (
            <span style={{
              fontSize: 11,
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

        {hasTasks && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            width: '100%',
          }}>
            {dayTasks.map(task => (
              <CalendarTaskChip key={task.id} task={task} compact />
            ))}
          </div>
        )}
    </button>
  );
}

function MobileCalendar({
  months,
  tasksByDate,
  onDaySelect,
  selectedDate,
}: {
  months: Date[];
  tasksByDate: Record<string, Task[]>;
  onDaySelect: (date: Date, tasks: Task[]) => void;
  selectedDate: Date | null;
}) {
  const today = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {months.map(month => (
        <MobileMonth
          key={month.toISOString()}
          month={month}
          today={today}
          tasksByDate={tasksByDate}
          onDaySelect={onDaySelect}
          selectedDate={selectedDate}
        />
      ))}
    </div>
  );
}

function MobileMonth({
  month,
  today,
  tasksByDate,
  onDaySelect,
  selectedDate,
}: {
  month: Date;
  today: Date;
  tasksByDate: Record<string, Task[]>;
  onDaySelect: (date: Date, tasks: Task[]) => void;
  selectedDate: Date | null;
}) {
  const days = useMemo(() => {
    const calendarStart = startOfWeek(startOfMonth(month));
    const calendarEnd = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [month]);

  return (
    <section>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <h3 style={{
          margin: 0,
          color: 'var(--foreground)',
          fontSize: 17,
          fontWeight: 750,
          lineHeight: 1.25,
        }}>
          {format(month, 'MMMM yyyy')}
        </h3>
      </div>

      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 10,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 6,
          marginBottom: 8,
        }}>
          {WEEKDAYS.map(day => (
            <div
              key={day}
              style={{
                color: 'var(--muted)',
                fontSize: 10,
                fontWeight: 700,
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {day.slice(0, 2)}
            </div>
          ))}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 6,
        }}>
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate[key] || [];
            const inMonth = isSameMonth(day, month);
            const isTodayCell = isSameDay(day, today);
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
            const isActive = isTodayCell || isSelected;

            return (
              <MobileDayButton
                key={key}
                day={day}
                dayKey={key}
                dayTasks={dayTasks}
                inMonth={inMonth}
                isActive={isActive}
                onDaySelect={onDaySelect}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MobileDayButton({
  day,
  dayKey,
  dayTasks,
  inMonth,
  isActive,
  onDaySelect,
}: {
  day: Date;
  dayKey: string;
  dayTasks: Task[];
  inMonth: boolean;
  isActive: boolean;
  onDaySelect: (date: Date, tasks: Task[]) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const hasTasks = dayTasks.length > 0;
  const visibleTasks = dayTasks.slice(0, 2);

  return (
    <button
      type="button"
      data-date={dayKey}
      onClick={() => onDaySelect(day, dayTasks)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        minHeight: 88,
        padding: '6px 4px',
        border: `1px solid ${isActive ? 'var(--accent-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        background: isActive ? 'var(--accent-subtle)' : (isHovered ? 'var(--task-surface-hover)' : 'var(--task-surface)'),
        color: isActive ? 'var(--accent)' : (inMonth ? 'var(--foreground)' : 'var(--muted)'),
        opacity: inMonth ? 1 : 0.45,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        fontSize: 13,
        fontWeight: isActive ? 750 : 600,
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      }}
    >
      <span style={{
        alignSelf: 'flex-start',
        lineHeight: 1,
      }}>
        {day.getDate()}
      </span>
      {hasTasks && (
        <span style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          width: '100%',
          minWidth: 0,
          marginTop: 6,
        }}>
          {visibleTasks.map(task => (
            <span
              key={task.id}
              style={{
                display: 'block',
                width: '100%',
                minWidth: 0,
                padding: '2px 3px',
                borderRadius: 5,
                background: 'rgba(255, 255, 255, 0.035)',
                color: isActive ? 'var(--foreground)' : 'var(--muted)',
                fontSize: 9,
                fontWeight: 650,
                lineHeight: 1.15,
                whiteSpace: 'normal',
                overflow: 'visible',
                overflowWrap: 'anywhere',
                textAlign: 'left',
              }}
            >
              {getCalendarTaskTitle(task)}
            </span>
          ))}
          {dayTasks.length > visibleTasks.length && (
            <span style={{
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              fontSize: 9,
              fontWeight: 700,
              lineHeight: 1,
              paddingLeft: 2,
            }}>
              +{dayTasks.length - visibleTasks.length}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

function getCalendarTaskTitle(task: Task) {
  const displayTitle = task.title.replace(/@(\d+(?::\d{2})?(?:pm|am)?)/gi, '').trim();
  return displayTitle || task.title;
}

function CalendarTaskChip({ task, compact = false }: { task: Task; compact?: boolean }) {
  const displayTitle = getCalendarTaskTitle(task);
  const timeMatch = task.title.match(/@(\d+(?::\d{2})?(?:pm|am)?)/i);
  const taskTime = timeMatch ? timeMatch[1].toLowerCase() : null;

  return (
    <div
      style={{
        display: 'block',
        minWidth: 0,
        width: '100%',
        color: 'var(--foreground)',
        background: compact ? 'rgba(255, 255, 255, 0.035)' : 'var(--task-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: compact ? '4px 6px' : '9px 10px',
        lineHeight: 1.25,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block',
          color: 'var(--foreground)',
          fontSize: compact ? 11 : 15,
          fontWeight: compact ? 650 : 650,
          lineHeight: compact ? 1.2 : 1.3,
          overflow: 'visible',
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
        }}>
          {displayTitle}
        </span>
        {!compact && (taskTime || task.isRecurring) && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginTop: 5,
            color: 'var(--muted)',
            fontSize: 'var(--text-meta)',
            fontWeight: 500,
            lineHeight: 1.2,
          }}>
            {taskTime && <span>{taskTime}</span>}
            {task.isRecurring && <span>{task.recurrenceType}</span>}
          </span>
        )}
      </span>
    </div>
  );
}
