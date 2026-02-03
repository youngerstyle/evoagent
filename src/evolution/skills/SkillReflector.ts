/**
 * Skill Reflector - 技能反思器
 *
 * 分析模式候选，触发技能生成，管理技能生命周期
 */

import { join } from 'path';
import { getLogger } from '../../core/logger/index.js';
import type { LLMService } from '../../core/llm/types.js';
import type { Logger } from '../../core/logger/index.js';
import { SkillCollector } from './SkillCollector.js';
import { SkillStore } from './SkillStore.js';
import { SkillGenerator } from './SkillGenerator.js';
import { EvolutionHistoryStorage } from './EvolutionHistoryStorage.js';
import type {
  PatternCandidate,
  SkillReflectorConfig
} from './SkillTypes.js';

const logger = getLogger('evolution:skills:reflector');

/**
 * 反思结果
 */
export interface ReflectionResult {
  generatedSkills: number;
  archivedPatterns: number;
  deprecatedSkills: number;
  promotedSkills: number;
  summary: string;
}

/**
 * 技能反思器
 */
export class SkillReflector {
  private readonly config: SkillReflectorConfig;
  private readonly evolutionHistory: EvolutionHistoryStorage;

  constructor(
    private readonly llm: LLMService,
    private readonly collector: SkillCollector,
    private readonly store: SkillStore,
    workspaceRoot: string,
    private readonly log: Logger = logger,
    config?: Partial<SkillReflectorConfig>
  ) {
    this.config = {
      minCandidatesForGeneration: config?.minCandidatesForGeneration ?? 3,
      minOccurrenceForGeneration: config?.minOccurrenceForGeneration ?? 3,
      defaultProbationThreshold: config?.defaultProbationThreshold ?? 10,
      defaultCautiousFactor: config?.defaultCautiousFactor ?? 0.5
    };

    // 初始化进化历史存储
    const historyDir = join(workspaceRoot, '.evoagent', 'skills');
    this.evolutionHistory = new EvolutionHistoryStorage(historyDir);
  }

  /**
   * 执行反思
   */
  async reflect(params: {
    agentType?: string;
    sessionCount?: number;
    forceGeneration?: boolean;
  } = {}): Promise<ReflectionResult> {
    this.log.info('Starting skill reflection...');

    const result: ReflectionResult = {
      generatedSkills: 0,
      archivedPatterns: 0,
      deprecatedSkills: 0,
      promotedSkills: 0,
      summary: ''
    };

    // 1. 检查是否有准备好的模式
    const readyPatterns = this.collector.getReadyPatterns(
      this.config.minCandidatesForGeneration,
      0.7
    );

    if (readyPatterns.length === 0 && !params.forceGeneration) {
      result.summary = 'No patterns ready for skill generation';
      this.log.info(result.summary);
      return result;
    }

    // 2. 生成技能
    const generator = new SkillGenerator(this.llm);
    const patternsToProcess = params.forceGeneration
      ? readyPatterns
      : readyPatterns.slice(0, 5); // 限制每次处理的数量

    const patternNames: string[] = [];

    for (const { pattern, candidates } of patternsToProcess) {
      try {
        this.log.info(`Generating skill for pattern: ${pattern} (${candidates.length} occurrences)`);

        const skill = await generator.generateSkill({
          patternName: pattern,
          candidates: candidates,
          agentType: params.agentType || 'unknown'
        });

        await this.store.saveSkill(skill, 'auto');
        result.generatedSkills++;
        patternNames.push(pattern);

      } catch (error) {
        this.log.error(`Failed to generate skill for ${pattern}`, { error });
      }
    }

    // 3. 归档已处理的模式
    if (patternNames.length > 0) {
      await this.collector.archivePatterns(patternNames);
      result.archivedPatterns = patternNames.length;
    }

    // 4. 检查现有技能状态
    await this.checkSkillLifecycle(result);

    // 5. 生成摘要
    result.summary = this.generateSummary(result);

    this.log.info(`Skill reflection completed: ${result.summary}`);
    return result;
  }

