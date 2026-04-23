/**
 * Recruitment Module Index
 * 
 * Exports all recruitment-related services and utilities
 */

export { 
  default as CandidateScout,
  searchCandidates,
  analyzeCandidates,
  importCandidatesToDb,
  getSourcingStats,
  type ScraperConfig,
  type CandidateAnalysis,
  type ScrapedCandidate,
  type SourcingResult,
} from './CandidateScout';