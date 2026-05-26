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

  const allTodayTasksCompleted = useMemo(() => {
    const today = startOfDay(currentDate);
    const todayTasks = tasks.filter(t => isSameDay(new Date(t.dueDate), today));
    const hasTodayTasks = todayTasks.length > 0;
    const allCompleted = todayTasks.every(t => t.completed);
    return hasTodayTasks && allCompleted;
  }, [tasks, currentDate]);

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
    <div style={{ minHeight: '100vh', background: 'var(--background)', transition: 'background 0.2s', maxWidth: (isWideScreen || showSplitView) ? 'none' : 600, margin: '0 auto', display: 'flex', flexDirection: showSplitView ? 'row' : 'column', height: '100vh' }}>
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
            padding: '16px 20px',
            borderRadius: 16,
            background: 'rgba(28, 28, 28, 0.88)',
            color: '#ECECEB',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.28)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.2,
          }}>
            Syncing tasks from Gist...
          </div>
        </div>
      )}

      {/* Top Right Buttons - Full Width View */}
      {showSplitView && (
        <div style={{
          position: 'fixed',
          top: 16,
          right: 24,
          zIndex: 25,
          display: 'flex',
          gap: 8,
        }}>
          <button
            onClick={() => setIsSearchExpanded(true)}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-inset)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--highlight)';
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-inset)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--muted)';
            }}
            aria-label="Search"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-inset)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--highlight)';
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-inset)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--muted)';
            }}
            aria-label="Settings"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
          <button
            onClick={() => {
              if (selectedDateFilter) {
                setInitialDate(format(selectedDateFilter, 'yyyy-MM-dd'));
              } else {
                setInitialDate(null);
              }
              setIsModalOpen(true);
            }}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-inset)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--foreground)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--highlight)';
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-inset)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--foreground)';
            }}
            aria-label="Add task"
            title="New (n)"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
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
          paddingRight: showSplitView ? 164 : 24,
          borderBottom: '2px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
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
        padding: isSearchExpanded ? '88px 24px 24px' : '24px 24px 24px', 
        overflow: 'auto',
        minHeight: 0,
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
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
Back
          </button>
        )}
        {/* Empty / All-done State */}
        {isLoaded && (
          <div>
            {(incompleteTasks.length === 0 || (allTodayTasksCompleted && !selectedDateFilter)) && (
              <div style={{
                textAlign: 'center',
                padding: showSplitView ? '60px 24px' : '40px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16
              }}>
                {/* Journal illustration */}
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ opacity: 0.6, marginBottom: 8 }}>
                  <rect x="10" y="8" width="60" height="64" rx="2" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5"/>
                  <line x1="10" y1="28" x2="70" y2="28" stroke="var(--border)" strokeWidth="1.5"/>
                  <line x1="10" y1="44" x2="60" y2="44" stroke="var(--border)" strokeWidth="1.5"/>
                  <line x1="10" y1="56" x2="50" y2="56" stroke="var(--border)" strokeWidth="1.5"/>
                  <line x1="10" y1="20" x2="40" y2="20" stroke="var(--accent-subtle)" strokeWidth="2"/>
                </svg>

                {hasNoTasks ? (
                  <>
                    <h2 style={{
                      fontSize: 20,
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      margin: 0,
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '-0.02em'
                    }}>
                      You have nothing to do
                    </h2>
                    <p style={{
                      fontSize: 15,
                      color: 'var(--muted)',
                      margin: 0,
                      lineHeight: 1.6,
                      maxWidth: 280
                    }}>
                      Tap the + button below to add your first task.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 style={{
                      fontSize: 20,
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      margin: 0,
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '-0.02em'
                    }}>
                      All done for now
                    </h2>
                    <p style={{
                      fontSize: 15,
                      color: 'var(--muted)',
                      margin: 0,
                      lineHeight: 1.6,
                      maxWidth: 280
                    }}>
                      Nothing left to do. Add another task or check tomorrow's.
                    </p>
                  </>
                )}

                {tomorrowTasks.length > 0 && (
                  <div style={{
                    marginTop: 8,
                    padding: '12px 20px',
                    background: 'var(--surface-inset)',
                    borderRadius: 8,
                    textAlign: 'center' as const,
                    color: 'var(--foreground)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    maxWidth: 300,
                    border: '1px solid var(--border)'
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      {tomorrowTasks.length}
                    </span>
                    {' '}task{tomorrowTasks.length !== 1 ? 's' : ''} tomorrow
                  </div>
                )}
              </div>
            )}
            {allTodayTasksCompleted && completedTasks.length > 0 && !selectedDateFilter && (
              <section style={{ marginBottom: 32 }}>
                <div style={{ borderTop: '2px solid var(--border)' }}>
                  {completedTasks.map((task) => (
                    <CompletedTaskItem key={task.id} task={task} onUncomplete={() => uncompleteTask(task.id)} />
                  ))}
                </div>
              </section>
            )}
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

                {/* Completed Section - shown after Today group */}
                {group.isToday && completedTasks.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ borderTop: '2px solid var(--border)' }}>
                      {completedTasks.map((task) => (
                        <CompletedTaskItem key={task.id} task={task} onUncomplete={() => uncompleteTask(task.id)} />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>
)}
      </main>
)}

{/* Bottom Action Buttons - Hidden in full width view */}
{!showSplitView && (
      <footer style={{
        zIndex: 10,
        background: 'var(--background)',
        padding: '0 24px 24px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        borderTop: '1px solid var(--border)',
      }}>
          {/* Toggle Calendar/List Button */}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-subtle)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface-inset)';
                e.currentTarget.style.color = 'var(--foreground)';
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
            >
              {view === 'list' ? (
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
              ) : (
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              )}
            </button>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearchClick}
            style={{
              width: 48,
              height: 60,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'none',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
            aria-label="Search"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-subtle)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--muted)';
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Find</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              width: 48,
              height: 60,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'none',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
            aria-label="Settings"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-subtle)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--muted)';
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Set</span>
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-subtle)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-inset)';
              e.currentTarget.style.color = 'var(--foreground)';
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
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


