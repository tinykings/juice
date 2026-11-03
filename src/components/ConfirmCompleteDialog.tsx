'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Task } from '@/types/task';
import { parseTaskDate } from '@/utils/taskDate';
import { splitTaskTitle } from '@/utils/taskTitle';

export default function ConfirmCompleteDialog({
  task,
  onConfirm,
  onCancel,
  title = 'Complete this task?',
  message,
  confirmLabel = 'Complete',
  confirmTone = 'primary',
}: {
  task: Task;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  confirmTone?: 'primary' | 'danger';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog (Cancel for destructive actions) and give it
  // back to whatever had it when the dialog closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    (confirmTone === 'danger' ? cancelRef : confirmRef).current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [confirmTone]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
        return;
      }
      // Keep Tab cycling between the dialog's buttons.
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.body.style.overflow = '';
    };
  }, [onCancel]);

  const taskDate = task.dueDate ? parseTaskDate(task.dueDate) : null;
  const formattedDate = taskDate ? format(taskDate, 'EEEE, MMMM d, yyyy') : 'No date';
  const titleParts = splitTaskTitle(task.title);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-complete-title"
      style={{ position: 'fixed', inset: 0, zIndex: 100 }}
    >
      <div
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 14, 12, 0.72)',
          backdropFilter: 'blur(10px)',
        }}
      />

      <div ref={panelRef} style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        maxWidth: 440,
        margin: '0 auto',
        background: 'var(--card)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        animation: 'scaleIn 140ms ease-out both',
      }}>
        <div style={{ padding: '18px 18px 16px' }}>
          <h3
            id="confirm-complete-title"
            style={{
            fontSize: 19,
            fontWeight: 700,
            margin: '0 0 8px 0',
            color: 'var(--foreground)',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.25,
          }}>
            {title}
          </h3>
          <p style={{
            fontSize: 14,
            color: 'var(--muted)',
            margin: '0 0 14px 0',
            lineHeight: 1.45
          }}>
            {message ?? (
              <>
                This task is scheduled for <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{formattedDate}</strong>.
              </>
            )}
          </p>
          <div style={{
            background: 'var(--task-surface)',
            padding: '12px 14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <p style={{
              fontSize: 'var(--text-task-title)',
              fontWeight: 650,
              margin: 0,
              color: 'var(--foreground)',
              lineHeight: 1.35,
              overflowWrap: 'anywhere',
            }}>
              {titleParts.title}
            </p>
            {titleParts.note && (
              <p style={{
                fontSize: 'var(--text-body)',
                color: 'var(--muted)',
                margin: '5px 0 0 0',
                lineHeight: 1.45,
                overflowWrap: 'anywhere',
              }}>
                {titleParts.note}
              </p>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: 10,
          padding: '12px 18px 18px',
          background: 'var(--card)',
          borderTop: '1px solid var(--border)'
        }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '0 14px',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--muted)',
              background: 'var(--surface-inset)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              height: 42,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            className="hover-surface"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '0 14px',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--background)',
              background: confirmTone === 'danger' ? 'var(--red)' : 'var(--accent)',
              border: `1px solid ${confirmTone === 'danger' ? 'var(--red)' : 'var(--accent)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              height: 42,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            className="hover-fill-accent"
            data-tone={confirmTone}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
