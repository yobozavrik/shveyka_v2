import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const supabase = await createServerClient(true);

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    // 1. Confirmed units trend
    const { data: entries, error } = await supabase
      .from('task_entries')
      .select('quantity, recorded_at')
      .eq('status', 'approved')
      .gte('recorded_at', dateFromStr);

    if (error) return ApiResponse.handle(error, 'analytics_production_trend');

    // 2. Defects trend
    const { data: defects, error: defectError } = await supabase
      .from('operation_defects')
      .select('quantity, created_at')
      .gte('created_at', dateFromStr);

    if (defectError) return ApiResponse.handle(defectError, 'analytics_production_trend');

    const dateMap: Record<string, { confirmed_units: number; defects: number }> = {};

    (entries || []).forEach((e: { quantity: number; recorded_at: string }) => {
      const date = e.recorded_at;
      if (!dateMap[date]) dateMap[date] = { confirmed_units: 0, defects: 0 };
      dateMap[date].confirmed_units += e.quantity;
    });

    (defects || []).forEach((d: { created_at: string; quantity: number }) => {
      const date = d.created_at.split('T')[0];
      if (!dateMap[date]) dateMap[date] = { confirmed_units: 0, defects: 0 };
      dateMap[date].defects += d.quantity;
    });

    const result = Object.entries(dateMap)
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return ApiResponse.success(result);
  } catch (e: any) {
    return ApiResponse.handle(e, 'analytics_production_trend');
  }
}
