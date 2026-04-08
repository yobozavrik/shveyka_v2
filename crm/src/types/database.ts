// ======================== ENUMS ========================

export type UserRole =
  | 'admin'
  | 'manager'
  | 'master'
  | 'worker'
  | 'hr'
  | 'quality'
  | 'production_head'
  | 'cutting'
  | 'sewing'
  | 'overlock'
  | 'packaging'
  | 'qc';
export type EmployeeStatus = 'active' | 'inactive' | 'fired';
export type PaymentType = 'piecework' | 'salary';
export type BatchStatus = 'created' | 'cutting' | 'in_progress' | 'completed' | 'cancelled';
export type EntryStatus = 'submitted' | 'confirmed' | 'rejected';
export type OperationType = 'cutting' | 'sewing' | 'packing' | 'other';
export type SupplyDocStatus = 'draft' | 'confirmed' | 'cancelled';
export type MovementType = 'supply' | 'writeoff' | 'adjustment' | 'batch_writeoff';
export type DefectSeverity = 'minor' | 'major' | 'critical';
export type AbsenceType = 'vacation' | 'sick' | 'day_off' | 'other';
export type PayrollPeriodStatus = 'open' | 'closed';

// ======================== CORE TABLES ========================

export type User = {
  id: number;
  username: string;
  hashed_password: string;
  hashed_pin?: string | null;
  email: string | null;
  role: UserRole;
  employee_id: number | null;
  is_active: boolean;
  failed_login_attempts?: number;
  locked_until?: string | null;
  created_at: string;
  updated_at: string;
};

export type Employee = {
  id: number;
  full_name: string;
  personnel_number: string | null;
  employee_number: string | null;
  master_id: number | null;
  supervisor_id?: number | null;
  department?: string | null;
  phone: string | null;
  hire_date: string;
  birth_date?: string | null;
  position: string;
  status: EmployeeStatus;
  payment_type: PaymentType;
  family_info?: string | null;
  address?: string | null;
  skill_level?: number | null;
  individual_coefficient?: number | null;
  salary_amount: number | null;
  comments: string | null;
  created_at: string;
  updated_at: string;
};

