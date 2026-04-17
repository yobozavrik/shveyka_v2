import { createServerClient } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

const ALLOWED_ROLES = ['admin', 'manager', 'hr', 'production_head'];

export class EmployeeService {
  static async getAll(auth: any) {
    if (!ALLOWED_ROLES.includes(auth.role)) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('employees')
      .select(`
        id, full_name, employee_number, position, phone, status, payment_type, created_at, updated_at,
        users (id, username, role, is_active, hashed_pin, hashed_password, created_at, updated_at)
      `)
      .neq('status', 'dismissed')
      .order('full_name');

    if (error) return { success: false, error: error.message, status: 500 };

    const employees = (data || []).map((employee: any) => ({
      ...employee,
      access: this.extractAccess(Array.isArray(employee.users) ? employee.users[0] : employee.users),
      users: undefined,
    }));

    return { success: true, data: employees };
  }

  static async create(body: any, auth: any, request?: Request) {
    if (!ALLOWED_ROLES.includes(auth.role)) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    const employeePayload = {
      full_name: typeof body.full_name === 'string' ? body.full_name.trim() : '',
      employee_number: typeof body.employee_number === 'string' ? body.employee_number.trim() || null : null,
      position: typeof body.position === 'string' ? body.position.trim() || null : null,
      phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
      status: body.status || 'active',
      payment_type: body.payment_type || 'piecework',
    };

    if (!employeePayload.full_name) {
      return { success: false, error: 'Вкажіть ПІБ', status: 400 };
    }

    const supabase = await createServerClient(true);

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .insert(employeePayload)
      .select('*')
      .single();

    if (employeeError || !employee) {
      return { success: false, error: employeeError?.message || 'Failed to create employee', status: 500 };
    }

    const accessInput = {
      username: typeof body.username === 'string' ? body.username.trim() || null : null,
      role: body.role || 'worker',
      pin: body.pin || '1234',
      password: body.password || '123456',
      is_active: body.is_active ?? true,
    };

    const { data: access, error: accessError } = await this.writeAccess(
      employee.id,
      accessInput,
      employee.employee_number,
      employee.status,
      null
    );

    if (accessError) {
      await supabase.from('employees').delete().eq('id', employee.id);
      return { success: false, error: accessError.message, status: 500 };
    }

    const resultData = {
      ...employee,
      access: this.extractAccess(access),
    };

    await recordAuditLog({
      action: 'CREATE',
      entityType: 'employee',
      entityId: String(employee.id),
      oldData: null,
      newData: resultData,
      request,
      auth: { id: auth.userId, username: auth.username },
    });

    return { success: true, data: resultData };
  }

  static async getById(employeeId: number, auth: any) {
    if (!this.canAccessEmployee(auth, employeeId)) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    const { data, error } = await this.loadEmployee(employeeId);
    if (error || !data) {
      return { success: false, error: error?.message || 'Not found', status: 404 };
    }

    return {
      success: true,
      data: {
        ...data,
        access: this.extractAccess(Array.isArray(data.users) ? data.users[0] : data.users),
        users: undefined,
      }
    };
  }

  static async update(employeeId: number, body: any, auth: any, request?: Request) {
    if (!this.canModifyEmployee(auth, employeeId)) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    const supabase = await createServerClient(true);

    const { data: existing, error: loadError } = await this.loadEmployee(employeeId);
    if (loadError || !existing) {
      return { success: false, error: 'Employee not found', status: 404 };
    }

    const oldData = {
      ...existing,
      access: this.extractAccess(Array.isArray(existing.users) ? existing.users[0] : existing.users),
    };

    const employeeUpdate = this.buildEmployeeUpdate(body);
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .update(employeeUpdate)
      .eq('id', employeeId)
      .select('*')
      .single();

    if (employeeError || !employee) {
      return { success: false, error: employeeError?.message || 'Failed to update employee', status: 500 };
    }

    const currentUser = Array.isArray(existing.users) ? existing.users[0] : existing.users;
    const accessResult = await this.writeAccess(
      employeeId,
      body,
      employee.employee_number,
      employee.status,
      currentUser
    );

    if (accessResult.error) {
      return { success: false, error: accessResult.error.message, status: 500 };
    }

    const { data: refreshed } = await this.loadEmployee(employeeId);

    const resultData = refreshed
      ? {
          ...refreshed,
          access: this.extractAccess(Array.isArray(refreshed.users) ? refreshed.users[0] : refreshed.users),
          users: undefined,
        }
      : employee;

    await recordAuditLog({
      action: 'UPDATE',
      entityType: 'employee',
      entityId: String(employeeId),
      oldData,
      newData: resultData,
      request: request,
      auth: { id: auth.userId, username: auth.username },
    });

    return { success: true, data: resultData };
  }

