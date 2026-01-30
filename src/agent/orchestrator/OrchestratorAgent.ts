/**
 * Orchestrator Agent
 *
 * 负责协调多个专业 Agent 的执行
 * 根据执行计划调度和管理 Agent 任务
 */

import type { LLMService } from '../../core/llm/types.js';
import { BaseAgent } from '../base/Agent.js';
import type { AgentRunOptions, AgentRunResult } from '../base/types.js';
import type { AgentConfig } from '../../types/agent.js';
import type { ExecutionPlan, PlanStep } from '../planner/PlanGenerator.js';
import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('agent:orchestrator');

/**
 * Orchestrator 配置
 */
export interface OrchestratorConfig {
  systemPrompt?: string;
  maxRetries?: number;
  retryDelay?: number;
  enableParallel?: boolean;
  timeout?: number; // 每个步骤的超时时间（毫秒）
}

/**
 * 步骤执行状态
 */
export interface StepStatus {
  step: PlanStep;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: AgentRunResult;
  error?: string;
  startTime?: number;
  endTime?: number;
  retryCount?: number;
}

/**
 * 编排结果
 */
export interface OrchestrationResult {
  planId: string;
  taskId: string;
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  stepResults: StepStatus[];
  aggregatedOutput: string;
  artifacts: Artifact[];
  errors: string[];
  duration: number;
}

/**
 * 重试决策
 */
export interface RetryDecision {
  shouldRetry: boolean;
  delay?: number;
  modifiedStep?: Partial<PlanStep>;
}

/**
 * 工件（产物）
 */
export interface Artifact {
  type: 'file' | 'directory' | 'command' | 'test' | 'review';
  path: string;
  content?: string;
  executable?: boolean;
}

/**
 * Agent 执行器接口
 */
export interface AgentExecutor {
  execute(agentType: string, input: string, sessionId: string, options?: AgentRunOptions): Promise<AgentRunResult>;
}

/**
 * Orchestrator Agent
 *
 * 职责：
 * 1. 接收 Planner 生成的执行计划
 * 2. 根据计划步骤调度专业 Agent
 * 3. 管理执行顺序和依赖关系
 * 4. 收集各 Agent 的执行结果
 * 5. 处理执行失败和重试逻辑
 */
export class OrchestratorAgent extends BaseAgent {
  private maxRetries: number;
  private retryDelay: number;
  private timeout: number;
  private agentExecutor?: AgentExecutor;

