'use client';

import { Task } from '@/types/task';

/** Read-only row for an event from the subscribed calendar. */
export default function CalendarEventItem({ task }: { task: Task }) {
  return (
    <div
      data-calendar-event="true"
      title="From your subscribed calendar (view only)"
      style={{
        display: 'grid',
        gridTemplateColumns: '38px minmax(0, 1fr)',
        alignItems: 'center',
        columnGap: 12,
        padding: '10px 14px 10px 12px',
        border: '1px solid var(--border)',
        boxShadow: 'inset 3px 0 0 var(--event)',
        borderRadius: 'var(--radius-md)',
        background: 'transparent',
        cursor: 'default',
      }}
    >
      <div style={{
        width: 38,
        display: 'flex',
        justifyContent: 'center',
        color: 'var(--event)',
      }}>
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          lineHeight: 1.35,
          color: 'var(--foreground)',
          overflowWrap: 'anywhere',
        }}>
          {task.title}
        </p>
        <p style={{
          margin: '3px 0 0',
          fontSize: 'var(--text-meta)',
          fontWeight: 500,
          color: 'var(--muted)',
        }}>
          {task.eventTime ?? 'All day'}
        </p>
      </div>
    </div>
  );
}
