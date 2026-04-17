#!/usr/bin/env node
/**
 * Скрипт для применения SQL миграций в Supabase
 * 
 * Использование:
 *   node scripts/apply-migrations.js
 * 
 * Требования:
 *   npm install @supabase/supabase-js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Загрузка переменных окружения
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Ошибка: NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть установлены в .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function readSqlFile(filename) {
  const filePath = path.join(__dirname, '..', 'docs', 'schemas', filename);
  return fs.readFileSync(filePath, 'utf-8');
}

async function executeSql(filename) {
  console.log(`📄 Выполняю ${filename}...`);
  const sql = await readSqlFile(filename);
  
  const { error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    // Если rpc exec_sql не существует, используем прямой запрос
    const { error: directError } = await supabase.from('_dummy').select('*').limit(0);
    console.warn(`⚠️  Прямое выполнение SQL может не работать через JS клиент.`);
    console.warn(`   Рекомендуется выполнить ${filename} через Supabase Dashboard SQL Editor.`);
    return false;
  }
  
  console.log(`✅ ${filename} выполнен успешно`);
  return true;
}

async function main() {
  console.log('🚀 Начало применения миграций...\n');
  
  const files = [
    'error_logs.sql',
    'refresh_tokens.sql',
    'rate_limits.sql'
  ];
  
  for (const file of files) {
    try {
      await executeSql(file);
    } catch (err) {
      console.error(`❌ Ошибка при выполнении ${file}:`, err.message);
      console.error('   Выполните этот файл вручную через Supabase Dashboard.');
    }
  }
  
  console.log('\n📋 Проверка таблиц...');
  
  const { data: tables, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'shveyka')
    .in('table_name', ['error_logs', 'refresh_tokens', 'rate_limits']);
  
  if (error) {
    console.error('❌ Ошибка проверки таблиц:', error.message);
  } else {
    const foundTables = tables.map(t => t.table_name);
    const expectedTables = ['error_logs', 'refresh_tokens', 'rate_limits'];
    const missing = expectedTables.filter(t => !foundTables.includes(t));
    
    if (missing.length === 0) {
      console.log('✅ Все таблицы созданы успешно!');
    } else {
      console.warn(`⚠️  Отсутствуют таблицы: ${missing.join(', ')}`);
      console.warn('   Выполните SQL файлы вручную через Supabase Dashboard.');
    }
  }
  
  console.log('\n✨ Готово!');
}

main().catch(console.error);
