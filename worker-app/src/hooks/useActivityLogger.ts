import { useEffect, useRef, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Full activity logger for Worker App.
 *
 * Logs:
 * - Page views (enter/leave with duration)
 * - Button clicks
 * - Card clicks
 * - Form input (debounced 500ms)
 * - Form submit
 * - Modal open/close
 * - Dropdown open
 * - Theme change
 * - Navigation clicks
 *
 * Usage:
 *   const { log, logTaskAction } = useActivityLogger();
 *   log('button_click', { action_label: 'Прийняти задачу', target_element: '#accept-btn' });
 *   logTaskAction('task_accept', taskId, batchId, stageCode);
 */

type LogEntry = {
  action_type: string;
  action_label?: string;
  target_element?: string;
  target_text?: string;
  page_path?: string;
  page_title?: string;
  task_id?: number;
  batch_id?: number;
  stage_code?: string;
  input_data?: Record<string, any>;
  previous_value?: string;
  new_value?: string;
  duration_ms?: number;
  time_on_page_ms?: number;
};

// Queue for batching logs
const logQueue: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

function isPublicAuthPage(path?: string | null): boolean {
  return Boolean(path && (path === '/login' || path.startsWith('/login?')));
}

function getScreenSize(): string {
  if (typeof window === 'undefined') return '';
  return `${window.innerWidth}x${window.innerHeight}`;
}

function getNetworkType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const conn = (navigator as any).connection;
  if (conn?.effectiveType) return conn.effectiveType;
  return 'unknown';
}

async function flushLogs() {
  if (isFlushing || logQueue.length === 0) return;
  isFlushing = true;

  const batch = logQueue.splice(0, logQueue.length);

  try {
    await fetch('/api/mobile/logging', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-screen-size': getScreenSize(),
        'x-network-type': getNetworkType(),
      },
      body: JSON.stringify(batch),
      // Don't block the UI — fire and forget
      keepalive: true,
    });
  } catch {
    // Logging failed — not critical, restore logs to queue
    logQueue.unshift(...batch);
  } finally {
    isFlushing = false;
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushLogs, 2000); // Flush every 2 seconds
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (logQueue.length > 0) {
      // Send synchronously on unload
      const blob = new Blob([JSON.stringify(logQueue.splice(0))], { type: 'application/json' });
      navigator.sendBeacon('/api/mobile/logging', blob);
    }
  });
}

export function useActivityLogger() {
  const pathname = usePathname();
  const pageEnterTime = useRef(Date.now());
  const prevPathname = useRef<string | null>(null);
  const inputDebounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const currentPagePath = pathname || '/';
  const disabled = isPublicAuthPage(currentPagePath);

  // Auto-log page view
  useEffect(() => {
    if (disabled) return;

    // Log page leave for previous page
    if (prevPathname.current && prevPathname.current !== currentPagePath) {
      const timeOnPage = Date.now() - pageEnterTime.current;
      logQueue.push({
        action_type: 'page_leave',
        page_path: prevPathname.current,
        time_on_page_ms: timeOnPage,
      });
      scheduleFlush();
    }

    // Log page view for current page
    logQueue.push({
      action_type: 'page_view',
      page_path: currentPagePath,
      page_title: document.title,
    });
    pageEnterTime.current = Date.now();
    prevPathname.current = currentPagePath;
    scheduleFlush();

    return () => {
      // Cleanup timers
      inputDebounceTimers.current.forEach((t) => clearTimeout(t));
      inputDebounceTimers.current.clear();
    };
  }, [currentPagePath]);

  // Generic log function
  const log = useCallback((action_type: string, data: Omit<LogEntry, 'action_type'> = {}) => {
    if (disabled) return;
    logQueue.push({
      action_type,
      page_path: currentPagePath,
      page_title: document.title,
      ...data,
    });
    scheduleFlush();
  }, [currentPagePath]);

  // Task-specific log
  const logTaskAction = useCallback((action_type: string, taskId: number, batchId?: number, stageCode?: string, extra?: Record<string, any>) => {
    if (disabled) return;
    logQueue.push({
      action_type,
      page_path: currentPagePath,
      page_title: document.title,
      task_id: taskId,
      batch_id: batchId,
      stage_code: stageCode,
      ...extra,
    });
    scheduleFlush();
  }, [currentPagePath]);

  // Setup global event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (disabled) return;

    // Button clicks
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button, [role="button"], a');
      if (!button) return;

      const element = button as HTMLElement;
      const action_type = element.tagName === 'A' ? 'navigation_click' : 'button_click';
      const label = element.textContent?.trim().slice(0, 100) || element.getAttribute('aria-label') || '';
      const id = element.id || element.className?.split(' ')[0] || '';

      log(action_type, {
        action_label: label,
        target_element: id,
        target_text: label,
      });
    };

    // Form input (debounced per element)
    const handleGlobalInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (!target || !target.name) return;

      const elementId = target.id || target.name;
      const value = (target as HTMLInputElement).value;

      // Debounce per element
      const existing = inputDebounceTimers.current.get(elementId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        log('form_input', {
          action_label: `Ввод: ${target.name}`,
          target_element: elementId,
          input_data: { [target.name]: value },
        });
        inputDebounceTimers.current.delete(elementId);
      }, 500);

      inputDebounceTimers.current.set(elementId, timer);
    };

    // Form submit
    const handleGlobalSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (!form) return;

      log('form_submit', {
        action_label: `Submit: ${form.id || form.className?.split(' ')[0] || 'form'}`,
        target_element: form.id || '',
      });
    };

    document.addEventListener('click', handleGlobalClick, true);
    document.addEventListener('input', handleGlobalInput, true);
    document.addEventListener('submit', handleGlobalSubmit, true);

    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
      document.removeEventListener('input', handleGlobalInput, true);
      document.removeEventListener('submit', handleGlobalSubmit, true);
    };
  }, [log]);

  return useMemo(() => ({ log, logTaskAction }), [log, logTaskAction]);
}
