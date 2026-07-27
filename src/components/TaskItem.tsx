'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { format, isBefore, isToday, startOfDay, addDays } from 'date-fns';
import { Task } from '@/types/task';
import { useTasks } from '@/context/TaskContext';
import { splitTaskTitle } from '@/utils/taskTitle';
import { formatTaskDate, parseTaskDate } from '@/utils/taskDate';

interface TaskItemProps {
  task: Task;
  onComplete: () => void;
  onEdit: () => void;
  showDate?: boolean;
  isOverdue?: boolean;
  needsConfirmation?: boolean;
}

export default function TaskItem({ 
  task, 
  onComplete, 
  onEdit,
  showDate,
  isOverdue: isOverdueProp,
  needsConfirmation = false
}: TaskItemProps) {
  const { updateTask } = useTasks();
  const [isCompleting, setIsCompleting] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isCheckboxHovered, setIsCheckboxHovered] = useState(false);
  
  const isSomeday = !task.dueDate;
  const taskDate = isSomeday ? null : parseTaskDate(task.dueDate);
  const isOverdue = isOverdueProp || (taskDate ? isBefore(taskDate, startOfDay(new Date())) && !isToday(taskDate) : false);

  // Extract time from @pattern - handles @1, @1pm, @130, @530, @2:30, @5pm
  const timeMatch = task.title.match(/@(\d+(?::\d{2})?(?:pm|am)?)/i);
  const rawTime = timeMatch ? timeMatch[0].replace('@', '').trim() : null;
  
  // Format time display
  let taskTime: string | null = null;
  if (rawTime) {
    if (rawTime.includes(':')) {
      taskTime = rawTime.toLowerCase();
    } else if (rawTime.includes('pm') || rawTime.includes('am')) {
      taskTime = rawTime.toLowerCase();
    } else {
      const num = parseInt(rawTime, 10);
      if (num >= 100) {
        taskTime = `${Math.floor(num / 100)}:${(num % 100).toString().padStart(2, '0')}`;
      } else if (num > 0 && num <= 12) {
        taskTime = `${num}:00`;
      }
    }
  }
  
  const displayTitle = task.title.replace(/@(\d+(?::\d{2})?(?:pm|am)?)/gi, '').trim();
  const titleParts = splitTaskTitle(displayTitle || task.title);

  const handleComplete = () => {
    if (isCompleting) return;

    if (needsConfirmation) {
      onComplete();
    } else {
      setIsCompleting(true);
      setTimeout(onComplete, 250);
    }
  };

  const handleReschedule = (date: Date) => {
    updateTask(task.id, { dueDate: formatTaskDate(date) });
    setShowReschedule(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div 
        data-task-card="true"
        onClick={onEdit}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'grid',
          gridTemplateColumns: '38px minmax(0, 1fr)',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          columnGap: 12,
          padding: '13px 14px 13px 12px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          opacity: isCompleting ? 0.3 : 1,
          transform: isCompleting ? 'translateX(-6px)' : 'translateX(0)',
          transition: 'opacity 0.18s ease, background 0.15s ease, border-color 0.15s ease, transform 0.18s ease, box-shadow 0.15s ease',
          background: isHovered ? 'var(--task-surface-hover)' : 'var(--task-surface)',
          boxShadow: isHovered ? '0 0 0 1px rgba(255, 255, 255, 0.02)' : 'none',
          cursor: 'pointer',
        }}
      >
        {/* Checkbox */}
        <button
          data-task-checkbox="true"
          disabled={isCompleting}
          onClick={(e) => {
            e.stopPropagation();
            handleComplete();
          }}
          onMouseEnter={() => setIsCheckboxHovered(true)}
          onMouseLeave={() => setIsCheckboxHovered(false)}
          style={{ 
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isCompleting ? 'default' : 'pointer',
            background: 'none',
            border: 'none',
            padding: 4,
            marginTop: 0,
            transition: 'all 0.2s ease',
          }}
          aria-label="Complete task"
        >
          <div style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isCompleting ? (isOverdue ? 'var(--red)' : 'var(--accent)') : (isCheckboxHovered ? 'var(--surface-hover)' : 'var(--surface-inset)'),
            border: `1px solid ${isOverdue ? 'var(--red)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
            boxShadow: isCheckboxHovered ? '0 0 0 3px rgba(255, 255, 255, 0.025)' : 'none',
          }}>
            {isCompleting && (
              <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12l5 5L20 7" strokeDasharray="20" style={{ animation: 'checkmark 0.25s ease-out forwards' }} />
              </svg>
            )}
          </div>
        </button>

        {/* Content */}
        <div style={{ minWidth: 0, paddingTop: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: showDate && !isSomeday ? 'minmax(0, 1fr) auto' : '1fr', alignItems: 'start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ 
                  margin: 0, 
                  fontSize: 'var(--text-task-title)', 
                  fontWeight: 650,
                  lineHeight: 1.35,
                  color: isOverdue ? 'var(--red)' : 'var(--foreground)',
                  transition: 'color 0.2s',
                  overflowWrap: 'anywhere',
                }}>
                  {titleParts.title}
                </p>
                {titleParts.note && (
                  <p style={{ 
                    margin: '5px 0 0', 
                  fontSize: 'var(--text-body)', 
                    color: 'var(--muted)', 
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    maxWidth: '100%'
                  }}>
                    {titleParts.note}
                  </p>
                )}
              {(task.isRecurring || taskTime) && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  margin: '8px 0 0',
                  fontSize: 'var(--text-meta)',
                  fontWeight: 500,
                  color: 'var(--muted)',
                }}>
                  {task.isRecurring && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
                      </svg>
                      {task.recurrenceType}
                    </span>
                  )}
                  {taskTime && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                      </svg>
                      {taskTime}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Date indicator */}
            {showDate && !isSomeday && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnchorEl(e.currentTarget);
                    setShowReschedule(!showReschedule);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent)';
                    e.currentTarget.style.backgroundColor = 'var(--accent-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = isOverdue ? 'var(--red)' : 'var(--muted)';
                    e.currentTarget.style.backgroundColor = 'var(--surface-inset)';
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    width: 32,
                    height: 32,
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    color: isOverdue ? 'var(--red)' : 'var(--muted)',
                    fontSize: 'var(--text-meta)',
                    fontWeight: 500,
                    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  aria-label={`Reschedule ${taskDate && isToday(taskDate) ? 'Today' : format(taskDate!, 'MMM d')}`}
                  title="Reschedule"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {showReschedule && anchorEl && (
                  <RescheduleMenu
                    anchorEl={anchorEl}
                    onClose={() => setShowReschedule(false)}
                    onSelect={handleReschedule}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RescheduleMenu({ 
  anchorEl, 
  onClose, 
  onSelect 
}: { 
  anchorEl: HTMLElement; 
  onClose: () => void; 
  onSelect: (date: Date) => void; 
}) {
  if (typeof document === 'undefined') return null;

  const triggerRect = anchorEl.getBoundingClientRect();

  return createPortal(
    <>
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }} 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div style={{
        position: 'fixed',
        top: triggerRect.bottom + 8,
        left: Math.min(window.innerWidth - 180, Math.max(16, triggerRect.left - 80)),
        width: 160,
        background: 'var(--card)',
        boxShadow: 'var(--shadow-lg)',
        padding: 6,
        zIndex: 9999,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <RescheduleOption label="Today" date={startOfDay(new Date())} onClick={onSelect} />
        <RescheduleOption label="Tomorrow" date={addDays(startOfDay(new Date()), 1)} onClick={onSelect} />
        {[2, 3, 4, 5].map(daysToAdd => {
          const date = addDays(startOfDay(new Date()), daysToAdd);
          return (
            <RescheduleOption 
              key={daysToAdd}
              label={format(date, 'EEEE')} 
              date={date} 
              onClick={onSelect} 
            />
          );
        })}
      </div>
    </>,
    document.body
  );
}

function RescheduleOption({ label, date, onClick }: { label: string; date: Date; onClick: (d: Date) => void }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(date);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '10px 12px',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        background: isHovered ? 'var(--surface-hover)' : 'transparent',
        cursor: 'pointer',
        fontSize: 14,
        color: 'var(--foreground)',
        textAlign: 'left',
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ opacity: 0.6, fontSize: 12 }}>{format(date, 'MMM d')}</span>
    </button>
  );
}
