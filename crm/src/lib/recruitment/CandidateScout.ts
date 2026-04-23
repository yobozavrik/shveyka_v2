/**
 * CandidateScout Service
 * AI-powered candidate sourcing and analysis for Shveyka CRM
 * 
 * Integrates with Python scrapers and Groq AI for candidate analysis
 */

import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

export interface ScraperConfig {
  keywords: string[];
  cities: string[];
  pages: number;
  sources: ('workua')[];
}

export interface CandidateAnalysis {
  score: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendedPosition: string;
  experienceMatch: string;
  skillsMatch: string;
  salaryFit: string;
  overallVerdict: 'РЕКОМЕНДУЮ' | 'ВЗГЛЯНУТИ' | 'ВІДХИЛИТИ';
}

export interface ScrapedCandidate {
  source: string;
  url: string;
  title: string;
  name?: string;
  phone?: string;
  email?: string;
  salary?: string;
  experienceYears?: number;
  city?: string;
  description?: string;
  resumeText?: string;
  skills?: string[];
  isRelevant?: boolean;
  aiScore?: number;
  aiAnalysis?: CandidateAnalysis;
  searchKeyword?: string;
  searchCity?: string;
}

export interface SourcingResult {
  success: boolean;
  candidatesFound: number;
  relevantCount: number;
  analyzedCount: number;
  outputPath: string;
  errors: string[];
}

/**
 * Get scraper base directory
 */
function getScrapersDir(): string {
  const rootPath = path.resolve(process.cwd(), '..');
  return path.join(rootPath, 'scrapers');
}

/**
 * Run a Python scraper script
 */
