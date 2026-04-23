import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function POST(request: Request) {
  try {
    const user = await getAuth();
    if (!user) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { filePath } = await request.json();
    const { ingestKnowledge } = await import('@/lib/ai/knowledge');

    await ingestKnowledge(filePath);

    return ApiResponse.success({ 
      message: filePath 
        ? `Ingested ${filePath}` 
        : 'Ingested all vault files'
    });
  } catch (error: any) {
    return ApiResponse.handle(error, 'knowledge_ingest');
  }
}
