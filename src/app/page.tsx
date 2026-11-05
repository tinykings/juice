'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, addDays, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from 'date-fns';
import { useTasks } from '@/context/TaskContext';
import { useSettings } from '@/context/SettingsContext';
import { useCalendarFeed } from '@/context/CalendarFeedContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useAppBadge } from '@/hooks/useAppBadge';
import { useViewport } from '@/hooks/useViewport';
import { Task } from '@/types/task';
import { TaskForm } from '@/components/TaskModal';
import SettingsModal from '@/components/SettingsModal';
import TaskItem from '@/components/TaskItem';
import CalendarEventItem from '@/components/CalendarEventItem';
import ConfirmCompleteDialog from '@/components/ConfirmCompleteDialog';
import CalendarView from '@/components/CalendarView';
import CalendarTaskOverlay from '@/components/CalendarTaskOverlay';
import CaptureTaskPage from '@/components/CaptureTaskPage';
import AppFooter, { SyncNotice } from '@/components/AppFooter';
import CompletedTasksSection from '@/components/CompletedTasksSection';
import GroupHeader from '@/components/GroupHeader';
import SearchHeader from '@/components/SearchHeader';
import TaskListEmptyState from '@/components/TaskListEmptyState';
import UndoToast from '@/components/UndoToast';
import { formatTaskDate, parseTaskDate } from '@/utils/taskDate';
import { buildTaskGroups, getTaskDateLabel, TaskGroup, withEventsLast } from '@/utils/taskGroups';
import { withRecurrencePreviews } from '@/utils/taskRecurrence';
import { compareTasksByTime } from '@/utils/taskTime';

// Width of the task list on the left of wide screens; the calendar takes the rest on the right.
const SPLIT_LIST_WIDTH = 'clamp(420px, 42vw, 560px)';

function matchesSearch(task: Task, query: string): boolean {
  return task.title.toLowerCase().includes(query) || (task.notes ?? '').toLowerCase().includes(query);
}

