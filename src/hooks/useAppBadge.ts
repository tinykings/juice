'use client';

import { useEffect, useRef } from 'react';

export function useAppBadge(count: number, enabled: boolean) {
  const lastCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !('setAppBadge' in navigator)) return;
    if (lastCountRef.current === count) return;
    lastCountRef.current = count;

    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else {
      navigator.clearAppBadge?.().catch(() => {});
    }
  }, [count, enabled]);

  // Clear badge on unmount or when disabled
  useEffect(() => {
    if (!enabled && 'clearAppBadge' in navigator) {
      navigator.clearAppBadge?.().catch(() => {});
      lastCountRef.current = null;
    }
  }, [enabled]);
}

export async function requestBadgePermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function isBadgeSupported(): boolean {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}
