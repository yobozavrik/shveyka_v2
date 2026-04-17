-- Migration: Add Payroll and HR infrastructure
-- Run this in Supabase SQL Editor

-- 1. Payroll Periods
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name text NOT NULL,
    date_from date NOT NULL,
    date_to date NOT NULL,
    status text NOT NULL DEFAULT 'open', -- open, closed
    created_at timestamptz DEFAULT now()
);

-- 2. Payroll Adjustments (Bonuses, Deductions, etc.)
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    employee_id bigint NOT NULL REFERENCES public.employees(id),
    period_id bigint REFERENCES public.payroll_periods(id),
    amount numeric(12, 2) NOT NULL,
    adjustment_type text NOT NULL, -- bonus, deduction, advance, correction
    reason text,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 3. Employee Work Schedules (HR)
CREATE TABLE IF NOT EXISTS public.employee_schedules (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    employee_id bigint NOT NULL REFERENCES public.employees(id),
    day_of_week integer NOT NULL, -- 0-6 (Sunday-Saturday)
    start_time time,
    end_time time,
    is_off_day boolean DEFAULT false,
    UNIQUE(employee_id, day_of_week)
);

-- 4. Employee Absences (HR)
CREATE TABLE IF NOT EXISTS public.employee_absences (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    employee_id bigint NOT NULL REFERENCES public.employees(id),
    type text NOT NULL, -- vacation, sick, training, other
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'approved', -- pending, approved, rejected
    notes text,
    created_at timestamptz DEFAULT now()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_emp ON public.payroll_adjustments(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_period ON public.payroll_adjustments(period_id);
CREATE INDEX IF NOT EXISTS idx_absences_emp ON public.employee_absences(employee_id);

-- 6. RLS (Simplified for CRM access)
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;

-- Allow all for now (matching current CRM policy for these management tables)
CREATE POLICY "Enable all for authenticated" ON public.payroll_periods FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated" ON public.payroll_adjustments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated" ON public.employee_schedules FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated" ON public.employee_absences FOR ALL USING (auth.role() = 'authenticated');
