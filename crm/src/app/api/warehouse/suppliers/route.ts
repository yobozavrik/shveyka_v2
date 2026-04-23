import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');
    
    if (error) {
      return ApiResponse.handle(error, 'warehouse_suppliers');
    }
    return ApiResponse.success(data || []);
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_suppliers');
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
      .from('suppliers')
      .insert({
        name: body.name,
        contact_person: body.contact_person || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      return ApiResponse.handle(error, 'warehouse_suppliers');
    }
    return ApiResponse.success(data, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_suppliers');
  }
}
