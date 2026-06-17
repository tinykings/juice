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
import { splitTaskTitle } from '@/utils/taskTitle';

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
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

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
      {isMobileCalendar && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 10,
        }}>
          <button
            type="button"
            aria-pressed={isMobileExpanded}
            aria-label={isMobileExpanded ? 'Collapse calendar' : 'Expand calendar'}
            title={isMobileExpanded ? 'Collapse calendar' : 'Expand calendar'}
            onClick={() => setIsMobileExpanded(prev => !prev)}
            style={{
              width: 42,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isMobileExpanded ? 'var(--accent)' : 'var(--muted)',
              background: isMobileExpanded ? 'var(--accent-subtle)' : 'transparent',
              border: '1px solid',
              borderColor: isMobileExpanded ? 'var(--accent-border)' : 'var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-subtle)';
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isMobileExpanded ? 'var(--accent-subtle)' : 'transparent';
              e.currentTarget.style.color = isMobileExpanded ? 'var(--accent)' : 'var(--muted)';
              e.currentTarget.style.borderColor = isMobileExpanded ? 'var(--accent-border)' : 'var(--border)';
            }}
          >
            {isMobileExpanded ? (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5" />
                <path d="M3 8l5-5M21 8l-5-5M3 16l5 5M21 16l-5 5" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" />
                <path d="M8 3L3 8M16 3l5 5M8 21l-5-5M16 21l5-5" />
              </svg>
            )}
          </button>
        </div>
      )}

      {isMobileCalendar ? (
        <MobileCalendar
          months={monthsWithTasks}
          tasksByDate={tasksByDate}
          onDaySelect={onDaySelect}
          selectedDate={selectedDate}
          expanded={isMobileExpanded}
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
        overflow: 'hidden',
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
  expanded,
}: {
  months: Date[];
  tasksByDate: Record<string, Task[]>;
  onDaySelect: (date: Date, tasks: Task[]) => void;
  selectedDate: Date | null;
  expanded: boolean;
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
          expanded={expanded}
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
  expanded,
}: {
  month: Date;
  today: Date;
  tasksByDate: Record<string, Task[]>;
  onDaySelect: (date: Date, tasks: Task[]) => void;
  selectedDate: Date | null;
  expanded: boolean;
}) {
  const days = useMemo(() => {
    const calendarStart = startOfWeek(startOfMonth(month));
    const calendarEnd = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [month]);

  const agendaDays = useMemo(() => {
    return days.filter(day => {
      const key = format(day, 'yyyy-MM-dd');
      return isSameMonth(day, month) && (tasksByDate[key]?.length ?? 0) > 0;
    });
  }, [days, month, tasksByDate]);

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
        marginBottom: !expanded && agendaDays.length > 0 ? 12 : 0,
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
                expanded={expanded}
              />
            );
          })}
        </div>
      </div>

      {!expanded && agendaDays.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agendaDays.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate[key] || [];
            const isActive = isSameDay(day, today) || (selectedDate ? isSameDay(day, selectedDate) : false);

            return (
              <button
                key={key}
                type="button"
                data-date={key}
                onClick={() => onDaySelect(day, dayTasks)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px minmax(0, 1fr)',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
                  paddingTop: 7,
                }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 750,
                    lineHeight: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    {format(day, 'MMM')}
                  </span>
                  <span style={{
                    color: isActive ? 'var(--accent)' : 'var(--foreground)',
                    fontSize: 22,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}>
                    {format(day, 'd')}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                  minWidth: 0,
                }}>
                  {dayTasks.map(task => (
                    <CalendarTaskChip key={task.id} task={task} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
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
  expanded,
}: {
  day: Date;
  dayKey: string;
  dayTasks: Task[];
  inMonth: boolean;
  isActive: boolean;
  onDaySelect: (date: Date, tasks: Task[]) => void;
  expanded: boolean;
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
        minHeight: expanded ? 88 : 42,
        padding: expanded ? '6px 4px' : 0,
        border: `1px solid ${isActive ? 'var(--accent-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        background: isActive ? 'var(--accent-subtle)' : (isHovered ? 'var(--task-surface-hover)' : 'var(--task-surface)'),
        color: isActive ? 'var(--accent)' : (inMonth ? 'var(--foreground)' : 'var(--muted)'),
        opacity: inMonth ? 1 : 0.45,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: expanded ? 'stretch' : 'center',
        justifyContent: expanded ? 'flex-start' : 'center',
        fontSize: 13,
        fontWeight: isActive ? 750 : 600,
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      }}
    >
      <span style={{
        alignSelf: expanded ? 'flex-start' : 'center',
        lineHeight: 1,
      }}>
        {day.getDate()}
      </span>
      {!expanded && hasTasks && (
        <span style={{
          position: 'absolute',
          left: '50%',
          bottom: 5,
          transform: 'translateX(-50%)',
          minWidth: dayTasks.length > 1 ? 12 : 5,
          height: 5,
          borderRadius: 999,
          background: isActive ? 'var(--accent)' : 'var(--muted)',
          opacity: isActive ? 1 : 0.7,
        }} />
      )}
      {expanded && hasTasks && (
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
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
  const titleParts = splitTaskTitle(displayTitle || task.title);
  return titleParts.title;
}

function CalendarTaskChip({ task, compact = false }: { task: Task; compact?: boolean }) {
  const displayTitle = task.title.replace(/@(\d+(?::\d{2})?(?:pm|am)?)/gi, '').trim();
  const titleParts = splitTaskTitle(displayTitle || task.title);
  const timeMatch = task.title.match(/@(\d+(?::\d{2})?(?:pm|am)?)/i);
  const taskTime = timeMatch ? timeMatch[1].toLowerCase() : null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? '12px minmax(0, 1fr)' : '18px minmax(0, 1fr)',
        gap: compact ? 5 : 8,
        alignItems: 'start',
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
      <span style={{
        width: compact ? 10 : 16,
        height: compact ? 10 : 16,
        marginTop: compact ? 1 : 1,
        border: '1px solid var(--border)',
        borderRadius: compact ? 3 : 'var(--radius-xs)',
        background: 'var(--surface-inset)',
        flexShrink: 0,
      }} />
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block',
          color: 'var(--foreground)',
          fontSize: compact ? 11 : 15,
          fontWeight: compact ? 650 : 650,
          lineHeight: compact ? 1.2 : 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: compact ? 'nowrap' : 'normal',
          overflowWrap: 'anywhere',
        }}>
          {titleParts.title}
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
