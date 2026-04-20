'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, isToday, addDays, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from 'date-fns';
import { useTasks } from '@/context/TaskContext';
import { useSettings } from '@/context/SettingsContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useAppBadge } from '@/hooks/useAppBadge';
import { Task } from '@/types/task';
import TaskModal from '@/components/TaskModal';
import SettingsModal from '@/components/SettingsModal';
import TaskItem from '@/components/TaskItem';
import CalendarView from '@/components/CalendarView';

interface TaskGroup {
  label: string;
  tasks: Task[];
  isToday?: boolean;
  isOverdue?: boolean;
  date?: Date;
}

export default function HomePage() {
  const { tasks, completeTask, uncompleteTask, deleteTask, getCompletedTasks, clearCompletedTasks, getTodayTasks, isLoaded, isSyncing } = useTasks();
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);

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
    return groupedTasks.filter(g => g.tasks.length > 0);
  }, [groupedTasks]);

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
            setInitialDate(null);
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
  }, [isModalOpen, confirmCompleteTask, searchQuery, isSearchExpanded, selectedDateFilter]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', transition: 'background 0.2s', maxWidth: (isWideScreen || showSplitView) ? 'none' : 600, margin: '0 auto', display: (isWideScreen || showSplitView) ? 'flex' : 'block', height: '100vh' }}>
      {/* Gist Sync Message */}
      {isGistConfigured && isSyncing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          background: 'var(--accent)',
          color: 'var(--background)',
          padding: '10px 24px',
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 500,
        }}>
          Syncing tasks from Gist...
        </div>
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
          padding: '16px 24px',
          borderBottom: '2px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12
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
                border: '1px solid var(--accent)',
                borderRadius: 0,
                color: 'var(--foreground)',
                outline: 'none',
                boxShadow: '4px 4px 0 var(--accent-light)',
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = 'var(--background)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            style={{
              fontSize: 15,
              color: 'var(--accent)',
              background: 'none',
              border: '1px solid var(--accent)',
              cursor: 'pointer',
              padding: '0 16px',
              fontWeight: 500,
              height: 44,
              borderRadius: 0,
              transition: 'all 0.2s'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Calendar View - shown in calendar view OR split view */}
      {(view === 'calendar' || showSplitView) && isLoaded && (
        <div style={{ flex: 1, overflow: 'auto', height: (isWideScreen || showSplitView) ? '100vh' : 'auto' }}>
          <CalendarView
            tasks={tasks}
            onDaySelect={handleDaySelect}
            isGistConfigured={isGistConfigured}
            isSyncing={isSyncing}
          />
        </div>
      )}

      {/* Main Content - List View - shown in list view OR split view */}
      {(view === 'list' || showSplitView) && (
      <main style={{ 
        flex: 1, 
        padding: isSearchExpanded ? '88px 24px 100px' : '24px 24px 100px', 
        paddingTop: (isGistConfigured && isSyncing) ? (isSearchExpanded ? 108 : 44) : (isSearchExpanded ? 88 : 24),
        overflow: 'auto',
        height: (isWideScreen || showSplitView) ? 'calc(100vh - 80px)' : 'auto',
        borderRight: (isWideScreen || showSplitView) ? '1px solid rgba(255,255,255,0.1)' : 'none',
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
              fontWeight: 500,
              color: 'var(--accent)',
              background: 'none',
              border: '1px solid var(--accent)',
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Calendar
          </button>
        )}
        {/* Task Groups */}
        {isLoaded && (
          <div>
            {visibleGroups.map((group, index) => (
              <section 
                key={group.label} 
                style={{ 
                  marginBottom: 32,
                  animation: 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  opacity: 0,
                  transform: 'translateY(10px)',
                  animationDelay: `${index * 100}ms`
                }}
              >
                <h2 style={{ 
                  fontSize: 15, 
                  fontWeight: 600, 
                  color: group.isOverdue ? 'var(--red)' : group.isToday ? 'var(--foreground)' : 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 12,
                  fontFamily: 'var(--font-body)'
                }}>
                  {group.label}
                </h2>
                <div style={{ 
                  borderTop: '2px solid var(--border)',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: group.tasks.length === 0 ? 'center' : 'flex-start',
                  alignItems: group.tasks.length === 0 ? 'center' : 'stretch'
                }}>
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
                </div>
              </section>
            ))}
            
            {incompleteTasks.length === 0 && completedTasks.length === 0 && !searchQuery && (
              <div style={{ textAlign: 'center', padding: '80px 0 120px' }}>
                {/* Empty state illustration */}
                <div style={{ 
                  width: 80, 
                  height: 80, 
                  background: 'var(--surface-inset)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                  borderRadius: 20,
                  border: '1px solid var(--border)',
                }}>
                  <svg width="36" height="36" fill="none" stroke="var(--accent)" strokeWidth="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 12h8"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, fontFamily: 'var(--font-body)', color: 'var(--foreground)' }}>
                  Ready to focus?
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: 15, maxWidth: 240, margin: '0 auto', lineHeight: 1.5 }}>
                  Add your first task with the + button below
                </p>
              </div>
            )}

            {/* Completed Section */}
            {completedTasks.length > 0 && (
              <section style={{ marginTop: 48 }}>
                <h2 style={{ 
                  fontSize: 15, 
                  fontWeight: 600, 
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 12,
                  fontFamily: 'var(--font-body)'
                }}>
                  Completed (30 days)
                </h2>
                <div style={{ borderTop: '2px solid var(--border)' }}>
                  {completedTasks.map((task) => (
                    <CompletedTaskItem key={task.id} task={task} onUncomplete={() => uncompleteTask(task.id)} />
                  ))}
                </div>
                
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete all completed tasks?')) {
                        clearCompletedTasks();
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--red)',
                      color: 'var(--red)',
                      fontSize: 15,
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: '12px 24px',
                      opacity: 0.8,
                      transition: 'all 0.2s',
                      borderRadius: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.background = 'var(--red)';
                      e.currentTarget.style.color = 'var(--background)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.8';
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--red)';
                    }}
                  >
