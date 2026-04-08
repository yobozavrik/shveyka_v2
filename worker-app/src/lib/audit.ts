import { supabaseAdmin } from './supabase';

/**
 * Записує дію робітника або майстра в загальний журнал аудиту.
 */
export async function recordAuditLog(params: {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN_SUCCESS' | 'LOGIN_FAIL';
  entityType: string;
  entityId: string;
  oldData?: any;
  newData?: any;
  request?: Request;
  auth?: { userId?: number | null; username?: string | null; employeeId?: number | null };
}) {
  try {
    // Отримуємо IP та User-Agent з запиту
    const ip = params.request?.headers.get('x-forwarded-for') || 
             params.request?.headers.get('x-real-ip') || 
             'unknown';
    const ua = params.request?.headers.get('user-agent') || 'unknown';

    const logEntry = {
      user_id: params.auth?.userId || null,
      user_name: params.auth?.username || `Employee #${params.auth?.employeeId || '?'}`,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_data: params.oldData,
      new_data: params.newData,
      ip_address: ip,
      user_agent: ua
    };

    const { error } = await supabaseAdmin
      .schema('public')
      .from('audit_logs')
      .insert([logEntry]);

    if (error) {
      console.error('Audit Log Error (Worker App):', error.message);
    }
  } catch (err) {
    console.error('Critical Error in recordAuditLog (Worker App):', err);
  }
}
