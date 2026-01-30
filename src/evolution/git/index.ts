/**
 * Git Integration Module
 *
 * Git 版本控制系统集成，用于分析和学习代码变更历史
 */

// Main Integration
export { GitIntegration } from './GitIntegration.js';

// Git Client
export { GitClient } from './GitClient.js';

// Commit Analyzer
export { CommitAnalyzer } from './CommitAnalyzer.js';

// Change Extractor
export { ChangeExtractor } from './ChangeExtractor.js';

// Types
export type {
  GitCommit,
  GitFileStats,
  GitFileChange,
  GitFileStatus,
  GitBranch,
  GitStatus,
  GitDiff,
  GitLogOptions,
  GitAnalysis,
  AuthorStats,
  FileChangeStats,
  PatternMatch,
  ChangeExtraction,
  ExtractedChange,
  CodePattern,
  GitIntegrationConfig,
  ExtractionConfig,
  LanguageExtractorConfig,
  CommitExperienceLink,
  CommitReflectionLink,
  GitReportConfig,
  GitReport,
  GitReportSummary
} from './GitIntegrationTypes.js';
