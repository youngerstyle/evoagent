import { v4 as uuidv4 } from 'uuid';
import type {
  AgentInterface,
  AgentRunOptions,
  AgentRunResult,
  AgentRunStatus,
  AgentCheckpoint,
  AgentContext,
  ToolImplementation,
  ToolResult,
  LifecycleEvent,
  AgentEventListener
} from './types.js';
import type { AgentConfig } from '../../types/agent.js';
import type { LLMService } from '../../core/llm/types.js';
import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('agent');

/**
 * Agent基类
 * 提供Agent的通用功能实现
 */
export abstract class BaseAgent implements AgentInterface {
  protected llm: LLMService;
  protected activeRuns: Map<string, AgentRunStatus>;
  protected checkpoints: Map<string, AgentCheckpoint>;
  protected eventListeners: Set<AgentEventListener>;
  protected tools: Map<string, ToolImplementation>;

  constructor(
    public readonly config: AgentConfig,
    public readonly type: string,
    llm: LLMService
  ) {
    this.llm = llm;
    this.activeRuns = new Map();
    this.checkpoints = new Map();
    this.eventListeners = new Set();
    this.tools = new Map();

    // 注册默认工具
    this.registerDefaultTools();
  }

  abstract run(options: AgentRunOptions): Promise<AgentRunResult>;

  /**
   * 暂停运行
   */
  async pause(runId: string): Promise<void> {
    const status = this.activeRuns.get(runId);
    if (!status) {
      throw new Error(`Run ${runId} not found`);
    }

    if (status.status !== 'running') {
      throw new Error(`Run ${runId} is not running`);
    }

    status.status = 'paused';
    this.emit({ type: 'paused', runId });
    logger.debug(`Paused run ${runId}`);
  }

  /**
   * 恢复运行
   */
  async resume(runId: string): Promise<void> {
    const status = this.activeRuns.get(runId);
    if (!status) {
      throw new Error(`Run ${runId} not found`);
    }

    if (status.status !== 'paused') {
      throw new Error(`Run ${runId} is not paused`);
    }

    status.status = 'running';
    this.emit({ type: 'resumed', runId });
    logger.debug(`Resumed run ${runId}`);
  }

  /**
   * 取消运行
   */
  async cancel(runId: string): Promise<void> {
    const status = this.activeRuns.get(runId);
    if (!status) {
      throw new Error(`Run ${runId} not found`);
    }

    if (status.status === 'completed' || status.status === 'failed') {
      throw new Error(`Run ${runId} already ${status.status}`);
    }

    status.status = 'cancelled';
    status.endTime = new Date().toISOString();
    this.emit({ type: 'cancelled', runId });
    logger.debug(`Cancelled run ${runId}`);
  }

  /**
   * 获取运行状态
   */
  getStatus(runId: string): AgentRunStatus | undefined {
    return this.activeRuns.get(runId);
  }

  /**
   * 创建检查点
   */
  createCheckpoint(runId: string): AgentCheckpoint {
    const status = this.activeRuns.get(runId);
    if (!status) {
      throw new Error(`Run ${runId} not found`);
    }

    const checkpoint: AgentCheckpoint = {
      runId,
      timestamp: new Date().toISOString(),
      progress: status.progress,
      state: this.captureState(runId)
    };

    this.checkpoints.set(runId, checkpoint);
    logger.debug(`Created checkpoint for run ${runId}`);

    return checkpoint;
  }

  /**
   * 从检查点恢复（子类可覆盖）
   */
  async restoreFromCheckpoint(checkpoint: AgentCheckpoint): Promise<void> {
    const status = this.activeRuns.get(checkpoint.runId);
    if (!status) {
      throw new Error(`Run ${checkpoint.runId} not found`);
    }

    status.progress = checkpoint.progress;
    this.restoreState(checkpoint.runId, checkpoint.state);

    logger.debug(`Restored run ${checkpoint.runId} from checkpoint`);
  }

  /**
   * 注册工具
   */
  registerTool(tool: ToolImplementation): void {
    this.tools.set(tool.name, tool);
    logger.debug(`Registered tool: ${tool.name}`);
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: AgentEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: AgentEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.activeRuns.clear();
    this.checkpoints.clear();
    this.eventListeners.clear();
  }

  // =====  protected 方法 =====

  /**
   * 初始化运行状态
   */
  protected initRun(_input: string, sessionId: string, _parentRunId?: string): string {
    const runId = uuidv4();

    this.activeRuns.set(runId, {
      runId,
      agentType: this.type,
      status: 'running',
      progress: 0,
      startTime: new Date().toISOString()
    });

    this.emit({ type: 'start', runId, agentType: this.type });
    logger.debug(`Initialized run ${runId} for session ${sessionId}`);

    return runId;
  }

  /**
   * 更新进度
   */
  protected updateProgress(runId: string, progress: number): void {
    const status = this.activeRuns.get(runId);
    if (status) {
      status.progress = Math.max(0, Math.min(100, progress));
      this.emit({ type: 'progress', runId, progress: status.progress });
    }
  }

  /**
   * 完成运行
   */
  protected completeRun(runId: string, result: AgentRunResult): void {
    const status = this.activeRuns.get(runId);
    if (status) {
      status.status = 'completed';
      status.progress = 100;
      status.endTime = result.endTime;

      this.emit({ type: 'complete', runId, result });
      logger.debug(`Completed run ${runId}`);
    }
  }

  /**
   * 标记运行失败
   */
  protected failRun(runId: string, error: Error): void {
    const status = this.activeRuns.get(runId);
    if (status) {
      status.status = 'failed';
      status.error = error.message;
      status.endTime = new Date().toISOString();

      this.emit({ type: 'error', runId, error });
      logger.debug(`Failed run ${runId}: ${error.message}`);
    }
  }

  /**
   * 构建系统提示词（子类可覆盖）
   */
  protected buildSystemPrompt(): string {
    return this.config.systemPrompt || `You are a ${this.type} agent.`;
  }

  /**
   * 获取工具定义列表
   */
  protected getToolDefinitions(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      }
    }));
  }

  /**
   * 执行工具调用
   */
  protected async executeToolCall(
    toolName: string,
    params: unknown,
    context: AgentContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolName} not found`
      };
    }

    this.emit({
      type: 'tool_call',
      runId: context.runId,
      tool: toolName,
      params
    });

    try {
      const result = await tool.execute(params, context);

      this.emit({
        type: 'tool_result',
        runId: context.runId,
        tool: toolName,
        result
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Tool ${toolName} execution failed: ${errorMsg}`);

      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * 发送事件给所有监听器
   */
  protected emit(event: LifecycleEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('Event listener error:', error);
      }
    }
  }

  /**
   * 捕获当前状态（子类可覆盖）
   */
  protected captureState(_runId: string): Record<string, unknown> {
    return {
      progress: 0,
      agentType: this.type
    };
  }

  /**
   * 恢复状态（子类可覆盖）
   */
  protected restoreState(_runId: string, _state: Record<string, unknown>): void {
    // 默认空实现，子类可以覆盖
  }

  /**
   * 注册默认工具
   */
  protected registerDefaultTools(): void {
    // 子类可以覆盖此方法注册特定工具
  }
}
