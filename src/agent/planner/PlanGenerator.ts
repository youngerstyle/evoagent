/**
 * Plan Generator
 *
 * 负责生成执行计划
 * 根据任务复杂度和类型选择最合适的执行模式
 */

import type { LLMService } from '../../core/llm/types.js';
import type { KnowledgeStorage } from '../../memory/knowledge/KnowledgeStorage.js';
import type { VectorStore } from '../../memory/vector/VectorStore.js';
import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('agent:planner');

// ========== 时长估算常量 ==========
const DEFAULT_MINUTES = 30;  // 默认分钟数（当解析失败时）
const DEFAULT_HOURS = 1;     // 默认小时数（当解析失败时）
const FALLBACK_HOURS = 1;    // 未知时长的默认小时数

// ========== 类型定义 ==========

export interface ExecutionMode {
  type: 'A' | 'B' | 'C' | 'D';
  description: string;
  reasoning: string;
}

export interface TaskAnalysis {
  userRequirement: string;
  complexity: 'simple' | 'medium' | 'complex' | 'very-complex';
  estimatedDuration: string;
  requiredCapabilities: string[];
  suggestedMode: ExecutionMode;
}

export interface PlanStep {
  id: string;
  agent: string;
  description: string;
  dependencies: string[];
  estimatedDuration?: string;
  requiredTools?: string[];
}

export interface ExecutionPlan {
  planId: string;
  taskId: string;
  analysis: TaskAnalysis;
  steps: PlanStep[];
  totalEstimatedDuration: string;
  risks: string[];
  alternatives?: ExecutionPlan[];
}

export interface PlanOptions {
  maxComplexity?: 'medium' | 'complex' | 'very-complex';
  preferredMode?: 'A' | 'B' | 'C' | 'D';
  forceParallel?: boolean;
}

/**
 * Plan Generator 类
 */
export class PlanGenerator {
  private _knowledge?: KnowledgeStorage;
  private _vectorStore?: VectorStore;

  constructor(
    _llm: LLMService,
    knowledge?: KnowledgeStorage,
    vectorStore?: VectorStore
  ) {
    this._knowledge = knowledge;
    this._vectorStore = vectorStore;
  }

  // Public getters for external access
  get knowledge(): KnowledgeStorage | undefined {
    return this._knowledge;
  }

  get vectorStore(): VectorStore | undefined {
    return this._vectorStore;
  }

  /**
   * 生成执行计划
   */
  async generatePlan(
    taskId: string,
    userRequirement: string,
    options: PlanOptions = {}
  ): Promise<ExecutionPlan> {
    logger.debug(`Generating plan for task: ${taskId}`);

    // 1. 分析任务
    const analysis = await this.analyzeTask(userRequirement, options);

    // 2. 选择执行模式
    const mode = this.selectMode(analysis, options);

    // 3. 生成计划步骤
    const steps = await this.generateSteps(userRequirement, mode);

    // 4. 识别风险
    const risks = await this.identifyRisks(userRequirement, steps);

    const plan: ExecutionPlan = {
      planId: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      taskId,
      analysis: {
        ...analysis,
        suggestedMode: mode
      },
      steps,
      totalEstimatedDuration: this.estimateTotalDuration(steps),
      risks
    };

    logger.debug(`Generated plan ${plan.planId} with ${steps.length} steps`);
    return plan;
  }

  /**
   * 分析任务
   */
  private async analyzeTask(
    userRequirement: string,
    _options: PlanOptions
  ): Promise<Omit<TaskAnalysis, 'suggestedMode'>> {
    // 简单规则分析（可以后续用 LLM 增强）
    const complexity = this.estimateComplexity(userRequirement);
    const requiredCapabilities = this.identifyCapabilities(userRequirement);

    return {
      userRequirement,
      complexity,
      estimatedDuration: this.estimateDuration(complexity),
      requiredCapabilities
    };
  }

