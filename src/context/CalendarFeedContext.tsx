'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, startOfMonth } from 'date-fns';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { CalendarEvent, normalizeCalendarUrl, parseIcsEvents } from '@/utils/ics';

/**
 * A subscribed .ics calendar. Stored only on this device (never synced to the
 * Gist) and shown read-only alongside tasks.
 */

const URL_KEY = 'juice-calendar-url';
const CACHE_KEY = 'juice-calendar-cache';
const REFRESH_AFTER_MS = 30 * 60 * 1000;
const PROXY_BASE = (process.env.NEXT_PUBLIC_GIST_AUTH_URL ?? '').replace(/\/$/, '');

interface CalendarCache {
  url: string;
  fetchedAt: string;
  events: CalendarEvent[];
}

interface CalendarFeedContextType {
  calendarUrl: string;
  setCalendarUrl: (url: string) => void;
  events: CalendarEvent[];
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  lastFetchedAt: string | null;
  refresh: () => Promise<void>;
}

const CalendarFeedContext = createContext<CalendarFeedContextType | undefined>(undefined);

async function downloadCalendar(url: string): Promise<string> {
  const looksLikeCalendar = (text: string) => text.includes('BEGIN:VCALENDAR');

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok) {
      const text = await response.text();
      if (looksLikeCalendar(text)) return text;
      throw new Error('That link did not return a calendar (.ics) file.');
    }
    if (!PROXY_BASE) throw new Error(`The calendar server responded with ${response.status}.`);
  } catch (error) {
    // A TypeError means the browser blocked the request (usually CORS); fall
    // back to the Juice worker, which fetches the feed on our behalf.
    if (!(error instanceof TypeError)) throw error;
    if (!PROXY_BASE) {
      throw new Error("This calendar can't be read directly from the browser, and no fetch proxy is configured.");
    }
  }

  const response = await fetch(`${PROXY_BASE}/ics?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Couldn't load the calendar (${response.status}).`);
  }
  const text = await response.text();
  if (!looksLikeCalendar(text)) throw new Error('That link did not return a calendar (.ics) file.');
  return text;
}

function eventWindow(now = new Date()): [number, number] {
  return [
    startOfMonth(addMonths(now, -1)).getTime(),
    addDays(now, 365).getTime(),
  ];
}

export function CalendarFeedProvider({ children }: { children: React.ReactNode }) {
  const [calendarUrl, setStoredUrl] = useLocalStorage<string>(URL_KEY, '');
  const [cache, setCache] = useLocalStorage<CalendarCache | null>(CACHE_KEY, null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  const load = useCallback(async (url: string) => {
    if (!url || inFlight.current === url) return;
    inFlight.current = url;
    setStatus('loading');
    setError(null);
    try {
      const text = await downloadCalendar(normalizeCalendarUrl(url));
      const events = parseIcsEvents(text, ...eventWindow());
      setCache({ url, fetchedAt: new Date().toISOString(), events });
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the calendar.');
      setStatus('error');
    } finally {
      inFlight.current = null;
    }
  }, [setCache]);

  const setCalendarUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    setStoredUrl(trimmed);
    setError(null);
    setStatus('idle');
    if (!trimmed) {
      setCache(null);
      return;
    }
    void load(trimmed);
  }, [load, setCache, setStoredUrl]);

  const refresh = useCallback(() => load(calendarUrl), [calendarUrl, load]);

  // Refresh on launch and when the app comes back to the foreground, if stale.
  useEffect(() => {
    if (!calendarUrl) return;
    const refreshIfStale = () => {
      if (document.visibilityState === 'hidden') return;
      const fetchedAt = cache?.url === calendarUrl ? Date.parse(cache.fetchedAt) : 0;
      if (Date.now() - fetchedAt > REFRESH_AFTER_MS) void load(calendarUrl);
    };
    refreshIfStale();
    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('focus', refreshIfStale);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfStale);
      window.removeEventListener('focus', refreshIfStale);
    };
  }, [cache, calendarUrl, load]);

  const events = useMemo(
    () => (calendarUrl && cache?.url === calendarUrl ? cache.events : []),
    [cache, calendarUrl]
  );

  return (
    <CalendarFeedContext.Provider value={{
      calendarUrl,
      setCalendarUrl,
      events,
      status,
      error,
      lastFetchedAt: cache?.url === calendarUrl ? cache.fetchedAt : null,
      refresh,
    }}>
      {children}
    </CalendarFeedContext.Provider>
  );
}

export function useCalendarFeed() {
  const context = useContext(CalendarFeedContext);
  if (!context) throw new Error('useCalendarFeed must be used within a CalendarFeedProvider');
  return context;
}
