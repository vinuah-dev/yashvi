'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getFCMToken, onMessageListener, ensureMessagingSW } from '@/lib/firebase';
import { useToast } from '@/contexts/ToastContext';
import { useNotification } from '@/contexts/NotificationContext';

export default function NotificationManager() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { addNotification } = useNotification();
  const [permission, setPermission] = useState('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [localUserId, setLocalUserId] = useState(null);
  const [localUserRole, setLocalUserRole] = useState('member');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem('gymUser');
      if (!raw) return;

      const parsed = JSON.parse(raw);
      setLocalUserId(parsed?.id || null);
      setLocalUserRole(parsed?.role || 'member');
    } catch {
      setLocalUserId(null);
      setLocalUserRole('member');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const currentPermission = Notification.permission;
      console.log('🔔 Notification permission status:', currentPermission);
      setPermission(currentPermission);
      
      // Show prompt if permission is not granted and user hasn't dismissed this session
      // Note: Don't show prompt if already denied - user must enable in browser settings
      if (currentPermission === 'default' && !dismissed) {
        setShowPrompt(true);
      } else if (currentPermission === 'denied') {
        console.log('⚠️ Notifications are blocked. User must enable in browser settings.');
      }
    }
  }, [dismissed]);

  useEffect(() => {
    const effectiveUserId = user?.id || localUserId;
    if (!effectiveUserId) return;

    // Request permission and register token
    const setupNotifications = async () => {
      try {
        // Make sure our Firebase Messaging Service Worker is registered
        await ensureMessagingSW();

        if (permission === 'granted') {
          await registerToken(effectiveUserId);
          setShowPrompt(false);
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    setupNotifications();

    // Listen for foreground messages
    const unsubscribe = onMessageListener()
      .then((payload) => {
        console.log('📬 Foreground message received:', payload.notification?.title);
        showToast(
          payload.notification?.title || 'New Notification',
          'info',
          5000
        );
        // Track unread count for bell icon
        addNotification(payload);
        // Note: Service worker already shows the notification in background,
        // so we don't show it again here to avoid duplicates
      })
      .catch(err => console.log('Failed to listen for messages:', err));

    return () => {
      // Cleanup listener
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [addNotification, localUserId, permission, showToast, user]);

  const registerToken = async (effectiveUserId) => {
    try {
      const token = await getFCMToken();
      
      const uid = effectiveUserId || user?.id;
      if (token && uid) {
        console.log('FCM token:', token);
        const role = localUserRole || user?.role || 'member';
        const userType = role === 'member' ? 'member' : 'profile';
        // Register token with backend
        const response = await fetch('/api/notifications/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: uid,
            token: token,
            userType,
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              registeredAt: new Date().toISOString()
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to register FCM token');
        }
        const json = await response.json();
        console.log('FCM token registered successfully', json);
      }
    } catch (error) {
      console.error('Error registering token:', error);
    }
  };

  const requestPermission = async () => {
    try {
      console.log('🔔 Current permission status:', Notification.permission);
      
      // Check if permission is already denied
      if (Notification.permission === 'denied') {
        console.error('❌ Notifications are blocked. User must enable them in browser settings.');
        showToast('Notifications are blocked. Please enable them in your browser settings.', 'error', 8000);
        setShowPrompt(false);
        setDismissed(true);
        return;
      }

      const result = await Notification.requestPermission();
      console.log('🔔 Permission request result:', result);
      setPermission(result);
      
      if (result === 'granted') {
        const uid = user?.id || localUserId;
        await registerToken(uid);
        showToast('Notifications enabled successfully!', 'success');
        setShowPrompt(false);
      } else if (result === 'denied') {
        console.error('❌ User denied notification permission');
        showToast('Notifications blocked. To enable: Click the lock icon in your browser address bar → Site settings → Notifications → Allow', 'error', 10000);
        setShowPrompt(false);
        setDismissed(true);
      } else {
        // Result is 'default' - user dismissed the prompt
        showToast('Notification permission dismissed', 'info');
        setShowPrompt(false);
        setDismissed(true);
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      showToast('Failed to request notification permission', 'error');
    }
  };

  if (showPrompt && (user?.id || localUserId)) {
    return (
      <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 border border-gray-200 dark:border-gray-700 z-50 animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">🔔</div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Enable Notifications
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Stay updated with announcements, membership expiry alerts, and important updates.
            </p>
            <div className="flex flex-row gap-2">
              <button
                onClick={requestPermission}
                className="flex-1 px-4 py-2 bg-[#f0813d] text-white text-sm font-medium rounded-lg hover:bg-[#f0813d] transition-colors"
              >
                Enable
              </button>
              <button
                onClick={() => {
                  setShowPrompt(false);
                  setDismissed(true);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
