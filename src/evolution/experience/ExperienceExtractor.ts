/**
 * Experience Extractor
 *
 * 从 Agent 运行结果中提取有价值的经验
 */

import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../core/logger/index.js';
import type {
  ExperienceEvent,
  ExperienceEventType,
  EventSeverity,
  ExtractionContext
} from './ExperienceTypes.js';

const logger = getLogger('evolution:extractor');

/**
 * 内置提取规则
 */
const DEFAULT_RULES: ExtractionRule[] = [
  // 失败提取规则
  {
    id: 'extract-failure',
    name: 'Extract Failure',
    description: '从失败的 Agent 运行中提取失败经验',
    trigger: {
      type: 'result',
      success: false
    },
    extractor: {
      type: 'template',
      template: {
        title: '任务失败: {{agentType}}',
        description: '{{agentType}} 在执行任务时失败',
        eventType: 'failure',
        severity: 'major',
        tags: ['failure', 'agent-error'],
        detailsFn: (ctx: ExtractionContext) => ({
          failureContext: {
            error: ctx.runResult.error || '未知错误',
            errorType: classifyError(ctx.runResult.error || ''),
            rootCause: extractRootCause(ctx.runResult.error || ''),
            attemptedSolutions: []
          }
        })
      }
    }
  },

  // 成功提取规则
  {
    id: 'extract-success',
    name: 'Extract Success',
    description: '从成功的 Agent 运行中提取成功经验',
    trigger: {
      type: 'result',
      success: true,
      durationRange: [0, 300000]
    },
    extractor: {
      type: 'template',
      template: {
        title: '任务成功: {{agentType}}',
        description: '{{agentType}} 成功完成任务',
        eventType: 'success',
        severity: 'info',
        tags: ['success'],
        detailsFn: (ctx: ExtractionContext) => ({
          successContext: {
            approach: extractApproach(ctx.runResult.output),
            keyFactors: extractKeyFactors(ctx.runResult.output),
            outcome: '任务成功完成',
            artifacts: extractArtifacts(ctx.runResult.output)
          }
        })
      }
    }
  },

  // 错误模式提取规则
  {
    id: 'extract-error-pattern',
    name: 'Extract Error Pattern',
    description: '提取常见错误模式',
    trigger: {
      type: 'error'
    },
    extractor: {
      type: 'template',
      template: {
        title: '错误模式',
        description: '发现的错误模式',
        eventType: 'pitfall',
        severity: 'critical',
        tags: ['pitfall', 'error-pattern'],
        detailsFn: (ctx: ExtractionContext) => ({
          failureContext: {
            error: ctx.runResult.error || '',
            errorType: classifyError(ctx.runResult.error || ''),
            rootCause: extractRootCause(ctx.runResult.error || ''),
            attemptedSolutions: []
          }
        })
      }
    }
  },

  // 代码模式提取规则
  {
    id: 'extract-code-pattern',
    name: 'Extract Code Pattern',
    description: '提取有用的代码模式',
    trigger: {
      type: 'custom',
      custom: (ctx) => hasCodeArtifacts(ctx.runResult.output)
    },
    extractor: {
      type: 'template',
      template: {
        title: '代码模式发现',
        description: '发现有用的代码模式',
        eventType: 'pattern',
        severity: 'info',
        tags: ['pattern', 'code'],
        detailsFn: (ctx: ExtractionContext) => extractCodePatternDetails(ctx)
      }
    }
  },

  // 慢执行提取规则
  {
    id: 'extract-slow-execution',
    name: 'Extract Slow Execution',
    description: '提取执行缓慢的经验',
    trigger: {
      type: 'custom',
      custom: (ctx) => ctx.runResult.duration > 60000
    },
    extractor: {
      type: 'template',
      template: {
        title: '执行缓慢',
        description: 'Agent 执行时间过长',
        eventType: 'optimization',
        severity: 'minor',
        tags: ['performance', 'optimization'],
        detailsFn: (ctx: ExtractionContext) => ({
          extra: {
            duration: ctx.runResult.duration,
            suggestion: '考虑优化算法或分解任务'
          }
        })
      }
    }
  }
];

/**
 * 提取模板
 */