  /**
   * 检查技能生命周期
   */
  private async checkSkillLifecycle(result: ReflectionResult): Promise<void> {
    const allSkills = await this.store.getAllSkills();

    for (const skill of allSkills) {
      const meta = skill.metadata;

      // 检查 probation -> validated 升级
      if (meta.validation.status === 'probation') {
        if (meta.timesUsed >= meta.probationThreshold) {
          const successRate = meta.timesUsed > 0
            ? meta.timesSucceeded / meta.timesUsed
            : 0;

          if (successRate >= 0.8) {
            meta.validation.status = 'validated';
            meta.cautiousFactor = Math.max(0.1, meta.cautiousFactor - 0.2);
            await this.store.saveSkill(skill, meta.source);
            result.promotedSkills++;
            this.log.info(`Skill ${meta.name} promoted to validated`);
          }
        }
      }

      // 检查需要废弃的技能
      const shouldDeprecate = await this.shouldDeprecateSkill(skill);
      if (shouldDeprecate && meta.validation.status !== 'deprecated') {
        const reason = this.getDeprecationReason(skill);
        await this.store.deprecateSkill(meta.name, reason);
        result.deprecatedSkills++;
        this.log.info(`Skill ${meta.name} deprecated: ${reason}`);
      }
    }
  }

  /**
   * 判断是否应该废弃技能
   */
  private async shouldDeprecateSkill(skill: {
    metadata: { timesUsed: number; timesFailed: number; validation: { lastValidated: string } };
  }): Promise<boolean> {
    const meta = skill.metadata;

    // 条件1: 连续失败 >= 5 次
    if (meta.timesFailed >= 5) {
      const failureRate = meta.timesUsed > 0 ? meta.timesFailed / meta.timesUsed : 0;
      if (failureRate > 0.5) {
        return true;
      }
    }

    // 条件2: 30 天未使用
    const lastUsed = new Date(meta.validation.lastValidated);
    const daysSinceLastUse = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastUse > 30 && meta.timesUsed === 0) {
      return true;
    }

