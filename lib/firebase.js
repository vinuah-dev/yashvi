import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDxqiznEXGQaawVeK02S7u7YRX5Du4gpqc",
  authDomain: "sfit-ai-notifications.firebaseapp.com",
  projectId: "sfit-ai-notifications",
  // storageBucket is not required for FCM; use default format if needed
  storageBucket: "sfit-ai-notifications.appspot.com",
  messagingSenderId: "613974701714",
  appId: "1:613974701714:web:42ed85b6ef5997250b184b"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// VAPID public key
export const VAPID_KEY = "BBWfZ2Ob9laApkoHOH0v52DjGXf8tT65YbIMbk2UgDPEG0ohTLiW9PqJMO1tvfAIaILnGcquPdOC1kBNWyINE8w";

// Ensure the Firebase Messaging Service Worker is registered and return it
export const ensureMessagingSW = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('⚠️ Service Worker not supported in this browser');
    return null;
  }

  try {
    // If already registered, reuse it
    const existing = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (existing) {
      console.log('✅ Firebase SW already registered');
      // If not yet active, wait until the SW is ready
      if (!existing.active) {
        console.log('⏳ Waiting for SW to become active...');
        try {
          const ready = await navigator.serviceWorker.ready;
          console.log('✅ SW is now active');
          return ready;
        } catch (e) {
          console.warn('Failed to wait for SW ready, will re-register:', e);
          // fallthrough to re-register
        }
      }
      return existing;
    }

    // Register the FCM-specific service worker at root scope
    console.log('📝 Registering firebase-messaging-sw.js...');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    console.log('✅ Firebase SW registered:', registration);
    
    // Wait until the SW is active
    const ready = await navigator.serviceWorker.ready;
    console.log('✅ SW is active and ready');
    return ready;
  } catch (e) {
    console.error('❌ Failed to register firebase-messaging-sw.js:', e);
    return null;
  }
};

// Get FCM token
export const getFCMToken = async () => {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Worker not available');
      return null;
    }

    // Check whether the current browser environment supports FCM
    const supported = await isSupported().catch(() => false);
    if (!supported) {
      console.warn('⚠️ FCM is not supported in this browser/environment.');
      return null;
    }

    console.log('🚀 Fetching FCM token...');
    // Make sure our messaging service worker is registered and used
    const swReg = await ensureMessagingSW();
    if (!swReg) {
      console.warn('⚠️ Failed to get service worker registration');
      return null;
    }

    const messaging = getMessaging(app);
    console.log('📱 Requesting token from Firebase...');
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (currentToken) {
      console.log('✅ FCM token obtained successfully');
      return currentToken;
    } else {
      console.warn('⚠️ No registration token available. Possible causes: user denied permission, browser doesn\'t support, or user is not authenticated.');
      return null;
    }
  } catch (err) {
    console.error('❌ Error retrieving FCM token:', err.code, err.message);
    return null;
  }
};

// Listen for foreground messages
export const onMessageListener = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return;
    
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
};

export default app;
