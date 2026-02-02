'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parse,
} from 'date-fns';

interface CalendarPickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
}

export default function CalendarPicker({ value, onChange }: CalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parse(value, 'yyyy-MM-dd', new Date());
  const [viewMonth, setViewMonth] = useState(startOfMonth(selected));
  const containerRef = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);
  const [useNative, setUseNative] = useState(false);

  // Detect coarse pointer (touch devices) to use native picker
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setUseNative(mq.matches);
    const handler = (e: MediaQueryListEvent) => setUseNative(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sync viewMonth when value changes externally
  useEffect(() => {
    setViewMonth(startOfMonth(parse(value, 'yyyy-MM-dd', new Date())));
  }, [value]);

  const handleSelect = useCallback((day: Date) => {
    onChange(format(day, 'yyyy-MM-dd'));
    setOpen(false);
  }, [onChange]);

  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = new Date();

  const displayText = format(selected, 'MMM d, yyyy');

  // Native picker for touch devices
  if (useNative) {
    return (
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        background: 'var(--background)',
        border: '1px solid var(--border)',
        borderRadius: 0,
        fontSize: 16,
        cursor: 'pointer',
        minHeight: 48,
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--foreground)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <CalendarIcon />
        <input
          ref={nativeRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--foreground)',
            fontSize: 16,
            fontFamily: 'inherit'
          }}
        />
      </label>
    );
  }

  // Custom calendar for desktop
  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: 'var(--background)',
          border: '1px solid var(--border)',
          borderRadius: 0,
          fontSize: 16,
          cursor: 'pointer',
          minHeight: 48,
          transition: 'all 0.2s',
          color: 'var(--foreground)',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--foreground)'}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <CalendarIcon />
        {displayText}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: '6px 6px 0 rgba(0,0,0,0.15)',
          zIndex: 200,
          padding: 12,
          width: 280,
          userSelect: 'none',
        }}>
          {/* Month nav */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <button
              type="button"
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              style={navBtnStyle}
              aria-label="Previous month"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              letterSpacing: '0.02em',
            }}>
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              style={navBtnStyle}
              aria-label="Next month"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            marginBottom: 4,
          }}>
            {days.map((d) => (
              <div key={d} style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--muted)',
                padding: '4px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
          }}>
            {allDays.map((day) => {
              const inMonth = isSameMonth(day, viewMonth);
              const isSelected = isSameDay(day, selected);
              const isToday = isSameDay(day, today);

              return (
                <DayCell
                  key={day.toISOString()}
                  day={day}
                  inMonth={inMonth}
                  isSelected={isSelected}
                  isToday={isToday}
                  onSelect={handleSelect}
                />
              );
            })}
          </div>

          {/* Today shortcut */}
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              setViewMonth(startOfMonth(t));
              handleSelect(t);
            }}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '6px 0',
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}

function DayCell({ day, inMonth, isSelected, isToday, onSelect }: {
  day: Date;
  inMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  onSelect: (d: Date) => void;
}) {
  const [hovered, setHovered] = useState(false);

  let bg = 'transparent';
  let color = inMonth ? 'var(--foreground)' : 'var(--muted)';
  let fontWeight = 400;
  let border = '1px solid transparent';

  if (isSelected) {
    bg = 'var(--accent)';
    color = 'var(--background)';
    fontWeight = 700;
  } else if (hovered && inMonth) {
    bg = 'var(--muted-light)';
  }

  if (isToday && !isSelected) {
    border = '1px solid var(--accent)';
    fontWeight = 600;
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(day)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight,
        background: bg,
        color,
        border,
        cursor: 'pointer',
        borderRadius: 0,
        padding: 0,
        transition: 'background 0.1s',
      }}
    >
      {day.getDate()}
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="var(--foreground)" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="0" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  padding: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--foreground)',
};