export default function HomePage() {
  const { tasks, completeTask, uncompleteTask, updateTask, getCompletedTasks, getTodayTasks, isLoaded, isSyncing, syncStatus } = useTasks();
  const { badgeEnabled } = useSettings();
  useServiceWorker();
  const { width: windowWidth, isTouch, isLandscapePhone } = useViewport();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskFormPresentation, setTaskFormPresentation] = useState<'inline' | 'calendar-overlay'>('inline');
  const [isInlineFormClosing, setIsInlineFormClosing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [initialDate, setInitialDate] = useState<string | null>(null);
  const [taskFormKey, setTaskFormKey] = useState(0);
  const [selectedDateFilter, setSelectedDateFilter] = useState<Date | null>(null);
  const [confirmCompleteTask, setConfirmCompleteTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCaptureUrl, setIsCaptureUrl] = useState<boolean | null>(null);
  const [undoTask, setUndoTask] = useState<Task | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const listScrollRef = useRef<HTMLElement | null>(null);
  const inlineCloseTimerRef = useRef<number | null>(null);
  const landscapeCalendarWasAutomaticRef = useRef(false);
  /** Set by the open task form: saves what was typed and closes it. */
  const formDismissRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setIsCaptureUrl(Array.from(params.keys()).some(key => key.toLowerCase() === 'newtask'));
    }, 0);

    return () => window.clearTimeout(timer);
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
    if (view === 'calendar') setView('list');
    setSelectedDateFilter(null);
    setIsSearchExpanded(true);
  }, [view]);

  const closeSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearchExpanded(false);
  }, []);

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

  // Keep "Today" accurate: when the app returns to the foreground, and at midnight if it stays open.
  useEffect(() => {
    const updateDate = () => setCurrentDate(new Date());

    document.addEventListener('visibilitychange', updateDate);
    window.addEventListener('focus', updateDate);

    return () => {
      document.removeEventListener('visibilitychange', updateDate);
      window.removeEventListener('focus', updateDate);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setCurrentDate(new Date()),
      endOfDay(currentDate).getTime() - currentDate.getTime() + 1000
    );
    return () => window.clearTimeout(timer);
  }, [currentDate]);

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

  const trimmedQuery = searchQuery.trim().toLowerCase();

  // The calendar follows the search too, so both sides show the same tasks.
  const calendarTasks = useMemo(() => {
    if (!trimmedQuery) return displayTasks;
    return displayTasks.filter(t => matchesSearch(t, trimmedQuery));
  }, [displayTasks, trimmedQuery]);

  // Get all incomplete tasks (filtered by search if query exists)
  const incompleteTasks = useMemo(() => {
    const today = startOfDay(currentDate);
    const lastEventDay = endOfDay(addDays(today, 7));
    const filtered = displayTasks.filter(t => {
      if (t.completed) return false;
      if (!t.dueDate) return false; // Undated tasks are added to Overdue separately.
      if (t.isCalendarEvent) {
        // The list shows upcoming events for this week; the calendar shows the rest.
        const eventDay = parseTaskDate(t.dueDate);
        if (isBefore(eventDay, today)) return false;
        if (!selectedDateFilter && isAfter(eventDay, lastEventDay)) return false;
      }
      if (selectedDateFilter && !isSameDay(parseTaskDate(t.dueDate), selectedDateFilter)) return false;
      return !trimmedQuery || matchesSearch(t, trimmedQuery);
    });
    return filtered.sort((a, b) => parseTaskDate(a.dueDate).getTime() - parseTaskDate(b.dueDate).getTime());
  }, [displayTasks, trimmedQuery, selectedDateFilter, currentDate]);

  // Get completed tasks (filtered by search if query exists)
  const completedTasks = useMemo(() => {
    if (selectedDateFilter) return [];
    const allCompleted = getCompletedTasks();
    return trimmedQuery ? allCompleted.filter(t => matchesSearch(t, trimmedQuery)) : allCompleted;
  }, [getCompletedTasks, trimmedQuery, selectedDateFilter]);

  const hasNoTasks = tasks.length === 0;

  // Tasks without a date (e.g. older pinned tasks, or ones made in the iOS app)
  // wait under Overdue until they're given a date or done.
  const undatedTasks = useMemo(() => {
    if (selectedDateFilter) return [];
    return tasks.filter(t => !t.dueDate && !t.completed && (!trimmedQuery || matchesSearch(t, trimmedQuery)));
  }, [tasks, trimmedQuery, selectedDateFilter]);

  const groupedTasks = useMemo(
    () => buildTaskGroups(incompleteTasks, undatedTasks, currentDate),
    [incompleteTasks, undatedTasks, currentDate]
  );

  const isCreatingTask = isModalOpen && !editingTask && taskFormPresentation === 'inline';
  const creatingDate = useMemo(() => {
    if (!isCreatingTask) return null;
    return initialDate ? parseTaskDate(initialDate) : startOfDay(currentDate);
  }, [currentDate, initialDate, isCreatingTask]);

  const shouldShowCreateFormInGroup = useCallback((group: TaskGroup) => {
    return Boolean(creatingDate && group.date && !group.isOverdue && isSameDay(group.date, creatingDate));
  }, [creatingDate]);

  const visibleGroups = useMemo(() => groupedTasks.filter(g => (
    g.tasks.length > 0 || (g.isToday && completedTasks.length > 0) || shouldShowCreateFormInGroup(g)
  )), [groupedTasks, completedTasks.length, shouldShowCreateFormInGroup]);

  const openTaskForm = useCallback((
    date: string | null,
    task: Task | null,
    presentation: 'inline' | 'calendar-overlay'
  ) => {
    // A form already open (say, tapping another card while editing) keeps what was typed.
    formDismissRef.current?.();
    if (inlineCloseTimerRef.current !== null) {
      window.clearTimeout(inlineCloseTimerRef.current);
      inlineCloseTimerRef.current = null;
    }
    setTaskFormKey(key => key + 1);
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
    const task = tasks.find(t => t.id === taskId);
    if (isTodayOrOverdue) {
      completeTask(taskId);
      if (task) showUndo(task);
    } else if (task) {
      setConfirmCompleteTask(task);
    }
  }, [tasks, completeTask, showUndo]);

  const handleConfirmComplete = useCallback(() => {
    if (confirmCompleteTask) {
      completeTask(confirmCompleteTask.id);
      showUndo(confirmCompleteTask);
      setConfirmCompleteTask(null);
    }
  }, [confirmCompleteTask, completeTask, showUndo]);

  const handleCloseModal = useCallback(() => {
    if (!isModalOpen || isInlineFormClosing) return;

    setIsInlineFormClosing(true);

    inlineCloseTimerRef.current = window.setTimeout(() => {
      setIsModalOpen(false);
      setIsInlineFormClosing(false);
      setEditingTask(null);
      setInitialDate(null);
      setTaskFormPresentation('inline');
      inlineCloseTimerRef.current = null;
    }, 180);
  }, [isInlineFormClosing, isModalOpen]);

  useEffect(() => {
    return () => {
      if (inlineCloseTimerRef.current !== null) {
        window.clearTimeout(inlineCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-task-inline-form="true"]')) return;
      if (target.closest('[data-task-inline-portal="true"]')) return;
      if (target.closest('[data-task-card="true"]') && !target.closest('[data-task-checkbox="true"]')) return;
      if (formDismissRef.current) formDismissRef.current();
      else handleCloseModal();
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

  const tasksForDay = useCallback((day: string) => withEventsLast(
    displayTasks.filter(t => !t.completed && t.dueDate === day),
    compareTasksByTime
  ), [displayTasks]);

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
        handleSearchClick();
      }
      // Escape to close confirmation dialog or clear search
      if (e.key === 'Escape') {
        if (confirmCompleteTask) {
          setConfirmCompleteTask(null);
        } else if (searchQuery || isSearchExpanded) {
          closeSearch();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isSettingsOpen, confirmCompleteTask, searchQuery, isSearchExpanded, selectedDateFilter, openTaskForm, handleSearchClick, closeSearch]);

  const conflictCount = useMemo(() => tasks.filter(t => t.conflictOf && !t.completed).length, [tasks]);
  const syncNotice = useMemo<SyncNotice | null>(() => {
    if (syncStatus === 'error') return { label: 'Sync error', tone: 'error' };
    if (conflictCount > 0) {
      return { label: `${conflictCount} conflict${conflictCount === 1 ? '' : 's'}`, tone: 'conflict' };
    }
    return null;
  }, [conflictCount, syncStatus]);

  if (isCaptureUrl === null || (isCaptureUrl && !isLoaded)) {
    return <div style={{ minHeight: '100dvh', background: 'var(--background)' }} />;
  }

  if (isCaptureUrl) return <CaptureTaskPage />;

  const openAddForm = () => {
    const date = selectedDateFilter ? format(selectedDateFilter, 'yyyy-MM-dd') : null;
    openTaskForm(date, null, 'calendar-overlay');
  };
  const splitRightEdge = `calc(100% - ${SPLIT_LIST_WIDTH})`;

  return (
    <div className="app-shell" style={{ background: 'var(--background)', maxWidth: (isWideScreen || showSplitView) ? 'none' : 600, margin: '0 auto', display: 'flex', flexDirection: showSplitView ? 'row' : 'column' }}>
      {view === 'list' && isSearchExpanded && (
        <SearchHeader
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onClose={closeSearch}
          rightEdge={showSplitView ? splitRightEdge : 0}
          reserveSpaceOnRight={!showSplitView}
        />
      )}

      {isModalOpen && taskFormPresentation === 'calendar-overlay' && (
        <CalendarTaskOverlay
          initialDate={initialDate}
          isClosing={isInlineFormClosing}
          onClose={handleCloseModal}
          tasksForDay={tasksForDay}
          onShowDay={showDayInList}
          dismissRef={formDismissRef}
          formKey={taskFormKey}
        />
      )}

      {/* Calendar View - shown in calendar view OR split view */}
      {(view === 'calendar' || showSplitView) && isLoaded && (
        <div className="app-scroll" style={{
          flex: 1,
          order: showSplitView ? 2 : undefined,
          height: (isWideScreen || showSplitView) ? '100%' : 'auto',
          paddingBottom: showSplitView || isLandscapePhone ? 0 : 'calc(65px + env(safe-area-inset-bottom, 0px))',
        }}>
          <CalendarView
            tasks={calendarTasks}
            onDaySelect={handleDaySelect}
            selectedDate={selectedDateFilter}
            fullScreen={isLandscapePhone}
            currentDate={currentDate}
          />
        </div>
      )}

      {/* Main Content - List View - shown in list view OR split view */}
      {(view === 'list' || showSplitView) && (
      <main ref={listScrollRef} className="app-scroll" style={{
        flex: showSplitView ? `0 0 ${SPLIT_LIST_WIDTH}` : 1,
        padding: isSearchExpanded
          ? 'calc(88px + env(safe-area-inset-top, 0px)) clamp(10px, 2vw, 18px) calc(100px + env(safe-area-inset-bottom, 0px))'
          : 'calc(24px + env(safe-area-inset-top, 0px)) clamp(10px, 2vw, 18px) calc(100px + env(safe-area-inset-bottom, 0px))',
        borderRight: showSplitView ? '1px solid var(--border)' : 'none',
      }}>
        {/* Back out of a single day shown from the calendar */}
        {selectedDateFilter && (
          <button
            onClick={() => {
              setSelectedDateFilter(null);
              // Phones rotated back to portrait return to the list; there's no portrait calendar to go to.
              if (isLandscapePhone || (!showSplitView && !isTouch)) setView('calendar');
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
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        {isLoaded && (
          <div>
            {incompleteTasks.length === 0 && undatedTasks.length === 0 && completedTasks.length === 0 && !isCreatingTask && (
              <TaskListEmptyState
                searchQuery={searchQuery}
                selectedDate={selectedDateFilter}
                hasNoTasks={hasNoTasks}
                isWide={showSplitView}
                onAdd={() => (selectedDateFilter ? openAddForm() : openInlineTaskForm(null))}
              />
            )}
            {visibleGroups.map((group) => {
              const groupHasCompletedTasks = group.isToday && completedTasks.length > 0;
              const groupHasTasks = group.tasks.length > 0 || groupHasCompletedTasks;

              return (
                <section key={group.label} style={{ marginBottom: 24 }}>
                  <GroupHeader
                    label={group.label}
                    detail={group.detail}
                    tone={group.isOverdue ? 'overdue' : group.isToday ? 'today' : 'default'}
                    onAdd={group.date && !group.isOverdue
                      ? () => openInlineTaskForm(group.isToday ? null : formatTaskDate(group.date!))
                      : undefined}
                    action={group.isOverdue && group.tasks.length > 1 ? {
                      label: 'Move all to today',
                      onClick: () => {
                        const today = formatTaskDate(startOfDay(new Date()));
                        group.tasks
                          .filter(task => !task.isCalendarEvent && !task.isRecurrencePreview)
                          .forEach(task => updateTask(task.id, { dueDate: today }));
                      },
                    } : undefined}
                  />
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '8px 0 0',
                    justifyContent: groupHasTasks ? 'flex-start' : 'center',
                    alignItems: groupHasTasks ? 'stretch' : 'center',
                  }}>
                    {shouldShowCreateFormInGroup(group) && (
                      <TaskForm
                        key={`new-${initialDate ?? 'today'}`}
                        inline
                        isClosing={isInlineFormClosing}
                        onClose={handleCloseModal}
                        dismissRef={formDismissRef}
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
                          dismissRef={formDismissRef}
                        />
                      ) : (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onComplete={() => handleTaskComplete(task.id, !!(group.isToday || group.isOverdue))}
                          onEdit={() => openInlineTaskForm(null, task)}
                          showDate={true}
                          dateLabel={getTaskDateLabel(task, group, currentDate)}
                          isOverdue={group.isOverdue || false}
                          needsConfirmation={!(group.isToday || group.isOverdue)}
                        />
                      )
                    ))}
                    {group.isToday && completedTasks.length > 0 && (
                      <CompletedTasksSection tasks={completedTasks} onUncomplete={uncompleteTask} />
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
      )}

      {/* The landscape phone calendar owns the full viewport. */}
      {!(isLandscapePhone && view === 'calendar') && (
        <AppFooter
          rightEdge={showSplitView ? splitRightEdge : 0}
          isFixed={showSplitView}
          isSyncing={isSyncing}
          syncNotice={syncNotice}
          calendarToggle={!showSplitView && !isTouch ? {
            showingCalendar: view === 'calendar',
            onToggle: () => {
              closeSearch();
              setSelectedDateFilter(null);
              setView(view === 'calendar' ? 'list' : 'calendar');
            },
          } : null}
          onSearch={handleSearchClick}
          onSettings={() => setIsSettingsOpen(true)}
          onAdd={openAddForm}
        />
      )}

      {undoTask && (
        <UndoToast
          task={undoTask}
          left={showSplitView ? `calc(${SPLIT_LIST_WIDTH} / 2)` : '50%'}
          onUndo={handleUndoComplete}
        />
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

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