    return false;
  }

  /**
   * 获取废弃原因
   */
  private getDeprecationReason(skill: {
    metadata: { timesUsed: number; timesFailed: number };
  }): string {
    const meta = skill.metadata;

    if (meta.timesFailed >= 5) {
      const failureRate = meta.timesUsed > 0 ? meta.timesFailed / meta.timesUsed : 0;
      if (failureRate > 0.5) {
        return `High failure rate: ${(failureRate * 100).toFixed(1)}%`;
      }
    }

    return 'No longer used';
  }

  /**
   * 生成反思摘要
   */
  private generateSummary(result: ReflectionResult): string {
    const parts: string[] = [];

    if (result.generatedSkills > 0) {
      parts.push(`${result.generatedSkills} skills generated`);
    }
    if (result.promotedSkills > 0) {
      parts.push(`${result.promotedSkills} skills promoted`);
    }
    if (result.deprecatedSkills > 0) {
      parts.push(`${result.deprecatedSkills} skills deprecated`);
    }
    if (result.archivedPatterns > 0) {
      parts.push(`${result.archivedPatterns} patterns archived`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No changes';
  }

  /**
   * 获取反思统计
   */
  async getReflectionStats(): Promise<{
    totalSkills: number;
    draftSkills: number;
    probationSkills: number;
    validatedSkills: number;
    deprecatedSkills: number;
    readyPatterns: number;
  }> {
    const allSkills = await this.store.getAllSkills();
    const readyPatterns = this.collector.getReadyPatterns().length;

    const stats = {
      totalSkills: allSkills.length,
      draftSkills: 0,
      probationSkills: 0,
      validatedSkills: 0,
      deprecatedSkills: 0,
      readyPatterns
    };

    for (const skill of allSkills) {
      const status = skill.metadata.validation.status;
      switch (status) {
        case 'draft':
          stats.draftSkills++;
          break;
        case 'probation':
          stats.probationSkills++;
          break;
        case 'validated':
          stats.validatedSkills++;
          break;
        case 'deprecated':
          stats.deprecatedSkills++;
          break;
      }
    }

    return stats;
  }

  /**
   * 建议需要处理的模式
   */
  async suggestPatterns(): Promise<Array<{
    pattern: string;
    occurrence: number;
    confidence: number;
    recommendation: string;
  }>> {
    const readyPatterns = this.collector.getReadyPatterns(2, 0.5);
    const suggestions: Array<{
      pattern: string;
      occurrence: number;
      confidence: number;
      recommendation: string;
    }> = [];

    for (const { pattern, candidates } of readyPatterns) {
      const occurrence = candidates.length;
      const confidence = this.calculatePatternConfidence(candidates);

      let recommendation = 'monitor';
      if (occurrence >= this.config.minCandidatesForGeneration && confidence >= 0.7) {
        recommendation = 'generate';
      } else if (occurrence >= 2) {
        recommendation = 'collect-more';
      }

      suggestions.push({
        pattern,
        occurrence,
        confidence,
        recommendation
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 计算模式置信度
   */
  private calculatePatternConfidence(candidates: PatternCandidate[]): number {
    if (candidates.length < 3) return 0.3;

    // 基于多个因素
    const occurrenceScore = Math.min(candidates.length / 10, 0.4);
    const uniqueSessions = new Set(candidates.map(c => c.sessionId)).size;
    const diversityScore = Math.min(uniqueSessions / candidates.length, 0.3);
    const avgSnippetLength = candidates.reduce((sum, c) => sum + c.snippet.length, 0) / candidates.length;
    const consistencyScore = Math.min(avgSnippetLength / 200, 0.3);

    return occurrenceScore + diversityScore + consistencyScore;
  }

  /**
   * 获取技能进化记录
   */
  async getEvolutionHistory(skillId?: string, limit?: number): Promise<Array<{
    timestamp: string;
    event: string;
    details: string;
  }>> {
    const events = skillId
      ? await this.evolutionHistory.getSkillHistory(skillId, limit)
      : await this.evolutionHistory.getRecentEvents(limit || 50);

    return events.map(e => ({
      timestamp: e.timestamp,
      event: e.eventType,
      details: `${e.skillName}: ${e.fromStatus || ''} -> ${e.toStatus || ''} ${e.reason ? `(${e.reason})` : ''}`
    }));
  }

  /**
   * 获取技能进化摘要
   */
  async getSkillEvolutionSummary(skillId: string) {
    return this.evolutionHistory.getSkillSummary(skillId);
  }

  /**
   * 获取进化统计
   */
  async getEvolutionStats() {
    return this.evolutionHistory.getStats();
  }

  /**
   * 记录技能状态变更
   */
  async recordStatusChange(
    skillId: string,
    skillName: string,
    fromStatus: string,
    toStatus: string,
    reason?: string
  ) {
    const eventType = this.determineEventType(fromStatus, toStatus);
    await this.evolutionHistory.recordEvent(
      skillId,
      skillName,
      eventType,
      {
        fromStatus,
        toStatus,
        reason,
        source: 'lifecycle'
      }
    );
  }

  /**
   * 记录技能使用结果
   */
  async recordUsage(skillId: string, skillName: string, success: boolean, metadata?: Record<string, unknown>) {
    await this.evolutionHistory.recordEvent(
      skillId,
      skillName,
      success ? 'usage_success' : 'usage_failure',
      {
        source: 'usage',
        metadata
      }
    );
  }

  /**
   * 确定事件类型
   */
  private determineEventType(fromStatus: string, toStatus: string): 'promoted' | 'demoted' | 'deprecated' | 'restored' | 'updated' {
    const statusOrder = ['draft', 'probation', 'validated'];
    const fromIndex = statusOrder.indexOf(fromStatus);
    const toIndex = statusOrder.indexOf(toStatus);

    if (toStatus === 'deprecated') return 'deprecated';
    if (fromStatus === 'deprecated') return 'restored';
    if (toIndex > fromIndex) return 'promoted';
    if (toIndex < fromIndex) return 'demoted';
    return 'updated';
  }
}
