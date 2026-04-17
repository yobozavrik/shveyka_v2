import { createServerClient } from '@/lib/supabase/server';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'audit' | 'user_action';

export interface LogEntry {
  level: LogLevel;
  message: string;
  module: string;
  action: string;
  userId?: string;
  username?: string;
  entityId?: string;
  entityType?: string;
  data?: Record<string, unknown>;
  error?: string;
  timestamp: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Универсальный логгер.
 * Пишет в консоль всегда.
 * Пишет в БД (system_logs) для уровней: audit, error, user_action, warn.
 */
export async function appLogger(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
  const timestamp = new Date().toISOString();
  const fullEntry: LogEntry = { ...entry, timestamp };

  // 1. Console (всегда для разработки)
  const logFn = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    audit: console.log,
    user_action: console.log,
  }[entry.level] || console.log;

  // Формируем красивое сообщение для консоли
  const prefix = `[${entry.level.toUpperCase()}] [${entry.module}]`;
  logFn(`${prefix} ${entry.message}`, entry.data ? JSON.stringify(entry.data) : '');

  // 2. Database (для важных событий)
  const dbLevels = ['audit', 'error', 'user_action', 'warn'];
  if (dbLevels.includes(entry.level)) {
    // Запускаем в фоне, не ждем ответа, чтобы не тормозить интерфейс
    writeToDatabase(fullEntry).catch(err => {
      console.error('[Logger] Failed to write to DB:', err);
    });
  }
}

async function writeToDatabase(entry: LogEntry) {
  try {
    const supabase = await createServerClient(true);
    await supabase.from('system_logs').insert({
      level: entry.level,
      message: entry.message,
      module: entry.module,
      action: entry.action,
      user_id: entry.userId || null,
      username: entry.username || null,
      entity_id: entry.entityId || null,
      entity_type: entry.entityType || null,
      data: entry.data || null,
      error_message: entry.error || null,
      request_id: entry.requestId || null,
      ip_address: entry.ip || null,
      user_agent: entry.userAgent || null,
      created_at: entry.timestamp,
    });
  } catch (dbError) {
    console.error('[Logger] DB Write Error:', dbError);
  }
}

/**
 * Хелпер для логирования действий пользователя (Клики, Сохранения)
 */
export async function trackUserAction(
  userId: string,
  username: string,
  action: string,
  description: string,
  details?: Record<string, unknown>
) {
  await appLogger({
    level: 'user_action',
    message: `${username} -> ${description}`,
    module: 'frontend',
    action,
    userId,
    username,
    data: details,
  });
}

/**
 * Хелпер для аудита (Важные изменения в БД)
 */
export async function auditLog(
  userId: string,
  username: string,
  action: string,
  entityType: string,
  entityId: string,
  data?: Record<string, unknown>
) {
  await appLogger({
    level: 'audit',
    message: `${username} выполнил ${action} → ${entityType} #${entityId}`,
    module: 'audit',
    action,
    userId,
    username,
    entityId,
    entityType,
    data,
  });
}

/**
 * Хелпер для логирования ошибок
 */
export async function errorLog(
  module: string,
  action: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  await appLogger({
    level: 'error',
    message: error instanceof Error ? error.message : String(error),
    module,
    action,
    error: error instanceof Error ? error.stack : String(error),
    data: context,
  });
}
