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
import type { SoulSystem } from '../../soul/index.js';
import type { SkillStore } from '../../evolution/skills/SkillStore.js';
import type { Skill } from '../../evolution/skills/SkillTypes.js';

const logger = getLogger('agent');

/**
 * Agent基类
 * 提供Agent的通用功能实现
 */
export abstract class BaseAgent implements AgentInterface {
  protected llm: LLMService;
  protected soulSystem?: SoulSystem;
  protected skillStore?: SkillStore;
  protected activeRuns: Map<string, AgentRunStatus>;
  protected checkpoints: Map<string, AgentCheckpoint>;
  protected eventListeners: Set<AgentEventListener>;
  protected tools: Map<string, ToolImplementation>;

  constructor(
    public readonly config: AgentConfig,
    public readonly type: string,
    llm: LLMService,
    soulSystem?: SoulSystem,
    skillStore?: SkillStore
  ) {
    this.llm = llm;
    this.soulSystem = soulSystem;
    this.skillStore = skillStore;
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
   * 自动注入 SOUL
   */
  protected async buildSystemPrompt(): Promise<string> {
    const basePrompt = this.config.systemPrompt || `You are a ${this.type} agent.`;

    if (this.soulSystem) {
      return this.soulSystem.injectToPrompt(this.type, basePrompt);
    }

    return basePrompt;
  }

  /**
   * 检查边界（SOUL 边界检查）
   */
  protected async checkBoundary(action: string): Promise<{ allowed: boolean; requiresConfirmation?: boolean; reason?: string }> {
    if (this.soulSystem) {
      const allowed = await this.soulSystem.checkBoundary(this.type, action);
      return { allowed };
    }
    return { allowed: true };
  }

  /**
   * 调整输出风格（基于 SOUL）
   */
  protected async adjustOutput(output: string): Promise<string> {
    if (this.soulSystem) {
      // SoulSystem has adjustOutput method but it's private in SoulInjector
      // For now, just return the output as-is
      // Subclasses can override this for specific behavior
      return output;
    }
    return output;
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

    // 检查 SOUL 边界
    const boundaryCheck = await this.checkBoundary(toolName);
    if (!boundaryCheck.allowed) {
      logger.warn(`Tool ${toolName} blocked by SOUL boundary: ${boundaryCheck.reason}`);
      return {
        success: false,
        error: `Operation blocked: ${boundaryCheck.reason || 'SOUL boundary violation'}`
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

  // ===== 技能系统集成 =====

  /**
   * 查询相关技能
   */
  protected async querySkills(context: string, tags?: string[]): Promise<Skill[]> {
    if (!this.skillStore) {
      return [];
    }

    try {
      await this.skillStore.init();
      const skills = await this.skillStore.searchSkills({
        searchText: context,
        tags,
        status: ['validated', 'probation'],
        minSuccessRate: 0.6
      });

      logger.debug(`Found ${skills.length} relevant skills for context: ${context.slice(0, 50)}...`);
      return skills;
    } catch (error) {
      logger.error('Failed to query skills:', error);
      return [];
    }
  }

  /**
   * 应用技能
   */
  protected async applySkill(skill: Skill, context: AgentContext): Promise<ToolResult> {
    if (!this.skillStore) {
      return {
        success: false,
        error: 'Skill store not available'
      };
    }

    try {
      logger.info(`Applying skill: ${skill.metadata.name}`);

      // 使用技能执行器执行技能
      const { globalSkillExecutor } = await import('../../evolution/skills/SkillExecutor.js');

      // 从上下文中提取参数（如果有）
      const parameters = (context.metadata?.skillParameters as Record<string, string | number | boolean | object>) || {};

      const result = await globalSkillExecutor.execute(
        skill,
        parameters,
        context,
        {
          timeout: 30000,
          maxMemory: 128 * 1024 * 1024
        }
      );

      // 更新技能统计
      const duration = (result as any).metadata?.duration as number || 0;
      await this.skillStore.updateUsageStats(
        skill.metadata.name,
        result.success,
        duration
      );

      logger.info(`Skill ${skill.metadata.name} ${result.success ? 'succeeded' : 'failed'} in ${duration}ms`);

      return result;
    } catch (error) {
      logger.error(`Failed to apply skill ${skill.metadata.name}:`, error);

      // 记录失败
      if (this.skillStore) {
        await this.skillStore.updateUsageStats(
          skill.metadata.name,
          false,
          0
        );
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 推荐技能
   */
  protected async recommendSkills(input: string): Promise<Skill[]> {
    if (!this.skillStore) {
      return [];
    }

    try {
      await this.skillStore.init();

      // 基于输入内容搜索相关技能
      const skills = await this.skillStore.searchSkills({
        searchText: input,
        status: ['validated'],
        minSuccessRate: 0.7,
        minTimesUsed: 3
      });

      // 按成功率和使用次数排序
      const sorted = skills.sort((a, b) => {
        const scoreA = (a.metadata.timesSucceeded / Math.max(a.metadata.timesUsed, 1)) * Math.log(a.metadata.timesUsed + 1);
        const scoreB = (b.metadata.timesSucceeded / Math.max(b.metadata.timesUsed, 1)) * Math.log(b.metadata.timesUsed + 1);
        return scoreB - scoreA;
      });

      return sorted.slice(0, 5); // 返回前5个推荐
    } catch (error) {
      logger.error('Failed to recommend skills:', error);
      return [];
    }
  }

  /**
   * 记录技能使用统计
   */
  protected async recordSkillUsage(skillId: string, success: boolean, duration: number): Promise<void> {
    if (!this.skillStore) {
      return;
    }

    try {
      await this.skillStore.updateUsageStats(skillId, success, duration);
    } catch (error) {
      logger.error(`Failed to record skill usage for ${skillId}:`, error);
    }
  }
}
