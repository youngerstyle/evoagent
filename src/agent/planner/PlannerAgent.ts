/**
 * Planner Agent
 *
 * 负责分析用户需求并生成执行计划
 * 支持多种执行模式的选择和规划
 */

import type { LLMService } from '../../core/llm/types.js';
import { BaseAgent } from '../base/Agent.js';
import type { AgentRunOptions, AgentRunResult } from '../base/types.js';
import type { AgentConfig } from '../../types/agent.js';
import type { KnowledgeStorage } from '../../memory/knowledge/KnowledgeStorage.js';
import type { VectorStore } from '../../memory/vector/VectorStore.js';
import { getLogger } from '../../core/logger/index.js';
import {
  PlanGenerator,
  type ExecutionPlan,
  type TaskAnalysis,
  type ExecutionMode
} from './PlanGenerator.js';

const logger = getLogger('agent:planner');

/**
 * Planner Agent 配置
 */
export interface PlannerConfig {
  systemPrompt?: string;
  maxIterations?: number;
  enableLearning?: boolean;
}

/**
 * Planner Agent
 *
 * 职责：
 * 1. 接收用户需求
 * 2. 检索相关历史经验（Knowledge + Memory）
 * 3. 分析任务复杂度和类型
 * 4. 选择最合适的执行模式
 * 5. 生成详细的执行计划
 */
export class PlannerAgent extends BaseAgent {
  private planGenerator: PlanGenerator;

