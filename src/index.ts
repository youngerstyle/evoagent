/**
 * EvoAgent - 自主进化编码Agent系统
 *
 * 主入口文件
 */

import { getConfig } from './core/config/index.js';
import { createLogger } from './core/logger/index.js';

const logger = createLogger({ component: 'evoagent' });

/**
 * 初始化EvoAgent
 */
export async function initialize(): Promise<void> {
  try {
    getConfig();
    logger.info('Initializing EvoAgent...');
    logger.info('EvoAgent initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize EvoAgent', error);
    throw error;
  }
}

/**
 * 清理资源
 */
export async function shutdown(): Promise<void> {
  logger.info('Shutting down EvoAgent...');
  logger.info('EvoAgent shut down complete');
}

/**
 * 获取版本信息
 */
export function getVersion(): string {
  return '1.0.0';
}

// 核心导出 - 避免命名冲突
export { ConfigLoader, getConfig as getRawConfig, loadConfig } from './core/config/index.js';
export { createLogger, getLogger, setLogLevel, type Logger, type LogLevel } from './core/logger/index.js';
export { MockLLMService, AnthropicLLMService, createLLMService, type LLMService, type LLMRequest, type LLMResponse, type Message } from './core/llm/index.js';
export { BaseAgent, type AgentRunOptions, type AgentRunResult, type AgentInterface } from './agent/base/index.js';

// Agent 导出
export { PlannerAgent, type PlannerConfig } from './agent/planner/index.js';
export { OrchestratorAgent, type OrchestratorConfig, type OrchestrationResult, type AgentExecutor } from './agent/orchestrator/index.js';
export { CodeWriterAgent, TesterAgent, ReviewerAgent } from './agent/specialists/index.js';

// A2A 通信导出
export {
  MessageBus,
  AgentRegistry,
  MessageBuilder,
  MessageSerializer,
  MessageValidator,
  MessageFilters,
  type AgentMessage,
  type AgentAddress,
  type MessagePayload,
  type MessageType,
  type MessagePriority,
  type MessageResult,
  type MessageHandler,
  type MessageFilter,
  type DeliveryOptions,
  type MessageBusConfig,
  type MessageBusMetrics,
  type AgentRegistration,
  type DiscoveryCriteria
} from './agent/communication/index.js';

// Lane Queue 导出
export {
  LaneQueue,
  type LaneTask,
  type LaneConfig,
  type LaneStatus,
  type QueueStats,
  type LaneQueueConfig,
  type TaskOptions,
  type TaskExecutor
} from './agent/queue/index.js';

// Memory 导出
export { SessionStorage } from './memory/session/SessionStorage.js';
export { KnowledgeStorage } from './memory/knowledge/KnowledgeStorage.js';
export { VectorStore } from './memory/vector/VectorStore.js';
export { EmbeddingService, EmbeddingCache } from './memory/vector/index.js';

// 类型导出
export type { AgentType, ExecutionMode, AgentConfig, AgentResult, ModelConfig, ToolDefinition, Artifact } from './types/agent.js';
export type { LaneType, SessionEntry, KnowledgeEntry, VectorEntry, MemoryContext } from './types/memory.js';
export type { ExperienceEvent, Pattern, ReflectionResult, EvolutionConfig } from './types/evolution.js';
