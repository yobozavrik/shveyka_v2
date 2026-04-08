import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { vacancyId } = await req.json();
    
    if (!vacancyId) {
      return NextResponse.json({ success: false, error: 'vacancyId is required' }, { status: 400 });
    }

    // Path to the scraper relative to the root
    const rootPath = path.resolve(process.cwd(), '..');
    const scraperPath = path.join(rootPath, 'scrapers', 'workua.py');
    
    console.log(`🚀 Starting Work.ua Resume sync for vacancy ${vacancyId}: python "${scraperPath}" ${vacancyId}`);
    
    // Run the scraper with vacancyId as argument
    const { stdout, stderr } = await execAsync(`python "${scraperPath}" ${vacancyId}`);
    
    if (stderr && !stdout) {
      console.error('❌ Scraper error:', stderr);
      return NextResponse.json({ success: false, error: stderr }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Work.ua resume sync completed',
      output: stdout
    });
    
  } catch (error: any) {
    console.error('❌ Sync API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
