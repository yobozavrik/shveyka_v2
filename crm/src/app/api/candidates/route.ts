import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { searchParams } = new URL(request.url);
    const vacancyId = searchParams.get('vacancyId');
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const specialization = searchParams.get('specialization');
    const minScore = searchParams.get('minScore');
    const maxScore = searchParams.get('maxScore');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase = await createServerClient(true);
    let query = supabase
      .from('candidates')
      .select('*, vacancies(title)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (vacancyId) query = query.eq('vacancy_id', vacancyId);
    if (status) query = query.eq('status', status);
    if (source) query = query.eq('source', source);
    if (specialization) query = query.eq('specialization', specialization);
    if (minScore) query = query.gte('ai_score', parseInt(minScore, 10));
    if (maxScore) query = query.lte('ai_score', parseInt(maxScore, 10));
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,position_desired.ilike.%${search}%,resume_text.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) {
      return ApiResponse.handle(error, 'candidates_list');
    }

    return ApiResponse.success({
      data,
      total: count,
      limit,
      offset,
    });
  } catch (e: any) {
    return ApiResponse.handle(e, 'candidates_list');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = await request.json();
    const supabase = await createServerClient(true);

    const candidateData = {
      vacancy_id: body.vacancy_id || null,
      full_name: body.full_name,
      phone: body.phone || null,
      email: body.email || null,
      resume_text: body.resume_text || null,
      resume_url: body.resume_url || null,
      birth_date: body.birth_date || null,
      city: body.city || null,
      position_desired: body.position_desired || null,
      salary_expected: body.salary_expected || null,
      experience_years: body.experience_years || null,
      specialization: body.specialization || null,
      specializations: body.specializations || null,
      machine_experience: body.machine_experience || null,
      production_type_experience: body.production_type_experience || null,
      skill_level: body.skill_level || null,
      work_type_preference: body.work_type_preference || null,
      remote_preference: body.remote_preference || false,
      schedule_preferred: body.schedule_preferred || null,
      work_experience: body.work_experience || [],
      education: body.education || [],
      languages: body.languages || [],
      skills: body.skills || [],
      training: body.training || [],
      source: body.source || 'manual',
      source_job_id: body.source_job_id || null,
      source_url: body.source_url || null,
      ai_score: body.ai_score || null,
      ai_analysis: body.ai_analysis || null,
      ai_strengths: body.ai_strengths || null,
      ai_concerns: body.ai_concerns || null,
      ai_recommended_position: body.ai_recommended_position || null,
      ai_analyzed_at: body.ai_analyzed_at || null,
      status: body.status || 'new',
      hr_notes: body.hr_notes || null,
      interview_date: body.interview_date || null,
      interview_notes: body.interview_notes || null,
      contact_history: body.contact_history || [],
    };

    const { data, error } = await supabase
      .from('candidates')
      .insert([candidateData])
      .select()
      .single();

    if (error) {
      return ApiResponse.handle(error, 'candidates_create');
    }

    // Record audit log
    try {
      const { recordAuditLog } = await import('@/lib/audit');
      await recordAuditLog({
        action: 'CREATE',
        entityType: 'candidate',
        entityId: data.id.toString(),
        newData: data,
        request: request,
        auth: { id: auth.userId, username: auth.username }
      });
    } catch (auditError) {
      console.warn('Failed to record audit log:', auditError);
    }

    return ApiResponse.success(data, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'candidates_create');
  }
}