export type Operation = {
  id: number;
  code: string;
  name: string;
  operation_type: OperationType;
  base_rate: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductModel = {
  id: number;
  keycrm_id?: number | null;
  name: string;
  sku: string | null;
  description: string | null;
  sizes: string[] | null;     // e.g. ['S','M','L','XL']
  is_active: boolean;
  thumbnail_url?: string | null;
  source_payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CatalogAttributeScope = 'model' | 'order' | 'batch' | 'operation';
export type CatalogAttributeValueType = 'text' | 'number' | 'boolean' | 'date' | 'json' | 'select' | 'multi_select';

export type CatalogAttributeDefinition = {
  id: number;
  key: string;
  label: string;
  description: string | null;
  value_type: CatalogAttributeValueType;
  scope: CatalogAttributeScope;
  source: 'manual' | 'keycrm' | 'production' | 'warehouse';
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CatalogAttributeValue = {
  id: number;
  product_model_id: number;
  attribute_definition_id: number;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  definition?: CatalogAttributeDefinition;
};

// ======================== PRODUCTION ========================

export type ProductionBatch = {
  id: number;
  batch_number: string;
  product_model_id: number;
  quantity: number;
  priority: string;
  status: 'planned' | 'cutting' | 'sewing' | 'completed' | 'cancelled';
  start_date: string | null;
  due_date: string | null;
  cutting_status: 'locked' | 'available' | 'in_progress' | 'completed';
  sewing_status: 'locked' | 'available' | 'in_progress' | 'completed';
  supervisor_id?: number | null;
  fabric_type?: string | null;
  fabric_color?: string | null;
  thread_number?: string | null;
  embroidery_type?: string | null;
  embroidery_color?: string | null;
  nastyl_number?: number | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_launch_date?: string | null;
  is_urgent?: boolean;
  notes: string | null;
  keycrm_id?: number | null;

  size_variants: Record<string, number> | null;
  created_at: string;
  updated_at: string;
  // Joins
  product_models?: ProductModel;
};

export type RouteCard = {
  id: number;
  product_model_id: number;
  name: string;
  version: number;
  is_active: boolean;
  description: string | null;
  weight_grams: number;
  created_at: string;
  updated_at: string;
  // Joins
  product_models?: ProductModel;
  route_card_operations?: RouteCardOperation[];
};

export type RouteCardOperation = {
  id: number;
  route_card_id: number;
  operation_id: number;
  sequence_number: number;
  sequence_order?: number;
  custom_rate: number | null;
  is_mandatory: boolean;
  is_required: boolean;
  is_control_point: boolean;
  batch_status_on_confirm: string | null;
  created_at: string;
  updated_at?: string;
  // Joins
  operations?: Operation;
};

export type MaterialNorm = {
  id: number;
  product_model_id: number;
  material_id: number;
  quantity_per_unit: number;
  item_type: string | null;
  unit_of_measure: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  materials?: Material;
  product_models?: ProductModel;
};

export type ProductionOrderEvent = {
  id: number;
  order_id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  stage_label: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  created_by: number | null;
  created_at: string;
};

export type MaterialRequirement = {
  id: number;
  order_id: number;
  material_id: number | null;
  material_name: string;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  unit: string | null;
  item_type: string | null;
  unit_of_measure: string | null;
  calculation_source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OperationEntry = {
  id: number;
  production_batch_id: number;
  employee_id: number;
  operation_id: number;
  quantity: number;
  size: string | null;
  model_id: number | null;
  status: EntryStatus;
  entry_date: string;
  entry_time: string | null;
  notes: string | null;
  local_id: string | null;
  input_source: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  employees?: Employee;
  operations?: Operation;
  production_batches?: ProductionBatch;
};

export type CuttingNastil = {
  id: number;
  production_batch_id: number;
  employee_id: number;
  layers: number;
  meters_used: number;
  notes: string | null;
  created_at: string;
};

// ======================== HR / PAYROLL ========================

export type WorkSchedule = {
  id: number;
  employee_id: number;
  day_of_week: number; // 0=Mon … 6=Sun
  start_time: string;
  end_time: string;
  is_working: boolean;
  created_at: string;
  updated_at: string;
};

export type EmployeeAbsence = {
  id: number;
  employee_id: number;
  absence_type: AbsenceType;
  date_from: string;
  date_to: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type PayrollPeriod = {
  id: number;
  name: string;              // e.g. "Березень 2026 (1-15)"
  date_from: string;
  date_to: string;
  status: PayrollPeriodStatus;
  closed_at: string | null;
  closed_by: number | null;
  created_at: string;
  updated_at: string;
};

export type PayrollAccrual = {
  id: number;
  payroll_period_id: number;
  employee_id: number;
  total_entries: number;
  total_quantity: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  // Joins
  employees?: Employee;
};

export type PayrollAdjustment = {
  id: number;
  payroll_period_id: number;
  employee_id: number;
  amount: number;
  reason: string;
  created_by: number | null;
  created_at: string;
};

// ======================== WAREHOUSE ========================

export type Material = {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  price_per_unit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Supplier = {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SupplyDocument = {
  id: number;
  doc_number: string;
  supplier_id: number;
  status: SupplyDocStatus;
  doc_date: string;
  total_amount: number;
  notes: string | null;
  confirmed_at: string | null;
  confirmed_by: number | null;
  created_at: string;
  updated_at: string;
  // Joins
  suppliers?: Supplier;
  supply_items?: SupplyItem[];
};

export type SupplyItem = {
  id: number;
  supply_document_id: number;
  material_id: number;
  quantity: number;
  price: number;
  total: number;
  created_at: string;
  // Joins
  materials?: Material;
};

export type MaterialNorm = {
  id: number;
  product_model_id: number;
  material_id: number;
  quantity_per_unit: number;   // сколько материала на 1 изделие
  created_at: string;
  updated_at: string;
  // Joins
  materials?: Material;
  product_models?: ProductModel;
};

export type StockMovement = {
  id: number;
  material_id: number;
  movement_type: MovementType;
  quantity: number;
  reference_id: number | null;
  reference_type: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  // Joins
  materials?: Material;
};

// ======================== QUALITY ========================

export type Defect = {
  id: number;
  production_batch_id: number;
  operation_id: number | null;
  employee_id: number | null;
  quantity: number;
  severity: DefectSeverity;
  description: string;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  production_batches?: ProductionBatch;
  operations?: Operation;
  employees?: Employee;
};

// ======================== INTEGRATION ========================

export type KeycrmSyncLog = {
  id: number;
  synced_at: string;
  orders_fetched: number;
  batches_created: number;
  errors: string | null;
  status: 'success' | 'error';
};
