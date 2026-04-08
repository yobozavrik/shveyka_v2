import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-server';
import { ingestKnowledge } from '@/lib/ai/knowledge';

export async function POST(request: Request) {
  try {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { filePath } = await request.json();

    await ingestKnowledge(filePath);

    return NextResponse.json({ 
      success: true,
      message: filePath 
        ? `Ingested ${filePath}` 
        : 'Ingested all vault files'
    });
  } catch (error: any) {
    console.error('Knowledge ingestion error:', error);
    return NextResponse.json({ 
      error: 'Ошибка при загрузке знаний',
      details: error.message 
    }, { status: 500 });
  }
}
