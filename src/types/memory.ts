/**
 * Memory system type definitions
 */

/**
 * Lane types for queue system
 */
export type LaneType = 'planner' | 'main' | 'parallel';

/**
 * Session (Layer 1: Short-term memory)
 */
export interface SessionEntry {
  type: 'message' | 'tool_call' | 'tool_result' | 'lifecycle' | 'metadata';
  timestamp: string;
  content: SessionContent;
}

export type SessionContent =
  | MessageContent
  | ToolCallContent
  | ToolResultContent
  | LifecycleContent
  | MetadataContent;

export interface MessageContent {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolCallContent {
  toolName: string;
  parameters: Record<string, unknown>;
  toolCallId: string;
}

export interface ToolResultContent {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export interface LifecycleContent {
  phase: 'start' | 'end' | 'error';
  agentType: string;
  runId: string;
  result?: unknown;
  error?: string;
}

export interface MetadataContent {
  key: string;
  value: unknown;
}

export interface SessionMetadata {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  status: 'active' | 'archived';
}

/**
 * Knowledge (Layer 2: Structured knowledge)
 */
export type KnowledgeCategory = 'pits' | 'patterns' | 'decisions' | 'solutions';

export interface KnowledgeEntry {
  title: string;
  category: KnowledgeCategory;
  tags: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  discovered: string;
  occurrences: number;
  relatedSessions: string[];
  content: string;
  lastUpdated: string;
}

export interface KnowledgeQuery {
  category?: KnowledgeCategory;
  tags?: string[];
  query?: string;
  limit?: number;
}

/**
 * Memory (Layer 3: Vector database)
 */
export type VectorCollection = 'code_snippets' | 'error_solutions' | 'user_feedback' | 'test_cases' | 'decision_contexts';

export interface VectorEntry {
  id: string;
  collection: VectorCollection;
  content: string;
  metadata: VectorMetadata;
  embedding?: number[];
}

export interface VectorMetadata {
  sessionId: string;
  agentRunId?: string;
  agentType?: string;
  timestamp: string;
  category?: string;
  tags?: string[];
}

export interface MemoryContext {
  sessionId: string;
  sessionHistory: SessionEntry[];
  relevantKnowledge: KnowledgeEntry[];
  relevantMemories: VectorEntry[];
}

export interface MemoryQueryOptions {
  query: string;
  collection?: VectorCollection;
  limit?: number;
  threshold?: number;
}
