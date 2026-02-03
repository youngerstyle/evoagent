/**
 * Memory Consolidation - 记忆巩固
 *
 * 将短期记忆转化为长期知识的过程
 */

import { getLogger } from '../../core/logger/index.js';
import type { LLMService } from '../../core/llm/types.js';
import type { SessionStorage } from '../session/SessionStorage.js';
import type { KnowledgeStorage } from '../knowledge/KnowledgeStorage.js';

const logger = getLogger('memory:consolidation');

/**
 * 巩固触发条件
 */
export interface ConsolidationTrigger {
  minSessionAge: number;      // 最小会话年龄（天）
  minOccurrences: number;     // 最小出现次数
  minSuccessRate: number;     // 最小成功率
}

/**
 * 巩固结果
 */
export interface ConsolidationResult {
  consolidatedCount: number;
  skippedCount: number;
  failedCount: number;
  details: Array<{
    sessionId: string;
    pattern: string;
    status: 'consolidated' | 'skipped' | 'failed';
    knowledgeId?: string;
  }>;
}

/**
 * 巩固配置
 */
export interface ConsolidationConfig {
  trigger: ConsolidationTrigger;
  llmModel?: string;
  maxBatchSize: number;
}

/**
 * 记忆巩固管理器
 */
export class MemoryConsolidation {
  constructor(
    private readonly llm: LLMService,
    private readonly sessionStorage: SessionStorage,
    private readonly knowledgeStorage: KnowledgeStorage,
    _evoagentDir: string,
    private readonly config: ConsolidationConfig = {
      trigger: {
        minSessionAge: 7,
        minOccurrences: 3,
        minSuccessRate: 0.7
      },
      maxBatchSize: 10
    }
  ) {}

  /**
   * 执行记忆巩固
   */
  async consolidate(): Promise<ConsolidationResult> {
    logger.info('Starting memory consolidation...');

    const result: ConsolidationResult = {
      consolidatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      details: []
    };

    try {
      // 1. 获取所有会话
      await this.sessionStorage.init();
      const sessionMetadatas = this.sessionStorage.listSessions();
      const sessions = sessionMetadatas.map(m => m.sessionId);

      // 2. 筛选符合巩固条件的会话
      const eligibleSessions = await this.getEligibleSessions(sessions);

      if (eligibleSessions.length === 0) {
        logger.info('No sessions eligible for consolidation');
        return result;
      }

      logger.info(`Found ${eligibleSessions.length} sessions eligible for consolidation`);

      // 3. 从会话中提取模式
      const patterns = await this.extractPatterns(eligibleSessions);

      // 4. 对每个模式进行巩固
      for (const pattern of patterns) {
        const detail = await this.consolidatePattern(pattern);
        result.details.push(detail);

        switch (detail.status) {
          case 'consolidated':
            result.consolidatedCount++;
            break;
          case 'skipped':
            result.skippedCount++;
            break;
          case 'failed':
            result.failedCount++;
            break;
        }
      }

      logger.info(`Memory consolidation completed: ${result.consolidatedCount} consolidated, ${result.skippedCount} skipped, ${result.failedCount} failed`);

    } catch (error) {
      logger.error('Memory consolidation failed', { error });
    }

    return result;
  }

  /**
   * 获取符合条件的会话
   */
  private async getEligibleSessions(sessions: string[]): Promise<string[]> {
    const eligible: string[] = [];
    const now = Date.now();
    const minAge = this.config.trigger.minSessionAge * 24 * 60 * 60 * 1000;

    for (const sessionId of sessions) {
      const session = await this.sessionStorage.loadSession(sessionId);
      if (!session) continue;

      // 检查年龄
      if (now - session.metadata.createdAt < minAge) continue;

      // 检查成功率
      const successRate = session.events.length > 0
        ? session.events.filter(e => e.type === 'success').length / session.events.length
        : 0;

      if (successRate < this.config.trigger.minSuccessRate) continue;

      eligible.push(sessionId);
    }

    return eligible;
  }

