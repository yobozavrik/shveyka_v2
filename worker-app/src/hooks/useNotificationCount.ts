import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Reusable hook for notification count polling.
 * - Fetches count on mount
 * - Polls every 30 seconds
 * - Requests browser notification permission on first interaction
 * - Shows alert on first load if pending tasks exist
 */
export function useNotificationCount() {
  const [count, setCount] = useState(0);
  const [urgent, setUrgent] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const prevCountRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/mobile/notifications/count');
      if (res.ok) {
        const data = await res.json();
        const newCount = data.pending_tasks ?? 0;

        // On first load: if there are pending tasks, show alert
        if (isFirstLoadRef.current && newCount > 0) {
          isFirstLoadRef.current = false;
          // Try browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            showBrowserNotification(newCount, data.urgent_tasks ?? 0);
          }
        }

        // On subsequent polls: notify if count increased
        if (!isFirstLoadRef.current && newCount > prevCountRef.current && prevCountRef.current >= 0) {
          if ('Notification' in window && Notification.permission === 'granted') {
            showBrowserNotification(newCount, data.urgent_tasks ?? 0);
          }
        }

        prevCountRef.current = newCount;
        setCount(newCount);
        setUrgent(data.urgent_tasks ?? 0);
      }
    } catch {
      // Silently fail — bell shows 0 on error
    }
  }, []);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/mobile/notifications/list');
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    fetchList();
    const interval = setInterval(fetchCount, 30000);

    // Listen for task acceptance events to refresh immediately
    const handleTaskAccepted = () => {
      fetchCount();
      fetchList();
    };
    window.addEventListener('task-accepted', handleTaskAccepted);

    return () => {
      clearInterval(interval);
      window.removeEventListener('task-accepted', handleTaskAccepted);
    };
  }, [fetchCount, fetchList]);

  /**
   * Request notification permission on user interaction.
   * Call this when user clicks the bell.
   */
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window) || permissionRequested) return;
    try {
      const permission = await Notification.requestPermission();
      setPermissionRequested(true);
      if (permission === 'granted' && count > 0) {
        showBrowserNotification(count, urgent);
      }
    } catch {
      // Permission denied or error
    }
  }, [permissionRequested, count, urgent]);

  const dismiss = useCallback(() => setDismissed(true), []);
  const undismiss = useCallback(() => setDismissed(false), []);

  const refetch = useCallback(async () => {
    await fetchCount();
    await fetchList();
    setDismissed(false);
  }, [fetchCount, fetchList]);

  return {
    count,
    urgent,
    dismissed,
    notifications,
    dismiss,
    undismiss,
    refetch,
    requestNotificationPermission,
  };
}

function showBrowserNotification(pendingCount: number, urgentCount: number) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  const title = urgentCount > 0
    ? `🔴 ${urgentCount} термінових завдань!`
    : `${pendingCount} нових завдань очікують`;

  new Notification('МЕС ЦЕХ', {
    body: title,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'pending-tasks',
    requireInteraction: false,
  });
}
