'use client';

import { useEffect } from 'react';
import { format } from 'date-fns';
import { Task } from '@/types/task';
import { splitTaskTitle } from '@/utils/taskTitle';

export default function ConfirmCompleteDialog({
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

  const taskDate = task.dueDate ? new Date(task.dueDate) : null;
  const formattedDate = taskDate ? format(taskDate, 'EEEE, MMMM d, yyyy') : 'Someday';
  const titleParts = splitTaskTitle(task.title);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
        }}
      />

      <div style={{
        position: 'absolute',
        left: 20,
        right: 20,
        top: '50%',
        transform: 'translateY(-50%)',
        maxWidth: 400,
        margin: '0 auto',
        background: 'var(--card)',
        boxShadow: '12px 12px 0 rgba(0,0,0,0.2)',
        overflow: 'hidden',
        border: '2px solid var(--border)',
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
              {titleParts.title}
            </p>
            {titleParts.note && (
              <p style={{
                fontSize: 14,
                color: 'var(--muted)',
                margin: '4px 0 0 0'
              }}>
                {titleParts.note}
              </p>
            )}
          </div>
        </div>

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
              border: '2px solid var(--border)',
              cursor: 'pointer',
              minHeight: 48,
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
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
              border: '2px solid var(--accent)',
              cursor: 'pointer',
              minHeight: 48,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-surface)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}