  /**
   * 从会话中提取模式
   */
  private async extractPatterns(sessionIds: string[]): Promise<Array<{
    pattern: string;
    occurrences: number;
    sessionIds: string[];
    context: string;
  }>> {
    const patternCounts = new Map<string, { count: number; sessionIds: Set<string>; context: string }>();

    for (const sessionId of sessionIds) {
      const session = await this.sessionStorage.loadSession(sessionId);
      if (!session) continue;

      // 分析会话内容，提取模式
      const patterns = this.analyzeSessionContent(session);

      for (const pattern of patterns) {
        const existing = patternCounts.get(pattern.pattern);
        if (existing) {
          existing.count++;
          existing.sessionIds.add(sessionId);
        } else {
          patternCounts.set(pattern.pattern, {
            count: 1,
            sessionIds: new Set([sessionId]),
            context: pattern.context
          });
        }
      }
    }

    // 转换为数组并过滤
    return Array.from(patternCounts.entries())
      .filter(([_, data]) => data.count >= this.config.trigger.minOccurrences)
      .map(([pattern, data]) => ({
        pattern,
        occurrences: data.count,
        sessionIds: Array.from(data.sessionIds),
        context: data.context
      }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * 分析会话内容
   */
  private analyzeSessionContent(session: {
    metadata: { createdAt: number };
    events: Array<{ type: string; data?: Record<string, unknown> }>;
  }): Array<{ pattern: string; context: string }> {
    const patterns: Array<{ pattern: string; context: string }> = [];

    // 从事件中提取模式
    for (const event of session.events) {
      const content = event.data?.output ? String(event.data.output) : '';
      if (!content) continue;

      // 提取代码模式
      const codePatterns = this.extractCodePatterns(content);
      patterns.push(...codePatterns);

      // 提取决策模式
      const decisionPatterns = this.extractDecisionPatterns(content);
      patterns.push(...decisionPatterns);
    }

    return patterns;
  }

  /**
   * 提取代码模式
   */
  private extractCodePatterns(content: string): Array<{ pattern: string; context: string }> {
    const patterns: Array<{ pattern: string; context: string }> = [];

    // 函数定义模式
    const functionMatch = content.match(/export\s+(async\s+)?function\s+(\w+)/);
    if (functionMatch) {
      patterns.push({
        pattern: `function-definition:${functionMatch[2]}`,
        context: content.slice(0, 200)
      });
    }

    // 组件定义模式
    const componentMatch = content.match(/export\s+(const|function)\s+(\w+).*React/);
    if (componentMatch) {
      patterns.push({
        pattern: `react-component:${componentMatch[2]}`,
        context: content.slice(0, 200)
      });
    }

    // Hook 模式
    const hookMatch = content.match(/function\s+(use[A-Z]\w+)/);
    if (hookMatch) {
      patterns.push({
        pattern: `custom-hook:${hookMatch[1]}`,
        context: content.slice(0, 200)
      });
    }

    return patterns;
  }

  /**
   * 提取决策模式
   */
  private extractDecisionPatterns(content: string): Array<{ pattern: string; context: string }> {
    const patterns: Array<{ pattern: string; context: string }> = [];

    // 技术选型决策
    const techDecision = content.match(/选择\s+(\w+)\s+(因为|由于)/);
    if (techDecision) {
      patterns.push({
        pattern: `tech-choice:${techDecision[1]}`,
        context: content.slice(0, 200)
      });
    }

    // 架构决策
    const archDecision = content.match(/使用\s+(\w+)\s+(架构|模式)/);
    if (archDecision) {
      patterns.push({
        pattern: `arch-pattern:${archDecision[1]}`,
        context: content.slice(0, 200)
      });
    }

    return patterns;
  }

  /**
   * 巩固单个模式
   */
  private async consolidatePattern(pattern: {
    pattern: string;
    occurrences: number;
    sessionIds: string[];
    context: string;
  }): Promise<{
    sessionId: string;
    pattern: string;
    status: 'consolidated' | 'skipped' | 'failed';
    knowledgeId?: string;
  }> {
    try {
      // 检查是否已存在
      const existing = await this.knowledgeStorage.searchByContent(pattern.pattern, { limit: 1 });
      if (existing.length > 0) {
        logger.debug(`Pattern already exists: ${pattern.pattern}`);
        return {
          sessionId: pattern.sessionIds[0] || 'unknown',
          pattern: pattern.pattern,
          status: 'skipped'
        };
      }

      // 使用 LLM 生成知识条目
      const knowledgeEntry = await this.generateKnowledgeEntry(pattern);

      // 保存到知识库
      const category = this.determineCategory(pattern.pattern);
      const slug = this.formatSlug(pattern.pattern);
      await this.knowledgeStorage.writeAuto(category, slug, knowledgeEntry.content);
      const knowledgeId = `${category}/${slug}`;

      logger.info(`Consolidated pattern: ${pattern.pattern} -> ${knowledgeId}`);

      return {
        sessionId: pattern.sessionIds[0] || 'unknown',
        pattern: pattern.pattern,
        status: 'consolidated',
        knowledgeId
      };

    } catch (error) {
      logger.error(`Failed to consolidate pattern: ${pattern.pattern}`, { error });
      return {
        sessionId: pattern.sessionIds[0] || 'unknown',
        pattern: pattern.pattern,
        status: 'failed'
      };
    }
  }

  /**
   * 生成知识条目
   */
  private async generateKnowledgeEntry(pattern: {
    pattern: string;
    occurrences: number;
    sessionIds: string[];
    context: string;
  }): Promise<{ content: string }> {
    const prompt = this.buildConsolidationPrompt(pattern);

    const response = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: this.getConsolidationSystemPrompt()
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      maxTokens: 2000
    });

    return { content: response.content };
  }

  /**
   * 构建巩固提示词
   */
  private buildConsolidationPrompt(pattern: {
    pattern: string;
    occurrences: number;
    sessionIds: string[];
    context: string;
  }): string {
    return `请将以下模式转化为知识库条目：

## 模式
${pattern.pattern}

## 出现次数
${pattern.occurrences}

## 来源会话
${pattern.sessionIds.join(', ')}

## 示例上下文
${pattern.context.slice(0, 500)}

请生成一个 Markdown 格式的知识条目，包含：
1. 清晰的标题
2. 适当的描述
3. 使用建议
4. 注意事项`;
  }

  /**
   * 获取巩固系统提示词
   */
  private getConsolidationSystemPrompt(): string {
    return `你是一个专业的知识整理专家，负责将代码模式转化为结构化的知识库条目。

你的任务是：
1. 理解模式的本质
2. 提取可重用的知识
3. 用清晰的语言描述
4. 提供实用的建议

输出要求：
- Markdown 格式
- 结构清晰
- 语言简洁
- 重点突出`;
  }

  /**
   * 确定知识类别
   */
  private determineCategory(pattern: string): string {
    if (pattern.includes('trap') || pattern.includes('pitfall') || pattern.includes('error')) {
      return 'pits';
    }
    if (pattern.includes('decision') || pattern.includes('choice')) {
      return 'decisions';
    }
    if (pattern.includes('solution') || pattern.includes('fix')) {
      return 'solutions';
    }
    return 'patterns';
  }

  /**
   * 格式化 slug
   */
  private formatSlug(pattern: string): string {
    return pattern
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  /**
   * 获取巩固统计
   */
  async getStats(): Promise<{
    totalSessions: number;
    eligibleSessions: number;
    consolidatedPatterns: number;
    pendingPatterns: number;
  }> {
    await this.sessionStorage.init();
    const sessionMetadatas = this.sessionStorage.listSessions();
    const sessions = sessionMetadatas.map(m => m.sessionId);
    const eligible = await this.getEligibleSessions(sessions);

    // TODO: 获取已巩固的模式数量

    return {
      totalSessions: sessions.length,
      eligibleSessions: eligible.length,
      consolidatedPatterns: 0,
      pendingPatterns: 0
    };
  }
}