  /**
   * 估算任务复杂度
   */
  private estimateComplexity(requirement: string): TaskAnalysis['complexity'] {
    // 简单任务特征
    const simpleIndicators = [
      /创建?\s*\d+\s*个?[文件页面]/,
      /添加?\s*(一个|按钮|表单|链接)/,
      /修改?\s*(文字|颜色|样式)/,
      /实现?\s*(简单|基础)的?(功能|页面)/,
      /fix\s*\w+/i,
      /update\s+\w+/
    ];

    // 复杂任务特征
    const complexIndicators = [
      /重构/i,
      /架构/i,
      /完整?\s*(系统|平台|应用)/,
      /多个?\s*(模块|服务|接口)/,
      /集成?\s*(支付|认证|第三方)/,
      /real.?time|实时/i,
      /性能优化/i,
      /分布式/i,
      /微服务/i
    ];

    // 检查简单指标
    for (const indicator of simpleIndicators) {
      if (indicator.test(requirement)) {
        return 'simple';
      }
    }

    // 检查复杂指标
    let complexCount = 0;
    for (const indicator of complexIndicators) {
      if (indicator.test(requirement)) {
        complexCount++;
      }
    }

    if (complexCount >= 2) {
      return complexCount >= 4 ? 'very-complex' : 'complex';
    }

    // 默认中等复杂度
    return 'medium';
  }

  /**
   * 识别所需能力
   */
  private identifyCapabilities(requirement: string): string[] {
    const capabilities: string[] = [];
    const lower = requirement.toLowerCase();

    if (/frontend|前端|界面|ui|页面|组件|button|form/i.test(lower)) {
      capabilities.push('frontend');
    }
    if (/backend|后端|api|接口|服务/i.test(lower)) {
      capabilities.push('backend');
    }
    if (/database|数据库|存储|crud/i.test(lower)) {
      capabilities.push('database');
    }
    if (/auth|认证|登录|权限|security/i.test(lower)) {
      capabilities.push('authentication');
    }
    if (/test|测试/i.test(lower)) {
      capabilities.push('testing');
    }

    return capabilities.length > 0 ? capabilities : ['general'];
  }

  /**
   * 估算持续时间
   */
  private estimateDuration(complexity: TaskAnalysis['complexity']): string {
    const durations = {
      'simple': '30分钟 - 2小时',
      'medium': '2 - 6小时',
      'complex': '1 - 3天',
      'very-complex': '3 - 7天'
    };
    return durations[complexity];
  }

  /**
   * 选择执行模式
   */
  private selectMode(
    analysis: Omit<TaskAnalysis, 'suggestedMode'>,
    options: PlanOptions
  ): ExecutionMode {
    // 如果用户指定了模式
    if (options.preferredMode) {
      const modes = {
        A: { type: 'A' as const, description: '单一 Agent 直接执行', reasoning: '用户指定的模式' },
        B: { type: 'B' as const, description: '主从模式 (Orchestrator + Specialist)', reasoning: '用户指定的模式' },
        C: { type: 'C' as const, description: '并行模式', reasoning: '用户指定的模式' },
        D: { type: 'D' as const, description: '迭代规划模式', reasoning: '用户指定的模式' }
      };
      return modes[options.preferredMode];
    }

    const { complexity, requiredCapabilities } = analysis;

    // 模式 A: 单一 Agent 直接执行
    if (complexity === 'simple' && requiredCapabilities.length <= 2) {
      return {
        type: 'A',
        description: '单一 Agent 直接执行',
        reasoning: '任务简单，功能点少于3个，无需复杂协作'
      };
    }

    // 模式 B: 主从模式 (Orchestrator + Specialist)
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

    // 模式 D: 迭代规划模式
    return {
      type: 'D',
      description: '迭代规划模式',
      reasoning: '任务非常复杂，需要分阶段规划和执行'
    };
  }

