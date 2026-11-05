'use client';

import { useEffect, useState } from 'react';

/** Viewport facts for the responsive layout; measured after mount, so width starts at 0. */
export function useViewport() {
  const [viewport, setViewport] = useState({ width: 0, isTouch: false, isLandscapePhone: false });

  useEffect(() => {
    const update = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      // Phones and small tablets, installed or in the browser; not a narrow desktop window.
      const isTouch = window.matchMedia('(pointer: coarse)').matches;

      setViewport({
        width: window.innerWidth,
        isTouch,
        // Phone held sideways: the calendar takes the whole screen, like the iOS app.
        isLandscapePhone: (isStandalone || isTouch) &&
          window.matchMedia('(orientation: landscape)').matches &&
          window.innerWidth < 1000,
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return viewport;
}
