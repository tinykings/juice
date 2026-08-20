'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, isToday, addDays, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from 'date-fns';
import { useTasks } from '@/context/TaskContext';
import { useSettings } from '@/context/SettingsContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useAppBadge } from '@/hooks/useAppBadge';
import { Task } from '@/types/task';
import { TaskForm } from '@/components/TaskModal';
import SettingsModal from '@/components/SettingsModal';
import TaskItem from '@/components/TaskItem';
import CompletedTaskItem from '@/components/CompletedTaskItem';
import ConfirmCompleteDialog from '@/components/ConfirmCompleteDialog';
import CalendarView from '@/components/CalendarView';
import CalendarTaskOverlay from '@/components/CalendarTaskOverlay';
import { parseTaskDate } from '@/utils/taskDate';
import { withRecurrencePreviews } from '@/utils/taskRecurrence';

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
  const [showSomeday, setShowSomeday] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [newTaskUrlMode, setNewTaskUrlMode] = useState<'pending' | 'off' | 'today' | 'someday'>('pending');
  const [hasAddedTaskFromUrl, setHasAddedTaskFromUrl] = useState(false);
  const listScrollRef = useRef<HTMLElement | null>(null);
  const inlineCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const newTaskEntry = Array.from(params.entries()).find(([key]) => key.toLowerCase() === 'newtask');
      if (!newTaskEntry) {
        setNewTaskUrlMode('off');
        return;
      }

      const value = newTaskEntry[1].toLowerCase();
      setNewTaskUrlMode(value === 'someday' ? 'someday' : 'today');
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Track window width for responsive layout
  useEffect(() => {
    const updateWidth = () => setWindowWidth(window.innerWidth);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

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

  useEffect(() => {
    if (!showSomeday) return;

    const frame = window.requestAnimationFrame(() => {
      listScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [showSomeday]);

  const todayTaskCount = getTodayTasks().length;
  useAppBadge(todayTaskCount, badgeEnabled);
  // Callback ref to focus search input immediately when mounted (preserves user gesture for mobile keyboards)
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

  // Get all incomplete tasks (filtered by search if query exists)
  const incompleteTasks = useMemo(() => {
    const filtered = tasksWithRecurrencePreviews.filter(t => {
      if (t.completed) return false;
      if (!t.dueDate) return false; // Exclude someday tasks from normal groups
      if (selectedDateFilter && !isSameDay(parseTaskDate(t.dueDate), selectedDateFilter)) return false;
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(query) || (t.notes ?? '').toLowerCase().includes(query);
    });
    return filtered.sort((a, b) => parseTaskDate(a.dueDate).getTime() - parseTaskDate(b.dueDate).getTime());
  }, [tasksWithRecurrencePreviews, searchQuery, selectedDateFilter]);

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
    return incompleteTasks.filter(t => isSameDay(parseTaskDate(t.dueDate), tomorrow));
  }, [incompleteTasks, selectedDateFilter, currentDate]);

  const hasNoTasks = tasks.length === 0;

  // Pinned tasks stay above every dated and someday group.
  const pinnedTasks = useMemo(() => {
    if (selectedDateFilter) return [];
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter(t => (
      t.pinned &&
      !t.completed &&
      (!query || t.title.toLowerCase().includes(query) || (t.notes ?? '').toLowerCase().includes(query))
    ));
  }, [tasks, searchQuery, selectedDateFilter]);

  // Someday tasks (no due date, not completed or pinned)
  const somedayTasks = useMemo(() => {
    return tasks.filter(t => !t.dueDate && !t.pinned && !t.completed);
  }, [tasks]);

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
    // Sort: timed tasks first (by time), then alphabetically
    // Handle AM/PM: times without AM/PM default to PM (like standard 12-hour clock convention for times like @12 meaning 12pm)
    const currentHour = new Date().getHours();
    const sortByTime = (a: Task, b: Task) => {
      const timeA = a.title.match(/@(\d+(?::\d{2})?(?:pm|am)?)/i);
      const timeB = b.title.match(/@(\d+(?::\d{2})?(?:pm|am)?)/i);
      if (timeA && !timeB) return -1;
      if (!timeA && timeB) return 1;
      if (timeA && timeB) {
        const parseTime = (t: string): number => {
          const clean = t.replace('@', '').toLowerCase();
          const hasAmPm = clean.includes('am') || clean.includes('pm');
          let hours: number;
          let minutes = 0;
          
          if (clean.includes(':')) {
            const [h, m] = clean.split(':').map(Number);
            hours = h;
            minutes = m || 0;
          } else {
            const num = parseInt(clean.replace(/\D/g, ''), 10) || 0;
            if (num >= 100) {
              hours = Math.floor(num / 100);
              minutes = num % 100;
            } else {
              hours = num;
              minutes = 0;
            }
          }
          
          // Convert to 24-hour format
          if (hasAmPm) {
            if (clean.includes('pm') && hours < 12) hours += 12;
            if (clean.includes('am') && hours === 12) hours = 0;
          } else {
            // No AM/PM specified - assume PM if time < current hour (after current time has passed for AM)
            // This handles @12 as 12pm, @530 as 5:30am (since 530 < current hour which is 11)
            // Actually user wants @12 (12pm) before @530 (5:30pm), so assume PM for times that could be PM
            if (hours < 12 && (hours * 60 + minutes) < (currentHour * 60)) {
              hours += 12; // Convert to PM (e.g., 5:30 becomes 17:30)
            }
          }
          
          return hours * 60 + minutes;
        };
        
        const normalizedA = parseTime(timeA[1]);
        const normalizedB = parseTime(timeB[1]);
        return normalizedA - normalizedB;
      }
      return a.title.localeCompare(b.title);
    };
    const sortedTodayTasks = [...todayTasks].sort(sortByTime);
    groups.push({ label: `Today (${format(today, 'M/d')})`, tasks: sortedTodayTasks, isToday: true, date: today });

    // Next 7 days (by day of week)
    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i);
      const dayTasks = incompleteTasks.filter(t => isSameDay(parseTaskDate(t.dueDate), date));
      // Sort alphabetically by title
      const sortedDayTasks = [...dayTasks].sort((a, b) => 
        a.title.localeCompare(b.title)
      );
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
    const creatingDate = isCreatingTask && initialDate !== ''
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
  const isCreatingSomedayTask = isCreatingTask && initialDate === '';
  const shouldShowCreateFormInGroup = useCallback((group: TaskGroup) => {
    if (!isCreatingTask || isCreatingSomedayTask) return false;
    const creatingDate = initialDate ? new Date(`${initialDate}T00:00:00`) : startOfDay(currentDate);
    const hasDatedCreateGroup = groupedTasks.some(g => g.date && isSameDay(g.date, creatingDate));
    if (group.date && isSameDay(group.date, creatingDate)) return true;
    return !hasDatedCreateGroup && !group.date && group.label === format(creatingDate, 'MMMM yyyy');
  }, [currentDate, groupedTasks, initialDate, isCreatingSomedayTask, isCreatingTask]);

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

  // Handle task completion with confirmation for future tasks
  const handleTaskComplete = useCallback((taskId: string, isTodayOrOverdue: boolean) => {
    if (isTodayOrOverdue) {
      // No confirmation needed for Today or Overdue tasks
      completeTask(taskId);
    } else {
      // Show confirmation for future tasks
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setConfirmCompleteTask(task);
      }
    }
  }, [tasks, completeTask]);

  // Confirm completion
  const handleConfirmComplete = useCallback(() => {
    if (confirmCompleteTask) {
      completeTask(confirmCompleteTask.id);
      setConfirmCompleteTask(null);
    }
  }, [confirmCompleteTask, completeTask, setConfirmCompleteTask]);

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

  const handleDaySelect = useCallback((date: Date, dayTasks: Task[]) => {
    if (dayTasks.length > 0) {
      setView('list');
      setSearchQuery('');
      setIsSearchExpanded(false);
      setSelectedDateFilter(date);
    } else {
      openCalendarTaskForm(format(date, 'yyyy-MM-dd'));
    }
  }, [openCalendarTaskForm]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !isModalOpen) {
        const el = document.activeElement;
        if (el?.tagName !== 'INPUT' && el?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          const date = selectedDateFilter
            ? format(selectedDateFilter, 'yyyy-MM-dd')
            : (showSomeday ? '' : null);
          openTaskForm(date, null, 'calendar-overlay');
        }
      }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey && !isModalOpen) {
        const el = document.activeElement;
        if (el?.tagName !== 'INPUT' && el?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (view === 'calendar') setView('list');
          setSelectedDateFilter(null);
          setIsSearchExpanded(true);
        }
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
  }, [isModalOpen, confirmCompleteTask, searchQuery, isSearchExpanded, selectedDateFilter, showSomeday, openTaskForm, view]);

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
                initialDate={newTaskUrlMode === 'someday' ? '' : null}
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
          padding: '12px 16px',
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
            onClick={() => {
              setSearchQuery('');
              setIsSearchExpanded(false);
            }}
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              background: 'var(--accent-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              padding: '0 16px',
              height: 44,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = 'var(--background)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-surface)';
              e.currentTarget.style.color = 'var(--foreground)';
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
        />
      )}

      {/* Calendar View - shown in calendar view OR split view */}
      {(view === 'calendar' || showSplitView) && isLoaded && (
        <div className="app-scroll" style={{ flex: 1, height: (isWideScreen || showSplitView) ? '100%' : 'auto' }}>
          <CalendarView
            tasks={tasksWithRecurrencePreviews}
            onDaySelect={handleDaySelect}
            selectedDate={selectedDateFilter}
          />
        </div>
      )}

      {/* Main Content - List View - shown in list view OR split view */}
      {(view === 'list' || showSplitView) && (
      <main ref={listScrollRef} className="app-scroll" style={{
        flex: 1, 
        padding: isSearchExpanded ? '88px clamp(10px, 2vw, 18px) 100px' : '24px clamp(10px, 2vw, 18px) 100px',
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
                          openInlineTaskForm(showSomeday ? '' : null);
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

            {/* Someday Section */}
            {showSomeday && (
              <section style={{
                marginBottom: 24,
              }}>
                <div style={{
                  padding: '8px 12px',
                  background: 'color-mix(in srgb, var(--purple) 14%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--purple) 42%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  color: 'var(--purple)',
                }}>
                  SOMEDAY
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: '12px 0 0',
                }}>
                  {isCreatingSomedayTask && (
                    <TaskForm
                      key="new-someday"
                      inline
                      isClosing={isInlineFormClosing}
                      onClose={handleCloseModal}
                      onSave={handleInlineSave}
                      initialDate=""
                    />
                  )}
                  {somedayTasks.length > 0 ? (
                    somedayTasks.map((task) => (
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
                          showDate={true}
                          isOverdue={false}
                          needsConfirmation={false}
                        />
                      )
                    ))
                  ) : !isCreatingSomedayTask ? (
                    <div style={{
                      padding: '28px 16px',
                      textAlign: 'center',
                      color: 'var(--muted)',
                      fontSize: 14,
                      fontWeight: 600,
                    }}>
                      No someday tasks
                    </div>
                  ) : null}
                </div>
              </section>
            )}

            {visibleGroups.map((group) => {
              const groupHasCompletedTasks = group.isToday && completedTasks.length > 0;
              const groupHasTasks = group.tasks.length > 0 || groupHasCompletedTasks;
              const showTodayCompletedSummary = group.isToday && group.tasks.length === 0 && completedTasks.length > 0 && !searchQuery.trim();

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
                      background: group.isOverdue ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 255, 255, 0.035)',
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
                    {showTodayCompletedSummary && (
                      <div style={{
                        padding: '14px 16px',
                        background: 'var(--task-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--muted)',
                        fontSize: 15,
                        fontWeight: 600,
                        lineHeight: 1.45,
                      }}>
                        <div style={{ color: 'var(--foreground)' }}>
                          All tasks are completed.
                        </div>
                        <div>
                          <span style={{ color: 'var(--accent)' }}>{tomorrowTasks.length}</span>
                          {' '}task{tomorrowTasks.length !== 1 ? 's' : ''} coming tomorrow
                        </div>
                      </div>
                    )}
                    {group.tasks.map((task) => (
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
                          onComplete={() => handleTaskComplete(task.id, !!(group.isToday || group.isOverdue))}
                          onEdit={() => openInlineTaskForm(null, task)}
                          showDate={true}
                          isOverdue={group.isOverdue || false}
                          needsConfirmation={!(group.isToday || group.isOverdue)}
                        />
                      )
                    ))}
                    {group.isToday && completedTasks.map((task) => (
                      <CompletedTaskItem key={task.id} task={task} onUncomplete={() => uncompleteTask(task.id)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
)}
      </main>
)}

      {/* Bottom Action Bar — constrained to task pane in split view */}
      <footer
        style={{
          background: 'color-mix(in srgb, var(--background) 92%, transparent)',
          padding: '12px 16px max(12px, env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderTop: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
          userSelect: 'none',
          position: showSplitView ? 'fixed' : 'relative',
          left: showSplitView ? '50%' : undefined,
          right: showSplitView ? 0 : undefined,
          bottom: showSplitView ? 0 : undefined,
          zIndex: showSplitView ? 25 : undefined,
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {/* Toggle Calendar/List Button — mobile only */}
          {!showSplitView && (
          <button
            title={view === 'list' ? 'Calendar view' : 'List view'}
            onClick={() => setView(view === 'list' ? 'calendar' : 'list')}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              background: 'transparent',
              border: '1px solid',
              borderColor: 'var(--border)',
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
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            {view === 'list' ? (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="0"/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
            ) : (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            )}
          </button>
          )}

          {/* Search Button */}
          <button
            title="Search tasks"
            onClick={handleSearchClick}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--muted)',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            aria-label="Search"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-subtle)';
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>

          {/* Someday Button */}
          {view !== 'calendar' && (
          <button
            title="Someday tasks"
            onClick={() => {
              const nextShowSomeday = !showSomeday;
              setShowSomeday(nextShowSomeday);
              if (nextShowSomeday) setSelectedDateFilter(null);
            }}
            style={{
              position: 'relative',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: showSomeday ? 'var(--purple)' : 'transparent',
              border: '1px solid',
              borderColor: showSomeday ? 'var(--purple)' : 'var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: showSomeday ? 'white' : 'var(--muted)',
              boxShadow: showSomeday ? '0 0 0 3px color-mix(in srgb, var(--purple) 22%, transparent)' : 'none',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s',
            }}
            aria-label="Someday"
            aria-pressed={showSomeday}
            onMouseEnter={(e) => {
              if (!showSomeday) {
                e.currentTarget.style.background = 'var(--accent-subtle)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showSomeday) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--muted)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22 12h-6l-2 3H10l-2-3H2"/>
              <path d="M2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6"/>
            </svg>
            {mounted && somedayTasks.length > 0 && !showSomeday && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: 4,
                minWidth: 14,
                height: 14,
                background: 'var(--muted)',
                color: 'var(--background)',
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 2px',
                borderRadius: 999,
              }}>
                {somedayTasks.length}
              </span>
            )}
          </button>
          )}

          {/* Settings Button */}
          <button
            title="Settings"
            onClick={() => setIsSettingsOpen(true)}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--muted)',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            aria-label="Settings"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-subtle)';
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
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
            title={isSyncing
              ? `Syncing tasks — click to add${showSomeday ? ' to Someday' : ''}`
              : showSomeday ? 'New Someday task (n)' : 'New (n)'}
            onClick={() => {
              const date = selectedDateFilter
                ? format(selectedDateFilter, 'yyyy-MM-dd')
                : (showSomeday ? '' : null);
              openTaskForm(date, null, 'calendar-overlay');
            }}
            aria-label={isSyncing
              ? `Syncing tasks; add ${showSomeday ? 'Someday ' : ''}task`
              : showSomeday ? 'Add Someday task' : 'Add task'}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              background: showSomeday ? 'var(--purple)' : 'var(--accent)',
              border: `1px solid ${showSomeday ? 'var(--purple)' : 'var(--accent)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              boxShadow: showSomeday
                ? '0 0 0 3px color-mix(in srgb, var(--purple) 22%, transparent)'
                : 'var(--shadow-md)',
              transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = showSomeday
                ? 'color-mix(in srgb, var(--purple) 85%, white)'
                : 'var(--accent-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = showSomeday ? 'var(--purple)' : 'var(--accent)';
            }}
          >
            <AddOrSyncIcon isSyncing={isSyncing} />
          </button>
        </div>
      </footer>

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
