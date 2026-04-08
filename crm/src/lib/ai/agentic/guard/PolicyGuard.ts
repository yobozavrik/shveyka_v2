export type UserRole = 'worker' | 'master' | 'manager' | 'accountant';

export type ToolCategory = 'order' | 'payroll' | 'knowledge';

const ROLE_PERMISSIONS: Record<UserRole, Record<ToolCategory, string[]>> = {
  worker: {
    order: ['get_order_summary'],
    payroll: ['get_worker_payroll_summary', 'get_entry_payroll_explanation'],
    knowledge: ['search_knowledge', 'get_document']
  },
  master: {
    order: ['get_order_summary', 'get_order_blockers', 'get_order_timeline'],
    payroll: ['get_worker_payroll_summary', 'get_entry_payroll_explanation', 'get_pending_entries'],
    knowledge: ['search_knowledge', 'get_document']
  },
  manager: {
    order: ['get_order_summary', 'get_order_blockers', 'get_order_timeline', 'get_order_payroll_impact'],
    payroll: ['get_worker_payroll_summary', 'get_entry_payroll_explanation', 'get_pending_entries'],
    knowledge: ['search_knowledge', 'get_document']
  },
  accountant: {
    order: ['get_order_summary', 'get_order_payroll_impact'],
    payroll: ['get_worker_payroll_summary', 'get_entry_payroll_explanation', 'get_pending_entries'],
    knowledge: ['search_knowledge', 'get_document']
  }
};

const SENSITIVE_FIELDS: Record<UserRole, string[]> = {
  worker: ['other_employee_payroll', 'cost_prices', 'margins'],
  master: ['cost_prices', 'margins'],
  manager: [],
  accountant: []
};

export class PolicyGuard {
  private role: UserRole;
  
  constructor(role: UserRole) {
    this.role = role;
  }
  
  canUseTool(toolName: string): boolean {
    for (const category of Object.keys(ROLE_PERMISSIONS[this.role]) as ToolCategory[]) {
      if (ROLE_PERMISSIONS[this.role][category].includes(toolName)) {
        return true;
      }
    }
    return false;
  }
  
  filterOutput(data: any, toolName: string): any {
    if (!data) return data;
    
    const sensitiveFields = SENSITIVE_FIELDS[this.role];
    
    const filtered = { ...data };
    
    for (const field of sensitiveFields) {
      if (field in filtered) {
        delete filtered[field];
      }
    }
    
    return filtered;
  }
  
  maskSensitive(data: any, fields?: string[]): any {
    const maskFields = fields || SENSITIVE_FIELDS[this.role];
    
    const masked = { ...data };
    
    for (const field of maskFields) {
      if (field in masked) {
        masked[field] = '***';
      }
    }
    
    return masked;
  }
  
  canAccessWorkerPayroll(targetWorkerId: number, currentWorkerId?: number): boolean {
    if (this.role === 'manager' || this.role === 'accountant') {
      return true;
    }
    
    if (this.role === 'worker') {
      return targetWorkerId === currentWorkerId;
    }
    
    return false;
  }
  
  getKnowledgeDomains(): string[] {
    switch (this.role) {
      case 'worker':
        return ['production', 'quality'];
      case 'master':
        return ['production', 'quality', 'orders'];
      case 'manager':
      case 'accountant':
        return ['production', 'quality', 'orders', 'payroll'];
      default:
        return [];
    }
  }
}
