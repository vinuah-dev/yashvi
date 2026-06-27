'use client';

import { useEffect } from 'react';

export default function PWASetup() {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const existingLink = document.querySelector('link[rel="manifest"]');
      if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = '/manifest.json';
        document.head.appendChild(link);
      }
    }

    // In local development, stale app SW can serve old UI bundles.
    // Remove only /sw.js registrations (keep firebase messaging SW intact).
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          const activeScript = registration.active?.scriptURL || '';
          const waitingScript = registration.waiting?.scriptURL || '';
          const installingScript = registration.installing?.scriptURL || '';
          const registeredAppSw =
            activeScript.includes('/sw.js') ||
            waitingScript.includes('/sw.js') ||
            installingScript.includes('/sw.js');

          if (registeredAppSw) {
            registration.unregister().catch((error) => {
              console.warn('Failed to unregister stale app service worker:', error);
            });
          }
        });
      });
    }
  }, []);

  return null;
}

