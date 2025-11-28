'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { format, isToday, addDays, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from 'date-fns';
import { useTasks } from '@/context/TaskContext';
import { useTheme } from '@/context/ThemeContext';
import { useSettings } from '@/context/SettingsContext';
import { Task } from '@/types/task';
import TaskModal from '@/components/TaskModal';
import SettingsModal from '@/components/SettingsModal';

interface TaskGroup {
  label: string;
  tasks: Task[];
  isToday?: boolean;
  date?: Date;
  dropTarget?: boolean;
}

export default function HomePage() {
  const { tasks, completeTask, uncompleteTask, updateTask, getCompletedTasks, isLoaded } = useTasks();
  const { theme, toggleTheme } = useTheme();
  const { isGistConfigured } = useSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const draggedTaskIdRef = useRef<string | null>(null);

  // Get all incomplete tasks
  const incompleteTasks = useMemo(() => {
    return tasks.filter(t => !t.completed).sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  }, [tasks]);

  // Get completed tasks
  const completedTasks = getCompletedTasks();

  // Group tasks by day (for this week) and month (for later)
  const groupedTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const weekEnd = endOfDay(addDays(today, 7));
    
    const groups: TaskGroup[] = [];
    
    // Today's tasks (always show as drop target)
    const todayTasks = incompleteTasks.filter(t => {
      const d = new Date(t.dueDate);
      return isToday(d) || isBefore(d, today);
    });
    groups.push({ label: 'Today', tasks: todayTasks, isToday: true, date: today, dropTarget: true });

    // Next 7 days (by day of week) - always show as drop targets
    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i);
      const dayTasks = incompleteTasks.filter(t => isSameDay(new Date(t.dueDate), date));
      const label = i === 1 ? 'Tomorrow' : format(date, 'EEEE');
      groups.push({ label, tasks: dayTasks, date, dropTarget: true });
    }

    // Beyond this week - group by month (not drop targets)
    const futureTasks = incompleteTasks.filter(t => isAfter(new Date(t.dueDate), weekEnd));
    const monthGroups: { [key: string]: Task[] } = {};
    
    futureTasks.forEach(task => {
      const monthKey = format(new Date(task.dueDate), 'MMMM yyyy');
      if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
      monthGroups[monthKey].push(task);
    });

    Object.entries(monthGroups).forEach(([month, monthTasks]) => {
      groups.push({ label: month, tasks: monthTasks, dropTarget: false });
    });

    return groups;
  }, [incompleteTasks]);

  // Filter to only show groups with tasks or that are drop targets during drag
  const visibleGroups = useMemo(() => {
    if (isDragging) {
      // During drag, show all week days as potential drop targets
      return groupedTasks.filter(g => g.tasks.length > 0 || g.dropTarget);
    }
    return groupedTasks.filter(g => g.tasks.length > 0);
  }, [groupedTasks, isDragging]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    draggedTaskIdRef.current = taskId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    // Use setTimeout to allow the drag image to be captured before changing state
    setTimeout(() => setIsDragging(true), 0);
  };

  const handleDragEnd = () => {
    draggedTaskIdRef.current = null;
    setIsDragging(false);
    setDragOverGroup(null);
  };

  const handleDragOver = (e: React.DragEvent, groupLabel: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroup(groupLabel);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the drop zone (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverGroup(null);
    }
  };

  const handleDrop = (e: React.DragEvent, group: TaskGroup) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskIdRef.current;
    
    if (taskId && group.date) {
      updateTask(taskId, {
        dueDate: group.date.toISOString()
      });
    }
    
    draggedTaskIdRef.current = null;
    setIsDragging(false);
    setDragOverGroup(null);
  };

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
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', transition: 'background 0.2s' }}>
      {/* Header */}
      <header style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 10, 
        background: 'var(--background)', 
        padding: '16px 20px',
        transition: 'background 0.2s'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Juice</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              style={{ 
                width: 32, 
                height: 32, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'var(--accent)', 
                background: 'none', 
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {theme === 'dark' ? (
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                </svg>
              ) : (
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              )}
            </button>
            {/* Settings Button */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              style={{ 
                width: 32, 
                height: 32, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'var(--muted)', 
                background: 'none', 
                border: 'none',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {isGistConfigured && (
                <div style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--green)',
                }} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ padding: '0 20px 96px' }}>
        {/* Task Groups */}
        {isLoaded && (
          <div>
            {visibleGroups.map((group) => (
              <section 
                key={group.label} 
                style={{ marginBottom: 24 }}
                onDragOver={group.dropTarget ? (e) => handleDragOver(e, group.label) : undefined}
                onDragLeave={group.dropTarget ? handleDragLeave : undefined}
                onDrop={group.dropTarget ? (e) => handleDrop(e, group) : undefined}
              >
                <h2 style={{ 
                  fontSize: 13, 
                  fontWeight: 600, 
                  color: group.isToday ? 'var(--foreground)' : 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 8
                }}>
                  {group.label}
                </h2>
                <div style={{ 
                  borderTop: '1px solid var(--border)',
                  background: dragOverGroup === group.label ? 'var(--accent-light)' : 'transparent',
                  borderRadius: dragOverGroup === group.label ? 8 : 0,
                  transition: 'background 0.15s',
                  minHeight: group.tasks.length === 0 && isDragging ? 60 : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: group.tasks.length === 0 ? 'center' : 'flex-start',
                  alignItems: group.tasks.length === 0 ? 'center' : 'stretch'
                }}>
                  {group.tasks.length === 0 && isDragging && group.dropTarget && (
                    <p style={{ color: 'var(--muted)', fontSize: 13 }}>Drop here</p>
                  )}
                  {group.tasks.map((task) => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      onComplete={() => completeTask(task.id)}
                      onEdit={() => {
                        setEditingTask(task);
                        setIsModalOpen(true);
                      }}
                      showDate={!group.isToday && !group.dropTarget}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      isDragging={isDragging && draggedTaskIdRef.current === task.id}
                    />
                  ))}
                </div>
              </section>
            ))}
            
            {incompleteTasks.length === 0 && completedTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  background: 'var(--accent-light)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <svg width="40" height="40" fill="none" stroke="var(--accent)" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>All Done</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                  No tasks yet. Tap + to add one.
          </p>
        </div>
            )}

            {/* Completed Section */}
            {completedTasks.length > 0 && (
              <section style={{ marginTop: 40 }}>
                <h2 style={{ 
                  fontSize: 13, 
                  fontWeight: 600, 
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 8
                }}>
                  Completed (30 days)
                </h2>
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {completedTasks.map((task) => (
                    <CompletedTaskItem key={task.id} task={task} onUncomplete={() => uncompleteTask(task.id)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Floating Add Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          background: 'var(--accent)',
          borderRadius: '50%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          zIndex: 20
        }}
      >
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        editTask={editingTask}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

function TaskItem({ 
  task, 
  onComplete, 
  onEdit,
  showDate,
  onDragStart,
  onDragEnd,
  isDragging
}: { 
  task: Task; 
  onComplete: () => void; 
  onEdit: () => void;
  showDate?: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = () => {
    setIsCompleting(true);
    setTimeout(onComplete, 300);
  };

  const taskDate = new Date(task.dueDate);
  const isOverdue = isBefore(taskDate, startOfDay(new Date())) && !isToday(taskDate);

  return (
    <div 
      draggable={true}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
        opacity: isCompleting ? 0.3 : isDragging ? 0.5 : 1,
        transition: 'opacity 0.15s',
        cursor: 'grab',
        background: 'var(--background)',
        userSelect: 'none'
      }}
    >
      {/* Drag Handle */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        color: 'var(--muted-light)',
        cursor: 'grab',
        marginTop: 4,
        touchAction: 'none'
      }}>
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5"/>
          <circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/>
          <circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/>
          <circle cx="15" cy="18" r="1.5"/>
        </svg>
      </div>

      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleComplete();
        }}
        draggable={false}
        style={{ 
          flexShrink: 0, 
          marginTop: 2, 
          background: 'none', 
          border: 'none', 
          padding: 0,
          cursor: 'pointer'
        }}
      >
        <div style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: isCompleting ? 'none' : '2px solid var(--muted-light)',
          background: isCompleting ? 'var(--accent)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s'
        }}>
          {isCompleting && (
            <svg width="12" height="12" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
              <path d="M5 12l5 5L20 7" />
            </svg>
          )}
        </div>
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }} draggable={false}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{ 
              margin: 0, 
              fontSize: 16, 
              textDecoration: isCompleting ? 'line-through' : 'none',
              color: isCompleting ? 'var(--muted)' : 'var(--foreground)'
            }}>
              {task.title}
            </p>
            {task.notes && (
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>{task.notes}</p>
            )}
            {task.isRecurring && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--accent)' }}>
                ↻ {task.recurrenceType}
              </p>
            )}
          </div>
          
          {/* Date/Flag */}
          {showDate && (
            <span style={{ 
              fontSize: 12, 
              color: isOverdue ? 'var(--red)' : 'var(--muted)',
              flexShrink: 0
            }}>
              {format(taskDate, 'MMM d')}
            </span>
          )}
        </div>
      </div>
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
      gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
      opacity: isUncompleting ? 0.3 : 1,
      transition: 'opacity 0.15s',
    }}>
      {/* Completed checkmark - clickable to uncomplete */}
      <button
        onClick={handleUncomplete}
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: isUncompleting ? 'transparent' : 'var(--green)',
          border: isUncompleting ? '2px solid var(--muted-light)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
          marginLeft: 28, // Align with task items that have drag handle
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.2s'
        }}
      >
        {!isUncompleting && (
          <svg width="12" height="12" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ 
          margin: 0, 
          fontSize: 16, 
          textDecoration: isUncompleting ? 'none' : 'line-through',
          color: isUncompleting ? 'var(--foreground)' : 'var(--muted)',
          transition: 'all 0.2s'
        }}>
          {task.title}
        </p>
        {task.completedAt && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            {format(new Date(task.completedAt), 'MMM d, h:mm a')}
          </p>
        )}
      </div>
    </div>
  );
}
