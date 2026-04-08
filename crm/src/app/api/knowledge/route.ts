import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-server';
import { KnowledgeRepository } from '@/lib/ai/knowledge';

export async function GET(request: Request) {
  try {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    const repo = new KnowledgeRepository();
    const results = await repo.searchKnowledge(query, 10);

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Knowledge search error:', error);
    return NextResponse.json({ 
      error: 'Ошибка при поиске',
      details: error.message 
    }, { status: 500 });
  }
}