  /**
   * 生成计划步骤
   */
  private async generateSteps(
    userRequirement: string,
    mode: ExecutionMode
  ): Promise<PlanStep[]> {
    const steps: PlanStep[] = [];

    switch (mode.type) {
      case 'A':
        // 模式 A: 单一 Agent
        steps.push({
          id: 'step-1',
          agent: 'CodeWriter',
          description: userRequirement,
          dependencies: [],
          estimatedDuration: '30分钟 - 2小时'
        });
        break;

      case 'B':
        // 模式 B: 主从模式
        steps.push({
          id: 'step-1',
          agent: 'Orchestrator',
          description: '分析需求并拆解任务',
          dependencies: [],
          estimatedDuration: '15 - 30分钟'
        });
        steps.push({
          id: 'step-2',
          agent: 'CodeWriter',
          description: '实现核心功能',
          dependencies: ['step-1'],
          requiredTools: ['file.write', 'file.edit']
        });
        steps.push({
          id: 'step-3',
          agent: 'Reviewer',
          description: '代码审查',
          dependencies: ['step-2']
        });
        steps.push({
          id: 'step-4',
          agent: 'Tester',
          description: '编写和执行测试',
          dependencies: ['step-3'],
          requiredTools: ['test.run']
        });
        break;

      case 'C':
        // 模式 C: 并行模式
        steps.push({
          id: 'step-1',
          agent: 'Orchestrator',
          description: '分析需求并识别独立模块',
          dependencies: []
        });
        steps.push({
          id: 'step-2a',
          agent: 'CodeWriter',
          description: '实现模块 A',
          dependencies: ['step-1']
        });
        steps.push({
          id: 'step-2b',
          agent: 'CodeWriter',
          description: '实现模块 B',
          dependencies: ['step-1']
        });
        steps.push({
          id: 'step-3',
          agent: 'Orchestrator',
          description: '集成模块并验证',
          dependencies: ['step-2a', 'step-2b']
        });
        break;

      case 'D':
        // 模式 D: 迭代规划
        steps.push({
          id: 'step-1',
          agent: 'Planner',
          description: '第一阶段：核心功能规划',
          dependencies: [],
          estimatedDuration: '1 - 2小时'
        });
        steps.push({
          id: 'step-2',
          agent: 'Orchestrator',
          description: '执行第一阶段',
          dependencies: ['step-1']
        });
        steps.push({
          id: 'step-3',
          agent: 'Planner',
          description: '第二阶段：完善和优化',
          dependencies: ['step-2'],
          estimatedDuration: '1 - 2小时'
        });
        break;
    }

    return steps;
  }

  /**
   * 识别风险
   */
  private async identifyRisks(
    userRequirement: string,
    steps: PlanStep[]
  ): Promise<string[]> {
    const risks: string[] = [];
    const lower = userRequirement.toLowerCase();

    // 技术风险
    if (/支付|认证|security|安全/i.test(lower)) {
      risks.push('安全相关功能需要特别注意，建议添加安全审查');
    }
    if (/性能优化|实时|real.?time/i.test(lower)) {
      risks.push('性能敏感任务，建议进行性能测试和优化');
    }

    // 复杂度风险
    if (steps.length > 5) {
      risks.push('步骤较多，建议分阶段验证');
    }

    // 依赖风险
    const hasExternalDeps = /第三方|external|api|接口/i.test(lower);
    if (hasExternalDeps) {
      risks.push('涉及外部依赖，建议添加错误处理和降级方案');
    }

    return risks;
  }

  /**
   * 估算总时长
   */
  private estimateTotalDuration(steps: PlanStep[]): string {
    // 简单累加估算
    const totalMinutes = steps.reduce((total, step) => {
      const duration = step.estimatedDuration || `${FALLBACK_HOURS}小时`;
      if (duration.includes('分钟')) {
        const match = duration.match(/(\d+)\s*分钟/);
        return total + (parseInt(match?.[1] || String(DEFAULT_MINUTES)) / 60);
      }
      if (duration.includes('小时')) {
        const match = duration.match(/(\d+)\s*小时/);
        return total + parseInt(match?.[1] || String(DEFAULT_HOURS));
      }
      return total + FALLBACK_HOURS;
    }, 0);

    if (totalMinutes < 1) {
      return '30分钟 - 1小时';
    } else if (totalMinutes < 8) {
      return `${Math.ceil(totalMinutes / 60)} - ${Math.ceil(totalMinutes / 4)}小时`;
    } else {
      return `${Math.ceil(totalMinutes / 60 / 8)} - ${Math.ceil(totalMinutes / 60)}天`;
    }
  }

