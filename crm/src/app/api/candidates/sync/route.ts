import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { vacancyId } = await req.json();
    
    if (!vacancyId) return ApiResponse.error('vacancyId is required', ERROR_CODES.BAD_REQUEST, 400);

    const rootPath = path.resolve(process.cwd(), '..');
    const scraperPath = path.join(rootPath, 'scrapers', 'workua.py');
    
    console.log(`🚀 Starting Work.ua Resume sync for vacancy ${vacancyId}: python "${scraperPath}" ${vacancyId}`);
    
    const { stdout, stderr } = await execAsync(`python "${scraperPath}" ${vacancyId}`);
    
    if (stderr && !stdout) {
      console.error('❌ Scraper error:', stderr);
      return ApiResponse.error(stderr, ERROR_CODES.INTERNAL_ERROR, 500);
    }

    return ApiResponse.success({ 
      message: 'Work.ua resume sync completed',
      output: stdout
    });
    
  } catch (error: any) {
    return ApiResponse.handle(error, 'candidates_sync');
  }
}
