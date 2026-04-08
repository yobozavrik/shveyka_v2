const API_BASE = '/api';

export async function apiRequest<T>(
  path: string, 
  options: RequestInit = {}
): Promise<T> {
  let token = '';
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|; )mes_auth_token=([^;]*)/);
    if (match) token = match[1];
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Помилка мережі' }));
    throw new Error(error.message || `Помилка ${res.status}`);
  }

  return res.json();
}

// Auth
export const login = (credentials: any) => 
  apiRequest<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
export const getMe = () => apiRequest<any>('/auth/me');

// Employees
export const getEmployees = () => apiRequest<any[]>('/employees');
export const createEmployee = (data: any) => apiRequest<any>('/employees', { method: 'POST', body: JSON.stringify(data) });
export const getEmployee = (id: number) => apiRequest<any>(`/employees/${id}`);
export const updateEmployee = (id: number, data: any) => apiRequest<any>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteEmployee = (id: number) => apiRequest<any>(`/employees/${id}`, { method: 'DELETE' });

// Operations & Products
export const getOperations = () => apiRequest<any[]>('/operations');
export const createOperation = (data: any) => apiRequest<any>('/operations', { method: 'POST', body: JSON.stringify(data) });
export const getProducts = () => apiRequest<any[]>('/product-models');
export const createProduct = (data: any) => apiRequest<any>('/product-models', { method: 'POST', body: JSON.stringify(data) });

// Route Cards
export const getRouteCards = () => apiRequest<any[]>('/route-cards');
export const getRouteCard = (id: number) => apiRequest<any>(`/route-cards/${id}`);
export const createRouteCard = (data: any) => apiRequest<any>('/route-cards', { method: 'POST', body: JSON.stringify(data) });
export const addOperationToCard = (cardId: number, data: any) => apiRequest<any>(`/route-cards/${cardId}/operations`, { method: 'POST', body: JSON.stringify(data) });
export const deleteRouteCard = (id: number) => apiRequest<any>(`/route-cards/${id}`, { method: 'DELETE' });

// Batches
export const getBatches = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiRequest<any[]>(`/batches${qs}`);
};
export const createBatch = (data: any) => apiRequest<any>('/batches', { method: 'POST', body: JSON.stringify(data) });
export const updateBatch = (id: number, data: any) => apiRequest<any>(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteBatch = (id: number) => apiRequest<any>(`/batches/${id}`, { method: 'DELETE' });

// Entries
export const getEntries = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiRequest<any[]>(`/entries${qs}`);
};
export const createEntry = (data: any) => apiRequest<any>('/entries', { method: 'POST', body: JSON.stringify(data) });
export const approveEntry = (data: any) => apiRequest<any>('/entries/approve', { method: 'POST', body: JSON.stringify(data) });

// Payroll
export const getPayrollPeriods = () => apiRequest<any[]>('/payroll/periods');
export const createPayrollPeriod = (data: any) => apiRequest<any>('/payroll/periods', { method: 'POST', body: JSON.stringify(data) });
export const calculatePayroll = (data: any) => apiRequest<any>('/payroll/calculate', { method: 'POST', body: JSON.stringify(data) });
export const getPayrollAdjustments = () => apiRequest<any[]>('/payroll/adjustments');
export const createPayrollAdjustment = (data: any) => apiRequest<any>('/payroll/adjustments', { method: 'POST', body: JSON.stringify(data) });

// Analytics
export const getDashboard = (period = 'week') => apiRequest<any>(`/analytics/dashboard?period=${period}`);
export const getProductionTrend = (days = 30) => apiRequest<any>(`/analytics/production-trend?days=${days}`);
export const getTopEmployees = (days = 30, limit = 10) => apiRequest<any>(`/analytics/employees/top?days=${days}&limit=${limit}`);
export const getDepartmentStats = (days = 30) => apiRequest<any>(`/analytics/departments?days=${days}`);

// HR
export const getSchedule = (id: number) => apiRequest<any>(`/employees/${id}/schedule`);
export const upsertSchedule = (id: number, data: any) => apiRequest<any>(`/employees/${id}/schedule`, { method: 'PUT', body: JSON.stringify(data) });
export const getAbsences = (id: number, year?: number) => {
  const qs = year ? `?year=${year}` : '';
  return apiRequest<any[]>(`/absences?employee_id=${id}${qs}`);
};
export const createAbsence = (data: any) => apiRequest<any>('/absences', { method: 'POST', body: JSON.stringify(data) });
export const updateAbsence = (id: number, data: any) => apiRequest<any>(`/absences/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAbsence = (id: number) => apiRequest<any>(`/absences/${id}`, { method: 'DELETE' });
export const getHRSummary = (id: number, year?: number) => {
  const qs = year ? `?year=${year}` : '';
  return apiRequest<any>(`/employees/${id}/hr-summary${qs}`);
};

// Defects & KeyCRM
export const getDefects = () => apiRequest<any[]>('/defects');
export const createDefect = (data: any) => apiRequest<any>('/defects', { method: 'POST', body: JSON.stringify(data) });
export const syncOrders = () => apiRequest<any>('/keycrm/sync-orders', { method: 'POST' });
export const getSyncLog = () => apiRequest<any[]>('/keycrm/logs');
