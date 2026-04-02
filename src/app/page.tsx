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
    // Sort alphabetically by title
    const sortedTodayTasks = [...todayTasks].sort((a, b) => 
      a.title.localeCompare(b.title)
    );
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
          setIsModalOpen(true);
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
  }, [isModalOpen, confirmCompleteTask, searchQuery, isSearchExpanded]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', transition: 'background 0.2s' }}>
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
            {searchQuery && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearchQuery('');
                }}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--muted-light)',
                  border: 'none',
                  borderRadius: 0,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <svg width="12" height="12" fill="none" stroke="var(--muted)" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setIsSearchExpanded(false);
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
              borderRadius: 0
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && isLoaded && (
        <CalendarView
          tasks={tasks}
          onDaySelect={handleDaySelect}
          isGistConfigured={isGistConfigured}
          isSyncing={isSyncing}
        />
      )}

      {/* Main Content */}
      {view === 'list' && (
      <main style={{ padding: isSearchExpanded ? '88px 24px 100px' : '24px 24px 100px', paddingTop: (isGistConfigured && isSyncing) ? (isSearchExpanded ? 108 : 44) : (isSearchExpanded ? 88 : 24) }}>
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
                  fontFamily: 'var(--font-display)'
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
            
            {incompleteTasks.length === 0 && completedTasks.length === 0 && searchQuery && (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ 
                  width: 100, 
                  height: 100, 
                  background: 'var(--accent-light)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <svg width="50" height="50" fill="none" stroke="var(--muted)" strokeWidth="1.5" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, fontFamily: 'var(--font-display)' }}>No Results</h3>
                <p style={{ color: 'var(--muted)', fontSize: 16 }}>
                  No tasks found for &ldquo;{searchQuery}&rdquo;
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    marginTop: 16,
                    padding: '10px 20px',
                    fontSize: 15,
                    fontWeight: 500,
                    color: 'var(--accent)',
                    background: 'var(--accent-light)',
                    border: 'none',
                    borderRadius: 0,
                    cursor: 'pointer'
                  }}
                >
                  Clear search
                </button>
              </div>
            )}
            
            {incompleteTasks.length === 0 && completedTasks.length === 0 && !searchQuery && (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ 
                  width: 100, 
                  height: 100, 
                  background: 'var(--accent-light)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <svg width="50" height="50" fill="none" stroke="var(--accent)" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, fontFamily: 'var(--font-display)' }}>All Done</h3>
                <p style={{ color: 'var(--muted)', fontSize: 16 }}>
                  No tasks yet. Tap + to add one.
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
                  fontFamily: 'var(--font-display)'
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

      {/* Footer */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: 'var(--background)',
        padding: '16px 24px 24px',
        transition: 'background 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderTop: '2px solid var(--border)'
      }}>
          {/* Actions (Left side) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Settings"
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted)',
                background: 'none',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                position: 'relative',
                padding: 0,
                borderRadius: 0
              }}
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {isGistConfigured && (
                <div style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 6,
                  height: 6,
                  background: 'var(--green)',
                }} />
              )}
            </button>

            {/* Calendar Toggle */}
            <button
              onClick={() => {
                setView(view === 'calendar' ? 'list' : 'calendar');
                if (view !== 'calendar') {
                  setIsSearchExpanded(false);
                  setSearchQuery('');
                  setSelectedDateFilter(null);
                }
              }}
              aria-label="Calendar view"
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: view === 'calendar' ? 'var(--accent)' : 'var(--muted)',
                background: 'none',
                border: view === 'calendar' ? '1px solid var(--accent)' : '1px solid var(--border)',
                cursor: 'pointer',
                borderRadius: 0,
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="0" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </button>

            {/* Search Toggle */}
            <button
              onClick={() => {
                if (view === 'calendar') setView('list');
                setSelectedDateFilter(null);
                setIsSearchExpanded(true);
              }}
              aria-label="Search tasks"
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: searchQuery ? 'var(--accent)' : 'var(--muted)',
                background: 'none',
                border: searchQuery ? '1px solid var(--accent)' : '1px solid var(--border)',
                cursor: 'pointer',
                borderRadius: 0,
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
            </button>
          </div>

          {/* Add Task Button (Right side) */}
          <button
            onClick={() => {
              if (selectedDateFilter) {
                setInitialDate(format(selectedDateFilter, 'yyyy-MM-dd'));
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
              color: 'var(--background)',
              background: 'var(--foreground)',
              border: 'none',
              borderRadius: 0,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-2px, -2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(0, 0)'}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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
            fontFamily: 'var(--font-display)'
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