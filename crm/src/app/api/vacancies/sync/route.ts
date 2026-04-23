import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Path to the scraper relative to the root
    // Root is parent of 'crm'
    const rootPath = path.resolve(process.cwd(), '..');
    const scraperPath = path.join(rootPath, 'scrapers', 'workua.py');
    
    console.log(`🚀 Starting Work.ua sync: python "${scraperPath}"`);
    
    // Run the scraper
    const { stdout, stderr } = await execAsync(`python "${scraperPath}"`);
    
    if (stderr && !stdout) {
      console.error('❌ Scraper error:', stderr);
      return ApiResponse.error(stderr, ERROR_CODES.INTERNAL_ERROR, 500);
    }

    return ApiResponse.success({ 
      success: true, 
      message: 'Work.ua sync completed',
      output: stdout
    });
    
  } catch (error: any) {
    console.error('❌ Sync API error:', error);
    return ApiResponse.handle(error, 'vacancies');
  }
}
