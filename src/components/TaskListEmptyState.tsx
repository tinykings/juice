'use client';

import { format } from 'date-fns';

const headlineStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1.3,
  letterSpacing: '-0.03em',
  maxWidth: 360,
  textAlign: 'center',
  color: 'var(--muted)',
};

const messageStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  lineHeight: 1.4,
  maxWidth: 360,
  textAlign: 'center',
  overflowWrap: 'anywhere',
  color: 'var(--muted)',
};

export default function TaskListEmptyState({
  searchQuery,
  selectedDate,
  hasNoTasks,
  isWide,
  onAdd,
}: {
  searchQuery: string;
  selectedDate: Date | null;
  hasNoTasks: boolean;
  isWide: boolean;
  onAdd: () => void;
}) {
  const query = searchQuery.trim();
  const addLink = (label: string) => (
    <button
      type="button"
      onClick={onAdd}
      className="hover-link"
      style={{
        color: 'var(--accent)',
        background: 'transparent',
        border: 'none',
        padding: 0,
        font: 'inherit',
        fontWeight: 'inherit',
        cursor: 'pointer',
        textDecoration: 'none',
      }}
    >
      {label}
    </button>
  );

  let content: React.ReactNode;
  if (query) {
    content = <div style={messageStyle}>No tasks match “{query}”</div>;
  } else if (selectedDate) {
    content = (
      <div style={messageStyle}>
        Nothing on {format(selectedDate, 'EEEE, MMMM d')}.
        <br />
        {addLink('Add a task.')}
      </div>
    );
  } else if (hasNoTasks) {
    content = (
      <div style={headlineStyle}>
        You have nothing to do.
        <br />
        {addLink('Start something.')}
      </div>
    );
  } else {
    content = (
      <div style={headlineStyle}>
        All done for now.
        <br />
        <span style={{ color: 'var(--accent)' }}>Tomorrow awaits.</span>
      </div>
    );
  }

  return (
    <div style={{
      padding: isWide ? '80px 24px' : '60px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
    }}>
      {content}
    </div>
  );
}
