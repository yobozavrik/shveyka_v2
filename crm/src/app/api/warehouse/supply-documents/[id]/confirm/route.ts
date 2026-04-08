import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { recordAuditLog } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const docId = parseInt(id);

    // We use admin client for critical transactions (inventory ledger)
    const supabase = await createServerClient(true);

    // 1. Fetch the document and its items
    const { data: doc, error: docErr } = await supabase
      .from('supply_documents')
      .select('*, supply_items(item_id, quantity, price)')
      .eq('id', docId)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: 'Документ не знайдено' }, { status: 404 });
    }

    if (doc.status === 'confirmed') {
      return NextResponse.json({ error: 'Документ вже проведено' }, { status: 400 });
    }

    // 2. Find Source (Vendor) and Target (Internal) locations
    const { data: locations, error: locErr } = await supabase
      .from('locations')
      .select('id, type')
      .in('type', ['vendor', 'internal']);

    if (locErr || !locations) {
      return NextResponse.json({ error: 'Не знайдено складські зони' }, { status: 500 });
    }

    const vendorLoc = locations.find((l: any) => l.type === 'vendor');
    // Temporary: Pick the first internal warehouse. 
    const targetLoc = locations.find((l: any) => l.type === 'internal'); 

    if (!vendorLoc || !targetLoc) {
      return NextResponse.json({ error: 'Помилка налаштування складів. Зв\'яжіться з адміном.' }, { status: 500 });
    }

    // 3. Prepare Double-Entry Journal Entries
    const entries = (doc.supply_items || []).map((item: any) => ({
      transaction_date: new Date().toISOString(),
      item_id: item.item_id,
      source_location_id: vendorLoc.id,
      target_location_id: targetLoc.id,
      qty: item.quantity,
      reference_type: 'supply_document',
      reference_id: doc.id,
      employee_id: auth.userId,
      comment: `Прибуткова накладна ${doc.doc_number}`
    }));

    if (entries.length === 0) {
      return NextResponse.json({ error: 'Документ порожній' }, { status: 400 });
    }

    // 4. Insert Entries into Ledger
    const { error: ledgerErr } = await supabase
      .from('stock_ledger_entries')
      .insert(entries);

    if (ledgerErr) {
      return NextResponse.json({ error: `Stock Ledger Error: ${ledgerErr.message}` }, { status: 500 });
    }

    // 5. Update Document Status
    const { error: updateErr } = await supabase
      .from('supply_documents')
      .update({ status: 'confirmed' })
      .eq('id', docId);

    if (updateErr) {
      console.error("Critical: Document status update failed after journal entries were created", updateErr);
      return NextResponse.json({ error: 'Помилка оновлення статусу документа' }, { status: 500 });
    }

    // 6. Audit Trail
    await recordAuditLog(
      supabase,
      auth.userId,
      'update',
      'supply_documents',
      docId,
      { status: 'draft' },
      { status: 'confirmed', doc_number: doc.doc_number, entries_created: entries.length },
      request.headers.get('user-agent'),
      request.headers.get('x-forwarded-for')
    );

    return NextResponse.json({ success: true, message: 'Рахунок успішно проведено' });
  } catch (e: any) {
    console.error('Supply Document Confirm Exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
