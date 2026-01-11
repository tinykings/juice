'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, isBefore, isToday, startOfDay, addDays, nextMonday } from 'date-fns';
import { motion, PanInfo, useAnimation } from 'framer-motion';
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
  
  // Framer motion controls
  const controls = useAnimation();
  const [dragDirection, setDragDirection] = useState<'none' | 'left' | 'right'>('none');

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

  // Handle drag end for swipe actions
  const handleDragEndMotion = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offset = info.offset.x;
    const threshold = 100;

    if (offset > threshold) {
      // Swipe Right -> Complete
      setIsCompleting(true);
      await controls.start({ x: 500, opacity: 0 });
      onComplete();
    } else if (offset < -threshold) {
      // Swipe Left -> Delete
      await controls.start({ x: -500, opacity: 0 });
      onDelete();
    } else {
      // Reset
      controls.start({ x: 0 });
    }
    setDragDirection('none');
  };

  const handleDragMotion = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 0) setDragDirection('right');
    else if (info.offset.x < 0) setDragDirection('left');
    else setDragDirection('none');
  };

  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background Actions */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 0
      }}>
        {/* Complete Action (Left side, visible when swiping right) */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          color: 'var(--green)',
          opacity: dragDirection === 'right' ? 1 : 0,
          transition: 'opacity 0.2s'
        }}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M5 12l5 5L20 7" />
          </svg>
          <span style={{ fontWeight: 600 }}>Complete</span>
        </div>

        {/* Delete Action (Right side, visible when swiping left) */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          color: 'var(--red)',
          opacity: dragDirection === 'left' ? 1 : 0,
          transition: 'opacity 0.2s'
        }}>
          <span style={{ fontWeight: 600 }}>Delete</span>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
      </div>

      {/* Foreground Content */}
      <motion.div 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={handleDragEndMotion}
        onDrag={handleDragMotion}
        animate={controls}
        whileTap={{ cursor: 'grabbing' }}
        style={{
          background: 'var(--background)',
          position: 'relative',
          zIndex: 1,
          touchAction: 'pan-y' // Allow vertical scrolling
        }}
      >
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
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: isCompleting ? 'none' : '2.5px solid var(--muted-light)',
              background: isCompleting ? 'var(--accent)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}>
              {isCompleting && (
                <svg width="16" height="16" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
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
                  fontWeight: isOverdue ? 500 : 400
                }}>
                  {task.title}
                </p>
                {task.notes && (
                  <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--muted)', lineHeight: 1.4 }}>{task.notes}</p>
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
                    ref={buttonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReschedule(!showReschedule);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px 8px',
                      margin: '-4px -8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ 
                      fontSize: 14, 
                      color: isOverdue ? 'var(--red)' : 'var(--muted)',
                      whiteSpace: 'nowrap'
                    }}>
                      {format(taskDate, 'MMM d')}
                    </span>
                  </button>

                  {showReschedule && buttonRef.current && (
                    <RescheduleMenu
                      triggerRect={buttonRef.current.getBoundingClientRect()}
                      onClose={() => setShowReschedule(false)}
                      onSelect={handleReschedule}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RescheduleMenu({ 
  triggerRect, 
  onClose, 
  onSelect 
}: { 
  triggerRect: DOMRect; 
  onClose: () => void; 
  onSelect: (date: Date) => void; 
}) {
  // Portal to body to avoid overflow clipping
  if (typeof document === 'undefined') return null;

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
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: 8,
        zIndex: 9999,
        border: '1px solid var(--border)'
      }}>
        <RescheduleOption label="Today" date={startOfDay(new Date())} onClick={onSelect} />
        <RescheduleOption label="Tomorrow" date={addDays(startOfDay(new Date()), 1)} onClick={onSelect} />
        <RescheduleOption label="Next Week" date={nextMonday(startOfDay(new Date()))} onClick={onSelect} />
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
        borderRadius: 8,
        textAlign: 'left'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
    >
      <span>{label}</span>
      <span style={{ color: 'var(--muted)', fontSize: 12 }}>{format(date, 'EEE')}</span>
    </button>
  );
}