  /**
   * 从历史计划中学习
   */
  async learnFromHistory(
    userRequirement: string
  ): Promise<{ similarPlans: ExecutionPlan[]; lessons: string[] }> {
    const similarPlans: ExecutionPlan[] = [];
    const lessons: string[] = [];

    if (!this._vectorStore) {
      logger.debug('VectorStore not available for historical plan search');
      return { similarPlans, lessons };
    }

    try {
      // 1. 向量化用户需求
      const embedding = await this._vectorStore.getEmbeddingService().embed(userRequirement);

      // 2. 搜索相似的历史计划（从 plans collection）
      const searchResults = await this._vectorStore.similaritySearch(embedding, {
        collection: 'plans',
        limit: 5,
        minScore: 0.6
      });

      // 3. 从搜索结果中提取 ExecutionPlan
      for (const result of searchResults) {
        try {
          const planData = JSON.parse(result.content);
          // 验证是否是有效的 ExecutionPlan
          if (planData.planId && planData.steps && Array.isArray(planData.steps)) {
            similarPlans.push(planData as ExecutionPlan);
            lessons.push(`[Plan] ${planData.taskId || 'unknown'}: ${planData.analysis?.complexity || 'unknown'} complexity`);
          }
        } catch {
          // 忽略解析错误
          logger.debug(`Failed to parse plan from result: ${result.id}`);
        }
      }

      // 4. 搜索相关的 Knowledge（从 knowledge collection）
      const knowledgeResults = await this._vectorStore.similaritySearch(embedding, {
        collection: 'knowledge',
        limit: 3,
        minScore: 0.5
      });

      for (const result of knowledgeResults) {
        const metadata = result.metadata as { category?: string; tags?: string[] };
        const category = metadata?.category || 'general';
        lessons.push(`[Knowledge] ${category}: ${result.content.slice(0, 100)}...`);
      }

      logger.debug(`Found ${similarPlans.length} similar plans and ${knowledgeResults.length} related knowledge items`);
    } catch (error) {
      logger.warn('Error searching for similar plans', { error: error instanceof Error ? error.message : String(error) });
    }

    return { similarPlans, lessons };
  }

  /**
   * 保存计划到历史（供未来学习使用）
   */
  async savePlanToHistory(plan: ExecutionPlan): Promise<void> {
    if (!this._vectorStore) {
      return;
    }

    try {
      // 将计划序列化为 JSON
      const planContent = JSON.stringify({
        planId: plan.planId,
        taskId: plan.taskId,
        analysis: plan.analysis,
        steps: plan.steps,
        totalEstimatedDuration: plan.totalEstimatedDuration,
        risks: plan.risks
      });

      // 创建摘要用于搜索
      const summary = `${plan.analysis.userRequirement} ${plan.steps.map(s => s.description).join(' ')}`;

      // 生成 embedding
      const embedding = await this._vectorStore.getEmbeddingService().embed(summary);

      // 保存到 plans collection
      await this._vectorStore.add({
        id: plan.planId,
        collection: 'plans',
        content: planContent,
        metadata: {
          sessionId: 'plan-history',
          timestamp: new Date().toISOString(),
          category: 'execution-plan',
          complexity: plan.analysis.complexity,
          mode: plan.analysis.suggestedMode.type,
          tagsJson: JSON.stringify([plan.analysis.complexity, plan.analysis.suggestedMode.type])
        },
        embedding,
        consolidated: false
      });

      logger.debug(`Saved plan ${plan.planId} to history`);
    } catch (error) {
      logger.warn('Error saving plan to history', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

/**
 * 计划调整建议
 */
export interface PlanAdjustment {
  type: 'add-risk-check' | 'refine-steps' | 'add-caution' | 'apply-pattern' | 'add-dependency';
  reason: string;
  suggestion: string;
}
