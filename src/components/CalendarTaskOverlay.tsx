'use client';

import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { TaskForm } from './TaskModal';
import { parseTaskDate } from '@/utils/taskDate';

export default function CalendarTaskOverlay({
  initialDate,
  isClosing,
  onClose,
}: {
  initialDate: string | null;
  isClosing: boolean;
  onClose: () => void;
}) {
  const dateLabel = initialDate === ''
    ? 'Someday'
    : format(initialDate ? parseTaskDate(initialDate) : new Date(), 'EEEE, MMMM d');

  return createPortal(
    <div
      data-task-inline-portal="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-task-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: isClosing ? 'fadeOut 180ms ease-in forwards' : 'fadeIn 140ms ease-out both',
      }}
    >
      <button
        type="button"
        aria-label="Close add task"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 14, 12, 0.68)',
          backdropFilter: 'blur(8px)',
          cursor: 'default',
        }}
      />

      <div style={{
        position: 'relative',
        width: 'min(100%, 560px)',
        maxHeight: 'calc(100dvh - 32px)',
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
        <TaskForm initialDate={initialDate} onClose={onClose} />
      </div>
    </div>,
    document.body
  );
}
