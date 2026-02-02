/**
 * SOUL 反射器
 *
 * 负责反思 Agent 行为，并根据反馈和模式更新 SOUL
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type {
  SoulLoader,
  SoulReflector,
  SoulEvolutionRecord,
  SoulAdjustment,
  UserFeedback,
  ActionHistory,
  SoulReflectionContext
} from './types.js';
import type { Logger } from '../core/logger/index.js';
import type { LLMService } from '../core/llm/types.js';

/**
 * SOUL 反射器实现
 */
export class SoulReflectorImpl implements SoulReflector {
  private readonly evolutionFile: string;

  constructor(
    private soulLoader: SoulLoader,
    private llm: LLMService,
    private logger: Logger,
    evoagentDir: string = '.evoagent'
  ) {
    this.evolutionFile = join(evoagentDir, 'SOUL_EVOLUTION.md');
  }

  /**
   * 反思并更新 SOUL
   */
  async reflect(context: SoulReflectionContext): Promise<SoulEvolutionRecord[]> {
    const records: SoulEvolutionRecord[] = [];

    // 1. 分析用户反馈
    for (const feedback of context.userFeedbacks) {
      const adjustment = await this.analyzeFeedback(feedback, context.agentType);
      if (adjustment) {
        records.push(await this.applyAdjustment(adjustment, context.agentType));
      }
    }

    // 2. 分析失败模式
    if (context.recentFailures > 3) {
      const adjustments = await this.analyzeFailurePatterns(context);
      for (const adjustment of adjustments) {
        records.push(await this.applyAdjustment(adjustment, context.agentType));
      }
    }

    // 3. 强化成功模式
    if (context.recentSuccesses > 5) {
      const adjustment = await this.identifySuccessPattern(context);
      if (adjustment) {
        records.push(await this.applyAdjustment(adjustment, context.agentType));
      }
    }

    // 4. 保存进化记录
    if (records.length > 0) {
      await this.saveEvolutionRecords(records);
    }

    return records;
  }

  /**
   * 记录用户反馈
   */
  async recordFeedback(feedback: UserFeedback): Promise<void> {
    const evolutionHistory = await this.soulLoader.loadEvolutionHistory();
    const record: SoulEvolutionRecord = {
      timestamp: feedback.timestamp,
      version: '1.0.0',
      changeType: feedback.type === 'positive' ? 'reinforce' : 'adjust',
      description: `用户反馈：${feedback.content}`,
      reason: `用户${feedback.type === 'positive' ? '认可' : '批评'}了${feedback.category}方面`,
      trigger: 'user_feedback'
    };

    evolutionHistory.push(record);
    await this.saveEvolutionRecords(evolutionHistory);
  }

  /**
   * 分析行为模式，建议 SOUL 调整
   */
  async analyzePatterns(history: ActionHistory[]): Promise<SoulAdjustment[]> {
    const adjustments: SoulAdjustment[] = [];

    // 分析失败率
    const failures = history.filter(h => h.result === 'failure');
    const successes = history.filter(h => h.result === 'success');

    if (failures.length > successes.length) {
      adjustments.push({
        changeType: 'adjust',
        target: 'approach',
        suggestedValue: '更谨慎的方法，先确认再执行',
        reason: `失败率高于成功率 (${failures.length}/${history.length})`,
        confidence: 0.7
      });
    }

    // 分析耗时
    const avgDuration = history.reduce((sum, h) => sum + h.duration, 0) / history.length;
    if (avgDuration > 30000) { // 超过30秒
      adjustments.push({
        changeType: 'adjust',
        target: 'efficiency',
        suggestedValue: '简化决策流程，优先完成任务',
        reason: `平均耗时 ${Math.round(avgDuration / 1000)}s 偏高`,
        confidence: 0.6
      });
    }

    return adjustments;
  }

  /**
   * 分析用户反馈并生成调整建议
   */
  private async analyzeFeedback(
    feedback: UserFeedback,
    agentType: string
  ): Promise<SoulAdjustment | null> {
    if (feedback.type === 'positive') {
      // 正面反馈，强化当前行为
      return {
        changeType: 'reinforce',
        target: feedback.category,
        suggestedValue: `继续当前的 ${feedback.category} 方式`,
        reason: `用户正面反馈：${feedback.content}`,
        confidence: 0.8
      };
    }

    // 负面反馈，使用 LLM 分析调整方案
    const prompt = this.buildAnalysisPrompt(feedback, agentType);
    try {
      const response = await this.llm.complete({
        messages: [{ role: 'user', content: prompt }]
      });

      return this.parseAdjustmentResponse(response.content, feedback);
    } catch (error) {
      this.logger.warn('Failed to analyze feedback with LLM', { error });
      return null;
    }
  }

