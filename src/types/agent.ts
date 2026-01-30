/**
 * Agent type definitions
 */

import type { MemoryContext, LaneType } from './memory.js';

export type AgentType = 'planner' | 'orchestrator' | 'codewriter' | 'tester' | 'reviewer' | 'reflector' | 'debugger';

export type ExecutionMode = 'A' | 'B' | 'C' | 'D';

export interface AgentConfig {
  agentId: string;
  description: string;
  model: ModelConfig;
  workspace: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'custom';
  model: string;
  baseUrl?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface AgentContext {
  agentId: string;
  agentType: AgentType;
  sessionId: string;
  runId: string;
  input: string;
  memory: MemoryContext;
  tools: Record<string, ToolImplementation>;
  workspace?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolImplementation {
  execute: (params: unknown) => Promise<unknown>;
}

export interface AgentResult {
  success: boolean;
  output: string;
  artifacts?: Artifact[];
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface Artifact {
  type: 'file' | 'directory' | 'command' | 'test' | 'review';
  path: string;
  content?: string;
  executable?: boolean;
}

/**
 * Code Review Comment
 */
export interface ReviewComment {
  severity: 'critical' | 'major' | 'minor' | 'info';
  location: string;
  issue: string;
  suggestion: string;
  codeExample?: string;
}

/**
 * Agent Lifecycle
 */

export type LifecyclePhase = 'start' | 'end' | 'error';

export interface LifecycleEvent {
  stream: 'lifecycle';
  phase: LifecyclePhase;
  agentId: string;
  runId: string;
  sessionId: string;
  timestamp: string;
  result?: AgentResult;
  error?: ErrorInfo;
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  code?: string;
}

/**
 * Agent Run
 */

export interface AgentRunOptions {
  agentType: AgentType;
  input: string;
  sessionId: string;
  parentRunId?: string;
  lane?: LaneType;
}

export interface AgentRun {
  runId: string;
  sessionId: string;
  agentType: AgentType;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed';
  input: string;
  output?: string;
  error?: string;
  parentRunId?: string;
  childRunIds?: string[];
}
