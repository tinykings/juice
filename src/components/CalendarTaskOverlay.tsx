'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { TaskForm } from './TaskModal';
import { parseTaskDate } from '@/utils/taskDate';
import { Task } from '@/types/task';
import { getTaskDisplayTitle } from '@/utils/taskTitle';
import { formatTaskTime } from '@/utils/taskTime';
import { useModalFocus } from '@/hooks/useModalFocus';

export default function CalendarTaskOverlay({
  initialDate,
  isClosing,
  onClose,
  tasksForDay,
  onShowDay,
  dismissRef,
  formKey = 0,
}: {
  initialDate: string | null;
  isClosing: boolean;
  onClose: () => void;
  /** What's already on a day, listed above the form. */
  tasksForDay: (day: string) => Task[];
  /** Opens a day in the list, where its tasks can be edited and checked off. */
  onShowDay: (day: string) => void;
  /** Lets tapping away save what was typed. */
  dismissRef: React.RefObject<(() => void) | null>;
  /** Changes on each open, so reopening during the close animation starts with an empty form. */
  formKey?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalFocus(panelRef);

  // Follows the form: picking another date or typing "tomorrow" moves the header and list with it.
  const [changedDate, setChangedDate] = useState<string | null>(null);
  const handleDateChange = useCallback((date: string) => {
    setChangedDate(date === (initialDate ?? format(new Date(), 'yyyy-MM-dd')) ? null : date);
  }, [initialDate]);
  const day = changedDate ?? initialDate;
  const dayTasks = day ? tasksForDay(day) : [];
  const dateLabel = day === ''
    ? 'No date'
    : format(day ? parseTaskDate(day) : new Date(), 'EEEE, MMMM d');

  const showDay = () => {
    if (!day) return;
    dismissRef.current?.();
    onShowDay(day);
  };

  const [visualViewport, setVisualViewport] = useState<{ height: number; offsetTop: number } | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateViewport = () => {
      setVisualViewport({ height: viewport.height, offsetTop: viewport.offsetTop });
    };

    updateViewport();
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);
    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
    };
  }, []);

  return createPortal(
    <div
      data-task-inline-portal="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-task-title"
      className="calendar-task-overlay"
      style={{
        position: 'fixed',
        inset: visualViewport ? undefined : 0,
        top: visualViewport?.offsetTop,
        right: visualViewport ? 0 : undefined,
        left: visualViewport ? 0 : undefined,
        height: visualViewport?.height,
        boxSizing: 'border-box',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        // While closing, let clicks through to what's underneath (like the add button).
        pointerEvents: isClosing ? 'none' : undefined,
        padding: 'max(8px, env(safe-area-inset-top, 0px)) 16px 16px',
        animation: isClosing ? 'fadeOut 180ms ease-in forwards' : 'fadeIn 140ms ease-out both',
      }}
    >
      <button
        type="button"
        aria-label="Close add task"
        onClick={() => dismissRef.current?.()}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(8, 7, 6, 0.84)',
          backdropFilter: 'blur(8px)',
          cursor: 'default',
        }}
      />

      <div ref={panelRef} tabIndex={-1} style={{
        position: 'relative',
        outline: 'none',
        width: 'min(100%, 560px)',
        maxHeight: '100%',
        overflowY: 'auto',
        background: 'var(--task-surface)',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        animation: isClosing
          ? 'calendarTaskClose 180ms ease-in forwards'
          : 'calendarTaskOpen 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px 0',
        }}>
          <div>
            <h2 id="calendar-task-title" style={{ fontSize: 18, color: 'var(--foreground)' }}>
              Add task
            </h2>
            <div style={{ marginTop: 2, fontSize: 13, color: 'var(--muted)' }}>{dateLabel}</div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {dayTasks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px 0' }}>
            {dayTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={showDay}
                title="Show this day in the list"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 10px',
                  border: `1px ${task.isRecurrencePreview ? 'dashed' : 'solid'} var(--border)`,
                  boxShadow: task.isCalendarEvent ? 'inset 3px 0 0 var(--event)' : undefined,
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: 'var(--foreground)',
                  opacity: task.isRecurrencePreview ? 0.6 : 1,
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {getTaskDisplayTitle(task)}
                {task.isCalendarEvent ? (
                  <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                    {' · '}{task.eventTime ?? 'All day'}
                  </span>
                ) : formatTaskTime(task.title) && (
                  <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                    {' · '}{formatTaskTime(task.title)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        <TaskForm key={formKey} initialDate={initialDate} onClose={onClose} onDateChange={handleDateChange} dismissRef={dismissRef} isClosing={isClosing} />
      </div>
    </div>,
    document.body
  );
}