async function runScraper(
  scriptName: string,
  args: string[] = [],
  timeout = 300000
): Promise<{ stdout: string; stderr: string }> {
  const scrapersDir = getScrapersDir();
  const scriptPath = path.join(scrapersDir, scriptName);
  
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Scraper not found: ${scriptPath}`);
  }
  
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const cmdArgs = [scriptPath, ...args];
  
  console.log(`Running: ${pythonCmd} "${scriptPath}" ${args.join(' ')}`);
  
  try {
    const { stdout, stderr } = await execAsync(
      `${pythonCmd} "${scriptPath}" ${args.map(a => `"${a}"`).join(' ')}`,
      { 
        timeout,
        cwd: scrapersDir,
        env: { ...process.env }
      }
    );
    return { stdout, stderr };
  } catch (error: any) {
    throw new Error(`Scraper failed: ${error.message}`);
  }
}

/**
 * Run candidate search on all configured sources
 */
export async function searchCandidates(config: ScraperConfig): Promise<SourcingResult> {
  const result: SourcingResult = {
    success: false,
    candidatesFound: 0,
    relevantCount: 0,
    analyzedCount: 0,
    outputPath: '',
    errors: [],
  };
  
  const scrapersDir = getScrapersDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tempOutput = path.join(scrapersDir, `candidates_${timestamp}.json`);
  
  try {
    const allCandidates: ScrapedCandidate[] = [];
    
    // Search Work.ua
    if (config.sources.includes('workua')) {
      try {
        console.log('Searching Work.ua...');
        const workuaArgs = [
          ...config.keywords,
          '--all-cities',
          '--pages', config.pages.toString(),
          '--detail',
          '--output', 'workua_temp.json',
        ];
        
        await runScraper('workua_scraper.py', workuaArgs);
        
        const workuaPath = path.join(scrapersDir, 'workua_temp.json');
        if (fs.existsSync(workuaPath)) {
          const workuaData = JSON.parse(fs.readFileSync(workuaPath, 'utf-8'));
          const workuaCandidates = (workuaData.resumes || []).map((r: any) => ({
            ...r,
            source: 'workua',
          }));
          allCandidates.push(...workuaCandidates);
          fs.unlinkSync(workuaPath);
        }
      } catch (error: any) {
        result.errors.push(`Work.ua scraper error: ${error.message}`);
        console.error('Work.ua scraper failed:', error);
      }
    }
    
// Deduplicate by URL
    const seen = new Set<string>();
    const uniqueCandidates = allCandidates.filter(c => {
      if (!c.url || seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });
    
    result.candidatesFound = uniqueCandidates.length;
    result.relevantCount = uniqueCandidates.filter(c => c.isRelevant).length;
    
    // Save combined results
    const combinedResult = {
      scraped_at: new Date().toISOString(),
      total_found: uniqueCandidates.length,
      relevant_count: result.relevantCount,
      resumes: uniqueCandidates,
    };
    
    fs.writeFileSync(tempOutput, JSON.stringify(combinedResult, null, 2), 'utf-8');
    result.outputPath = tempOutput;
    result.success = true;
    
    return result;
    
  } catch (error: any) {
    result.errors.push(`Search failed: ${error.message}`);
    return result;
  }
}

/**
 * Analyze candidates using Groq AI
 */
export async function analyzeCandidates(
  inputPath: string,
  outputPath?: string
): Promise<{ success: boolean; analyzedCount: number; avgScore: number; errors: string[] }> {
  const scrapersDir = getScrapersDir();
  outputPath = outputPath || path.join(scrapersDir, 'analyzed_candidates.json');
  
  try {
    await runScraper('analyze_candidates.py', [
      inputPath,
      outputPath,
    ]);
    
    if (fs.existsSync(outputPath)) {
      const result = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      const scores = (result.resumes || [])
        .filter((r: any) => r.ai_score)
        .map((r: any) => r.ai_score);
      
      return {
        success: true,
        analyzedCount: result.analyzed_count || result.resumes?.length || 0,
        avgScore: scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0,
        errors: [],
      };
    }
    
    return { success: false, analyzedCount: 0, avgScore: 0, errors: ['Output file not found'] };
    
  } catch (error: any) {
    return { 
      success: false, 
      analyzedCount: 0, 
      avgScore: 0, 
      errors: [error.message] 
    };
  }
}

/**
 * Import analyzed candidates into the database
 */
export async function importCandidatesToDb(
  analyzedFilePath: string,
  vacancyId?: string
): Promise<{ imported: number; errors: string[] }> {
  const supabase = await createServerClient(true);
  const result = { imported: 0, errors: [] as string[] };
  
  try {
    const data = JSON.parse(fs.readFileSync(analyzedFilePath, 'utf-8'));
    const resumes = (data.resumes || []).filter((r: any) => 
      r.ai_score && r.ai_score >= 4
    );
    
    for (const resume of resumes) {
      try {
        const candidateData = {
          full_name: resume.name || resume.title || 'Невідоме ім\'я',
          phone: resume.phone || null,
          email: resume.email || null,
          resume_text: resume.resume_text || resume.description || null,
          resume_url: resume.url || null,
          source: resume.source || 'manual',
          source_job_id: resume.source_job_id || null,
          source_url: resume.url || null,
          position_desired: resume.title || null,
          salary_expected: parseSalary(resume.salary),
          experience_years: resume.experience_years || null,
          city: resume.city || resume.location || null,
          ai_score: resume.ai_score,
          ai_analysis: resume.ai_analysis,
          ai_strengths: resume.ai_analysis?.strengths || [],
          ai_concerns: resume.ai_analysis?.concerns || [],
          ai_recommended_position: resume.ai_analysis?.recommendedPosition,
          ai_analyzed_at: resume.ai_analyzed_at || new Date().toISOString(),
          status: 'new',
          vacancy_id: vacancyId || null,
          work_experience: resume.work_experience || [],
          skills: resume.skills || [],
        };
        
        const { error } = await supabase
          .from('candidates')
          .insert([candidateData]);
        
        if (error) {
          if (error.code === '23505') {
            console.log(`Candidate already exists: ${candidateData.full_name}`);
          } else {
            result.errors.push(`Insert error for ${candidateData.full_name}: ${error.message}`);
          }
        } else {
          result.imported++;
        }
        
      } catch (insertError: any) {
        result.errors.push(`Error processing candidate: ${insertError.message}`);
      }
    }
    
    return result;
    
  } catch (error: any) {
    result.errors.push(`Failed to read analyzed file: ${error.message}`);
    return result;
  }
}

/**
 * Parse salary string to number (UAH)
 */
function parseSalary(salaryStr: string | number | undefined): number | null {
  if (!salaryStr) return null;
  if (typeof salaryStr === 'number') return salaryStr;
  
  const cleaned = salaryStr.replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/**
 * Get sourcing statistics
 */
export async function getSourcingStats(): Promise<{
  totalCandidates: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  avgScore: number;
  recentImports: number;
}> {
  const supabase = await createServerClient(true);
  
  const { data: candidates } = await supabase
    .from('candidates')
    .select('status, source, ai_score, created_at');
  
  if (!candidates) {
    return {
      totalCandidates: 0,
      byStatus: {},
      bySource: {},
      avgScore: 0,
      recentImports: 0,
    };
  }
  
  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let scoreSum = 0;
  let scoreCount = 0;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  let recentImports = 0;
  
  for (const c of candidates) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    bySource[c.source] = (bySource[c.source] || 0) + 1;
    
    if (c.ai_score) {
      scoreSum += c.ai_score;
      scoreCount++;
    }
    
    if (new Date(c.created_at) > weekAgo) {
      recentImports++;
    }
  }
  
  return {
    totalCandidates: candidates.length,
    byStatus,
    bySource,
    avgScore: scoreCount ? scoreSum / scoreCount : 0,
    recentImports,
  };
}

export default {
  searchCandidates,
  analyzeCandidates,
  importCandidatesToDb,
  getSourcingStats,
};