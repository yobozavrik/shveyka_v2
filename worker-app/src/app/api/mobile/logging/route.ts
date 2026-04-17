import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { createRequestLogger } from '@/lib/logger';

/**
 * POST /api/mobile/logging
 * Принимает batch логов действий пользователя.
 * Логи НЕ возвращают данные — fire and forget.
 *
 * Body: Array<{ action_type, action_label?, target_element?, target_text?, page_path, page_title?, task_id?, batch_id?, stage_code?, input_data?, previous_value?, new_value?, duration_ms?, time_on_page_ms?, user_agent?, screen_size?, network_type? }>
 */
export async function POST(request: Request) {
  const logger = createRequestLogger(request, { action: 'log_user_actions' });
  const user = await getCurrentUser(request);
  if (!user || !user.employeeId) {
    return NextResponse.json({ inserted: 0, skipped: 'unauthorized' }, { status: 202 });
  }

  const employeeId = user.employeeId;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Normalize to array (accept single object or array)
  const logs = Array.isArray(body) ? body : body.logs || [body];

  if (logs.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  // Cap batch size to prevent abuse
  const batch = logs.slice(0, 100);

  const supabase = getSupabaseAdmin('shveyka');

  // Extract session_id from cookie header or generate from user agent
  const sessionCookie = request.headers.get('cookie')?.match(/session_id=([^;]+)/)?.[1];
  const sessionId = sessionCookie || 'unknown';

  // Get user agent and screen size from headers (set by client)
  const userAgent = request.headers.get('user-agent') || '';
  const screenHeader = request.headers.get('x-screen-size') || '';
  const networkHeader = request.headers.get('x-network-type') || 'unknown';

  const rows = batch.map((log: any) => ({
    employee_id: employeeId,
    session_id: sessionId,
    action_type: String(log.action_type || 'unknown').slice(0, 50),
    action_label: log.action_label ? String(log.action_label).slice(0, 200) : null,
    target_element: log.target_element ? String(log.target_element).slice(0, 200) : null,
    target_text: log.target_text ? String(log.target_text).slice(0, 500) : null,
    page_path: String(log.page_path || '/').slice(0, 500),
    page_title: log.page_title ? String(log.page_title).slice(0, 200) : null,
    task_id: Number(log.task_id) || null,
    batch_id: Number(log.batch_id) || null,
    stage_code: log.stage_code ? String(log.stage_code).slice(0, 50) : null,
    input_data: log.input_data || null,
    previous_value: log.previous_value ? String(log.previous_value).slice(0, 500) : null,
    new_value: log.new_value ? String(log.new_value).slice(0, 500) : null,
    duration_ms: Number(log.duration_ms) || null,
    time_on_page_ms: Number(log.time_on_page_ms) || null,
    user_agent: userAgent.slice(0, 500),
    screen_size: screenHeader.slice(0, 20),
    network_type: networkHeader.slice(0, 20),
  }));

  const { data, error } = await supabase
    .from('user_action_log')
    .insert(rows)
    .select('id');

  if (error) {
    logger.error('user_action_log insert error:', error);
    return NextResponse.json({ error: 'Logging failed', inserted: 0 }, { status: 202 });
  }

  return NextResponse.json({ inserted: data?.length || 0 });
}