  static async delete(employeeId: number, auth: any, request?: Request) {
    if (auth.role !== 'admin') {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    const supabase = await createServerClient(true);
    const { data: existing, error: loadError } = await this.loadEmployee(employeeId);
    if (loadError || !existing) {
      return { success: false, error: 'Employee not found', status: 404 };
    }

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .update({ status: 'dismissed' })
      .eq('id', employeeId)
      .select('*')
      .single();

    if (employeeError || !employee) {
      return { success: false, error: employeeError?.message || 'Failed to dismiss employee', status: 500 };
    }

    await supabase
      .from('users')
      .update({ is_active: false })
      .eq('employee_id', employeeId);

    await recordAuditLog({
      action: 'DELETE',
      entityType: 'employee',
      entityId: String(employeeId),
      oldData: existing,
      newData: employee,
      request: request,
      auth: { id: auth.userId, username: auth.username },
    });

    return { success: true, data: employee };
  }

  // --- Private Helpers ---

  private static canAccessEmployee(auth: any, targetEmployeeId: number): boolean {
    if (ALLOWED_ROLES.includes(auth.role)) return true;
    return auth.employeeId && auth.employeeId === targetEmployeeId;
  }

  private static canModifyEmployee(auth: any, targetEmployeeId: number): boolean {
    return ALLOWED_ROLES.includes(auth.role);
  }

  private static async loadEmployee(employeeId: number) {
    const supabase = await createServerClient(true);
    return supabase
      .from('employees')
      .select(`
        *,
        users (
          id, username, role, is_active, hashed_pin, hashed_password, created_at, updated_at
        )
      `)
      .eq('id', employeeId)
      .single();
  }

  private static extractAccess(user: any) {
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      has_pin: Boolean(user.hashed_pin),
      has_password: Boolean(user.hashed_password),
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  private static buildEmployeeUpdate(body: any) {
    const allowed = [
      'full_name', 'employee_number', 'position', 'phone', 'status',
      'payment_type', 'birth_date', 'family_info', 'address',
      'skill_level', 'individual_coefficient',
    ];
    const update: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'individual_coefficient') {
          update[key] = body[key] === null || body[key] === '' ? null : Number(body[key]);
        } else {
          update[key] = typeof body[key] === 'string' ? body[key].trim() || null : body[key];
        }
      }
    }
    return update;
  }

  private static async writeAccess(employeeId: number, body: any, employeeNumber: string | null, status: string, existingUser: any) {
    const supabase = await createServerClient(true);
    const access = {
      username: typeof body.username === 'string' ? body.username.trim() || null : null,
      role: typeof body.role === 'string' ? body.role.trim() || null : null,
      pin: typeof body.pin === 'string' ? body.pin.trim() || null : null,
      password: typeof body.password === 'string' ? body.password.trim() || null : null,
      is_active: typeof body.is_active === 'boolean' ? body.is_active : null,
    };

    if (existingUser) {
      const updates: any = {};
      if (access.username) updates.username = access.username;
      if (access.role) updates.role = access.role;
      if (access.is_active !== null) updates.is_active = access.is_active;
      if (access.pin) updates.hashed_pin = await hashPassword(access.pin);
      if (access.password) updates.hashed_password = await hashPassword(access.password);

      if (Object.keys(updates).length === 0) return { data: existingUser, error: null };

      return supabase.from('users').update(updates).eq('employee_id', employeeId).select().single();
    }

    if (!access.role || !access.pin || !access.password) return { data: null, error: null };

    return supabase.from('users').insert({
      username: access.username || employeeNumber || `employee-${employeeId}`,
      role: access.role,
      employee_id: employeeId,
      hashed_pin: await hashPassword(access.pin),
      hashed_password: await hashPassword(access.password),
      is_active: access.is_active ?? status === 'active',
    }).select().single();
  }
}
