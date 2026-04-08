import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Пряме підключення без dotenv
const supabaseUrl = 'https://supabase.dmytrotovstytskyi.online';
const supabaseServiceKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2MzI0OTcwMCwiZXhwIjo0OTE4OTIzMzAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.QC9C9-CxocHb-jM-lHmXHEjEZV2hCOaSwgfxKLjKoEQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'shveyka' }
});

async function main() {
  console.log('🚀 ФІНАЛЬНИЙ ЗАПУСК: Створення адміністратора 001...');

  try {
    // 1. Створення співробітника
    const { data: emp, error: empErr } = await supabase
      .from('employees')
      .upsert({
        employee_number: '001',
        full_name: 'Супер Адмін',
        position: 'Адміністратор',
        department: 'Адміністрація',
        is_active: true
      }, { onConflict: 'employee_number' })
      .select()
      .single();

    if (empErr) throw empErr;
    console.log('✅ Співробітник 001 (ID:', emp.id, ')');

    // 2. Хешування PIN 0000
    // Використовуємо простіший метод якщо bcryptjs барахлить
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('0000', salt);

    // 3. Створення користувача
    const { error: userErr } = await supabase
      .from('users')
      .upsert({
        username: 'admin001',
        hashed_password: hashedPassword,
        role: 'admin',
        employee_id: emp.id,
        is_active: true
      }, { onConflict: 'username' });

    if (userErr) throw userErr;

    console.log('🎉 БІНГО! АДМІНІСТРАТОР 001 З PIN 0000 СТВОРЕНИЙ!');
    console.log('👉 Тепер спробуйте увійти в додатку.');
  } catch (err: any) {
    console.error('❌ ПОМИЛКА:', err.message || err);
  }
}

main();
