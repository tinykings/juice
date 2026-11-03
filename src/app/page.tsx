'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, isToday, addDays, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from 'date-fns';
import { useTasks } from '@/context/TaskContext';
import { useSettings } from '@/context/SettingsContext';
import { useCalendarFeed } from '@/context/CalendarFeedContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useAppBadge } from '@/hooks/useAppBadge';
import { Task } from '@/types/task';
import { TaskForm } from '@/components/TaskModal';
import SettingsModal from '@/components/SettingsModal';
import TaskItem from '@/components/TaskItem';
import CalendarEventItem from '@/components/CalendarEventItem';
import CompletedTaskItem from '@/components/CompletedTaskItem';
import ConfirmCompleteDialog from '@/components/ConfirmCompleteDialog';
import CalendarView from '@/components/CalendarView';
import CalendarTaskOverlay from '@/components/CalendarTaskOverlay';
import { parseTaskDate } from '@/utils/taskDate';
import { withRecurrencePreviews } from '@/utils/taskRecurrence';
import { parseTaskTimeMinutes } from '@/utils/taskTime';
import { splitTaskTitle } from '@/utils/taskTitle';

interface TaskGroup {
  label: string;
  tasks: Task[];
  isToday?: boolean;
  isOverdue?: boolean;
  date?: Date;
}

