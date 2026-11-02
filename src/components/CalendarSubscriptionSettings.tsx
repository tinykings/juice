'use client';

import { useEffect, useState } from 'react';
import { useCalendarFeed } from '@/context/CalendarFeedContext';

/** Settings panel for this device's subscribed .ics calendar. */
export default function CalendarSubscriptionSettings() {
  const { calendarUrl, setCalendarUrl, events, status, error, lastFetchedAt, refresh } = useCalendarFeed();
  const [draft, setDraft] = useState(calendarUrl);

  useEffect(() => {
    setDraft(calendarUrl);
  }, [calendarUrl]);

  const trimmed = draft.trim();
  const isDirty = trimmed !== calendarUrl;
  const isLoading = status === 'loading';

  const buttonStyle = (primary: boolean, disabled: boolean): React.CSSProperties => ({
    flex: primary ? 1 : undefined,
    height: 40,
    padding: '0 14px',
    border: `1px solid ${primary && !disabled ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-sm)',
    background: primary && !disabled ? 'var(--accent)' : 'transparent',
    color: primary && !disabled ? 'var(--background)' : 'var(--muted)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    fontSize: 14,
    fontWeight: 700,
  });

  let statusText: string;
  if (!calendarUrl) {
    statusText = 'Paste a calendar link (.ics or webcal://) to show its events in your list and calendar.';
  } else if (isLoading) {
    statusText = 'Loading calendar…';
  } else if (error) {
    statusText = error;
  } else if (lastFetchedAt) {
    statusText = `${events.length} event${events.length === 1 ? '' : 's'} · updated ${new Date(lastFetchedAt).toLocaleString()}`;
  } else {
    statusText = 'Not loaded yet.';
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isDirty) setCalendarUrl(trimmed);
        else void refresh();
      }}
      style={{
        marginTop: 14,
        padding: 14,
        background: 'var(--task-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--foreground)', fontSize: 15, fontWeight: 700 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--event)' }} aria-hidden="true" />
        Calendar Subscription
      </div>
      <p style={{ margin: '6px 0 12px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
        Events are view only and stay on this device — they aren&apos;t synced to your Gist.
      </p>
      <input
        type="url"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Calendar link"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="https://… .ics or webcal://…"
        style={{
          width: '100%',
          height: 42,
          padding: '0 12px',
          fontSize: 15,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(255, 255, 255, 0.035)',
          color: 'var(--foreground)',
          boxSizing: 'border-box',
        }}
      />
      <p style={{
        margin: '8px 0 12px',
        color: error && calendarUrl && !isLoading ? 'var(--red)' : 'var(--muted)',
        fontSize: 13,
        lineHeight: 1.45,
        overflowWrap: 'anywhere',
      }}>
        {statusText}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          disabled={isLoading || (!isDirty && !calendarUrl)}
          style={buttonStyle(true, isLoading || (!isDirty && !calendarUrl))}
        >
          {isDirty ? 'Save' : 'Refresh'}
        </button>
        {calendarUrl && (
          <button
            type="button"
            onClick={() => {
              setDraft('');
              setCalendarUrl('');
            }}
            style={buttonStyle(false, false)}
          >
            Remove
          </button>
        )}
      </div>
    </form>
  );
}
