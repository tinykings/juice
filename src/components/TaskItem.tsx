'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { format, isBefore, isToday, startOfDay, addDays } from 'date-fns';
import { Task } from '@/types/task';
import { useTasks } from '@/context/TaskContext';

interface TaskItemProps {
  task: Task;
  onComplete: () => void;
  onEdit: () => void;
  showDate?: boolean;
  isOverdue?: boolean;
  needsConfirmation?: boolean;
  onDelete: () => void;
}

export default function TaskItem({ 
  task, 
  onComplete, 
  onEdit,
  showDate,
  isOverdue: isOverdueProp,
  needsConfirmation = false,
  onDelete
}: TaskItemProps) {
  const { updateTask } = useTasks();
  const [isCompleting, setIsCompleting] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  
  const handleComplete = () => {
    if (needsConfirmation) {
      onComplete();
    } else {
      setIsCompleting(true);
      setTimeout(onComplete, 300);
    }
  };

  const handleReschedule = (date: Date) => {
    updateTask(task.id, { dueDate: date.toISOString() });
    setShowReschedule(false);
  };

  const taskDate = new Date(task.dueDate);
  const isOverdue = isOverdueProp || (isBefore(taskDate, startOfDay(new Date())) && !isToday(taskDate));

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div 
        onClick={onEdit}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          gap: 16,
          padding: '16px 0',
          borderBottom: '1px solid var(--border)',
          opacity: isCompleting ? 0.3 : 1,
          transition: 'opacity 0.15s, background 0.2s',
          background: 'var(--background)',
          userSelect: 'none',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleComplete();
          }}
          draggable={false}
          style={{ 
            flexShrink: 0, 
            marginTop: 4, 
            background: 'none', 
            border: 'none', 
            padding: 0,
            cursor: 'pointer',
            minWidth: 28,
            minHeight: 28
          }}
        >
          <div style={{
            width: 24,
            height: 24,
            borderRadius: 0,
            border: isCompleting ? 'none' : '2px solid var(--foreground)',
            background: isCompleting ? 'var(--accent)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            boxShadow: isCompleting ? 'none' : '4px 4px 0 var(--border)'
          }}>
            {isCompleting && (
              <svg width="16" height="16" fill="none" stroke="var(--background)" strokeWidth="3" viewBox="0 0 24 24">
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
                fontSize: 18, 
                lineHeight: 1.4,
                textDecoration: isCompleting ? 'line-through' : 'none',
                color: isCompleting ? 'var(--muted)' : isOverdue ? 'var(--red)' : 'var(--foreground)',
                fontWeight: isOverdue ? 600 : 400
              }}>
                {task.title}
              </p>
              {task.notes && (
                <p style={{ margin: '6px 0 2px', fontSize: 15, color: 'var(--muted)', lineHeight: 1.4 }}>{task.notes}</p>
              )}
              {task.isRecurring && (
                <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--accent)' }}>
                  ↻ {task.recurrenceType}
                </p>
              )}
            </div>
            
            {/* Date/Flag with Reschedule Popover */}
            {showDate && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnchorEl(e.currentTarget);
                    setShowReschedule(!showReschedule);
                  }}
                  style={{
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    padding: '4px 8px',
                    margin: '-4px 0 -4px -8px',
                    borderRadius: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.2s',
                    color: 'var(--foreground)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.color = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }}
                >
                  <span style={{ 
                    fontSize: 14, 
                    color: isOverdue ? 'var(--red)' : 'var(--foreground)',
                    whiteSpace: 'nowrap',
                    fontWeight: 500
                  }}>
                    {format(taskDate, 'M/d')}
                  </span>
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
  // Portal to body to avoid overflow clipping
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
        top: triggerRect.bottom + 4,
        left: Math.min(window.innerWidth - 190, Math.max(10, triggerRect.right - 180)),
        width: 180,
        background: 'var(--card)',
        borderRadius: 0,
        boxShadow: '8px 8px 0 rgba(0,0,0,0.15)',
        padding: 8,
        zIndex: 9999,
        border: '1px solid var(--foreground)'
      }}>
        <RescheduleOption label="Today" date={startOfDay(new Date())} onClick={onSelect} />
        <RescheduleOption label="Tomorrow" date={addDays(startOfDay(new Date()), 1)} onClick={onSelect} />
        {[2, 3, 4].map(daysToAdd => {
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
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(date);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: 14,
        color: 'var(--foreground)',
        borderRadius: 0,
        textAlign: 'left'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--foreground)';
        e.currentTarget.style.color = 'var(--background)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none';
        e.currentTarget.style.color = 'var(--foreground)';
      }}
    >
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ opacity: 0.7, fontSize: 12 }}>{format(date, 'EEE')}</span>
    </button>
  );
}