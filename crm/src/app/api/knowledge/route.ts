import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const user = await getAuth();
    if (!user) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) return ApiResponse.error('Query required', ERROR_CODES.BAD_REQUEST, 400);

    const { KnowledgeRepository } = await import('@/lib/ai/knowledge');
    const repo = new KnowledgeRepository();
    const results = await repo.searchKnowledge(query, 10);

    return ApiResponse.success({ results });
  } catch (error: any) {
    return ApiResponse.handle(error, 'knowledge_get');
  }
}
