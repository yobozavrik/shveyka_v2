import { NextResponse } from 'next/server';
import { getProductionInsights, askAssistant } from '@/lib/ai/assistant';
import { getAuth } from '@/lib/auth-server';
import { AgenticOrchestrator } from '@/lib/ai/agentic/application/AgenticOrchestrator';

const orchestrator = new AgenticOrchestrator();

export async function GET(request: Request) {
  try {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');
    const action = searchParams.get('action');
    const orderId = searchParams.get('orderId');
    const employeeId = searchParams.get('employeeId');
    const periodId = searchParams.get('periodId');
    const sopName = searchParams.get('sop');
    const query = searchParams.get('q');

    if (action === 'explain-order' && orderId) {
      const explanation = await orchestrator.explainOrder(parseInt(orderId));
      return NextResponse.json({ explanation, version: '2.1.0' });
    }

    if (action === 'explain-payroll') {
      const explanation = await orchestrator.explainPayroll(
        employeeId ? parseInt(employeeId) : undefined,
        periodId ? parseInt(periodId) : undefined
      );
      return NextResponse.json({ explanation, version: '2.1.0' });
    }

    if (action === 'get-sop' && sopName) {
      const content = await orchestrator.retrieveSOP(sopName);
      return NextResponse.json({ content, version: '2.1.0' });
    }

    if (action === 'search' && query) {
      const results = await orchestrator.searchKnowledge(query, 5);
      return NextResponse.json({ results, version: '2.1.0' });
    }

    if (mode === 'agentic') {
      const insights = await orchestrator.getSmartInsights();
      return NextResponse.json({ insights, version: '2.0.0-agentic' });
    }

    const insights = await getProductionInsights();
    return NextResponse.json({ insights, version: '1.0.0-classic' });
  } catch (error: any) {
    console.error('AI GET Route Error:', error);
    return NextResponse.json({ 
      error: 'Ошибка при получении инсайтов',
      details: error.message 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { question, history, mode, action, orderId, employeeId, periodId } = await request.json();

    if (action === 'explain-order' && orderId) {
      const explanation = await orchestrator.explainOrder(orderId);
      return NextResponse.json({ explanation, version: '2.1.0' });
    }

    if (action === 'explain-payroll') {
      const explanation = await orchestrator.explainPayroll(employeeId, periodId);
      return NextResponse.json({ explanation, version: '2.1.0' });
    }
    
    if (!question) {
      return NextResponse.json({ error: 'Сообщение обязательно' }, { status: 400 });
    }

    if (mode === 'agentic') {
      const answer = await orchestrator.handleAgenticQuery(question, history || []);
      return NextResponse.json({ answer, version: '2.0.0-agentic' });
    }

    const answer = await askAssistant(question, history || []);
    return NextResponse.json({ answer, version: '1.0.0-classic' });
  } catch (error: any) {
    console.error('AI POST Route Error:', error);
    return NextResponse.json({ 
      error: 'Ошибка при обработке вопроса',
      details: error.message 
    }, { status: 500 });
  }
}
