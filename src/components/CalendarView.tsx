'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  addMonths,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
} from 'date-fns';
import { Task } from '@/types/task';
import { getCalendarMonths, getNextMonthsEnd } from '@/utils/calendarMonths';
import { getTaskDisplayTitle } from '@/utils/taskTitle';
import { parseTaskDate } from '@/utils/taskDate';
import { withRecurrencePreviews } from '@/utils/taskRecurrence';
import { compareTasksByTime, formatTaskTime } from '@/utils/taskTime';

interface CalendarViewProps {
  tasks: Task[];
  onDaySelect: (date: Date, tasks: Task[]) => void;
  selectedDate?: Date | null;
  /** Landscape phone: the calendar owns the screen, with shorter days to fit more of the month. */
  fullScreen?: boolean;
  currentDate?: Date;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOBILE_BREAKPOINT = 1000;
const DESKTOP_DAY_MIN_HEIGHT = 150;
const DESKTOP_COMPRESSED_DAY_MIN_HEIGHT = 28;
// Upcoming weeks with nothing scheduled stay tappable but don't fill the screen.
const DESKTOP_EMPTY_DAY_MIN_HEIGHT = 64;
const MOBILE_DAY_MIN_HEIGHT = 88;
const MOBILE_COMPRESSED_DAY_MIN_HEIGHT = 24;
const FULL_SCREEN_DAY_MIN_HEIGHT = 60;
// How close to either end of the loaded months, in pixels, before more are added.
const LOAD_MONTHS_MARGIN = 800;

export default function CalendarView({
  tasks,
  onDaySelect,
  selectedDate = null,
  fullScreen = false,
  currentDate,
}: CalendarViewProps) {
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

  const rootRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  // Month to scroll to after the next render. Starts on the current month, past any older overdue months.
  const pendingScrollRef = useRef<Date | null>(startOfMonth(new Date()));
  // Starts a month back, so there's always something to scroll up into.
  const [navigatedStart, setNavigatedStart] = useState<Date>(() => startOfMonth(addMonths(new Date(), -1)));
  const [navigatedEnd, setNavigatedEnd] = useState<Date | null>(null);
  // Set while months are added above, so what's on screen stays put.
  const heightBeforePrependRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const [navigationCount, setNavigationCount] = useState(0);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));

  // Only real tasks decide which months exist; previews and events fill in the months shown.
  const realTasks = useMemo(
    () => tasks.filter(t => !t.isRecurrencePreview && !t.isCalendarEvent),
    [tasks]
  );

  const now = useMemo(() => currentDate ?? new Date(), [currentDate]);

  const months = useMemo(
    () => getCalendarMonths(realTasks, now, navigatedStart, navigatedEnd),
    [realTasks, now, navigatedStart, navigatedEnd]
  );

  const tasksByDate = useMemo(() => {
    const shown = [
      ...withRecurrencePreviews(realTasks, now, months.map(month => format(month, 'yyyy-MM'))),
      ...tasks.filter(t => t.isCalendarEvent),
    ];
    const map: Record<string, Task[]> = {};
    shown.filter(t => !t.completed && t.dueDate).forEach(task => {
      const key = format(parseTaskDate(task.dueDate), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(task);
    });

    // Tasks first (by time, like the list), then subscribed-calendar events by start time.
    Object.values(map).forEach(arr => arr.sort((a, b) =>
      Number(Boolean(a.isCalendarEvent)) - Number(Boolean(b.isCalendarEvent))
      || (a.isCalendarEvent
        ? (a.eventStart ?? 0) - (b.eventStart ?? 0) || a.title.localeCompare(b.title)
        : compareTasksByTime(a, b))
    ));
    return map;
  }, [realTasks, tasks, months, now]);

  const firstMonth = months[0];
  useLayoutEffect(() => {
    const target = pendingScrollRef.current;
    const root = rootRef.current;
    const bar = barRef.current;
    if (!target || !root || !bar) return;
    pendingScrollRef.current = null;

    const scroller = root.closest('.app-scroll');
    const element = root.querySelector(isMobileCalendar
      ? `[data-month="${format(target, 'yyyy-MM')}"]`
      : `[data-date="${format(target, 'yyyy-MM-01')}"]`);
    if (!scroller || !element) return;
    if (isSameMonth(target, firstMonth)) {
      scroller.scrollTop = 0;
      return;
    }
    // Measure against where the bar sits once stuck; it may still be further down the page.
    const stuckBarBottom = scroller.getBoundingClientRect().top + bar.offsetHeight;
    scroller.scrollTop += element.getBoundingClientRect().top - stuckBarBottom - 8;
  }, [navigationCount, firstMonth, isMobileCalendar]);

  const updateVisibleMonth = useCallback(() => {
    const root = rootRef.current;
    const bar = barRef.current;
    if (!root || !bar) return;
    const month = findVisibleMonth(root, isMobileCalendar, bar.getBoundingClientRect().bottom);
    if (month) setVisibleMonth(current => (isSameMonth(current, month) ? current : month));
  }, [isMobileCalendar]);

  // Keep the view steady when months are added above it.
  useLayoutEffect(() => {
    const heightBefore = heightBeforePrependRef.current;
    const scroller = rootRef.current?.closest('.app-scroll');
    if (heightBefore === null || !scroller) return;
    heightBeforePrependRef.current = null;
    scroller.scrollTop += scroller.scrollHeight - heightBefore;
    lastScrollTopRef.current = scroller.scrollTop;
  }, [months]);

  useEffect(() => {
    const scroller = rootRef.current?.closest('.app-scroll');
    if (!scroller) return;

    const loadNearbyMonths = () => {
      const { scrollTop, scrollHeight, clientHeight } = scroller;
      if (scrollHeight - scrollTop - clientHeight < LOAD_MONTHS_MARGIN) {
        const end = getNextMonthsEnd(months, now);
        setNavigatedEnd(previous => (previous && !isBefore(previous, end) ? previous : end));
      }
      // Only when heading up, so the first month's position on opening doesn't trigger it.
      if (scrollTop < lastScrollTopRef.current && scrollTop < LOAD_MONTHS_MARGIN && heightBeforePrependRef.current === null) {
        heightBeforePrependRef.current = scrollHeight;
        setNavigatedStart(addMonths(months[0], -1));
      }
      lastScrollTopRef.current = scrollTop;
    };

    const update = () => {
      updateVisibleMonth();
      loadNearbyMonths();
    };
    let frame = requestAnimationFrame(update);
    const handleScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', handleScroll);
    };
  }, [updateVisibleMonth, months, now]);

  const goToCurrentMonth = () => {
    const target = startOfMonth(now);
    pendingScrollRef.current = target;
    // Set now rather than waiting for the scroll.
    setVisibleMonth(target);
    setNavigationCount(count => count + 1);
  };

  return (
    <div ref={rootRef} style={{
      padding: fullScreen
        ? '0 max(8px, env(safe-area-inset-right, 0px)) 24px max(8px, env(safe-area-inset-left, 0px))'
        : (isMobileCalendar ? '8px 10px 110px' : '12px clamp(10px, 2vw, 18px) 120px'),
      minWidth: 0,
      width: '100%',
      maxWidth: 1120,
      margin: '0 auto',
    }}>
      <div ref={barRef} style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'var(--background)',
        padding: fullScreen
          ? 'max(6px, env(safe-area-inset-top, 0px)) 0 4px'
          : 'calc(10px + env(safe-area-inset-top, 0px)) 0 8px',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <h3 style={{ flex: 1, minWidth: 0, margin: 0, color: 'var(--foreground)', fontSize: 17, fontWeight: 750, lineHeight: 1.25 }}>
            {format(visibleMonth, 'MMMM yyyy')}
          </h3>
          {!isSameMonth(visibleMonth, now) && (
            <button
              type="button"
              className="icon-btn"
              onClick={goToCurrentMonth}
              style={{ height: 36, padding: '0 12px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
            >
              Today
            </button>
          )}
        </div>
        {!isMobileCalendar && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
            {WEEKDAYS.map(day => (
              <div key={day} style={{
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {day}
              </div>
            ))}
          </div>
        )}
      </div>

      {isMobileCalendar ? (
        <MobileCalendar
          months={months}
          tasksByDate={tasksByDate}
          onDaySelect={onDaySelect}
          selectedDate={selectedDate}
          dayMinHeight={fullScreen ? FULL_SCREEN_DAY_MIN_HEIGHT : MOBILE_DAY_MIN_HEIGHT}
        />
      ) : (
        <ContinuousCalendar
          months={months}
          tasksByDate={tasksByDate}
          onDaySelect={onDaySelect}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}

/** The month under the sticky bar: on desktop, the month a row ends in, so a row's month is its last day's. */
function findVisibleMonth(root: HTMLElement, isMobileCalendar: boolean, top: number): Date | null {
  if (isMobileCalendar) {
    for (const element of root.querySelectorAll<HTMLElement>('[data-month]')) {
      if (element.getBoundingClientRect().bottom > top + 12) {
        return parseTaskDate(`${element.dataset.month}-01`);
      }
    }
    return null;
  }

  const days = root.querySelectorAll<HTMLElement>('[data-date]');
  for (let index = 6; index < days.length; index += 7) {
    if (days[index].getBoundingClientRect().bottom > top + 12) {
      return startOfMonth(parseTaskDate(days[index].dataset.date!));
    }
  }
  return null;
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

  const calendarDays = getRelevantCalendarDays(months);
  const currentWeekStart = startOfWeek(today).getTime();
  const compressedWeekRows = getEmptyPastWeekRows(calendarDays, tasksByDate, currentWeekStart);
  const emptyWeekRows = getEmptyUpcomingWeekRows(calendarDays, tasksByDate, currentWeekStart, selectedDate);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
      gap: 8,
      width: '100%',
    }}>
      {calendarDays.map((day, index) => {
        const key = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDate[key] || [];
        const inVisibleMonth = months.some(month => isSameMonth(day, month));
        const isMonthStart = day.getDate() === 1 && inVisibleMonth;
        const row = Math.floor(index / 7) + 1;
        const column = (index % 7) + 1;
        const isCompressedWeek = compressedWeekRows.has(Math.floor(index / 7));
        const isEmptyWeek = emptyWeekRows.has(Math.floor(index / 7));

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
            monthLabel={isMonthStart ? format(day, 'MMM') : undefined}
            dayKey={key}
            isCompressedWeek={isCompressedWeek}
            isEmptyWeek={isEmptyWeek}
          />
        );
      })}
    </div>
  );
}

function getRelevantCalendarDays(months: Date[]): Date[] {
  if (months.length === 0) return [];

  const monthRuns: Date[][] = [];

  for (const month of months) {
    const currentRun = monthRuns.at(-1);
    const previousMonth = currentRun?.at(-1);
    const monthIndex = month.getFullYear() * 12 + month.getMonth();
    const previousMonthIndex = previousMonth
      ? previousMonth.getFullYear() * 12 + previousMonth.getMonth()
      : null;

    if (currentRun && previousMonthIndex !== null && monthIndex === previousMonthIndex + 1) {
      currentRun.push(month);
    } else {
      monthRuns.push([month]);
    }
  }

  return monthRuns.flatMap((run) => eachDayOfInterval({
    start: startOfWeek(startOfMonth(run[0])),
    end: endOfWeek(endOfMonth(run[run.length - 1])),
  }));
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
  isCompressedWeek,
  isEmptyWeek,
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
  isCompressedWeek: boolean;
  isEmptyWeek: boolean;
}) {
  const isTodayCell = isSameDay(day, today);
  const hasTasks = dayTasks.length > 0;
  const isActive = isSelected || isTodayCell;
  const selectableTasks = dayTasks;

  return (
    <button
      type="button"
      className="calendar-day"
      data-active={isActive || undefined}
      data-ringed="true"
      onClick={() => onDaySelect(day, selectableTasks)}
      data-date={dayKey}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: isCompressedWeek ? '3px 6px' : '10px 9px',
        minHeight: isCompressedWeek
          ? DESKTOP_COMPRESSED_DAY_MIN_HEIGHT
          : (isEmptyWeek ? DESKTOP_EMPTY_DAY_MIN_HEIGHT : DESKTOP_DAY_MIN_HEIGHT),
        fontSize: 13,
        fontWeight: isActive ? 700 : 500,
        background: isActive
          ? 'var(--accent-subtle)'
          : (inVisibleMonth ? 'var(--task-surface)' : 'var(--surface-faint)'),
        color: inVisibleMonth ? 'var(--foreground)' : 'var(--muted)',
        border: `1px solid ${isActive ? 'var(--accent-border)' : 'transparent'}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        textAlign: 'left',
        overflow: 'visible',
        gridColumn: `${gridColumn} / ${gridColumn + 1}`,
        gridRow: `${gridRow} / ${gridRow + 1}`,
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, min-height 0.15s',
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
            width: isCompressedWeek ? 20 : 24,
            height: isCompressedWeek ? 16 : 24,
            borderRadius: 'var(--radius-xs)',
            background: isTodayCell ? 'var(--accent)' : (isActive ? 'var(--accent-surface)' : 'transparent'),
            color: isTodayCell ? 'var(--background)' : undefined,
            fontSize: isCompressedWeek ? 12 : 13,
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
              <CalendarTaskChip key={task.id} task={task} compact onTint={isActive} isOverdue={!task.isCalendarEvent && isBefore(day, startOfDay(today))} />
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
  dayMinHeight,
}: {
  months: Date[];
  tasksByDate: Record<string, Task[]>;
  onDaySelect: (date: Date, tasks: Task[]) => void;
  selectedDate: Date | null;
  dayMinHeight: number;
}) {
  const today = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {months.map((month, index) => (
        <MobileMonth
          key={month.toISOString()}
          month={month}
          isFirst={index === 0}
          today={today}
          tasksByDate={tasksByDate}
          onDaySelect={onDaySelect}
          selectedDate={selectedDate}
          dayMinHeight={dayMinHeight}
        />
      ))}
    </div>
  );
}

function MobileMonth({
  month,
  isFirst,
  today,
  tasksByDate,
  onDaySelect,
  selectedDate,
  dayMinHeight,
}: {
  month: Date;
  isFirst: boolean;
  today: Date;
  tasksByDate: Record<string, Task[]>;
  onDaySelect: (date: Date, tasks: Task[]) => void;
  selectedDate: Date | null;
  dayMinHeight: number;
}) {
  const days = useMemo(() => {
    const calendarStart = startOfWeek(startOfMonth(month));
    const calendarEnd = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [month]);
  const currentWeekStart = startOfWeek(today).getTime();
  const compressedWeekRows = useMemo(
    () => getEmptyPastWeekRows(days, tasksByDate, currentWeekStart),
    [days, tasksByDate, currentWeekStart]
  );

  return (
    <section>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: isFirst ? 0 : 10,
      }}>
        {/* The sticky bar above names the first month. */}
        {!isFirst && (
          <h3 style={{
            margin: 0,
            color: 'var(--foreground)',
            fontSize: 17,
            fontWeight: 750,
            lineHeight: 1.25,
          }}>
            {format(month, 'MMMM yyyy')}
          </h3>
        )}
      </div>

      <div data-month={format(month, 'yyyy-MM')} style={{
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
          {days.map((day, index) => {
            const weekRow = Math.floor(index / 7);
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
                isToday={isTodayCell}
                onDaySelect={onDaySelect}
                isCompressedWeek={compressedWeekRows.has(weekRow)}
                minHeight={dayMinHeight}
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
  isToday,
  onDaySelect,
  isCompressedWeek,
  minHeight,
}: {
  day: Date;
  dayKey: string;
  dayTasks: Task[];
  inMonth: boolean;
  isActive: boolean;
  isToday: boolean;
  onDaySelect: (date: Date, tasks: Task[]) => void;
  isCompressedWeek: boolean;
  minHeight: number;
}) {
  const hasTasks = dayTasks.length > 0;

  return (
    <button
      type="button"
      className="calendar-day"
      data-active={isActive || undefined}
      data-date={dayKey}
      onClick={() => onDaySelect(day, dayTasks)}
      style={{
        position: 'relative',
        minHeight: isCompressedWeek ? MOBILE_COMPRESSED_DAY_MIN_HEIGHT : minHeight,
        padding: isCompressedWeek ? '3px 2px' : '6px 4px',
        border: `1px solid ${isActive ? 'var(--accent-border)' : 'transparent'}`,
        borderRadius: 'var(--radius-sm)',
        background: isActive ? 'var(--accent-subtle)' : 'var(--task-surface)',
        color: isActive ? 'var(--accent)' : (inMonth ? 'var(--foreground)' : 'var(--muted)'),
        opacity: inMonth ? 1 : 0.45,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        fontSize: 13,
        fontWeight: isActive ? 750 : 600,
        transition: 'background 0.15s, border-color 0.15s, color 0.15s, min-height 0.15s',
      }}
    >
      <span style={{
        alignSelf: 'flex-start',
        lineHeight: 1,
        ...(isToday ? {
          margin: '-2px 0 -2px -2px',
          padding: '2px 4px',
          borderRadius: 5,
          background: 'var(--accent)',
          color: 'var(--background)',
        } : {}),
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
          {dayTasks.map(task => {
            const isOverdueChip = !task.isCalendarEvent && !task.completed && isBefore(day, startOfDay(new Date()));
            return (
            <span
              key={task.id}
              title={getCalendarTaskTitle(task)}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                width: '100%',
                minWidth: 0,
                padding: '2px 4px',
                border: task.isRecurrencePreview ? '1px dashed var(--border)' : '1px solid transparent',
                boxShadow: task.isCalendarEvent ? 'inset 2px 0 0 var(--event)' : undefined,
                borderRadius: 5,
                background: task.isRecurrencePreview || task.isCalendarEvent ? 'transparent' : (isActive ? 'var(--task-surface)' : 'var(--surface-inset)'),
                color: isOverdueChip ? 'var(--red)' : (isActive ? 'var(--foreground)' : 'var(--muted)'),
                opacity: task.isRecurrencePreview ? 0.58 : 1,
                fontSize: 10,
                fontWeight: 600,
                lineHeight: 1.2,
                overflow: 'hidden',
                overflowWrap: 'anywhere',
                textAlign: 'left',
              }}
            >
              {getCalendarTaskTitle(task)}
            </span>
            );
          })}
        </span>
      )}
    </button>
  );
}

function getCalendarTaskTitle(task: Task) {
  return getTaskDisplayTitle(task);
}

function getEmptyUpcomingWeekRows(
  days: Date[],
  tasksByDate: Record<string, Task[]>,
  currentWeekStart: number,
  selectedDate: Date | null
) {
  const rows = new Set<number>();

  for (let row = 0; row < days.length; row += 7) {
    const weekDays = days.slice(row, row + 7);
    if (weekDays.length < 7) continue;
    if (startOfWeek(weekDays[0]).getTime() <= currentWeekStart) continue;
    if (selectedDate && weekDays.some(day => isSameDay(day, selectedDate))) continue;

    // Recurrence previews alone don't keep a week full height; they still fit in the shorter cells.
    const weekHasTasks = weekDays.some(day => (tasksByDate[format(day, 'yyyy-MM-dd')] || []).some(task => !task.isRecurrencePreview));
    if (!weekHasTasks) rows.add(row / 7);
  }

  return rows;
}

function getEmptyPastWeekRows(days: Date[], tasksByDate: Record<string, Task[]>, currentWeekStart: number) {
  const rows = new Set<number>();

  for (let row = 0; row < days.length; row += 7) {
    const weekDays = days.slice(row, row + 7);
    if (weekDays.length < 7) continue;

    const weekEndedBeforeCurrentWeek = endOfWeek(weekDays[0]).getTime() < currentWeekStart;
    const weekHasTasks = weekDays.some(day => {
      const key = format(day, 'yyyy-MM-dd');
      return (tasksByDate[key] || []).length > 0;
    });

    if (weekEndedBeforeCurrentWeek && !weekHasTasks) {
      rows.add(row / 7);
    }
  }

  return rows;
}

function CalendarTaskChip({ task, compact = false, isOverdue = false, onTint = false }: { task: Task; compact?: boolean; isOverdue?: boolean; onTint?: boolean }) {
  const displayTitle = getCalendarTaskTitle(task);
  const taskTime = formatTaskTime(task.title);

  return (
    <div
      style={{
        display: 'block',
        minWidth: 0,
        width: '100%',
        color: isOverdue ? 'var(--red)' : (compact ? 'var(--muted)' : 'var(--foreground)'),
        background: task.isRecurrencePreview || task.isCalendarEvent
          ? 'transparent'
          : (compact && !onTint ? 'var(--surface-inset)' : 'var(--task-surface)'),
        border: `1px ${task.isRecurrencePreview ? 'dashed' : 'solid'} ${compact && !task.isRecurrencePreview ? 'transparent' : 'var(--border)'}`,
        boxShadow: task.isCalendarEvent ? 'inset 2px 0 0 var(--event)' : undefined,
        borderRadius: compact ? 5 : 'var(--radius-sm)',
        opacity: task.isRecurrencePreview ? 0.58 : 1,
        padding: compact ? '2px 3px' : '9px 10px',
        lineHeight: 1.25,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: compact ? '-webkit-box' : 'block',
          WebkitLineClamp: compact ? 2 : undefined,
          WebkitBoxOrient: compact ? 'vertical' : undefined,
          color: isOverdue ? 'var(--red)' : (compact ? 'var(--muted)' : 'var(--foreground)'),
          fontSize: compact ? 11 : 15,
          fontWeight: compact ? 600 : 650,
          lineHeight: compact ? 1.2 : 1.3,
          overflow: 'hidden',
          whiteSpace: compact ? 'normal' : 'nowrap',
          overflowWrap: compact ? 'anywhere' : undefined,
          textOverflow: 'ellipsis',
        }}>
          {compact && (taskTime || task.eventTime) && (
            <span style={{ fontWeight: 700 }}>{taskTime || task.eventTime} </span>
          )}
          {displayTitle}
        </span>
        {!compact && (taskTime || task.isRecurring || task.eventTime) && (
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
            {task.eventTime && <span>{task.eventTime}</span>}
            {task.isRecurring && <span>{task.recurrenceType}</span>}
          </span>
        )}
      </span>
    </div>
  );
}
