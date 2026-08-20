'use client';

import { useEffect } from 'react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      const appScope = `${window.location.origin}${basePath}/`;
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations
          .filter((registration) => registration.scope === appScope)
          .forEach((registration) => void registration.unregister());
      });
      return;
    }

    navigator.serviceWorker
      .register(`${basePath}/sw.js`, { scope: `${basePath}/`, updateViaCache: 'none' })
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  }, []);
}
