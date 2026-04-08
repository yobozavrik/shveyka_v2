import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';

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
      return NextResponse.json({ success: false, error: stderr }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Work.ua sync completed',
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
