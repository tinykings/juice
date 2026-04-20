'use client';

import { useState, useEffect } from 'react';
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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  const taskDate = new Date(task.dueDate);
  const isOverdue = isOverdueProp || (isBefore(taskDate, startOfDay(new Date())) && !isToday(taskDate));

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

  const handleComplete = () => {
    if (needsConfirmation) {
      onComplete();
    } else {
      setIsCompleting(true);
      setTimeout(onComplete, 250);
    }
  };

  const handleReschedule = (date: Date) => {
    updateTask(task.id, { dueDate: date.toISOString() });
    setShowReschedule(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div 
        onClick={onEdit}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 16,
          padding: '16px 0',
          borderBottom: '1px solid var(--border)',
          opacity: isCompleting ? 0 : 1,
          transform: isCompleting ? 'translateX(-8px)' : 'translateX(0)',
          transition: 'opacity 0.25s ease, transform 0.25s ease, background 0.2s',
          background: isHovered ? 'var(--surface-inset)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleComplete();
          }}
          style={{ 
            flexShrink: 0,
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: `2px solid ${isOverdue ? 'var(--red)' : 'var(--border)'}`,
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.2s ease',
          }}
        >
          {isCompleting && (
            <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M5 12l5 5L20 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ 
                  margin: 0, 
                  fontSize: 16, 
                  fontWeight: 500,
                  lineHeight: 1.4,
                  color: isOverdue ? 'var(--red)' : 'var(--foreground)',
                  transition: 'color 0.2s',
                }}>
                  {displayTitle || task.title}
                </p>
              {task.notes && (
                <p style={{ 
                  margin: '4px 0 0', 
                  fontSize: 14, 
                  color: 'var(--muted)', 
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%'
                }}>
                  {task.notes}
                </p>
              )}
              {(task.isRecurring || taskTime) && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  margin: '6px 0 0',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--accent)',
                }}>
                  {task.isRecurring && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
                      </svg>
                      {task.recurrenceType}
                    </span>
                  )}
                  {taskTime && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            {showDate && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnchorEl(e.currentTarget);
                    setShowReschedule(!showReschedule);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: isOverdue ? 'var(--red)' : 'var(--muted)',
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'color 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isToday(taskDate) ? 'Today' : format(taskDate, 'MMM d')}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        borderRadius: 8,
        boxShadow: 'var(--shadow-lg)',
        padding: 6,
        zIndex: 9999,
        border: '1px solid var(--border)',
        animation: 'scaleIn 0.15s ease',
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
        background: isHovered ? 'var(--accent-subtle)' : 'transparent',
        cursor: 'pointer',
        fontSize: 14,
        color: 'var(--foreground)',
        borderRadius: 6,
        textAlign: 'left',
        transition: 'background 0.15s ease',
      }}
    >
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ opacity: 0.6, fontSize: 12 }}>{format(date, 'MMM d')}</span>
    </button>
  );
}