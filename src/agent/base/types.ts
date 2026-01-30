/**
 * Agent运行相关类型定义
 */

import type { AgentConfig, AgentResult } from '../../types/agent.js';

/**
 * Agent运行选项
 */
export interface AgentRunOptions {
  input: string;
  sessionId: string;
  parentRunId?: string;
  lane?: 'planner' | 'main' | 'parallel';
  onProgress?: (progress: number) => void;
  onToolCall?: (tool: string, params: unknown) => void;
  onMessage?: (message: string) => void;
  metadata?: Record<string, unknown>;
}

/**
 * Agent运行结果（扩展自AgentResult）
 */
export interface AgentRunResult extends AgentResult {
  runId: string;
  sessionId: string;
  agentType: string;
  startTime: string;
  endTime: string;
  duration: number;
  parentRunId?: string;
  childRunIds?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Agent运行状态
 */
export interface AgentRunStatus {
  runId: string;
  agentType: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
  startTime?: string;
  endTime?: string;
}

/**
 * Agent检查点（用于恢复）
 */
export interface AgentCheckpoint {
  runId: string;
  timestamp: string;
  progress: number;
  state: Record<string, unknown>;
  partialResults?: unknown[];
}

/**
 * Agent接口
 * 所有Agent都必须实现此接口
 */
export interface AgentInterface {
  readonly config: AgentConfig;
  readonly type: string;

  /**
   * 运行Agent
   */
  run(options: AgentRunOptions): Promise<AgentRunResult>;

  /**
   * 暂停运行
   */
  pause(runId: string): Promise<void>;

  /**
   * 恢复运行
   */
  resume(runId: string): Promise<void>;

  /**
   * 取消运行
   */
  cancel(runId: string): Promise<void>;

  /**
   * 获取运行状态
   */
  getStatus(runId: string): AgentRunStatus | undefined;

  /**
   * 创建检查点
   */
  createCheckpoint?(runId: string): AgentCheckpoint;

  /**
   * 从检查点恢复
   */
  restoreFromCheckpoint?(checkpoint: AgentCheckpoint): Promise<void>;
}

/**
 * Agent上下文
 */
export interface AgentContext {
  agentId: string;
  agentType: string;
  sessionId: string;
  runId: string;
  input: string;
  parentRunId?: string;
  workspace: string;
  tools: Record<string, ToolImplementation>;
  metadata: Record<string, unknown>;
}

/**
 * 工具实现
 */
export interface ToolImplementation {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute(params: unknown, context: AgentContext): Promise<ToolResult>;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

/**
 * Agent生命周期事件
 */
export type LifecycleEvent =
  | { type: 'start'; runId: string; agentType: string }
  | { type: 'progress'; runId: string; progress: number }
  | { type: 'tool_call'; runId: string; tool: string; params: unknown }
  | { type: 'tool_result'; runId: string; tool: string; result: ToolResult }
  | { type: 'complete'; runId: string; result: AgentRunResult }
  | { type: 'error'; runId: string; error: Error }
  | { type: 'paused'; runId: string }
  | { type: 'resumed'; runId: string }
  | { type: 'cancelled'; runId: string };

/**
 * Agent事件监听器
 */
export type AgentEventListener = (event: LifecycleEvent) => void;
