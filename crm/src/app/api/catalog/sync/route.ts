import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CatalogSyncService } from '@/services/catalog.service';
import { getAuth } from '@/lib/auth-server';

export async function POST() {
  const auth = await getAuth();
  
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Разрешаем синхронизацию только админам и менеджерам
  if (!['admin', 'manager', 'production_head'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const supabase = await createServerClient(true); // Используем Admin Client (service_role)
    const syncService = new CatalogSyncService(supabase);
    
    const result = await syncService.syncAll();
    
    return NextResponse.json({
      message: 'Sync completed',
      ...result
    });
  } catch (error: any) {
    console.error('Catalog Sync API Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 });
  }
}