  constructor(
    config: PlannerConfig,
    llm: LLMService,
    knowledge?: KnowledgeStorage,
    vectorStore?: VectorStore
  ) {
    // 创建符合 AgentConfig 类型的完整配置
    const agentConfig: AgentConfig = {
      agentId: `planner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: '分析需求并生成执行计划',
      model: {
        provider: 'anthropic', // 默认，实际运行时会从 llm 服务获取
        model: 'claude-3-5-sonnet-20241022'
      },
      workspace: process.cwd(),
      systemPrompt: config.systemPrompt || defaultSystemPrompt,
      tools: [],
      temperature: 0.3, // 较低温度保证决策稳定
      maxTokens: 4000
    };

    super(agentConfig, 'planner', llm);

    this.planGenerator = new PlanGenerator(llm, knowledge, vectorStore);
  }

  /**
   * 运行 Planner Agent
   */
  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const startTime = Date.now();
    const runId = this.initRun(options.input, options.sessionId, options.parentRunId);

    logger.info(`Planner starting for task: ${options.input.slice(0, 50)}...`);

    try {
      // 步骤 1: 搜索相关历史经验
      this.updateProgress(runId, 10);
      const { similarPlans, lessons } = await this.searchHistory(options.input);

      // 步骤 2: 分析需求
      this.updateProgress(runId, 30);
      const analysis = await this.analyzeRequirement(options.input);

      // 步骤 3: 选择执行模式
      this.updateProgress(runId, 50);
      const mode = await this.selectMode(analysis);

      // 步骤 4: 生成计划
      this.updateProgress(runId, 70);
      const plan = await this.generatePlan(options.input, mode);

      // 步骤 5: 验证和优化计划
      this.updateProgress(runId, 90);
      const optimizedPlan = await this.validateAndOptimize(plan, similarPlans, lessons);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 将结果序列化为 JSON 字符串
      const outputData = {
        plan: optimizedPlan,
        analysis,
        similarPlans: similarPlans.slice(0, 3), // 最多返回3个相似计划
        lessons
      };

      const result: AgentRunResult = {
        runId,
        sessionId: options.sessionId,
        agentType: this.type,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration,
        success: true,
        output: JSON.stringify(outputData, null, 2),
        metadata: {
          mode: mode.type,
          complexity: analysis.complexity,
          capabilities: analysis.requiredCapabilities
        }
      };

      this.completeRun(runId, result);
      return result;

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
        output: '', // 空字符串而不是 null
        metadata: {}
      };

      this.failRun(runId, err);
      return result;
    }
  }

  /**
   * 搜索历史经验
   */
  private async searchHistory(userRequirement: string): Promise<{
    similarPlans: ExecutionPlan[];
    lessons: string[];
  }> {
    const lessons: string[] = [];

    // 搜索 Knowledge
    const knowledge = this.planGenerator.knowledge;
    if (knowledge) {
      const knowledgeResults = await knowledge.searchByContent(userRequirement, { limit: 5 });

      for (const result of knowledgeResults) {
        lessons.push(`[Knowledge] ${result.item.frontmatter.title}: ${result.item.frontmatter.category}`);
      }
    }

    // 向量搜索历史计划
    const { similarPlans } = await this.planGenerator.learnFromHistory(userRequirement);

    return { similarPlans, lessons };
  }

  /**
   * 分析需求
   */
  private async analyzeRequirement(userRequirement: string): Promise<Omit<TaskAnalysis, 'suggestedMode'>> {
    // 简单规则分析（可以后续用 LLM 增强）
    const complexity = this.estimateComplexity(userRequirement);
    const requiredCapabilities = this.identifyCapabilities(userRequirement);

    logger.debug(`Task analysis: complexity=${complexity}, capabilities=${requiredCapabilities.join(', ')}`);

    return {
      userRequirement,
      complexity,
      estimatedDuration: this.estimateDuration(complexity),
      requiredCapabilities
    };
  }

  /**
   * 估算复杂度
   */
  private estimateComplexity(requirement: string): 'simple' | 'medium' | 'complex' | 'very-complex' {
    // 简单任务特征
    const simplePatterns = [
      /创建?\s*\d+\s*个?[文件页面组件]/,
      /添加?\s*(一个|按钮|表单|链接|导航)/,
      /修改?\s*(文字|颜色|样式|布局)/,
      /实现?\s*(简单|基础)的?(功能|页面)/,
      /fix\s+\w+/i
    ];

    for (const pattern of simplePatterns) {
      if (pattern.test(requirement)) {
        return 'simple';
      }
    }

    // 复杂任务特征
    const complexPatterns = [
      /重构|架构|系统|平台|应用/i,
      /模块|服务|接口/i,
      /集成|支付|认证|第三方/i,
      /real.?time|实时|性能优化/i,
      /分布式|微服务/i
    ];

    let complexScore = 0;
    for (const pattern of complexPatterns) {
      if (pattern.test(requirement)) {
        complexScore++;
      }
    }

    if (complexScore >= 4) return 'very-complex';
    if (complexScore >= 2) return 'complex';
    if (complexScore >= 1) return 'medium';

    return 'simple';
  }

  /**
   * 识别所需能力
   */
  private identifyCapabilities(requirement: string): string[] {
    const capabilities: string[] = [];
    const lower = requirement.toLowerCase();

    const capabilityMap = {
      'frontend': /前端|界面|ui|页面|组件|按钮|表单|样式|布局/i,
      'backend': /后端|api|接口|服务|服务器/i,
      'database': /数据库|存储|crud|增删改查/i,
      'authentication': /认证|登录|权限|安全|auth/i,
      'testing': /测试|test/i,
      'deployment': /部署|deploy/i
    };

    for (const [cap, pattern] of Object.entries(capabilityMap)) {
      if (pattern.test(lower)) {
        capabilities.push(cap);
      }
    }

    return capabilities.length > 0 ? capabilities : ['general'];
  }

  /**
   * 估算持续时间
   */
  private estimateDuration(complexity: string): string {
    const durations = {
      'simple': '30分钟 - 2小时',
      'medium': '2 - 6小时',
      'complex': '1 - 3天',
      'very-complex': '3 - 7天'
    };
    return durations[complexity as keyof typeof durations] || '2 - 4小时';
  }

  /**
   * 选择执行模式
   */
  private async selectMode(
    analysis: Omit<TaskAnalysis, 'suggestedMode'>
  ): Promise<ExecutionMode> {
    const { complexity, requiredCapabilities } = analysis;

    // 模式 A: 单一 Agent
    if (complexity === 'simple' && requiredCapabilities.length <= 2) {
      return {
        type: 'A',
        description: '单一 Agent 直接执行',
        reasoning: '任务简单，功能点少于3个，无需复杂协作'
      };
    }

    // 模式 B: 主从模式
    if (complexity === 'medium' || (complexity === 'complex' && requiredCapabilities.length <= 3)) {
      return {
        type: 'B',
        description: '主从模式 (Orchestrator + Specialist)',
        reasoning: '任务中等复杂度，需要协调多个专业 Agent'
      };
    }

    // 模式 C: 并行模式
    if (complexity === 'complex' && requiredCapabilities.length >= 3) {
      return {
        type: 'C',
        description: '并行模式',
        reasoning: '任务复杂且包含多个独立模块，可并行处理'
      };
    }

    // 模式 D: 迭代规划
    return {
      type: 'D',
      description: '迭代规划模式',
      reasoning: '任务非常复杂，需要分阶段规划和执行'
    };
  }

  /**
   * 生成计划
   */
  private async generatePlan(
    userRequirement: string,
    mode: ExecutionMode
  ): Promise<ExecutionPlan> {
    return this.planGenerator.generatePlan(
      `task-${Date.now()}`,
      userRequirement,
      { preferredMode: mode.type }
    );
  }

  /**
   * 验证和优化计划
   */
  private async validateAndOptimize(
    plan: ExecutionPlan,
    similarPlans: ExecutionPlan[],
    lessons: string[]
  ): Promise<ExecutionPlan> {
    let optimized = plan;

    // 应用历史教训
    if (lessons.length > 0) {
      optimized = this.applyLessons(optimized, lessons);
    }

    // 如果有相似计划，参考其结构
    if (similarPlans.length > 0) {
      optimized = await this.learnFromSimilarPlans(optimized, similarPlans);
    }

    // 检查计划合理性
    const validated = this.validatePlanStructure(optimized);

    // 保存计划到历史供未来学习
    await this.planGenerator.savePlanToHistory(validated);

    return validated;
  }

  /**
   * 应用历史教训调整计划
   */
  private applyLessons(plan: ExecutionPlan, lessons: string[]): ExecutionPlan {
    const adjustedRisks = [...plan.risks];
    const adjustedSteps = [...plan.steps];

    for (const lesson of lessons) {
      // 检查是否是风险类教训
      if (lesson.includes('[Knowledge]') && (lesson.includes('pits') || lesson.includes('critical') || lesson.includes('high'))) {
        const riskMessage = `Note: ${lesson}`;
        if (!adjustedRisks.some(r => r.includes(lesson.slice(0, 50)))) {
          adjustedRisks.push(riskMessage);
        }
      }

      // 检查是否是模式类教训
      if (lesson.includes('patterns')) {
        // 可以考虑在步骤中添加模式相关的提示
        logger.debug(`Pattern lesson applicable: ${lesson}`);
      }
    }

    return {
      ...plan,
      risks: adjustedRisks,
      steps: adjustedSteps
    };
  }

  /**
   * 从相似计划中学习
   */
  private async learnFromSimilarPlans(
    plan: ExecutionPlan,
    similarPlans: ExecutionPlan[]
  ): Promise<ExecutionPlan> {
    let optimized = plan;

    // 找到最相似的计划（基于步骤数量和复杂度）
    const mostSimilar = similarPlans
      .filter(p => p.analysis.complexity === plan.analysis.complexity)
      .sort((a, b) => {
        const aDiff = Math.abs(a.steps.length - plan.steps.length);
        const bDiff = Math.abs(b.steps.length - plan.steps.length);
        return aDiff - bDiff;
      })[0];

    if (mostSimilar) {
      // 学习：如果相似计划有更多步骤，考虑是否需要细化
      if (mostSimilar.steps.length > plan.steps.length * 1.3) {
        logger.debug(`Similar plan ${mostSimilar.taskId} has more granular steps, but keeping current structure for flexibility`);
      }

      // 学习：检查相似计划是否有我们没有考虑到的工具需求
      const similarTools = new Set<string>();
      for (const step of mostSimilar.steps) {
        if (step.requiredTools) {
          for (const tool of step.requiredTools) {
            similarTools.add(tool);
          }
        }
      }

      // 如果相似计划使用了我们计划中没有的工具，添加提示
      if (similarTools.size > 0) {
        const currentTools = new Set<string>();
        for (const step of plan.steps) {
          if (step.requiredTools) {
            for (const tool of step.requiredTools) {
              currentTools.add(tool);
            }
          }
        }

        const missingTools = Array.from(similarTools).filter(t => !currentTools.has(t));
        if (missingTools.length > 0) {
          logger.debug(`Similar plan used tools not in current plan: ${missingTools.join(', ')}`);
          // 可以添加到风险提示中
          optimized = {
            ...optimized,
            risks: [
              ...optimized.risks,
              `Consider if these tools are needed: ${missingTools.join(', ')}`
            ]
          };
        }
      }

      // 学习：检查相似计划的依赖关系
      const depsCount = mostSimilar.steps.reduce((sum, s) => sum + s.dependencies.length, 0);
      const currentDepsCount = plan.steps.reduce((sum, s) => sum + s.dependencies.length, 0);

      if (depsCount > currentDepsCount * 1.5) {
        logger.debug('Similar plan had more dependencies, consider if any are missing');
      }
    }

    return optimized;
  }

  /**
   * 验证计划结构
   */
  private validatePlanStructure(plan: ExecutionPlan): ExecutionPlan {
    // 确保步骤依赖有效
    const stepIds = new Set(plan.steps.map(s => s.id));
    for (const step of plan.steps) {
      for (const dep of step.dependencies) {
        if (!stepIds.has(dep)) {
          logger.warn(`Invalid dependency in plan: ${dep} not found`);
        }
      }
    }

    return plan;
  }

  /**
   * 生成计划摘要（用于展示）
   */
  summarizePlan(plan: ExecutionPlan): string {
    const lines = [
      `# 执行计划: ${plan.taskId}`,
      '',
      `## 任务分析`,
      `- 复杂度: ${plan.analysis.complexity}`,
      `- 预计耗时: ${plan.analysis.estimatedDuration}`,
      `- 执行模式: ${plan.analysis.suggestedMode.type} - ${plan.analysis.suggestedMode.description}`,
      '',
      `## 执行步骤`,
      ''
    ];

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (!step) continue;

      lines.push(`${i + 1}. **${step.description}**`);
      lines.push(`   - Agent: ${step.agent}`);
      if (step.dependencies.length > 0) {
        lines.push(`   - 依赖: ${step.dependencies.join(', ')}`);
      }
      if (step.estimatedDuration) {
        lines.push(`   - 预计: ${step.estimatedDuration}`);
      }
      lines.push('');
    }

