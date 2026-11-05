'use client';

export default function GroupHeader({
  label,
  detail,
  tone,
  onAdd,
  action,
}: {
  label: string;
  detail?: string;
  tone: 'today' | 'overdue' | 'default';
  /** Tapping the header opens the add form for that day. */
  onAdd?: () => void;
  action?: { label: string; onClick: () => void };
}) {
  const text = (
    <>
      <span>{label}</span>
      {detail && (
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>{detail}</span>
      )}
    </>
  );

  return (
    <h2 style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      margin: 0,
      padding: '0 4px',
      minHeight: 28,
      fontSize: tone === 'today' ? 15 : 13,
      fontWeight: 700,
      letterSpacing: '0.01em',
      color: tone === 'overdue' ? 'var(--red)' : tone === 'today' ? 'var(--foreground)' : 'var(--muted)',
    }}>
      {onAdd ? (
        <button
          type="button"
          className="group-header-add"
          onClick={onAdd}
          aria-label={`Add task for ${label}${detail ? `, ${detail}` : ''}`}
        >
          {text}
          <svg className="group-header-add-icon" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>{text}</span>
      )}
      {action && (
        <button type="button" className="group-header-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </h2>
  );
}