  /**
   * 分析失败模式
   */
  private async analyzeFailurePatterns(
    context: SoulReflectionContext
  ): Promise<SoulAdjustment[]> {
    const soul = await this.soulLoader.loadAgent(context.agentType)
      || await this.soulLoader.loadGlobal();

    const prompt = `
你是 ${context.agentType} 的反思者。最近连续失败 ${context.recentFailures} 次。

当前 SOUL 的核心真理：
${soul.coreTruths.map(t => `- ${t.principle}: ${t.description}`).join('\n')}

当前 SOUL 的边界：
${soul.boundaries.map(b => `- ${b.name}: ${b.rule}`).join('\n')}

请分析可能的问题并提出调整建议。输出格式 JSON：
{
  "adjustments": [
    {
      "changeType": "adjust|reinforce|add",
      "target": "truth|boundary|trait",
      "suggestedValue": "建议内容",
      "reason": "原因",
      "confidence": 0.7
    }
  ]
}
`;

    try {
      const response = await this.llm.complete({
        messages: [{ role: 'user', content: prompt }]
      });

      const parsed = JSON.parse(response.content);
      return parsed.adjustments || [];
    } catch (error) {
      this.logger.warn('Failed to analyze failure patterns', { error });
      return [];
    }
  }

  /**
   * 识别成功模式
   */
  private async identifySuccessPattern(
    context: SoulReflectionContext
  ): Promise<SoulAdjustment | null> {
    return {
      changeType: 'reinforce',
      target: 'approach',
      suggestedValue: '当前方法有效，继续使用',
      reason: `最近 ${context.recentSuccesses} 次连续成功`,
      confidence: 0.6
    };
  }

  /**
   * 应用调整
   */
  private async applyAdjustment(
    adjustment: SoulAdjustment,
    agentType: string
  ): Promise<SoulEvolutionRecord> {
    const soul = await this.soulLoader.loadAgent(agentType)
      || await this.soulLoader.loadGlobal();

    // 根据 adjustment 类型更新 SOUL
    switch (adjustment.changeType) {
      case 'add':
        if (adjustment.target === 'truth') {
          const parts = adjustment.suggestedValue.split('：');
          soul.coreTruths.push({
            principle: parts[0] || adjustment.suggestedValue,
            description: parts[1] || ''
          });
        }
        break;

      case 'reinforce':
        // 强化不改变内容，只在进化记录中标注
        break;

      case 'adjust':
        // 调整边界或原则
        if (adjustment.target === 'boundary') {
          const parts = adjustment.suggestedValue.split('：');
          const existing = soul.boundaries.find(b => b.name === parts[0]);
          if (existing) {
            existing.rule = parts[1] || existing.rule;
          }
        }
        break;
    }

    // 保存更新后的 SOUL
    await this.soulLoader.save(soul);

    return {
      timestamp: new Date().toISOString(),
      version: soul.version,
      changeType: adjustment.changeType,
      description: adjustment.suggestedValue,
      reason: adjustment.reason,
      trigger: 'reflection',
      expected: adjustment.confidence > 0.7 ? '预期行为改善' : undefined
    };
  }

  /**
   * 保存进化记录
   */
  private async saveEvolutionRecords(records: SoulEvolutionRecord[]): Promise<void> {
    const existing = await this.soulLoader.loadEvolutionHistory();
    const all = [...existing, ...records];

    const content = this.formatEvolutionRecords(all);
    await mkdir(dirname(this.evolutionFile), { recursive: true });
    await writeFile(this.evolutionFile, content, 'utf-8');
  }

  /**
   * 格式化进化记录
   */
  private formatEvolutionRecords(records: SoulEvolutionRecord[]): string {
    let content = `# SOUL 进化记录\n\n`;
    content += `记录 EvoAgent 及其 Agent 的灵魂进化过程。\n\n`;
    content += `---\n\n`;

    content += `## 全局 SOUL 进化\n\n`;

    // 按时间排序
    const sorted = [...records].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    for (const record of sorted) {
      content += `### ${record.timestamp} - ${record.description}\n\n`;
      content += `**变更类型**: ${record.changeType}\n`;
      content += `**变更原因**: ${record.reason}\n`;
      if (record.expected) {
        content += `**预期效果**: ${record.expected}\n`;
      }
      content += `**触发条件**: ${record.trigger}\n\n`;
    }

    return content;
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(feedback: UserFeedback, agentType: string): string {
    return `
你是 ${agentType} 的 SOUL 分析师。收到用户反馈：

类型: ${feedback.type}
类别: ${feedback.category}
内容: ${feedback.content}

请分析这个反馈，建议如何调整 SOUL。输出 JSON 格式：
{
  "changeType": "adjust|reinforce|add",
  "target": "truth|boundary|trait",
  "suggestedValue": "具体的建议内容",
  "reason": "这个建议的理由",
  "confidence": 0.8
}
`;
  }

  /**
   * 解析调整响应
   */
  private parseAdjustmentResponse(
    response: string,
    _feedback: UserFeedback
  ): SoulAdjustment | null {
    try {
      const parsed = JSON.parse(response);
      return {
        changeType: parsed.changeType,
        target: parsed.target,
        suggestedValue: parsed.suggestedValue,
        reason: parsed.reason,
        confidence: parsed.confidence || 0.5
      };
    } catch {
      return null;
    }
  }
}

/**
 * 创建 SoulReflector 实例
 */
export type { SoulReflector } from './types.js';

export function createSoulReflector(
  soulLoader: SoulLoader,
  llm: LLMService,
  logger: Logger,
  evoagentDir?: string
): SoulReflector {
  return new SoulReflectorImpl(soulLoader, llm, logger, evoagentDir);
}
