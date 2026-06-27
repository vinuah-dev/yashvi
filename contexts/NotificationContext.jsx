"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState([]);

  // Load persisted state
  useEffect(() => {
    try {
      const raw = localStorage.getItem('notif_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        setUnreadCount(parsed.unreadCount || 0);
        setItems(parsed.items || []);
      }
    } catch {}
  }, []);

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem('notif_state', JSON.stringify({ unreadCount, items }));
    } catch {}
  }, [unreadCount, items]);

  const addNotification = (notif) => {
    setItems((prev) => [{
      id: notif?.messageId || `${Date.now()}`,
      title: notif?.notification?.title || 'Notification',
      body: notif?.notification?.body || '',
      data: notif?.data || {},
      receivedAt: new Date().toISOString()
    }, ...prev]);
    setUnreadCount((c) => c + 1);
  };

  const clearUnread = () => setUnreadCount(0);

  const value = useMemo(() => ({ unreadCount, addNotification, clearUnread, items }), [unreadCount, items]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  return ctx || { unreadCount: 0, addNotification: () => {}, clearUnread: () => {}, items: [] };
}
