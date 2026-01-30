/**
 * Experience Module
 *
 * 经验收集和反思
 */

export { ExperienceCollector, type ExperienceCollectorConfig, type AggregationConfig } from './ExperienceCollector.js';
export { ExperienceExtractor, type ExtractionRule } from './ExperienceExtractor.js';
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
} from './ExperienceTypes.js';
