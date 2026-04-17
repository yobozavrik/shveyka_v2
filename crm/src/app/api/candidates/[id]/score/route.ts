import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { AIProviderFactory } from '@/lib/ai/agentic/infrastructure/AIProviderFactory';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const supabase = await createServerClient(true);

    // 1. Fetch Candidate and Vacancy details
    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .select('*, vacancies(*)')
      .eq('id', parseInt(id))
      .single();

    if (candError) return ApiResponse.handle(candError, 'candidate_score');
    if (!candidate) return ApiResponse.error('Кандидата не знайдено', ERROR_CODES.NOT_FOUND, 404);

    if (!candidate.resume_text) {
      return ApiResponse.error('Відсутній текст резюме для аналізу', ERROR_CODES.BAD_REQUEST, 400);
    }

    // 2. Prepare Prompt
    const vacancy = candidate.vacancies;
    const prompt = `
      Ты — эксперт по найму персонала в швейное производство. 
      Твоя задача: оценить соответствие кандидата вакансии.
      
      ВАКАНСИЯ: "${vacancy.title}"
      ОПИСАНИЕ: ${vacancy.description}
      ТРЕБОВАНИЯ: ${JSON.stringify(vacancy.requirements)}
      
      РЕЗЮМЕ КАНДИДАТА:
      ${candidate.resume_text}
      
      ОТВЕТЬ ТОЛЬКО В ФОРМАТЕ JSON:
      {
        "score": (число від 0 до 100),
        "pros": ["сильна сторона 1", "сильна сторона 2", ...],
        "cons": ["слабка сторона або ризик 1", "риск 2", ...],
        "summary": "Короткий висновок на 2 речення УКРАЇНСЬКОЮ мовою."
      }
    `;

    // 3. Call AI
    const ai = AIProviderFactory.getProvider();
    const response = await ai.generateResponse(prompt);
    
    // Parse JSON safely
    let result;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch (e) {
      console.error('AI JSON Parse Error:', response);
      return ApiResponse.error('Помилка форматування відповіді AI', ERROR_CODES.INTERNAL_ERROR, 500);
    }

    // 4. Update Candidate record
    const { data: updated, error: updateError } = await supabase
      .from('candidates')
      .update({
        ai_score: result.score,
        ai_analysis: {
          pros: result.pros,
          cons: result.cons,
          summary: result.summary
        }
      })
      .eq('id', parseInt(id))
      .select()
      .single();

    if (updateError) return ApiResponse.handle(updateError, 'candidate_score');

    return ApiResponse.success(updated);
  } catch (e: any) {
    return ApiResponse.handle(e, 'candidate_score');
  }
}
