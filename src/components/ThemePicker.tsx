'use client';

import { useTheme } from '@/context/ThemeContext';
import { DEFAULT_THEMES, getTheme, ThemeChoice, ThemeId, THEMES } from '@/utils/theme';

/** Each tile sets data-theme on itself, so it previews that theme using the same CSS tokens as the app. */
export default function ThemePicker() {
  const { choice, setChoice } = useTheme();
  const lightName = getTheme(DEFAULT_THEMES.light).name;
  const darkName = getTheme(DEFAULT_THEMES.dark).name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
      <ChoiceButton
        selected={choice === 'system'}
        onClick={() => setChoice('system')}
        label="System"
        detail={`${lightName} in light mode, ${darkName} in dark`}
      />
      <ThemeGroup title="Light" mode="light" choice={choice} onSelect={setChoice} />
      <ThemeGroup title="Dark" mode="dark" choice={choice} onSelect={setChoice} />
    </div>
  );
}

function ThemeGroup({
  title,
  mode,
  choice,
  onSelect,
}: {
  title: string;
  mode: 'light' | 'dark';
  choice: ThemeChoice;
  onSelect: (choice: ThemeChoice) => void;
}) {
  return (
    <div role="group" aria-label={`${title} themes`}>
      <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {THEMES.filter(theme => theme.mode === mode).map(theme => (
          <ChoiceButton
            key={theme.id}
            themeId={theme.id}
            selected={choice === theme.id}
            onClick={() => onSelect(theme.id)}
            label={theme.name}
          />
        ))}
      </div>
    </div>
  );
}

function ChoiceButton({
  themeId,
  selected,
  onClick,
  label,
  detail,
}: {
  themeId?: ThemeId;
  selected: boolean;
  onClick: () => void;
  label: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      data-theme={themeId}
      aria-pressed={selected}
      onClick={onClick}
      className="hover-accent-border"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
        width: '100%',
        padding: '8px 10px',
        textAlign: 'left',
        color: 'var(--foreground)',
        background: 'var(--background)',
        border: `${selected ? 2 : 1}px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
      }}
    >
      {themeId && (
        <span aria-hidden="true" style={{
          flexShrink: 0,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'var(--accent)',
        }} />
      )}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}>{label}</span>
        {detail && (
          <span style={{ display: 'block', marginTop: 2, fontSize: 12, lineHeight: 1.3, color: 'var(--muted)' }}>{detail}</span>
        )}
      </span>
      {selected && (
        <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      )}
    </button>
  );
}
