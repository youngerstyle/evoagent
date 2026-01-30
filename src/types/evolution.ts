/**
 * Evolution system type definitions
 */

import type { AgentType } from './agent.js';

/**
 * Experience events that trigger collection
 */
export type ExperienceEventType = 'agent_complete' | 'agent_error' | 'user_feedback' | 'test_failed';

export interface ExperienceEvent {
  eventType: ExperienceEventType;
  sessionId: string;
  agentRunId: string;
  agentType: AgentType;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Patterns discovered from experience
 */
export interface Pattern {
  id: string;
  type: 'success' | 'failure' | 'optimization';
  category: 'pits' | 'patterns' | 'decisions' | 'solutions';
  description: string;
  context: string;
  applicableAgents: AgentType[];
  occurrences: number;
  discoveredAt: string;
  lastSeenAt: string;
  confidence: number;
}

/**
 * Reflection result
 */
export interface ReflectionOptions {
  since: string;
  minSessions: number;
  agentTypes?: AgentType[];
}

export interface ReflectionResult {
  status: 'completed' | 'skipped' | 'failed';
  reason?: string;
  report?: ReflectionReport;
}

export interface ReflectionReport {
  periodAnalyzed: {
    start: string;
    end: string;
  };
  sessionsAnalyzed: number;
  patternsDiscovered: Pattern[];
  knowledgeUpdates: KnowledgeUpdate[];
  promptUpdates: PromptUpdate[];
  summary: string;
  recommendations: string[];
}

export interface KnowledgeUpdate {
  category: string;
  action: 'created' | 'updated' | 'merged';
  entries: number;
}

export interface PromptUpdate {
  agentType: AgentType;
  oldPrompt: string;
  newPrompt: string;
  reason: string;
  changes: PromptChange[];
}

export interface PromptChange {
  type: 'added' | 'modified' | 'removed';
  section: string;
  description: string;
}

/**
 * Evolution config
 */
export interface EvolutionConfig {
  collection: {
    enabled: boolean;
    triggers: ExperienceEventType[];
  };
  reflection: {
    enabled: boolean;
    schedule: string; // cron format
    minSessions: number;
  };
  promptOptimization: {
    enabled: boolean;
    trigger: 'after_reflection' | 'continuous';
  };
}