Clear Completed
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
)}

{/* Bottom Action Buttons */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: 'var(--background)',
        padding: '0 24px 24px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
      }}>
          {/* Toggle Calendar/List Button & View indicator - show in both views when < 1000px */}
          {!showSplitView && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setView(view === 'list' ? 'calendar' : 'list')}
                style={{
                  width: 60,
                  height: 60,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--foreground)',
                  background: 'var(--surface-inset)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-md)',
                  transition: 'all 0.2s ease',
                }}
              >
                {view === 'list' ? (
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                ) : (
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                )}
              </button>
            </div>
          )}

          {/* Settings Button - show in all views */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
            aria-label="Settings"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>

          {/* FAB - Add Task */}
          <button
            onClick={() => {
              if (selectedDateFilter) {
                setInitialDate(format(selectedDateFilter, 'yyyy-MM-dd'));
              } else {
                setInitialDate(null);
              }
              setIsModalOpen(true);
            }}
            aria-label="Add task"
            title="New (n)"
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              background: 'var(--accent)',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: 'var(--shadow-lg)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
      </footer>

      <TaskModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={() => {
          if (selectedDateFilter !== null) {
            setView('calendar');
          }
        }}
        editTask={editingTask}
        initialDate={initialDate}
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

function CompletedTaskItem({ task, onUncomplete }: { task: Task; onUncomplete: () => void }) {
  const [isUncompleting, setIsUncompleting] = useState(false);

  const handleUncomplete = () => {
    setIsUncompleting(true);
    setTimeout(onUncomplete, 300);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
      padding: '16px 0',
      borderBottom: '1px solid var(--border)',
      opacity: isUncompleting ? 0.3 : 1,
      transition: 'opacity 0.15s',
    }}>
      {/* Completed checkmark - clickable to uncomplete */}
      <button
        onClick={handleUncomplete}
        style={{
          width: 28,
          height: 28,
          borderRadius: 0,
          background: isUncompleting ? 'transparent' : 'var(--green)',
          border: isUncompleting ? '2.5px solid var(--muted-light)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 4,
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.2s',
          minWidth: 28,
          minHeight: 28
        }}
      >
        {!isUncompleting && (
          <svg width="16" height="16" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ 
          margin: 0, 
          fontSize: 18, 
          lineHeight: 1.4,
          textDecoration: isUncompleting ? 'none' : 'line-through',
          color: isUncompleting ? 'var(--foreground)' : 'var(--muted)',
          transition: 'all 0.2s'
        }}>
          {task.title}
        </p>
        {task.completedAt && (
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--muted)' }}>
            {format(new Date(task.completedAt), 'MMM d, h:mm a')}
          </p>
        )}
      </div>
    </div>
  );
}

function ConfirmCompleteDialog({ 
  task, 
  onConfirm, 
  onCancel 
}: { 
  task: Task; 
  onConfirm: () => void; 
  onCancel: () => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onCancel]);

  const taskDate = new Date(task.dueDate);
  const formattedDate = format(taskDate, 'EEEE, MMMM d, yyyy');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      {/* Backdrop */}
      <div 
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)'
        }}
      />

      {/* Dialog */}
      <div style={{
        position: 'absolute',
        left: 20,
        right: 20,
        top: '50%',
        transform: 'translateY(-50%)',
        maxWidth: 400,
        margin: '0 auto',
        background: 'var(--card)',
        borderRadius: 0,
        boxShadow: '12px 12px 0 rgba(0,0,0,0.2)',
        overflow: 'hidden',
        border: '1px solid var(--border)'
      }}>
        <div style={{ padding: 24 }}>
          <h3 style={{
            fontSize: 20,
            fontWeight: 600,
            margin: '0 0 12px 0',
            color: 'var(--foreground)',
            fontFamily: 'var(--font-body)'
          }}>
            Complete this task?
          </h3>
          <p style={{
            fontSize: 16,
            color: 'var(--muted)',
            margin: '0 0 16px 0',
            lineHeight: 1.5
          }}>
            This task is scheduled for <strong>{formattedDate}</strong>. Are you sure you want to mark it as complete?
          </p>
          <div style={{
            background: 'var(--background)',
            padding: 12,
            border: '1px solid var(--border)',
            marginBottom: 20
          }}>
            <p style={{
              fontSize: 16,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)'
            }}>
              {task.title}
            </p>
            {task.notes && (
              <p style={{
                fontSize: 14,
                color: 'var(--muted)',
                margin: '4px 0 0 0'
              }}>
                {task.notes}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: 12,
          padding: '16px 24px',
          background: 'var(--background)',
          borderTop: '1px solid var(--border)'
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 20px',
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--muted)',
              background: 'var(--card)',
              borderRadius: 0,
              border: '1px solid var(--border)',
              cursor: 'pointer',
              minHeight: 48
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 20px',
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--background)',
              background: 'var(--accent)',
              borderRadius: 0,
              border: 'none',
              cursor: 'pointer',
              minHeight: 48
            }}
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}