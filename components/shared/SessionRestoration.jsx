"use client";

import { useEffect } from "react";
import { getSession, isSessionValid, SESSION_KEYS } from "@/lib/sessionStorage";

/**
 * Session restoration component
 * Loads session from IndexedDB on app startup
 * Ensures auth persists across PWA close/reopen
 */
export default function SessionRestoration() {
  useEffect(() => {
    const restoreSession = async () => {
      try {
        if (sessionStorage.getItem('logoutInProgress') === 'true') {
          localStorage.removeItem('gymUser');
          localStorage.removeItem('gymUserExpiry');
          localStorage.removeItem('selectedGym');
          localStorage.removeItem('member');
          sessionStorage.setItem('sessionRestorationComplete', 'true');
          return;
        }
        console.log('🔄 Starting session restoration...');
        
        // First check localStorage as quick check
        const localUserData = localStorage.getItem('gymUser');
        const localExpiry = localStorage.getItem('gymUserExpiry');
        
        console.log('📦 localStorage check:', {
          hasUser: !!localUserData,
          hasExpiry: !!localExpiry,
          expiry: localExpiry ? new Date(parseInt(localExpiry)).toLocaleString() : 'none'
        });
        
        // Check if session is still valid
        const valid = await isSessionValid();
        if (!valid) {
          console.log('⚠️ No valid session found or session expired');
          // Clear any stale data
          localStorage.removeItem('gymUser');
          localStorage.removeItem('gymUserExpiry');
          localStorage.removeItem('selectedGym');
          localStorage.removeItem('member');
          // Mark restoration as complete (even though no session found)
          sessionStorage.setItem('sessionRestorationComplete', 'true');
          return;
        }

        // Restore user data from IndexedDB (or localStorage fallback)
        const userData = await getSession(SESSION_KEYS.USER);
        const expiry = await getSession(SESSION_KEYS.EXPIRY);

        if (userData && expiry) {
          // Ensure it's in localStorage for compatibility with existing code
          const userStr = typeof userData === 'string' ? userData : JSON.stringify(userData);
          localStorage.setItem('gymUser', userStr);
          localStorage.setItem('gymUserExpiry', expiry);
          
          const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
          
          // Also set member key for member compatibility
          if (user.role === 'member') {
            localStorage.setItem('member', userStr);
          }
          
          console.log('✅ Session successfully restored!');
          console.log('👤 User:', user.name || user.email);
          console.log('🎭 Role:', user.role);
          console.log('📅 Session expires:', new Date(parseInt(expiry)).toLocaleString());
          console.log('⏰ Time remaining:', Math.round((parseInt(expiry) - Date.now()) / (1000 * 60 * 60 * 24)), 'days');
        } else {
          console.log('⚠️ No session data found in storage');
        }
        
        // Mark restoration as complete
        sessionStorage.setItem('sessionRestorationComplete', 'true');
      } catch (error) {
        console.error('❌ Error restoring session:', error);
        localStorage.removeItem('selectedGym');
        // Still mark as complete so app doesn't hang
        sessionStorage.setItem('sessionRestorationComplete', 'true');
      }
    };

    // Restore session immediately on mount
    restoreSession();

    // Also restore session when PWA becomes visible (resume from background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 PWA resumed from background, checking session...');
        restoreSession();
      }
    };

    // Listen for focus events too (when user returns to the app)
    const handleFocus = () => {
      console.log('🔍 App gained focus, checking session...');
      restoreSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return null; // This component doesn't render anything
}
