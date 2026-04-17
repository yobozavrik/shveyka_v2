import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const supabase = await createServerClient(true);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    let query = supabase
      .from('materials')
      .select(`
        id, code, name, category, unit, current_stock, min_stock,
        price_per_unit, notes, created_at
      `)
      .order('name');

    if (q) query = query.ilike('name', `%${q}%`);

    const { data, error } = await query;
    if (error) {
      return ApiResponse.handle(error, 'warehouse_materials');
    }
    
    return ApiResponse.success(data || []);
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_materials');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return ApiResponse.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = await request.json();
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('materials')
      .insert({
        code: body.code,
        name: body.name,
        category: body.category || body.material_type || 'fabric',
        unit: body.unit || 'м',
        current_stock: parseFloat(body.current_stock) || 0,
        min_stock: parseFloat(body.min_stock) || 0,
        price_per_unit: body.price_per_unit || body.cost_per_unit || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      return ApiResponse.handle(error, 'warehouse_materials');
    }
    return ApiResponse.success(data, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_materials');
  }
}
