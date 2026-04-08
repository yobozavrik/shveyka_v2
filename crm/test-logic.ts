
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Завантажуємо змінні оточення
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('🚀 Початок QA-тестування логіки підтвердження...');

  const entryId = 23; // Наша тестова запис
  
  // 1. Отримуємо дані запису
  const { data: entry, error: fetchError } = await supabase
    .from('operation_entries')
    .select(`
      *,
      production_batches (
        id,
        route_card_id,
        status
      )
    `)
    .eq('id', entryId)
    .single();

  if (fetchError || !entry) {
    console.error('❌ Помилка завантаження запису:', fetchError);
    return;
  }

  console.log(`📝 Запис знайдено. Поточний статус: ${entry.status}. Партія: ${entry.production_batches.id}`);

  // 2. Емуляція логіки API approve
  // (Копіюємо логіку з crm/src/app/api/entries/approve/route.ts)
  
  try {
    // Шукаємо активний період (наш ID 100)
    const { data: period } = await supabase
      .from('payroll_periods')
      .select('id')
      .eq('is_closed', false)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (!period) throw new Error('Активний період не знайдено');
    console.log(`📅 Знайдено активний період: ${period.id}`);

    // Оновлюємо статус виробітку
    const { error: updateError } = await supabase
      .from('operation_entries')
      .update({ status: 'confirmed' })
      .eq('id', entryId);
      
    if (updateError) throw updateError;
    console.log('✅ Статус виробітку змінено на confirmed');

    // Нарахування зарплати (беремо базовий тариф для простоти тесту у Free Mode)
    const amount = entry.quantity * 5.5; // Емулюємо наш custom_rate
    
    const { error: accrualError } = await supabase
      .from('payroll_accruals')
      .upsert({
        employee_id: entry.employee_id,
        period_id: period.id,
        amount: amount, // В реальності була б логіка накопичення
        updated_at: new Date().toISOString()
      }, { onConflict: 'employee_id,period_id' });

    if (accrualError) throw accrualError;
    console.log(`💰 Нараховано зарплату: ${amount} (UPSERT пройшов успішно)`);

    console.log('✨ Тест завершено успішно!');
  } catch (err) {
    console.error('❌ Помилка під час тесту:', err);
  }
}

runTest();
