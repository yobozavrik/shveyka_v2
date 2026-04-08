import { createServerClient } from './supabase/server';

/**
 * Записує дію адміністратора в журнал аудиту.
 * Працює у "фоновому" режимі (не блокує основний запит).
 */
export async function recordAuditLog(params: {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN_FAIL' | 'LOGIN_SUCCESS';
  entityType: string;
  entityId: string;
  oldData?: any;
  newData?: any;
  request?: Request;
  auth?: { id: number; username: string };
}) {
  try {
    const supabase = await createServerClient(true);
    
    // Отримуємо IP та User-Agent з запиту
    const ip = params.request?.headers.get('x-forwarded-for') || 
             params.request?.headers.get('x-real-ip') || 
             'unknown';
    const ua = params.request?.headers.get('user-agent') || 'unknown';

    const logEntry = {
      user_id: params.auth?.id || null,
      user_name: params.auth?.username || 'System/Guest',
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_data: params.oldData,
      new_data: params.newData,
      ip_address: ip,
      user_agent: ua
    };

    const { error } = await supabase
      .from('audit_logs')
      .insert([logEntry]);

    if (error) {
      console.error('Audit Log Error:', error.message);
    }
  } catch (err) {
    console.error('Critical Error in recordAuditLog:', err);
  }
}
