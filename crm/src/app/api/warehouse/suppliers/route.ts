import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Supabase error fetching suppliers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error('Suppliers GET exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      console.error('Supabase error creating supplier:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error('Suppliers POST exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
