/**
 * Evolution Module
 *
 * 自我进化和反思
 */

// Experience Module
export { ExperienceCollector, type ExperienceCollectorConfig, type AggregationConfig } from './experience/ExperienceCollector.js';
export { ExperienceExtractor, type ExtractionRule } from './experience/ExperienceExtractor.js';
export type {
  ExperienceEvent,
  ExperienceEventType,
  EventSeverity,
  EventSource,
  EventDetails,
  SuccessContext,
  FailureContext,
  PatternInfo,
  CodeSnippet,
  EventMetadata,
  ExtractionTrigger,
  Extractor,
  ExtractionContext,
  EventFilter,
  PaginationOptions,
  ExperienceStats
} from './experience/ExperienceTypes.js';

// Reflection Module
export { Reflector } from './reflection/Reflector.js';
export type {
  ReflectionTrigger,
  ReflectionTriggerType,
  ReflectionContext,
  ReflectionReport,
  ReflectionType,
  ReflectionResult,
  Insight,
  InsightType,
  ActionItem,
  ActionPriority,
  PerformanceMetrics,
  QualityMetrics,
  SWOTAnalysis,
  ReflectionConfig,
  ReflectionStats,
  ReflectionFilter,
  ReflectionStatus,
  LearningPattern,
  ImprovementSuggestion
} from './reflection/ReflectionTypes.js';

// Optimization Module
export { PromptOptimizer } from './optimization/PromptOptimizer.js';
export type {
  OptimizationConfig,
  OptimizationRequest,
  OptimizationResult,
  OptimizationStatus,
  OptimizationStrategy,
  OptimizationGoal,
  OptimizationSuggestion,
  PromptAnalysis,
  PromptIssue,
  PromptSection,
  PromptType,
  PromptVersion,
  OptimizationStats,
  OptimizationFilter,
  OptimizationResponse,
  PatternInjection,
  BatchOptimizationRequest,
  BatchOptimizationResponse
} from './optimization/OptimizationTypes.js';

// Git Integration Module
export { GitIntegration, GitClient, CommitAnalyzer, ChangeExtractor } from './git/index.js';
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
  CommitExperienceLink,
  CommitReflectionLink,
  GitReport,
  GitReportSummary
} from './git/index.js';

// Skills Module (Third Track Evolution)
export { SkillCollector, SkillStore, SkillGenerator, SkillReflector, SkillReviewer } from './skills/index.js';
export type {
  Skill,
  PatternCandidate,
  SkillMetadata,
  SkillValidationInfo,
  SkillRequirements,
  SkillGenerationParams,
  SkillValidationResult,
  SkillUsageStats,
  SkillDegradationCriteria,
  SkillIndex,
  SkillIndexEntry,
  SkillStoreConfig,
  SkillCollectorConfig,
  SkillReflectorConfig,
  SkillReviewerConfig,
  SkillSearchFilter,
  SkillExecutionResult,
  SkillExecutionContext,
  SkillValidationStatus,
  SkillSource
} from './skills/SkillTypes.js';
