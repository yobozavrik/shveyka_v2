'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search, Shield, Pencil, Trash2, Users } from 'lucide-react';
import { showConfirm } from '@/lib/confirm';

type EmployeeAccess = {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  has_pin: boolean;
  has_password: boolean;
};

type EmployeeRow = {
  id: number;
  full_name: string;
  employee_number: string | null;
  position: string | null;
  phone: string | null;
  status: string;
  payment_type: string;
  hire_date: string | null;
  birth_date: string | null;
  family_info: string | null;
  address: string | null;
  skill_level: string | null;
  individual_coefficient: number | null;
  access: EmployeeAccess | null;
};

type PositionOption = {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
  default_role?: string | null;
};

type EmployeeForm = {
  full_name: string;
  employee_number: string;
  position: string;
  phone: string;
  status: string;
  payment_type: string;
  username: string;
  role: string;
  pin: string;
  password: string;
  is_active: boolean;
};

const EMPTY_FORM: EmployeeForm = {
  full_name: '',
  employee_number: '',
  position: '',
  phone: '',
  status: 'active',
  payment_type: 'piecework',
  username: '',
  role: 'cutting',
  pin: '',
  password: '',
  is_active: true,
};

const ROLE_OPTIONS = [
  { value: 'cutting', label: 'Розкрій' },
  { value: 'sewing', label: 'Пошиття' },
  { value: 'embroidery', label: 'Вишивка' },
  { value: 'overlock', label: 'Оверлок' },
  { value: 'straight_stitch', label: 'Прямострочка' },
  { value: 'coverlock', label: 'Розпошив' },
  { value: 'packaging', label: 'Пакування' },
  { value: 'qc', label: 'Контроль якості' },
  { value: 'master', label: 'Майстер' },
  { value: 'production_head', label: 'Начальник виробництва' },
  { value: 'admin', label: 'Адміністратор' },
  { value: 'hr', label: 'Відділ кадрів' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Активний' },
  { value: 'vacation', label: 'У відпустці' },
  { value: 'dismissed', label: 'Звільнений' },
  { value: 'trainee', label: 'Стажер' },
];

const PAYMENT_OPTIONS = [
  { value: 'piecework', label: 'Відрядна' },
  { value: 'salary', label: 'Оклад' },
];

function roleLabel(role?: string | null) {
  const option = ROLE_OPTIONS.find((item) => item.value === role);
  return option?.label || 'Невідомо';
}

function roleBadge(role?: string | null) {
  switch (role) {
    case 'cutting':
      return 'bg-emerald-500/15 text-emerald-600';
    case 'sewing':
      return 'bg-blue-500/15 text-blue-600';
    case 'embroidery':
      return 'bg-indigo-500/15 text-indigo-600';
    case 'overlock':
      return 'bg-violet-500/15 text-violet-600';
    case 'straight_stitch':
      return 'bg-sky-500/15 text-sky-600';
    case 'coverlock':
      return 'bg-fuchsia-500/15 text-fuchsia-600';
    case 'packaging':
      return 'bg-amber-500/15 text-amber-600';
    case 'master':
      return 'bg-rose-500/15 text-rose-600';
    case 'production_head':
      return 'bg-slate-500/15 text-slate-700';
    case 'admin':
      return 'bg-gray-500/15 text-gray-700';
    default:
      return 'bg-cyan-500/15 text-cyan-600';
  }
}

function statusLabel(status?: string | null) {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  return option?.label || 'Невідомо';
}

function paymentLabel(paymentType?: string | null) {
  const option = PAYMENT_OPTIONS.find((item) => item.value === paymentType);
  return option?.label || 'Невідомо';
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [employeesRes, positionsRes] = await Promise.all([
        fetch('/api/employees', { cache: 'no-store' }),
        fetch('/api/positions', { cache: 'no-store' }),
      ]);

      const employeesJson = await employeesRes.json();
      const positionsJson = await positionsRes.json();

      if (!employeesRes.ok) {
        throw new Error(employeesJson.error || 'Не вдалося завантажити співробітників');
      }

      if (!positionsRes.ok) {
        throw new Error(positionsJson.error || 'Не вдалося завантажити посади');
      }

      setEmployees(Array.isArray(employeesJson) ? employeesJson : []);
      setPositions(Array.isArray(positionsJson) ? positionsJson : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити дані');
      setEmployees([]);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesQuery =
        !query ||
        employee.full_name.toLowerCase().includes(query) ||
        (employee.employee_number || '').toLowerCase().includes(query) ||
        (employee.position || '').toLowerCase().includes(query) ||
        roleLabel(employee.access?.role).toLowerCase().includes(query);
      const matchesRole = roleFilter === 'all' || employee.access?.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [employees, roleFilter, search]);

  const positionOptions = useMemo(() => {
    const activePositions = positions.filter((position) => position.is_active);
    if (!editing?.position) return activePositions;
    const exists = activePositions.some((position) => position.name === editing.position);
    if (exists) return activePositions;
    return [...activePositions, { id: -1, name: editing.position, is_active: true, sort_order: 9999 }];
  }, [editing?.position, positions]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (employee: EmployeeRow) => {
    setEditing(employee);
    setForm({
      full_name: employee.full_name || '',
      employee_number: employee.employee_number || '',
      position: employee.position || '',
      phone: employee.phone || '',
      status: employee.status || 'active',
      payment_type: employee.payment_type || 'piecework',
      username: employee.access?.username || employee.employee_number || '',
      role: employee.access?.role || 'cutting',
      pin: '',
      password: '',
      is_active: employee.access?.is_active ?? true,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    if (!form.position.trim()) {
      setError('Оберіть посаду зі списку');
      setSaving(false);
      return;
    }

    const payload = {
      full_name: form.full_name.trim(),
      employee_number: form.employee_number.trim(),
      position: form.position.trim(),
      phone: form.phone.trim(),
      status: form.status,
      payment_type: form.payment_type,
      username: form.username.trim() || null,
      role: form.role,
      pin: form.pin.trim() || null,
      password: form.password,
      is_active: form.is_active,
    };

    try {
      const res = await fetch(editing ? `/api/employees/${editing.id}` : '/api/employees', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Не вдалося зберегти співробітника');
      }
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося зберегти співробітника');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (employee: EmployeeRow) => {
    if (!await showConfirm(`Видалити співробітника ${employee.full_name}?`)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Не вдалося видалити співробітника');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося видалити співробітника');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black text-[var(--text-1)]">
            <Users className="h-8 w-8 text-emerald-500" />
            Співробітники
          </h1>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            Довідник персоналу з ролями, PIN і паролем для worker app.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"
        >
          <Plus className="h-4 w-4" />
          Додати співробітника
        </button>
      </div>

      <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук за ПІБ, табельним №, посадою або роллю"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] py-3 pl-11 pr-4 text-sm outline-none"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
          >
            <option value="all">Усі ролі</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-20 text-center text-sm text-[var(--text-3)]">
            Немає співробітників за цим фільтром.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)] text-sm">
              <thead className="bg-[var(--bg-base)]/80 text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
                <tr>
                  <th className="px-6 py-4 text-left">ПІБ</th>
                  <th className="px-6 py-4 text-left">Табельний №</th>
                  <th className="px-6 py-4 text-left">Посада</th>
                  <th className="px-6 py-4 text-left">Роль</th>
                  <th className="px-6 py-4 text-left">Доступ</th>
                  <th className="px-6 py-4 text-left">Статус</th>
                  <th className="px-6 py-4 text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((employee) => (
                  <tr key={employee.id} className="hover:bg-[var(--bg-base)]/60">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[var(--text-1)]">{employee.full_name}</div>
                      <div className="text-xs text-[var(--text-3)]">{employee.phone || 'Без телефону'}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[var(--text-2)]">{employee.employee_number || '—'}</td>
                    <td className="px-6 py-4 text-[var(--text-2)]">{employee.position || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase ${roleBadge(employee.access?.role)}`}>
                        {roleLabel(employee.access?.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-[var(--text-2)]">
                      {employee.access ? (
                        <div className="space-y-1">
                          <div>Логін: {employee.access.username}</div>
                          <div>PIN: {employee.access.has_pin ? 'Так' : 'Ні'}</div>
                          <div>Пароль: {employee.access.has_password ? 'Так' : 'Ні'}</div>
                        </div>
                      ) : (
                        'Немає'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-black uppercase ${
                          employee.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : 'bg-slate-500/15 text-slate-600'
                        }`}
                      >
                        {statusLabel(employee.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(employee)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-xs font-bold"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Редагувати
                        </button>
                        <button
                          onClick={() => handleDeactivate(employee)}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Видалити
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-emerald-500">
                  {editing ? 'Редагування' : 'Новий співробітник'}
                </div>
                <h2 className="mt-1 text-2xl font-black text-[var(--text-1)]">
                  {editing ? editing.full_name : 'Додати співробітника'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm font-bold"
              >
                Закрити
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">ПІБ</span>
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm((current) => ({ ...current, full_name: e.target.value }))}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
                    placeholder="Іваненко Іван Іванович"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">Табельний №</span>
                  <input
                    value={form.employee_number}
                    onChange={(e) => setForm((current) => ({ ...current, employee_number: e.target.value }))}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
                    placeholder="001"
                    required
                  />
                </label>

                  <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">Посада</span>
                  <select
                    value={form.position}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      const selectedPos = positions.find((p) => p.name === selectedName);
                      setForm((current) => ({
                        ...current,
                        position: selectedName,
                        role: selectedPos?.default_role || current.role,
                      }));
                    }}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
                    required
                  >
                    <option value="">Оберіть посаду</option>
                    {positionOptions.map((position) => (
                      <option key={position.id} value={position.name}>
                        {position.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">Телефон</span>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
                    placeholder="+380..."
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">Статус</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">Тип оплати</span>
                  <select
                    value={form.payment_type}
                    onChange={(e) => setForm((current) => ({ ...current, payment_type: e.target.value }))}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
                  >
                    {PAYMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-base)] p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-[var(--text-1)]">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  Доступ до worker app
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">Логін</span>
                    <input
                      value={form.username}
                      onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm outline-none"
                      placeholder="Табельний №"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">Роль</span>
                    <select
                      value={form.role}
                      onChange={(e) => setForm((current) => ({ ...current, role: e.target.value }))}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm outline-none"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">PIN</span>
                    <input
                      value={form.pin}
                      onChange={(e) => setForm((current) => ({ ...current, pin: e.target.value }))}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm outline-none"
                      placeholder={editing ? 'Залиште порожнім, щоб не змінювати' : '1234'}
                      type="password"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">Пароль</span>
                    <input
                      value={form.password}
                      onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm outline-none"
                      placeholder={editing ? 'Залиште порожнім, щоб не змінювати' : 'Пароль'}
                      type="password"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-3 text-sm font-semibold text-[var(--text-2)]">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-[var(--border)]"
                  />
                  Активний доступ
                </label>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-black text-[var(--text-2)]"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                  >
                    {saving ? 'Збереження...' : editing ? 'Оновити' : 'Створити'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