interface ExtractorTemplate {
  title: string;
  description: string;
  eventType: ExperienceEventType;
  severity: EventSeverity;
  tags: string[];
  detailsFn: (context: ExtractionContext) => Record<string, unknown>;
}

/**
 * 提取规则
 */
export interface ExtractionRule {
  id: string;
  name: string;
  description: string;
  trigger: TriggerCondition;
  extractor: {
    type: 'template' | 'function' | 'ai';
    template?: ExtractorTemplate;
    function?: (context: ExtractionContext) => Partial<ExperienceEvent>;
    ai?: { prompt: string; model?: string };
  };
}

/**
 * 触发条件
 */
interface TriggerCondition {
  type: 'result' | 'error' | 'custom';
  success?: boolean;
  agentType?: string | string[];
  durationRange?: [number, number];
  custom?: (context: ExtractionContext) => boolean;
}

/**
 * Experience Extractor
 *
 * 功能：
 * 1. 根据规则从 Agent 运行结果中提取经验
 * 2. 支持自定义提取规则
 * 3. 模式匹配和代码片段提取
 */
export class ExperienceExtractor {
  private rules: Map<string, ExtractionRule> = new Map();

  constructor() {
    // 注册默认规则
    for (const rule of DEFAULT_RULES) {
      this.rules.set(rule.id, rule);
    }

    logger.debug(`ExperienceExtractor initialized with ${DEFAULT_RULES.length} rules`);
  }

  /**
   * 添加提取规则
   */
  addRule(rule: ExtractionRule): void {
    this.rules.set(rule.id, rule);
    logger.debug(`Added extraction rule: ${rule.id}`);
  }

  /**
   * 移除提取规则
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * 获取所有规则
   */
  getAllRules(): ExtractionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 从上下文中提取经验事件
   */
  async extract(context: ExtractionContext): Promise<Partial<ExperienceEvent>[]> {
    const events: Partial<ExperienceEvent>[] = [];

    for (const rule of this.rules.values()) {
      if (this.matchesTrigger(rule.trigger, context)) {
        try {
          const extracted = await this.applyExtractor(rule.extractor, context);

          if (extracted) {
            events.push(extracted);
          }
        } catch (error) {
          logger.error(`Error applying extraction rule ${rule.id}:`, error);
        }
      }
    }

    logger.debug(`Extracted ${events.length} events from ${context.agentType} run`);

    return events;
  }