export default function HomePage() {
  const { tasks, completeTask, uncompleteTask, getCompletedTasks, getTodayTasks, isLoaded, isSyncing } = useTasks();
  const { badgeEnabled } = useSettings();
  useServiceWorker();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskFormPresentation, setTaskFormPresentation] = useState<'inline' | 'calendar-overlay'>('inline');
  const [isInlineFormClosing, setIsInlineFormClosing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [initialDate, setInitialDate] = useState<string | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<Date | null>(null);
  const [confirmCompleteTask, setConfirmCompleteTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [windowWidth, setWindowWidth] = useState(0);
  // Phone held sideways: the calendar takes the whole screen, like the iOS app.
  const [isLandscapePhone, setIsLandscapePhone] = useState(false);
  const [newTaskUrlMode, setNewTaskUrlMode] = useState<'pending' | 'off' | 'today' | 'pinned'>('pending');
  const [hasAddedTaskFromUrl, setHasAddedTaskFromUrl] = useState(false);
  const [undoTask, setUndoTask] = useState<Task | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const listScrollRef = useRef<HTMLElement | null>(null);
  const inlineCloseTimerRef = useRef<number | null>(null);
  const landscapeCalendarWasAutomaticRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const newTaskEntry = Array.from(params.entries()).find(([key]) => key.toLowerCase() === 'newtask');
      if (!newTaskEntry) {
        setNewTaskUrlMode('off');
        return;
      }

      const value = newTaskEntry[1].toLowerCase();
      setNewTaskUrlMode(value === 'pinned' ? 'pinned' : 'today');
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Track viewport width and PWA landscape mode for responsive layout.
  useEffect(() => {
    const updateViewport = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      // Phones and small tablets, installed or in the browser; not a narrow desktop window.
      const isTouch = window.matchMedia('(pointer: coarse)').matches;

      setWindowWidth(window.innerWidth);
      setIsLandscapePhone(
        (isStandalone || isTouch) &&
        window.matchMedia('(orientation: landscape)').matches &&
        window.innerWidth < 1000
      );
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (isLandscapePhone) {
      setView(currentView => {
        landscapeCalendarWasAutomaticRef.current = currentView !== 'calendar';
        return 'calendar';
      });
      return;
    }

    if (landscapeCalendarWasAutomaticRef.current) {
      landscapeCalendarWasAutomaticRef.current = false;
      setView('list');
    }
  }, [isLandscapePhone]);

  const showSplitView = windowWidth >= 1000;
  const isWideScreen = windowWidth > 600;
  const handleSearchClick = useCallback(() => {
    if (view === 'calendar') {
      setView('list');
    }
    setIsSearchExpanded(true);
  }, [view]);

  useEffect(() => {
    if (view !== 'list' || showSplitView) return;

    const timer = window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      listScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [view, showSplitView]);

  const todayTaskCount = getTodayTasks().length;
  useAppBadge(todayTaskCount, badgeEnabled);
  // Callback ref focuses search immediately while preserving mobile keyboard user gesture.
  const searchInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      node.focus();
    }
  }, []);

  // Update current date when window gains focus or becomes visible to ensure "Today" is accurate
  useEffect(() => {
    const updateDate = () => {
      setCurrentDate(new Date());
    };

    document.addEventListener('visibilitychange', updateDate);
    window.addEventListener('focus', updateDate);

    return () => {
      document.removeEventListener('visibilitychange', updateDate);
      window.removeEventListener('focus', updateDate);
    };
  }, []);

  // Project occurrences into months already visible from real tasks. These
  // previews stay derived and never create new calendar months or sync data.
  const tasksWithRecurrencePreviews = useMemo(
    () => withRecurrencePreviews(tasks, currentDate),
    [tasks, currentDate]
  );

  // Read-only events from this device's subscribed calendar, shaped like
  // tasks so the list and calendar can place them by day.
  const { events: calendarEvents } = useCalendarFeed();
  const calendarEventTasks = useMemo<Task[]>(() => calendarEvents.map(event => ({
    id: `ics:${event.id}`,
    title: event.title,
    notes: '',
    dueDate: event.date,
    completed: false,
    completedAt: null,
    createdAt: '',
    pinned: false,
    isRecurring: false,
    recurrenceType: null,
    tags: [],
    isCalendarEvent: true,
    eventTime: event.allDay ? undefined : format(new Date(event.start), 'h:mm a'),
    eventStart: event.start,
  })), [calendarEvents]);

  // Everything shown on calendar days: tasks, recurrence previews and events.
  const displayTasks = useMemo(
    () => (calendarEventTasks.length ? [...tasksWithRecurrencePreviews, ...calendarEventTasks] : tasksWithRecurrencePreviews),
    [tasksWithRecurrencePreviews, calendarEventTasks]
  );

  // Get all incomplete tasks (filtered by search if query exists)
  const incompleteTasks = useMemo(() => {
    const today = startOfDay(currentDate);
    const lastEventDay = endOfDay(addDays(today, 7));
    const filtered = displayTasks.filter(t => {
      if (t.completed) return false;
      if (!t.dueDate) return false; // Pinned tasks are shown separately.
      if (t.isCalendarEvent) {
        // The list shows upcoming events for this week; the calendar shows the rest.
        const eventDay = parseTaskDate(t.dueDate);
        if (isBefore(eventDay, today)) return false;
        if (!selectedDateFilter && isAfter(eventDay, lastEventDay)) return false;
      }
      if (selectedDateFilter && !isSameDay(parseTaskDate(t.dueDate), selectedDateFilter)) return false;
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(query) || (t.notes ?? '').toLowerCase().includes(query);
    });
    return filtered.sort((a, b) => parseTaskDate(a.dueDate).getTime() - parseTaskDate(b.dueDate).getTime());
  }, [displayTasks, searchQuery, selectedDateFilter, currentDate]);

  // Get completed tasks (filtered by search if query exists)
  const completedTasks = useMemo(() => {
    const allCompleted = getCompletedTasks();
    if (selectedDateFilter) return [];
    if (!searchQuery.trim()) return allCompleted;
    const query = searchQuery.toLowerCase();
    return allCompleted.filter(t =>
      t.title.toLowerCase().includes(query) || (t.notes ?? '').toLowerCase().includes(query)
    );
  }, [getCompletedTasks, searchQuery, selectedDateFilter]);

  // Get tomorrow's tasks
  const tomorrowTasks = useMemo(() => {
    if (selectedDateFilter) return [];
    const tomorrow = addDays(startOfDay(currentDate), 1);
    return incompleteTasks.filter(t => !t.isCalendarEvent && isSameDay(parseTaskDate(t.dueDate), tomorrow));
  }, [incompleteTasks, selectedDateFilter, currentDate]);

  const hasNoTasks = tasks.length === 0;

  // Pinned tasks stay above every dated group.
  const pinnedTasks = useMemo(() => {
    if (selectedDateFilter) return [];
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter(t => (
      t.pinned &&
      !t.completed &&
      (!query || t.title.toLowerCase().includes(query) || (t.notes ?? '').toLowerCase().includes(query))
    ));
  }, [tasks, searchQuery, selectedDateFilter]);

  // Group tasks by day (for this week) and month (for later)
  const groupedTasks = useMemo(() => {
    const today = startOfDay(currentDate);
    const weekEnd = endOfDay(addDays(today, 7));
    
    const groups: TaskGroup[] = [];
    
    // Overdue tasks (due date is before today, not today)
    const overdueTasks = incompleteTasks.filter(t => {
      const d = startOfDay(parseTaskDate(t.dueDate));
      return isBefore(d, today) && !isToday(d);
    });
    if (overdueTasks.length > 0) {
      const yesterday = addDays(today, -1);
      // Sort alphabetically by title
      const sortedOverdueTasks = [...overdueTasks].sort((a, b) => 
        a.title.localeCompare(b.title)
      );
      groups.push({ label: 'Overdue', tasks: sortedOverdueTasks, isOverdue: true, date: yesterday });
    }
    
    // Today's tasks (only today, not overdue)
    const todayTasks = incompleteTasks.filter(t => {
      const d = parseTaskDate(t.dueDate);
      return isSameDay(d, today);
    });
    // Timed tasks first (by time), then alphabetically.
    const sortByTime = (a: Task, b: Task) => {
      const timeA = parseTaskTimeMinutes(a.title);
      const timeB = parseTaskTimeMinutes(b.title);
      if (timeA !== null && timeB === null) return -1;
      if (timeA === null && timeB !== null) return 1;
      if (timeA !== null && timeB !== null && timeA !== timeB) return timeA - timeB;
      return a.title.localeCompare(b.title);
    };
    const sortedTodayTasks = withEventsLast(todayTasks, sortByTime);
    groups.push({ label: `Today (${format(today, 'M/d')})`, tasks: sortedTodayTasks, isToday: true, date: today });

    // Next 7 days (by day of week)
    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i);
      const dayTasks = incompleteTasks.filter(t => isSameDay(parseTaskDate(t.dueDate), date));
      // Sort alphabetically by title
      const sortedDayTasks = withEventsLast(dayTasks, (a, b) => a.title.localeCompare(b.title));
      const label = format(date, 'EEEE (M/d)');
      groups.push({ label, tasks: sortedDayTasks, date });
    }

    // Beyond this week - group by month
    const futureTasks = incompleteTasks.filter(t => isAfter(parseTaskDate(t.dueDate), weekEnd));
    const monthGroups: { [key: string]: Task[] } = {};
    
    futureTasks.forEach(task => {
      const monthKey = format(parseTaskDate(task.dueDate), 'MMMM yyyy');
      if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
      monthGroups[monthKey].push(task);
    });

    Object.entries(monthGroups).forEach(([month, monthTasks]) => {
      // Sort by due date
      const sortedMonthTasks = [...monthTasks].sort((a, b) => parseTaskDate(a.dueDate).getTime() - parseTaskDate(b.dueDate).getTime());
      groups.push({ label: month, tasks: sortedMonthTasks });
    });

    return groups;
  }, [incompleteTasks, currentDate]);

  const visibleGroups = useMemo(() => {
    const isCreatingTask = isModalOpen && !editingTask && taskFormPresentation === 'inline';
    const creatingDate = isCreatingTask
      ? (initialDate ? new Date(`${initialDate}T00:00:00`) : startOfDay(currentDate))
      : null;
    const hasDatedCreateGroup = creatingDate
      ? groupedTasks.some(g => g.date && isSameDay(g.date, creatingDate))
      : false;

    const visible = groupedTasks.filter(g => {
      if (g.tasks.length > 0 || (g.isToday && completedTasks.length > 0)) return true;
      if (!creatingDate) return false;
      if (g.date && isSameDay(g.date, creatingDate)) return true;
      return !hasDatedCreateGroup && !g.date && g.label === format(creatingDate, 'MMMM yyyy');
    });

    if (!creatingDate) return visible;

    const hasCreateGroup = visible.some(g => {
      if (g.date && isSameDay(g.date, creatingDate)) return true;
      return !hasDatedCreateGroup && !g.date && g.label === format(creatingDate, 'MMMM yyyy');
    });

    if (hasCreateGroup) return visible;

    return [
      ...visible,
      {
        label: format(creatingDate, 'MMMM yyyy'),
        tasks: [],
      },
    ];
  }, [groupedTasks, completedTasks.length, currentDate, editingTask, initialDate, isModalOpen, taskFormPresentation]);

  const isCreatingTask = isModalOpen && !editingTask && taskFormPresentation === 'inline';
  const shouldShowCreateFormInGroup = useCallback((group: TaskGroup) => {
    if (!isCreatingTask) return false;
    const creatingDate = initialDate ? new Date(`${initialDate}T00:00:00`) : startOfDay(currentDate);
    const hasDatedCreateGroup = groupedTasks.some(g => g.date && isSameDay(g.date, creatingDate));
    if (group.date && isSameDay(group.date, creatingDate)) return true;
    return !hasDatedCreateGroup && !group.date && group.label === format(creatingDate, 'MMMM yyyy');
  }, [currentDate, groupedTasks, initialDate, isCreatingTask]);

  const openTaskForm = useCallback((
    date: string | null,
    task: Task | null,
    presentation: 'inline' | 'calendar-overlay'
  ) => {
    if (inlineCloseTimerRef.current !== null) {
      window.clearTimeout(inlineCloseTimerRef.current);
      inlineCloseTimerRef.current = null;
    }
    setTaskFormPresentation(presentation);
    setIsInlineFormClosing(false);
    setEditingTask(task);
    setInitialDate(date);
    setIsModalOpen(true);
  }, []);

  const openInlineTaskForm = useCallback((date: string | null, task: Task | null = null) => {
    if (!task && view === 'calendar') {
      openTaskForm(date, null, 'calendar-overlay');
      return;
    }
    if (view === 'calendar' && !showSplitView) setView('list');
    openTaskForm(date, task, 'inline');
  }, [openTaskForm, showSplitView, view]);

  const openCalendarTaskForm = useCallback((date: string) => {
    setSelectedDateFilter(null);
    openTaskForm(date, null, 'calendar-overlay');
  }, [openTaskForm]);

  const showUndo = useCallback((task: Task) => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    setUndoTask(task);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoTask(null);
      undoTimerRef.current = null;
    }, 5000);
  }, []);

  const handleUndoComplete = useCallback(() => {
    if (!undoTask) return;
    uncompleteTask(undoTask.id);
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndoTask(null);
  }, [undoTask, uncompleteTask]);

  useEffect(() => () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
  }, []);

  // Handle task completion with confirmation for future tasks
  const handleTaskComplete = useCallback((taskId: string, isTodayOrOverdue: boolean) => {
    if (isTodayOrOverdue) {
      // No confirmation needed for Today or Overdue tasks
      completeTask(taskId);
      const task = tasks.find(t => t.id === taskId);
      if (task) showUndo(task);
    } else {
      // Show confirmation for future tasks
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setConfirmCompleteTask(task);
      }
    }
  }, [tasks, completeTask, showUndo]);

  // Confirm completion
  const handleConfirmComplete = useCallback(() => {
    if (confirmCompleteTask) {
      completeTask(confirmCompleteTask.id);
      showUndo(confirmCompleteTask);
      setConfirmCompleteTask(null);
    }
  }, [confirmCompleteTask, completeTask, showUndo]);

  const handleCloseModal = useCallback(() => {
    if (!isModalOpen || isInlineFormClosing) return;

    const hadDateFilter = selectedDateFilter !== null;
    setIsInlineFormClosing(true);

    inlineCloseTimerRef.current = window.setTimeout(() => {
      setIsModalOpen(false);
      setIsInlineFormClosing(false);
      setEditingTask(null);
      setInitialDate(null);
      setTaskFormPresentation('inline');
      setSelectedDateFilter(null);
      inlineCloseTimerRef.current = null;
      if (hadDateFilter) {
        setView('calendar');
      }
    }, 180);
  }, [isInlineFormClosing, isModalOpen, selectedDateFilter]);

  useEffect(() => {
    return () => {
      if (inlineCloseTimerRef.current !== null) {
        window.clearTimeout(inlineCloseTimerRef.current);
      }
    };
  }, []);

  const handleInlineSave = useCallback(() => {
    if (selectedDateFilter !== null) {
      setView('calendar');
    }
  }, [selectedDateFilter]);

  useEffect(() => {
    if (!isModalOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-task-inline-form="true"]')) return;
      if (target.closest('[data-task-inline-portal="true"]')) return;
      if (target.closest('[data-task-card="true"]') && !target.closest('[data-task-checkbox="true"]')) return;
      handleCloseModal();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [handleCloseModal, isModalOpen]);

  // Tapping a day adds to it, like the iOS app. The overlay lists the day's tasks and events, and
  // tapping a listed task opens that day in the list.
  const handleDaySelect = useCallback((date: Date) => {
    openCalendarTaskForm(format(date, 'yyyy-MM-dd'));
  }, [openCalendarTaskForm]);

  const showDayInList = useCallback((day: string) => {
    if (inlineCloseTimerRef.current !== null) {
      window.clearTimeout(inlineCloseTimerRef.current);
      inlineCloseTimerRef.current = null;
    }
    setIsModalOpen(false);
    setIsInlineFormClosing(false);
    setInitialDate(null);
    setTaskFormPresentation('inline');
    setView('list');
    setSearchQuery('');
    setIsSearchExpanded(false);
    setSelectedDateFilter(parseTaskDate(day));
  }, []);

  const overlayDayTasks = useMemo(() => (
    initialDate
      ? withEventsLast(
        displayTasks.filter(t => !t.completed && t.dueDate === initialDate),
        (a, b) => a.title.localeCompare(b.title)
      )
      : []
  ), [initialDate, displayTasks]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const isTyping = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || el?.isContentEditable;
      const canUseShortcut = !e.metaKey && !e.ctrlKey && !e.altKey && !isModalOpen && !isSettingsOpen && !confirmCompleteTask && !isTyping;

      if (e.key === 'n' && canUseShortcut) {
        e.preventDefault();
        const date = selectedDateFilter
          ? format(selectedDateFilter, 'yyyy-MM-dd')
          : null;
        openTaskForm(date, null, 'calendar-overlay');
      }
      if (e.key === 's' && canUseShortcut) {
        e.preventDefault();
        if (view === 'calendar') setView('list');
        setSelectedDateFilter(null);
        setIsSearchExpanded(true);
      }
      // Escape to close confirmation dialog or clear search
      if (e.key === 'Escape') {
        if (confirmCompleteTask) {
          setConfirmCompleteTask(null);
        } else if (searchQuery) {
          setSearchQuery('');
          setIsSearchExpanded(false);
          // Also blur the search input if it's focused
          const el = document.activeElement as HTMLInputElement;
          if (el?.tagName === 'INPUT') {
            el.blur();
          }
        } else if (isSearchExpanded) {
           setIsSearchExpanded(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isSettingsOpen, confirmCompleteTask, searchQuery, isSearchExpanded, selectedDateFilter, openTaskForm, view]);

  if (newTaskUrlMode === 'pending' || (newTaskUrlMode !== 'off' && !isLoaded)) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'var(--background)',
      }} />
    );
  }

  if (newTaskUrlMode !== 'off') {
    return (
      <main style={{
        minHeight: '100dvh',
        background: 'var(--background)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 14px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          {hasAddedTaskFromUrl ? (
            <div style={{
              color: 'var(--foreground)',
              fontSize: 18,
              fontWeight: 700,
              padding: '14px 2px',
            }}>
              task added
            </div>
          ) : (
            <>
              <TaskForm
                key={`url-new-task-${newTaskUrlMode}`}
                inline
                onClose={() => {}}
                onSave={() => setHasAddedTaskFromUrl(true)}
                initialDate={newTaskUrlMode === 'pinned' ? '' : null}
                captureUrlMode
              />
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                style={{
                  alignSelf: 'flex-start',
                  color: 'var(--muted)',
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 2px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--accent)';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--muted)';
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Settings
              </button>
            </>
          )}
        </div>

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </main>
    );
  }

  return (
    <div className="app-shell" style={{ background: 'var(--background)', maxWidth: (isWideScreen || showSplitView) ? 'none' : 600, margin: '0 auto', display: 'flex', flexDirection: showSplitView ? 'row' : 'column' }}>
      {/* Search Header */}
      {view === 'list' && isSearchExpanded && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: 'color-mix(in srgb, var(--background) 92%, transparent)',
          padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px',
          paddingRight: showSplitView ? 196 : 72,
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  setIsSearchExpanded(false);
                }
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                fontSize: 16,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--foreground)',
                height: 44
              }}
            />
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}
            >
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </div>
          <button
            className="btn-soft"
            onClick={() => {
              setSearchQuery('');
              setIsSearchExpanded(false);
            }}
            style={{
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              padding: '0 16px',
              height: 44,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {isModalOpen && taskFormPresentation === 'calendar-overlay' && (
        <CalendarTaskOverlay
          initialDate={initialDate}
          isClosing={isInlineFormClosing}
          onClose={handleCloseModal}
          dayTasks={overlayDayTasks}
          onShowDay={initialDate ? () => showDayInList(initialDate) : undefined}
        />
      )}

      {/* Calendar View - shown in calendar view OR split view */}
      {(view === 'calendar' || showSplitView) && isLoaded && (
        <div className="app-scroll" style={{
          flex: 1,
          height: (isWideScreen || showSplitView) ? '100%' : 'auto',
          paddingBottom: showSplitView ? 0 : 'calc(65px + env(safe-area-inset-bottom, 0px))',
        }}>
          <CalendarView
            tasks={displayTasks}
            onDaySelect={handleDaySelect}
            selectedDate={selectedDateFilter}
            fullScreen={isLandscapePhone}
          />
        </div>
      )}

      {/* Main Content - List View - shown in list view OR split view */}
      {(view === 'list' || showSplitView) && (
      <main ref={listScrollRef} className="app-scroll" style={{
        flex: 1, 
        padding: isSearchExpanded
          ? 'calc(88px + env(safe-area-inset-top, 0px)) clamp(10px, 2vw, 18px) calc(100px + env(safe-area-inset-bottom, 0px))'
          : 'calc(24px + env(safe-area-inset-top, 0px)) clamp(10px, 2vw, 18px) calc(100px + env(safe-area-inset-bottom, 0px))',
        borderRight: (isWideScreen || showSplitView) ? '1px solid var(--border)' : 'none',
      }}>
        {/* Back to Calendar button (shown when date filter is active) */}
        {selectedDateFilter && (
          <button
            onClick={() => {
              setSelectedDateFilter(null);
              setView('calendar');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              marginBottom: 16,
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--accent)',
              background: 'var(--accent-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
Back
          </button>
        )}
        {/* Empty / All-done State */}
        {isLoaded && (
          <div>
            {incompleteTasks.length === 0 && pinnedTasks.length === 0 && completedTasks.length === 0 && !isCreatingTask && (
              <div style={{
                padding: showSplitView ? '80px 24px' : '60px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16
              }}>
                {hasNoTasks ? (
                  <div style={{
                    fontSize: 28,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    letterSpacing: '-0.03em',
                    maxWidth: 360,
                    textAlign: 'center',
                    color: 'var(--muted)',
                  }}>
                    You have nothing to do.
                    <br />
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedDateFilter) {
                          openInlineTaskForm(format(selectedDateFilter, 'yyyy-MM-dd'));
                        } else {
                          openInlineTaskForm(null);
                        }
                      }}
                      style={{
                        color: 'var(--accent)',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 'inherit',
                        cursor: 'pointer',
                        textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--accent-hover)';
                        e.currentTarget.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--accent)';
                        e.currentTarget.style.textDecoration = 'none';
                      }}
                    >
                      Start something.
                    </button>
                  </div>
                ) : (
                  <div style={{
                    fontSize: 28,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    letterSpacing: '-0.03em',
                    maxWidth: 360,
                    textAlign: 'center',
                    color: 'var(--muted)',
                  }}>
                    All done for now.
                    <br />
                    <span style={{ color: 'var(--accent)' }}>Tomorrow awaits.</span>
                  </div>
                )}

                {tomorrowTasks.length > 0 && (
                  <div style={{
                    marginTop: 8,
                    padding: '12px 24px',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    fontSize: 15,
                    fontWeight: 600,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)',
                  }}>
                    <span style={{ color: 'var(--accent)' }}>
                      {tomorrowTasks.length}
                    </span>
                    {' '}task{tomorrowTasks.length !== 1 ? 's' : ''} tomorrow
                  </div>
                )}
              </div>
            )}
            {/* Pinned Section */}
            {pinnedTasks.length > 0 && (
              <section style={{ marginBottom: 24 }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  {pinnedTasks.map((task) => (
                    editingTask?.id === task.id ? (
                      <TaskForm
                        key={task.id}
                        inline
                        isClosing={isInlineFormClosing}
                        editTask={task}
                        onClose={handleCloseModal}
                        onSave={handleInlineSave}
                      />
                    ) : (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onComplete={() => handleTaskComplete(task.id, true)}
                        onEdit={() => openInlineTaskForm(null, task)}
                        showDate={false}
                        isOverdue={false}
                        needsConfirmation={false}
                      />
                    )
                  ))}
                </div>
              </section>
            )}

            {visibleGroups.map((group) => {
              const groupHasCompletedTasks = group.isToday && completedTasks.length > 0;
              const groupHasTasks = group.tasks.length > 0 || groupHasCompletedTasks;

              return (
                <section
                  key={group.label}
                  style={{
                    marginBottom: 24,
                  }}
                >
                  {!group.isToday && (
                    <div style={{
                      padding: '8px 12px',
                      background: group.isOverdue ? 'rgba(255, 107, 107, 0.1)' : 'var(--surface-inset)',
                      border: `1px solid ${group.isOverdue ? 'rgba(255, 107, 107, 0.24)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: '0.01em',
                      color: group.isOverdue ? 'var(--red)' : 'var(--muted)',
                    }}>
                      {group.label}
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: group.isToday ? 0 : '12px 0 0',
                    justifyContent: groupHasTasks ? 'flex-start' : 'center',
                    alignItems: groupHasTasks ? 'stretch' : 'center'
                  }}>
                    {shouldShowCreateFormInGroup(group) && (
                      <TaskForm
                        key={`new-${initialDate ?? 'today'}`}
                        inline
                        isClosing={isInlineFormClosing}
                        onClose={handleCloseModal}
                        onSave={handleInlineSave}
                        initialDate={initialDate}
                      />
                    )}
                    {group.tasks.map((task) => (
                      task.isCalendarEvent ? (
                        <CalendarEventItem key={task.id} task={task} />
                      ) : editingTask?.id === task.id ? (
                        <TaskForm
                          key={task.id}
                          inline
                          isClosing={isInlineFormClosing}
                          editTask={task}
                          onClose={handleCloseModal}
                          onSave={handleInlineSave}
                        />
                      ) : (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onComplete={() => handleTaskComplete(task.id, !!(group.isToday || group.isOverdue))}
                          onEdit={() => openInlineTaskForm(null, task)}
                          showDate={true}
                          isOverdue={group.isOverdue || false}
                          needsConfirmation={!(group.isToday || group.isOverdue)}
                        />
                      )
                    ))}
                    {group.isToday && completedTasks.length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}>
                        <button
                          type="button"
                          onClick={() => setIsCompletedExpanded(expanded => !expanded)}
                          aria-expanded={isCompletedExpanded}
                          aria-controls="completed-tasks"
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 10px',
                            color: 'var(--muted)',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 13,
                            fontWeight: 700,
                            letterSpacing: '0.01em',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            style={{
                              transform: isCompletedExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.15s ease',
                            }}
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                          <span>Completed</span>
                          <span style={{
                            marginLeft: 'auto',
                            fontSize: 12,
                            fontWeight: 600,
                          }}>
                            {completedTasks.length}
                          </span>
                        </button>
                        {isCompletedExpanded && (
                          <div
                            id="completed-tasks"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                            }}
                          >
                            {completedTasks.map((task) => (
                              <CompletedTaskItem key={task.id} task={task} onUncomplete={() => uncompleteTask(task.id)} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
)}
      </main>
)}

      {/* Landscape PWA calendar owns the full viewport. */}
      {!(isLandscapePhone && view === 'calendar') && (
      <footer
        style={{
          background: 'color-mix(in srgb, var(--background) 45%, transparent)',
          // Hug the 44px buttons: 4px above, 16px below + 1px top border, then
          // extend through the home-indicator inset so no blank band shows below.
          height: 'calc(65px + env(safe-area-inset-bottom, 0px))',
          minHeight: 'calc(65px + env(safe-area-inset-bottom, 0px))',
          maxHeight: 'calc(65px + env(safe-area-inset-bottom, 0px))',
          padding: '4px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderTop: '1px solid var(--border)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          userSelect: 'none',
          // Overlay the scroll area so content blurs through as it scrolls.
          position: showSplitView ? 'fixed' : 'absolute',
          left: showSplitView ? '50%' : 0,
          right: 0,
          bottom: 0,
          zIndex: 25,
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {/* Search Button */}
          <button
            title="Search tasks"
            className="icon-btn"
            onClick={handleSearchClick}
            style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)' }}
            aria-label="Search"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>

          {/* Settings Button */}
          <button
            title="Settings"
            className="icon-btn"
            onClick={() => setIsSettingsOpen(true)}
            style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)' }}
            aria-label="Settings"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
        </div>

        {/* Add Task — always visible */}
        <div>
          <button
            title={isSyncing ? 'Syncing tasks — click to add' : 'New (n)'}
            onClick={() => {
              const date = selectedDateFilter
                ? format(selectedDateFilter, 'yyyy-MM-dd')
                : null;
              openTaskForm(date, null, 'calendar-overlay');
            }}
            aria-label={isSyncing ? 'Syncing tasks; add task' : 'Add task'}
            className="btn-accent"
            style={{
              width: 44,
              height: 44,
              color: 'white',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <AddOrSyncIcon isSyncing={isSyncing} />
          </button>
        </div>
      </footer>
      )}

      {undoTask && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            left: showSplitView ? '75%' : '50%',
            bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            transform: 'translateX(-50%)',
            zIndex: 30,
            width: 'min(420px, calc(100% - 32px))',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 10px 10px 16px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideUp 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
        >
          <span style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            Completed <strong style={{ fontWeight: 650 }}>{splitTaskTitle(undoTask.title).title}</strong>
          </span>
          <button
            type="button"
            className="btn-soft"
            onClick={handleUndoComplete}
            style={{
              flexShrink: 0,
              height: 36,
              padding: '0 14px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Undo
          </button>
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Confirmation Dialog */}
      {confirmCompleteTask && (
        <ConfirmCompleteDialog
          task={confirmCompleteTask}
          onConfirm={handleConfirmComplete}
          onCancel={() => setConfirmCompleteTask(null)}
        />
      )}
    </div>
  );
}

function AddOrSyncIcon({ isSyncing }: { isSyncing: boolean }) {
  if (isSyncing) {
    return (
      <svg className="sync-spinner" width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="36 16" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Real tasks first (in the given order), then calendar events by start time. */
function withEventsLast(items: Task[], compareTasks: (a: Task, b: Task) => number): Task[] {
  const tasks = items.filter(t => !t.isCalendarEvent).sort(compareTasks);
  const events = items
    .filter(t => t.isCalendarEvent)
    .sort((a, b) => (a.eventStart ?? 0) - (b.eventStart ?? 0) || a.title.localeCompare(b.title));
  return [...tasks, ...events];
}
