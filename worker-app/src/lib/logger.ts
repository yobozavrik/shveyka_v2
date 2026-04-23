import { getSupabaseAdmin } from './supabase';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: number | null;
  employeeId?: number | null;
  requestId?: string;
  endpoint?: string;
  action?: string;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
  timestamp: string;
}

interface ErrorLogRow {
  level: string;
  message: string;
  context: Record<string, unknown> | null;
  error_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  request_id: string | null;
  user_id: number | null;
  employee_id: number | null;
  endpoint: string | null;
  action: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];

function sanitizeValue(value: unknown, depth: number = 0): unknown {
  if (depth > 5) return '[Max Depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length > 1000) return value.slice(0, 1000) + '...[truncated]';
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.slice(0, 500),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(v => sanitizeValue(v, depth + 1));
  }
  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some(f => lowerKey.includes(f))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeValue(val, depth + 1);
      }
    }
    return sanitized;
  }
  return String(value);
}

const logQueue: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
let supabaseClient: ReturnType<typeof getSupabaseAdmin> | null = null;

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = getSupabaseAdmin('shveyka');
  }
  return supabaseClient;
}

async function flushLogs(): Promise<void> {
  if (isFlushing || logQueue.length === 0) return;
  isFlushing = true;

  const batch = logQueue.splice(0, logQueue.length);
  
  try {
    const rows: ErrorLogRow[] = batch.map(entry => ({
      level: entry.level,
      message: entry.message,
      context: (entry.context as Record<string, unknown>) || null,
      error_data: (entry.error as Record<string, unknown>) || null,
      metadata: (entry.metadata as Record<string, unknown>) || null,
      request_id: entry.context?.requestId || null,
      user_id: entry.context?.userId || null,
      employee_id: entry.context?.employeeId || null,
      endpoint: entry.context?.endpoint || null,
      action: entry.context?.action || null,
      ip_address: null,
      user_agent: null,
    }));

    await getSupabase()
      .from('error_logs')
      .insert(rows);
  } catch (err) {
    console.error('[Logger] Failed to persist logs:', err);
    logQueue.unshift(...batch);
  } finally {
    isFlushing = false;
  }
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushLogs, 2000);
}

function shouldLog(level: LogLevel): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  return level !== 'debug';
}

function consoleOutput(entry: LogEntry): void {
  const timestamp = entry.timestamp;
  const level = entry.level.toUpperCase().padEnd(5);
  const context = entry.context ? ` [${entry.context.action || entry.context.endpoint || 'app'}]` : '';
  const error = entry.error ? ` ${entry.error.name}: ${entry.error.message}` : '';
  
  const output = `[${timestamp}]${context} ${level}: ${entry.message}${error}`;
  
  switch (entry.level) {
    case 'error':
      console.error(output, entry.metadata || '');
      break;
    case 'warn':
      console.warn(output, entry.metadata || '');
      break;
    case 'info':
      console.info(output, entry.metadata || '');
      break;
    case 'debug':
      console.debug(output, entry.metadata || '');
      break;
  }
}

export class Logger {
  private context: LogContext;

  constructor(context?: LogContext) {
    this.context = context || {};
  }

  child(additionalContext?: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, undefined, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, undefined, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, undefined, metadata);
  }

  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    let errorObj: Error | undefined;
    if (error instanceof Error) {
      errorObj = error;
    } else if (error) {
      errorObj = new Error(String(error));
    }
    this.log('error', message, errorObj, metadata);
  }

  private log(
    level: LogLevel,
    message: string,
    error?: Error,
    metadata?: Record<string, unknown>
  ): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context: this.context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.slice(0, 500),
      } : undefined,
      metadata: sanitizeValue(metadata) as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    };

    if (process.env.NODE_ENV !== 'test') {
      consoleOutput(entry);
    }

    if (level === 'error' || level === 'warn') {
      logQueue.push(entry);
      scheduleFlush();
    }
  }
}

export const logger = new Logger();

export function createRequestLogger(request: Request, context?: LogContext): Logger {
  const requestId = request.headers.get('x-request-id') || undefined;
  const endpoint = new URL(request.url).pathname;
  
  return new Logger({
    requestId,
    endpoint,
    ...context,
  });
}

export async function flushLogsOnShutdown(): Promise<void> {
  if (logQueue.length > 0) {
    await flushLogs();
  }
}