  /**
   * 检查是否匹配触发条件
   */
  private matchesTrigger(trigger: TriggerCondition, context: ExtractionContext): boolean {
    const result = context.runResult;

    // 成功/失败条件
    if (trigger.success !== undefined) {
      if (result.success !== trigger.success) {
        return false;
      }
    }

    // Agent 类型条件
    if (trigger.agentType) {
      const types = Array.isArray(trigger.agentType) ? trigger.agentType : [trigger.agentType];
      if (!types.includes(context.agentType)) {
        return false;
      }
    }

    // 持续时间范围
    if (trigger.durationRange) {
      const [min, max] = trigger.durationRange;
      if (result.duration < min || result.duration > max) {
        return false;
      }
    }

    // 错误类型
    if (trigger.type === 'error' && !result.error) {
      return false;
    }

    // 自定义触发器
    if (trigger.custom) {
      if (!trigger.custom(context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 应用提取器
   */
  private async applyExtractor(
    extractorConfig: ExtractionRule['extractor'],
    context: ExtractionContext
  ): Promise<Partial<ExperienceEvent> | null> {
    // 处理模板提取器
    if (extractorConfig.type === 'template' && extractorConfig.template) {
      const template = extractorConfig.template;
      const event: Partial<ExperienceEvent> = {
        id: uuidv4(),
        type: template.eventType,
        severity: template.severity,
        source: 'agent',
        agentType: context.agentType,
        sessionId: context.sessionId,
        runId: context.runId,
        title: this.resolveTemplate(template.title, context),
        description: this.resolveTemplate(template.description, context),
        details: template.detailsFn(context),
        metadata: {
          duration: context.runResult.duration,
          ...context.runResult.metadata
        },
        timestamp: context.timestamp,
        tags: template.tags,
        occurrenceCount: 1,
        lastOccurrence: context.timestamp
      };
      return event;
    }

    // 处理函数提取器
    if (extractorConfig.type === 'function' && extractorConfig.function) {
      return extractorConfig.function(context);
    }

    // AI 提取器暂不支持
    if (extractorConfig.type === 'ai') {
      logger.warn('AI extractor not yet implemented');
      return null;
    }

    return null;
  }

  /**
   * 解析模板变量
   */
  private resolveTemplate(template: string, context: ExtractionContext): string {
    return template
      .replace(/\{\{agentType\}\}/g, context.agentType)
      .replace(/\{\{sessionId\}\}/g, context.sessionId)
      .replace(/\{\{runId\}\}/g, context.runId)
      .replace(/\{\{duration\}\}/g, String(context.runResult.duration))
      .replace(/\{\{success\}\}/g, String(context.runResult.success))
      .replace(/\{\{output\}\}/g, context.runResult.output.slice(0, 100))
      .replace(/\{\{error\}\}/g, context.runResult.error || '');
  }
}

// ========== 辅助函数 ==========

/**
 * 分类错误类型
 */
function classifyError(error: string): string {
  const lower = error.toLowerCase();

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'timeout';
  }
  if (lower.includes('network') || lower.includes('econnrefused')) {
    return 'network';
  }
  if (lower.includes('permission') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return 'permission';
  }
  if (lower.includes('not found') || lower.includes('enoent')) {
    return 'not_found';
  }
  if (lower.includes('syntax') || lower.includes('parse')) {
    return 'syntax';
  }
  if (lower.includes('type') || lower.includes('cannot read')) {
    return 'type';
  }

  return 'unknown';
}

/**
 * 提取根本原因
 */
function extractRootCause(error: string): string {
  const lines = error.split('\n');
  return lines[0] || error;
}

/**
 * 提取方法
 */
function extractApproach(output: string): string {
  const approachPatterns = [
    /(?:采用|使用|通过|using|by)\s+([^.。]+)/i,
    /(?:方法|approach|method)[:：]\s*([^.。]+)/i
  ];

  for (const pattern of approachPatterns) {
    const match = output.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '标准执行流程';
}

/**
 * 提取关键因素
 */
function extractKeyFactors(output: string): string[] {
  const factors: string[] = [];

  const factorKeywords = [
    '优化', '改进', '缓存', '异步', '并行', '批量',
    'optimize', 'improve', 'cache', 'async', 'parallel', 'batch'
  ];

  for (const keyword of factorKeywords) {
    if (output.toLowerCase().includes(keyword.toLowerCase())) {
      factors.push(keyword);
    }
  }

  return factors.length > 0 ? factors : ['标准执行'];
}

/**
 * 提取产物
 */
function extractArtifacts(output: string): string[] {
  const artifacts: string[] = [];

  const filePathPattern = /[`'"]([^`'"]+\.[a-z]+)[`'"]/gi;
  let match;
  while ((match = filePathPattern.exec(output)) !== null) {
    if (match[1]) {
      artifacts.push(match[1]);
    }
  }

  return artifacts;
}

/**
 * 检查是否有代码产物
 */
function hasCodeArtifacts(output: string): boolean {
  const codeIndicators = [
    '```', 'function', 'class', 'const ', 'let ', 'var ',
    'def ', 'import ', 'from ', 'export '
  ];

  return codeIndicators.some(indicator => output.includes(indicator));
}

/**
 * 提取代码模式详情
 */
function extractCodePatternDetails(context: ExtractionContext): Record<string, unknown> {
  const output = context.runResult.output;
  const codeSnippets: Array<{ language: string; code: string; description?: string }> = [];

  // 提取代码块
  const codeBlockRegex = /```(\w+)?(?:\n|\r\n)?([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(output)) !== null) {
    codeSnippets.push({
      language: match[1] || 'text',
      code: (match[2] || '').trim()
    });
  }

  return {
    pattern: {
      patternType: 'code',
      pattern: '代码片段',
      frequency: 1,
      confidence: 0.7,
      examples: codeSnippets.map(s => s.code.slice(0, 100))
    },
    codeSnippet: codeSnippets[0] || null
  };
}
