// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDxqiznEXGQaawVeK02S7u7YRX5Du4gpqc",
  authDomain: "sfit-ai-notifications.firebaseapp.com",
  projectId: "sfit-ai-notifications",
  storageBucket: "sfit-ai-notifications.firebasestorage.app",
  messagingSenderId: "613974701714",
  appId: "1:613974701714:web:42ed85b6ef5997250b184b"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('📨 Background message received:', payload);
  console.log('🔍 Checking if any clients are focused...');
  
  // Check if any client (PWA window) is currently focused
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    const hasFocusedClient = clientList.some(client => client.focused);
    
    console.log('📊 Client status:', {
      totalClients: clientList.length,
      hasFocusedClient: hasFocusedClient,
      clientStates: clientList.map(c => ({ url: c.url, focused: c.focused, visibilityState: c.visibilityState }))
    });
    
    // Only show notification if no client is focused (app is in background)
    if (hasFocusedClient) {
      console.log('✋ App is in foreground, skipping background notification (foreground handler will show toast)');
      return Promise.resolve();
    }
    
    console.log('🔔 App is in background, showing notification');
    const notificationTitle = payload.notification?.title || 'New Notification';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      data: payload.data,
      tag: payload.data?.tag || 'default',
      requireInteraction: true,
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Notification clicked:', event.notification.data);
  event.notification.close();
  
  let urlToOpen = event.notification.data?.url || '/';
  
  // Ensure URL is absolute for the current origin
  if (!urlToOpen.startsWith('http')) {
    urlToOpen = self.location.origin + (urlToOpen.startsWith('/') ? '' : '/') + urlToOpen;
  }
  
  console.log('🔗 Opening URL:', urlToOpen);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      console.log('📱 Found', clientList.length, 'open windows');
      
      // Check if there's already a window open to the app
      for (const client of clientList) {
        const clientOrigin = new URL(client.url).origin;
        if (clientOrigin === self.location.origin && 'focus' in client) {
          console.log('✅ Focusing existing window and navigating to:', urlToOpen);
          // Navigate the existing window to the URL
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      
      // Open a new window
      console.log('🆕 Opening new window');
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
