import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual env loading
const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim().replace(/^"|"$/g, '');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'shveyka' }
});

async function cleanup() {
  console.log('--- Cleaning up test data ---');
  try {
    await supabase.from('production_order_materials').delete().neq('id', 0);
    await supabase.from('production_order_lines').delete().neq('id', 0);
    await supabase.from('production_batches').delete().neq('id', 0);
    await supabase.from('production_orders').delete().neq('id', 0);
  } catch (e) {
    console.warn('Cleanup warning (might be empty):', e);
  }
}

async function prepareData() {
  console.log('--- Preparing Reference Data ---');
  
  // 1. Ensure a location exists
  let { data: locations } = await supabase.from('locations').select('id').limit(1);
  if (!locations || locations.length === 0) {
    console.log('Creating test location...');
    const { data: newLoc, error: locErr } = await supabase.from('locations').insert({ name: 'Test Warehouse', type: 'warehouse' }).select().single();
    if (locErr) throw locErr;
    locations = [newLoc];
  }

  // 2. Ensure a product model exists
  let { data: models } = await supabase.from('product_models').select('id, name, sku').limit(1);
  if (!models || models.length === 0) {
    console.log('Creating test product model...');
    const { data: newModel, error: modErr } = await supabase.from('product_models').insert({ name: 'Test Shirt', sku: 'TS-' + Date.now(), category: 'tops' }).select().single();
    if (modErr) throw modErr;
    models = [newModel];
  }
  const model = models[0];

  // 3. Ensure materials exist
  let { data: materials } = await supabase.from('materials').select('id, name').limit(1);
  if (!materials || materials.length === 0) {
    console.log('Creating test material...');
    const { data: newMat, error: matErr } = await supabase.from('materials').insert({ name: 'Cotton Fabric', code: 'MAT-' + Date.now(), unit: 'm', current_stock: 100 }).select().single();
    if (matErr) throw matErr;
    materials = [newMat];
  }
  const material = materials[0];

  // 4. Link material to model BOM
  console.log('Linking material to BOM...');
  const { data: bom } = await supabase.from('material_norms').select('id').eq('product_model_id', model.id).eq('material_id', material.id).limit(1);
  if (!bom || bom.length === 0) {
    const { error: bomErr } = await supabase.from('material_norms').insert({
      product_model_id: model.id,
      material_id: material.id,
      quantity_per_unit: 1.5,
      item_type: 'main_fabric'
    });
    if (bomErr) throw bomErr;
  }

  return { locationId: locations[0].id, model };
}

async function runTest() {
  await cleanup();
  const refs = await prepareData();

  console.log('\n--- Step 1: Create Order (Draft) ---');
  const orderNum = 'TEST-' + Math.floor(Math.random() * 10000);
  const { data: order, error: orderErr } = await supabase.from('production_orders').insert({
    order_number: orderNum,
    order_type: 'stock',
    status: 'draft',
    order_date: new Date().toISOString().split('T')[0],
    target_location_id: refs.locationId,
    total_quantity: 10,
    total_lines: 1
  }).select().single();

  if (orderErr) throw orderErr;
  console.log('Order created:', order.id, order.order_number);

  console.log('\n--- Step 2: Add Order Line ---');
  const { error: lineErr } = await supabase.from('production_order_lines').insert({
    order_id: order.id,
    model_id: refs.model.id,
    model_name: refs.model.name,
    model_sku: refs.model.sku,
    quantity: 10
  });
  if (lineErr) throw lineErr;

  console.log('\n--- Step 3: Approve Order ---');
  await supabase.from('production_orders').update({
    status: 'approved',
    approved_at: new Date().toISOString()
  }).eq('id', order.id);
  console.log('Order approved');

  console.log('\n--- Step 4: Create Batch ---');
  const { data: batch, error: batchErr } = await supabase.from('production_batches').insert({
    order_id: order.id,
    batch_number: order.order_number + '-01',
    product_model_id: refs.model.id,
    sku: refs.model.sku,
    quantity: 10,
    status: 'created'
  }).select().single();

  if (batchErr) throw batchErr;
  console.log('Batch created:', batch.id, batch.batch_number);

  console.log('\n--- Step 5: Launch Order (Trigger MRP) ---');
  const { error: rpcError } = await supabase.rpc('calculate_material_requirements', {
    p_order_id: order.id
  });
  if (rpcError) throw rpcError;

  await supabase.from('production_orders').update({
    status: 'launched',
    launched_at: new Date().toISOString()
  }).eq('id', order.id);
  console.log('Order launched');

  console.log('\n--- Step 6: Verify MRP Results ---');
  const { data: requirements, error: reqErr } = await supabase.from('production_order_materials').select('*').eq('order_id', order.id);
  if (reqErr) throw reqErr;

  console.log('Material Requirements:', requirements?.length || 0, 'records');
  if (requirements && requirements.length > 0) {
    requirements.forEach(req => {
      console.log(`- ${req.material_name}: Req=${req.required_quantity}, Avail=${req.available_quantity}, Short=${req.shortage_quantity}`);
    });
    console.log('\n✅ STEP 1 TEST PASSED!');
  } else {
    console.log('❌ FAIL: No requirements found! Check BOM link.');
  }
}

runTest().catch(e => {
  console.error('❌ TEST FAILED');
  console.error(e);
});
