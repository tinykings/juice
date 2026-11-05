'use client';

import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside an open modal: moves it in on open, cycles Tab
 * within the panel, and hands focus back on close. The panel needs tabIndex={-1}.
 */
export function useModalFocus(panelRef: RefObject<HTMLElement | null>, onEscape?: () => void) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && !panel.contains(previouslyFocused)) panel.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      const current = panelRef.current;
      if (!current) return;

      if (e.key === 'Escape' && onEscapeRef.current) {
        e.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const active = document.activeElement as HTMLElement | null;
      // Pickers and confirmations opened from the modal manage their own focus.
      if (active?.closest('[data-task-inline-portal]') && !current.contains(active)) return;

      const focusable = Array.from(current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && (active === first || !current.contains(active) || active === current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [panelRef]);
}
