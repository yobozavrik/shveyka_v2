import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { recordAuditLog } from '@/lib/audit';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  { params }: Params
) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const docId = parseInt(id);
    const supabase = await createServerClient(true);

    // 1. Get Document and its lines
    const { data: doc, error: docError } = await supabase
      .from('supply_documents')
      .select('*, supply_document_lines(*, items(*))')
      .eq('id', docId)
      .single();

    if (docError || !doc) return ApiResponse.error('Документ не знайдено', ERROR_CODES.NOT_FOUND, 404);
    if (doc.status === 'confirmed') return ApiResponse.error('Документ вже проведено', ERROR_CODES.BAD_REQUEST, 400);

    // 2. Prepare Ledger Entries
    const lines = doc.supply_document_lines || [];
    const entries = lines.map((item: any) => ({
      item_id: item.material_id,
      source_location_id: null, // Приход извне
      target_location_id: doc.target_location_id,
      qty: item.quantity,
      reference_type: 'supply_document',
      reference_id: doc.id,
      employee_id: auth.userId,
      comment: `Прибуткова накладна ${doc.doc_number}`
    }));

    if (entries.length === 0) {
      return ApiResponse.error('Документ порожній', ERROR_CODES.BAD_REQUEST, 400);
    }

    // 4. Insert Entries into Ledger
    const { error: ledgerErr } = await supabase
      .from('stock_ledger_entries')
      .insert(entries);

    if (ledgerErr) return ApiResponse.handle(ledgerErr, 'warehouse_supply_confirm');

    // 5. Update Document Status
    const { error: updateErr } = await supabase
      .from('supply_documents')
      .update({ status: 'confirmed' })
      .eq('id', docId);

    if (updateErr) {
      console.error("Critical: Document status update failed after journal entries were created", updateErr);
      return ApiResponse.handle(updateErr, 'warehouse_supply_confirm');
    }

    // 6. Audit Trail
    await recordAuditLog({
      action: 'UPDATE',
      entityType: 'supply_documents',
      entityId: String(docId),
      oldData: { status: 'draft' },
      newData: { status: 'confirmed', doc_number: doc.doc_number, entries_created: entries.length },
      request: request,
      auth: { id: auth.userId, username: auth.username },
    });

    return ApiResponse.success({ success: true, message: 'Рахунок успішно проведено' });
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_supply_confirm');
  }
}