  constructor(
    config: OrchestratorConfig,
    llm: LLMService,
    agentExecutor?: AgentExecutor
  ) {
    // 创建符合 AgentConfig 类型的完整配置
    const agentConfig: AgentConfig = {
      agentId: `orchestrator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: '协调多个专业 Agent 的执行',
      model: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022'
      },
      workspace: process.cwd(),
      systemPrompt: config.systemPrompt || defaultSystemPrompt,
      tools: [],
      temperature: 0.3,
      maxTokens: 4000
    };

    super(agentConfig, 'orchestrator', llm);

    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
    this.timeout = config.timeout ?? 300000; // 默认 5 分钟
    this.agentExecutor = agentExecutor;
  }

  /**
   * 运行 Orchestrator Agent
   */
  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const startTime = Date.now();
    const runId = this.initRun(options.input, options.sessionId, options.parentRunId);

    logger.info(`Orchestrator starting for task: ${options.input.slice(0, 50)}...`);

    try {
      // 解析输入为执行计划
      const plan = this.parsePlanInput(options.input);

      this.updateProgress(runId, 10);

      // 执行计划
      const result = await this.executePlan(plan, options.sessionId);

      this.updateProgress(runId, 100);

      const endTime = Date.now();
      const duration = endTime - startTime;

      const agentResult: AgentRunResult = {
        runId,
        sessionId: options.sessionId,
        agentType: this.type,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration,
        success: result.success,
        output: JSON.stringify(result, null, 2),
        artifacts: result.artifacts,
        metadata: {
          completedSteps: result.completedSteps,
          totalSteps: result.totalSteps,
          errors: result.errors
        }
      };

      this.completeRun(runId, agentResult);
      return agentResult;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      const result: AgentRunResult = {
        runId,
        sessionId: options.sessionId,
        agentType: this.type,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration,
        success: false,
        error: err.message,
        output: '',
        metadata: {}
      };

      this.failRun(runId, err);
      return result;
    }
  }

  /**
   * 解析输入为执行计划
   */
  private parsePlanInput(input: string): ExecutionPlan {
    try {
      // 尝试解析 JSON
      const parsed = JSON.parse(input);
      if (parsed.plan) {
        return parsed.plan as ExecutionPlan;
      }
      return parsed as ExecutionPlan;
    } catch {
      // 如果不是 JSON，创建一个简单的单步计划
      return {
        planId: `plan-${Date.now()}`,
        taskId: 'manual-task',
        analysis: {
          userRequirement: input,
          complexity: 'simple',
          estimatedDuration: '30分钟',
          requiredCapabilities: ['general'],
          suggestedMode: {
            type: 'A',
            description: '单一 Agent 直接执行',
            reasoning: '手动输入的简单任务'
          }
        },
        steps: [{
          id: 'step-1',
          agent: 'codewriter',
          description: input,
          dependencies: []
        }],
        totalEstimatedDuration: '30分钟',
        risks: []
      };
    }
  }

  /**
   * 执行执行计划
   */
  async executePlan(plan: ExecutionPlan, sessionId: string): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const stepStatuses: StepStatus[] = plan.steps.map(step => ({
      step,
      status: 'pending' as const
    }));

    const errors: string[] = [];
    const artifacts: Artifact[] = [];

    logger.info(`Executing plan ${plan.planId} with ${plan.steps.length} steps`);

    // 构建步骤依赖图
    const completedSteps = new Set<string>();

    // 按依赖顺序执行步骤
    for (let i = 0; i < plan.steps.length; i++) {
      const stepStatus = stepStatuses[i];
      if (!stepStatus) continue;

      // 检查依赖是否完成
      const pendingDeps = stepStatus.step.dependencies.filter(dep => !completedSteps.has(dep));
      if (pendingDeps.length > 0) {
        logger.warn(`Step ${stepStatus.step.id} has pending dependencies: ${pendingDeps.join(', ')}`);
        stepStatus.status = 'skipped';
        continue;
      }

      // 执行步骤
      try {
        const result = await this.executeStep(stepStatus.step, sessionId);
        stepStatus.status = 'completed';
        stepStatus.result = result;
        stepStatus.endTime = Date.now();
        completedSteps.add(stepStatus.step.id);

        // 收集工件
        if (result.artifacts) {
          artifacts.push(...result.artifacts);
        }

        logger.info(`Step ${stepStatus.step.id} completed successfully`);

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Step ${stepStatus.step.id} failed: ${errMsg}`);

        // 尝试处理失败
        const retryDecision = await this.handleFailure(stepStatus.step, error as Error);
        if (retryDecision.shouldRetry && (stepStatus.retryCount ?? 0) < this.maxRetries) {
          stepStatus.retryCount = (stepStatus.retryCount ?? 0) + 1;
          stepStatus.status = 'pending'; // 重置状态以便重试
          i--; // 重试当前步骤
          logger.info(`Retrying step ${stepStatus.step.id} (attempt ${stepStatus.retryCount})`);

          if (retryDecision.delay) {
            await this.sleep(retryDecision.delay);
          }
          continue;
        }

        stepStatus.status = 'failed';
        stepStatus.error = errMsg;
        errors.push(`Step ${stepStatus.step.id} failed: ${errMsg}`);

        // 决定是否继续执行
        // 如果关键步骤失败，停止执行
        if (this.isCriticalStep(stepStatus.step)) {
          logger.error(`Critical step ${stepStatus.step.id} failed, aborting plan execution`);
          break;
        }
      }
    }

    const duration = Date.now() - startTime;
    const completedCount = stepStatuses.filter(s => s.status === 'completed').length;

    return {
      planId: plan.planId,
      taskId: plan.taskId,
      success: errors.length === 0,
      completedSteps: completedCount,
      totalSteps: plan.steps.length,
      stepResults: stepStatuses,
      aggregatedOutput: this.aggregateResults(stepStatuses),
      artifacts,
      errors,
      duration
    };
  }

  /**
   * 调度执行单个步骤
   */
  async dispatchStep(step: PlanStep, sessionId: string): Promise<AgentRunResult> {
    if (!this.agentExecutor) {
      throw new Error('No agent executor configured. Please provide an AgentExecutor.');
    }

    logger.debug(`Dispatching step ${step.id} to agent ${step.agent}`);

    const options: AgentRunOptions = {
      input: step.description,
      sessionId,
      metadata: {
        stepId: step.id,
        requiredTools: step.requiredTools
      }
    };

    // 添加超时
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Step ${step.id} timed out after ${this.timeout}ms`)), this.timeout);
    });

    return Promise.race([
      this.agentExecutor.execute(step.agent, step.description, sessionId, options),
      timeoutPromise
    ]);
  }

  /**
   * 执行步骤（内部方法）
   */
  private async executeStep(step: PlanStep, sessionId: string): Promise<AgentRunResult> {
    const stepStatus: StepStatus = {
      step,
      status: 'running',
      startTime: Date.now()
    };

    // 如果有配置的执行器，使用它
    if (this.agentExecutor) {
      return this.dispatchStep(step, sessionId);
    }

    // 否则，返回模拟结果
    logger.warn(`No agent executor configured, returning mock result for step ${step.id}`);
    return {
      runId: `mock-${step.id}-${Date.now()}`,
      sessionId,
      agentType: step.agent,
      startTime: new Date(stepStatus.startTime!).toISOString(),
      endTime: new Date().toISOString(),
      duration: 100,
      success: true,
      output: `Mock output for ${step.description}`,
      metadata: {}
    };
  }

  /**
   * 处理步骤失败
   */
  async handleFailure(_step: PlanStep, error: Error): Promise<RetryDecision> {
    // 根据错误类型决定是否重试
    const errorMsg = error.message.toLowerCase();

    // 超时错误 - 重试
    if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
      return {
        shouldRetry: true,
        delay: this.retryDelay * 2 // 延长等待时间
      };
    }

    // 网络错误 - 重试
    if (errorMsg.includes('network') || errorMsg.includes('econnrefused') || errorMsg.includes('fetch')) {
      return {
        shouldRetry: true,
        delay: this.retryDelay
      };
    }

    // API 限流 - 延长等待后重试
    if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
      return {
        shouldRetry: true,
        delay: this.retryDelay * 5
      };
    }

    // 认证错误 - 不重试
    if (errorMsg.includes('unauthorized') || errorMsg.includes('authentication')) {
      return { shouldRetry: false };
    }

    // 语法/编译错误 - 不重试（需要人工介入）
    if (errorMsg.includes('syntax error') || errorMsg.includes('compile error')) {
      return { shouldRetry: false };
    }

    // 默认：重试
    return { shouldRetry: true, delay: this.retryDelay };
  }

  /**
   * 判断是否为关键步骤
   */
  private isCriticalStep(step: PlanStep): boolean {
    // 第一步通常是关键的
    if (step.id === 'step-1') return true;

    // 包含 "init"、"setup"、"bootstrap" 等关键词的步骤是关键的
    const criticalKeywords = ['init', 'setup', 'bootstrap', 'configure', 'install'];
    const description = step.description.toLowerCase();
    return criticalKeywords.some(keyword => description.includes(keyword));
  }

  /**
   * 聚合所有步骤的结果
   */
  aggregateResults(stepResults: StepStatus[]): string {
    const lines: string[] = ['# 执行结果汇总', ''];

    for (const status of stepResults) {
      const statusIcon = status.status === 'completed' ? '✅' :
                        status.status === 'failed' ? '❌' :
                        status.status === 'skipped' ? '⏭️' :
                        status.status === 'running' ? '🔄' : '⏳';

      lines.push(`${statusIcon} **${status.step.description}** (${status.step.agent})`);

      if (status.result?.output) {
        const preview = status.result.output.slice(0, 200);
        lines.push(`   ${preview}${status.result.output.length > 200 ? '...' : ''}`);
      }

      if (status.error) {
        lines.push(`   ❌ 错误: ${status.error}`);
      }

      const duration = status.endTime && status.startTime
        ? `${((status.endTime - status.startTime) / 1000).toFixed(2)}s`
        : 'N/A';
      lines.push(`   ⏱️ 耗时: ${duration}`);
      lines.push('');
    }

    // 统计信息
    const completed = stepResults.filter(s => s.status === 'completed').length;
    const failed = stepResults.filter(s => s.status === 'failed').length;
    const skipped = stepResults.filter(s => s.status === 'skipped').length;

    lines.push('## 统计');
    lines.push(`- ✅ 完成: ${completed}`);
    lines.push(`- ❌ 失败: ${failed}`);
    lines.push(`- ⏭️ 跳过: ${skipped}`);
    lines.push(`- 📊 总计: ${stepResults.length}`);

    return lines.join('\n');
  }

  /**
   * 设置 Agent 执行器
   */
  setAgentExecutor(executor: AgentExecutor): void {
    this.agentExecutor = executor;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 生成执行摘要
   */
  summarizeExecution(result: OrchestrationResult): string {
    const lines = [
      `# 执行计划: ${result.planId}`,
      '',
      `## 任务: ${result.taskId}`,
      '',
      `## 结果: ${result.success ? '✅ 成功' : '❌ 失败'}`,
      '',
      `## 进度: ${result.completedSteps}/${result.totalSteps} 步骤完成`,
      '',
      `## 耗时: ${(result.duration / 1000).toFixed(2)}秒`,
      ''
    ];

    if (result.errors.length > 0) {
      lines.push('## 错误:');
      for (const error of result.errors) {
        lines.push(`- ${error}`);
      }
      lines.push('');
    }

    if (result.artifacts.length > 0) {
      lines.push('## 产物:');
      for (const artifact of result.artifacts) {
        lines.push(`- [${artifact.type}] ${artifact.path}`);
      }
      lines.push('');
    }

    lines.push('## 详细结果:');
    lines.push('');
    lines.push(result.aggregatedOutput);

    return lines.join('\n');
  }
}

/**
 * 默认 System Prompt
 */
const defaultSystemPrompt = `你是 EvoAgent 的编排者（Orchestrator）。

## 工作流程

1. 接收 Planner 生成的执行计划
2. 按照依赖顺序调度专业 Agent
3. 监控每个步骤的执行状态
4. 处理执行失败和重试
5. 聚合所有 Agent 的执行结果

## 可调度的 Agent

- **CodeWriter**: 编写和修改代码
- **Tester**: 编写和执行测试
- **Reviewer**: 代码审查
- **Debugger**: 调试和修复问题

## 错误处理策略

- **超时**: 重试，延长等待时间
- **网络错误**: 重试，保持原延迟
- **API 限流**: 重试，延长等待时间
- **认证错误**: 不重试，需要人工介入
- **语法/编译错误**: 不重试，需要人工介入

## 输出格式

返回包含以下信息的执行报告：
- 每个步骤的执行状态和结果
- 产出的文件和工件
- 遇到的错误和警告
- 整体执行统计
`;
