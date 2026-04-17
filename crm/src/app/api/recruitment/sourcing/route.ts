import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';
import {
  searchCandidates,
  analyzeCandidates,
  importCandidatesToDb,
  getSourcingStats,
  ScraperConfig,
} from '@/lib/recruitment/CandidateScout';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'stats') {
      const stats = await getSourcingStats();
      return ApiResponse.success(stats);
    }

    return ApiResponse.error('Невідома дія', ERROR_CODES.BAD_REQUEST, 400);
  } catch (e: any) {
    return ApiResponse.handle(e, 'recruitment');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = await request.json();
    const action = body.action;

    if (action === 'search') {
      const config: ScraperConfig = {
        keywords: body.keywords || ['шваля', 'закрійник', 'майстер швейного'],
        cities: body.cities || [],
        pages: body.pages || 2,
        sources: ['workua'],
      };

      const result = await searchCandidates(config);
      return ApiResponse.success({
        success: result.success,
        candidatesFound: result.candidatesFound,
        relevantCount: result.relevantCount,
        outputPath: result.outputPath,
        errors: result.errors,
      });
    }

    if (action === 'analyze') {
      const inputPath = body.inputPath;
      const outputPath = body.outputPath;

      if (!inputPath) {
        return ApiResponse.error('inputPath обов\'язковий', ERROR_CODES.BAD_REQUEST, 400);
      }

      const result = await analyzeCandidates(inputPath, outputPath);
      return ApiResponse.success(result);
    }

    if (action === 'import') {
      const inputPath = body.inputPath;
      const vacancyId = body.vacancyId;

      if (!inputPath) {
        return ApiResponse.error('inputPath обов\'язковий', ERROR_CODES.BAD_REQUEST, 400);
      }

      const result = await importCandidatesToDb(inputPath, vacancyId);
      return ApiResponse.success({
        imported: result.imported,
        errors: result.errors,
      });
    }

    if (action === 'full_cycle') {
      const config: ScraperConfig = {
        keywords: body.keywords || ['шваля', 'закрійник', 'майстер швейного'],
        cities: body.cities || [],
        pages: body.pages || 2,
        sources: ['workua'],
      };
      const vacancyId = body.vacancyId;

      const searchResult = await searchCandidates(config);
      if (!searchResult.success || !searchResult.outputPath) {
        return ApiResponse.error('Помилка пошуку', ERROR_CODES.INTERNAL_ERROR, 500, {
          success: false,
          stage: 'search',
          errors: searchResult.errors,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const analyzeResult = await analyzeCandidates(searchResult.outputPath);
      if (!analyzeResult.success) {
        return ApiResponse.error('Помилка аналізу', ERROR_CODES.INTERNAL_ERROR, 500, {
          success: false,
          stage: 'analyze',
          errors: analyzeResult.errors,
          searchOutput: searchResult.outputPath,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const importResult = await importCandidatesToDb(
        searchResult.outputPath.replace('.json', '') + '.json',
        vacancyId
      );

      return ApiResponse.success({
        success: true,
        search: {
          candidatesFound: searchResult.candidatesFound,
          relevantCount: searchResult.relevantCount,
        },
        analysis: {
          analyzedCount: analyzeResult.analyzedCount,
          avgScore: analyzeResult.avgScore,
        },
        import: {
          imported: importResult.imported,
          errors: importResult.errors,
        },
      });
    }

    return ApiResponse.error('Невідома дія', ERROR_CODES.BAD_REQUEST, 400);
  } catch (e: any) {
    return ApiResponse.handle(e, 'recruitment');
  }
}
