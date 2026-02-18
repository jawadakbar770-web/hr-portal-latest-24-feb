import React, { createContext, useState, useCallback } from 'react';

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  // 1. Move removeNotification UP so addNotification can see it
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // 2. addNotification now includes removeNotification in its dependency array
  const addNotification = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    const notification = { id, message, type };

    setNotifications(prev => [...prev, notification]);

    if (duration) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  }, [removeNotification]); // Dependency added here

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAllNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}