    if (plan.risks.length > 0) {
      lines.push('## 风险提示');
      for (const risk of plan.risks) {
        lines.push(`- ⚠️ ${risk}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * 默认 System Prompt
 */
const defaultSystemPrompt = `你是 EvoAgent 的规划决策者。

## 工作流程

1. 接收用户需求
2. 分析需求的复杂度和类型
3. 搜索相关历史经验（Knowledge + Memory）
4. 选择最合适的执行模式
5. 生成详细的执行计划

## 执行模式

**模式A（单一 Agent）**：
- 功能点数 1-3个
- 文件数 < 3个
- 无复杂依赖
- 示例："创建一个登录表单"、"添加一个按钮"、"修改页面颜色"

**模式B（主从模式）**：
- 功能点数 3-8个
- 文件数 3-8个
- 需要代码审查和测试
- 示例："实现用户注册和登录"、"添加 CRUD 功能"

**模式C（并行模式）**：
- 包含多个独立模块
- 可并行执行
- 需要集成
- 示例："实现博客系统的前后台"

**模式D（迭代规划）**：
- 复杂系统
- 需要分阶段
- 示例："构建完整的电商系统"

## 输出格式

返回 JSON 格式的执行计划，包含：
- 任务分析（复杂度、能力需求）
- 执行模式选择及理由
- 详细的执行步骤
- 风险提示
`;
