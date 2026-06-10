'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, isToday, addDays, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from 'date-fns';
import { useTasks } from '@/context/TaskContext';
import { useSettings } from '@/context/SettingsContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useAppBadge } from '@/hooks/useAppBadge';
import { Task } from '@/types/task';
import TaskModal from '@/components/TaskModal';
import SettingsModal from '@/components/SettingsModal';
import TaskItem from '@/components/TaskItem';
import CompletedTaskItem from '@/components/CompletedTaskItem';
import ConfirmCompleteDialog from '@/components/ConfirmCompleteDialog';
import CalendarView from '@/components/CalendarView';

interface TaskGroup {
  label: string;
  tasks: Task[];
  isToday?: boolean;
  isOverdue?: boolean;
  date?: Date;
}

export default function HomePage() {
  const { tasks, completeTask, uncompleteTask, deleteTask, getCompletedTasks, getTodayTasks, isLoaded, isSyncing } = useTasks();
  const { isGistConfigured, badgeEnabled } = useSettings();
  useServiceWorker();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
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
  const listScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track window width for responsive layout
  useEffect(() => {
    const updateWidth = () => setWindowWidth(window.innerWidth);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const showSplitView = windowWidth >= 1000;
  const showToggle = windowWidth < 1000; // Show toggle arrow when NOT split view
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

  const todayTaskCount = useMemo(() => getTodayTasks().length, [getTodayTasks, currentDate]);
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

  // Get all incomplete tasks (filtered by search if query exists)
  const incompleteTasks = useMemo(() => {
    const filtered = tasks.filter(t => {
      if (t.completed) return false;
      if (!t.dueDate) return false; // Exclude someday tasks from normal groups
      if (selectedDateFilter && !isSameDay(new Date(t.dueDate), selectedDateFilter)) return false;
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(query) ||
        (t.notes && t.notes.toLowerCase().includes(query))
      );
    });
    return filtered.sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  }, [tasks, searchQuery, selectedDateFilter]);

  // Get completed tasks (filtered by search if query exists)
  const completedTasks = useMemo(() => {
    const allCompleted = getCompletedTasks();
    if (selectedDateFilter) return [];
    if (!searchQuery.trim()) return allCompleted;
    const query = searchQuery.toLowerCase();
    return allCompleted.filter(t => 
      t.title.toLowerCase().includes(query) ||
      (t.notes && t.notes.toLowerCase().includes(query))
    );
  }, [getCompletedTasks, searchQuery, selectedDateFilter]);

  // Get tomorrow's tasks
  const tomorrowTasks = useMemo(() => {
    if (selectedDateFilter) return [];
    const tomorrow = addDays(startOfDay(currentDate), 1);
    return incompleteTasks.filter(t => isSameDay(new Date(t.dueDate), tomorrow));
  }, [incompleteTasks, selectedDateFilter, currentDate]);

  const hasNoTasks = tasks.length === 0;

  // Someday tasks (no due date, not completed)
  const somedayTasks = useMemo(() => {
    return tasks.filter(t => !t.dueDate && !t.completed);
  }, [tasks]);

  // Group tasks by day (for this week) and month (for later)
  const groupedTasks = useMemo(() => {
    const today = startOfDay(currentDate);
    const weekEnd = endOfDay(addDays(today, 7));
    
    const groups: TaskGroup[] = [];
    
    // Overdue tasks (due date is before today, not today)
    const overdueTasks = incompleteTasks.filter(t => {
      const d = startOfDay(new Date(t.dueDate));
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
      const d = new Date(t.dueDate);
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
      const dayTasks = incompleteTasks.filter(t => isSameDay(new Date(t.dueDate), date));
      // Sort alphabetically by title
      const sortedDayTasks = [...dayTasks].sort((a, b) => 
        a.title.localeCompare(b.title)
      );
      const label = format(date, 'EEEE (M/d)');
      groups.push({ label, tasks: sortedDayTasks, date });
    }

    // Beyond this week - group by month
    const futureTasks = incompleteTasks.filter(t => isAfter(new Date(t.dueDate), weekEnd));
    const monthGroups: { [key: string]: Task[] } = {};
    
    futureTasks.forEach(task => {
      const monthKey = format(new Date(task.dueDate), 'MMMM yyyy');
      if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
      monthGroups[monthKey].push(task);
    });

    Object.entries(monthGroups).forEach(([month, monthTasks]) => {
      // Sort by due date
      const sortedMonthTasks = [...monthTasks].sort((a, b) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
      groups.push({ label: month, tasks: sortedMonthTasks });
    });

    return groups;
  }, [incompleteTasks, currentDate]);

  const visibleGroups = useMemo(() => {
    return groupedTasks.filter(g => g.tasks.length > 0 || (g.isToday && completedTasks.length > 0));
  }, [groupedTasks, completedTasks.length]);

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
    const hadDateFilter = selectedDateFilter !== null;
    setIsModalOpen(false);
    setEditingTask(null);
    setInitialDate(null);
    setSelectedDateFilter(null);
    if (hadDateFilter) {
      setView('calendar');
    }
  }, [selectedDateFilter]);

  const handleDaySelect = useCallback((date: Date, dayTasks: Task[]) => {
    if (dayTasks.length > 0) {
      setView('list');
      setSearchQuery('');
      setIsSearchExpanded(false);
      setSelectedDateFilter(date);
    } else {
      setSelectedDateFilter(null);
      setInitialDate(format(date, 'yyyy-MM-dd'));
      setIsModalOpen(true);
    }
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !isModalOpen) {
        const el = document.activeElement;
        if (el?.tagName !== 'INPUT' && el?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (selectedDateFilter) {
            setInitialDate(format(selectedDateFilter, 'yyyy-MM-dd'));
          } else {
            setInitialDate(showSomeday ? '' : null);
          }
          setIsModalOpen(true);
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
  }, [isModalOpen, confirmCompleteTask, searchQuery, isSearchExpanded, selectedDateFilter, showSomeday]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', maxWidth: (isWideScreen || showSplitView) ? 'none' : 600, margin: '0 auto', display: 'flex', flexDirection: showSplitView ? 'row' : 'column', height: '100dvh' }}>
      {/* Gist Sync Notice */}
      {isGistConfigured && isSyncing && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          padding: 24,
        }}>
          <div style={{
            minWidth: 240,
            maxWidth: '90vw',
            padding: '16px 24px',
            background: 'var(--card)',
            color: 'var(--foreground)',
            border: '3px solid var(--accent)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}>
            Syncing tasks from Gist...
          </div>
        </div>
      )}

      {/* Bottom-right Buttons - only in split view */}
      {showSplitView && (
      <FloatingButtons
        showSomeday={showSomeday}
        mounted={mounted}
        somedayTasksLength={somedayTasks.length}
        onToggleSomeday={() => setShowSomeday(prev => !prev)}
        onSearch={() => setIsSearchExpanded(true)}
        onSettings={() => setIsSettingsOpen(true)}
        onAddTask={() => {
          if (selectedDateFilter) {
            setInitialDate(format(selectedDateFilter, 'yyyy-MM-dd'));
          } else {
            setInitialDate(showSomeday ? '' : null);
          }
          setIsModalOpen(true);
        }}
      />
      )}
 
      {/* Search Header */}
      {view === 'list' && isSearchExpanded && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: 'var(--background)',
          padding: '12px 16px',
          paddingRight: showSplitView ? 196 : 72,
          borderBottom: '4px solid var(--accent)',
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
                border: '2px solid var(--accent-border)',
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
              border: '2px solid var(--accent)',
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

      {/* Calendar View - shown in calendar view OR split view */}
      {(view === 'calendar' || showSplitView) && isLoaded && (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, height: (isWideScreen || showSplitView) ? '100vh' : 'auto' }}>
          <CalendarView
            tasks={tasks}
            onDaySelect={handleDaySelect}
          />
        </div>
      )}

      {/* Main Content - List View - shown in list view OR split view */}
      {(view === 'list' || showSplitView) && (
      <main ref={listScrollRef} style={{ 
        flex: 1, 
        padding: isSearchExpanded ? '88px 24px 100px' : '24px 24px 100px', 
        overflow: 'auto',
        minHeight: 0,
        borderRight: (isWideScreen || showSplitView) ? '2px solid var(--border)' : 'none',
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
              border: '2px solid var(--accent)',
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
            {incompleteTasks.length === 0 && completedTasks.length === 0 && (
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
                    <span style={{ color: 'var(--accent)' }}>Start something.</span>
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
                    background: 'var(--surface-inset)',
                    color: 'var(--foreground)',
                    fontSize: 15,
                    fontWeight: 600,
                    border: '2px solid var(--border)',
                  }}>
                    <span style={{ color: 'var(--accent)' }}>
                      {tomorrowTasks.length}
                    </span>
                    {' '}task{tomorrowTasks.length !== 1 ? 's' : ''} tomorrow
                  </div>
                )}
              </div>
            )}
            {/* Someday Section */}
            {showSomeday && (
              <section style={{ marginBottom: 32, border: '2px solid var(--border)' }}>
                <div style={{ padding: '8px 16px', background: 'var(--accent-surface)', borderBottom: '2px solid var(--accent)', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', color: 'var(--accent)' }}>
                  SOMEDAY
                </div>
                <div style={{ padding: '0 16px' }}>
                  {somedayTasks.length > 0 ? (
                    somedayTasks.map((task) => (
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        onComplete={() => handleTaskComplete(task.id, true)}
                        onEdit={() => {
                          setEditingTask(task);
                          setIsModalOpen(true);
                        }}
                        showDate={true}
                        isOverdue={false}
                        needsConfirmation={false}
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))
                  ) : (
                    <div style={{
                      padding: '32px 0',
                      textAlign: 'center',
                      color: 'var(--muted)',
                      fontSize: 14,
                      fontWeight: 600,
                    }}>
                      No someday tasks
                    </div>
                  )}
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
                    marginBottom: 32,
                  }}
                >
                  <div style={{
                    padding: '8px 16px',
                    background: group.isOverdue ? 'var(--red)' : 'var(--accent-surface)',
                    borderBottom: `2px solid ${group.isOverdue ? 'var(--red)' : 'var(--accent)'}`,
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: group.isOverdue ? 'white' : 'var(--accent)',
                  }}>
                    {group.label}
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: groupHasTasks ? 'flex-start' : 'center',
                    alignItems: groupHasTasks ? 'stretch' : 'center'
                  }}>
                    {showTodayCompletedSummary && (
                      <div style={{
                        padding: '18px 0',
                        borderBottom: '2px solid var(--border)',
                        color: 'var(--muted)',
                        fontSize: 15,
                        fontWeight: 700,
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
                      <TaskItem
                        key={task.id}
                        task={task}
                        onComplete={() => handleTaskComplete(task.id, !!(group.isToday || group.isOverdue))}
                        onEdit={() => {
                          setEditingTask(task);
                          setIsModalOpen(true);
                        }}
                        showDate={true}
                        isOverdue={group.isOverdue || false}
                        needsConfirmation={!(group.isToday || group.isOverdue)}
                        onDelete={() => deleteTask(task.id)}
                      />
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

      {/* Bottom Action Bar - Hidden in full width view */}
{!showSplitView && (
      <footer
        style={{
          background: 'var(--background)',
          padding: '12px 16px max(12px, env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderTop: '3px solid var(--border)',
          userSelect: 'none',
          position: 'relative',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {/* Toggle Calendar/List Button */}
          <button
            title={view === 'list' ? 'Calendar view' : 'List view'}
            onClick={() => setView(view === 'list' ? 'calendar' : 'list')}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: view === 'calendar' ? 'var(--accent)' : 'var(--foreground)',
              background: view === 'calendar' ? 'var(--accent-surface)' : 'transparent',
              border: '2px solid',
              borderColor: view === 'calendar' ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (view !== 'calendar') {
                e.currentTarget.style.background = 'var(--accent-subtle)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }
            }}
            onMouseLeave={(e) => {
              if (view !== 'calendar') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--foreground)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }
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
              border: '2px solid var(--border)',
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
            onClick={() => setShowSomeday(prev => !prev)}
            style={{
              position: 'relative',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: showSomeday ? 'var(--accent-surface)' : 'transparent',
              border: '2px solid',
              borderColor: showSomeday ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer',
              color: showSomeday ? 'var(--accent)' : 'var(--muted)',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            aria-label="Someday"
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
              border: '2px solid var(--border)',
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
            title="New (n)"
            onClick={() => {
              if (selectedDateFilter) {
                setInitialDate(format(selectedDateFilter, 'yyyy-MM-dd'));
              } else {
                setInitialDate(showSomeday ? '' : null);
              }
              setIsModalOpen(true);
            }}
            aria-label="Add task"
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              background: 'var(--accent)',
              border: '2px solid var(--accent)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </footer>
)}

      <TaskModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={() => {
          if (selectedDateFilter !== null) {
            setView('calendar');
          }
        }}
        editTask={editingTask}
        initialDate={!editingTask && showSomeday ? '' : initialDate}
      />

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

function FloatingButtons({
  showSomeday,
  mounted,
  somedayTasksLength,
  onToggleSomeday,
  onSearch,
  onSettings,
  onAddTask,
}: {
  showSomeday: boolean;
  mounted: boolean;
  somedayTasksLength: number;
  onToggleSomeday: () => void;
  onSearch: () => void;
  onSettings: () => void;
  onAddTask: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
        <button
          onClick={onAddTask}
          title="New (n)"
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            background: 'var(--accent)',
            border: '2px solid var(--accent)',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-surface)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
          }}
          aria-label="Add task"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s',
          pointerEvents: isHovered ? 'auto' : 'none',
        }}>
          <button
            title="Settings"
            onClick={onSettings}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              background: 'var(--accent)',
              border: '2px solid var(--accent)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            aria-label="Settings"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
          <button
            title="Search tasks"
            onClick={onSearch}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              background: 'var(--accent)',
              border: '2px solid var(--accent)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            aria-label="Search"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          <button
            title="Someday tasks"
            onClick={onToggleSomeday}
            style={{
              position: 'relative',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              background: 'var(--accent)',
              border: '2px solid var(--accent)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            aria-label="Someday"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22 12h-6l-2 3H10l-2-3H2"/>
              <path d="M2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6"/>
            </svg>
            {mounted && somedayTasksLength > 0 && (
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
              }}>
                {somedayTasksLength}
              </span>
            )}
          </button>
        </div>
    </div>
  );
}
