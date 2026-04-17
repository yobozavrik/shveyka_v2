import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-server';
import { AgenticOrchestrator } from '@/lib/ai/agentic/application/AgenticOrchestrator';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);
    const { role, employeeId: authEmployeeId } = auth;

    const body = await request.json();
    const { question, history, mode = 'agentic', action, orderId, employeeId, periodId } = body;

    const orchestrator = new AgenticOrchestrator();

    // Специальные быстрые действия
    if (action === 'explain-order' && orderId) {
      const answer = await orchestrator.explainOrder(parseInt(orderId));
      return ApiResponse.success({ answer, version: '2.1.0', role });
    }

    if (action === 'explain-payroll') {
      const empId = employeeId ? parseInt(employeeId) : (authEmployeeId || undefined);
      const perId = periodId ? parseInt(periodId) : undefined;
      const answer = await orchestrator.explainPayroll(empId, perId);
      return ApiResponse.success({ answer, version: '2.1.0', role });
    }

    if (!question) {
      return ApiResponse.error('Повідомлення обов\'язкове', ERROR_CODES.BAD_REQUEST, 400);
    }

    let answer: string;
    if (mode === 'agentic') {
      answer = await orchestrator.handleAgenticQuery(question, history || []);
    } else {
      answer = await orchestrator.handleUserQuery(question, history || []);
    }
    
    return ApiResponse.success({
      answer,
      version: '2.1.0',
      role
    });

  } catch (error: any) {
    return ApiResponse.handle(error, 'ai_assistant');
  }
}
