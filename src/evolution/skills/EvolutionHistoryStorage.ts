/**
 * 进化历史存储
 *
 * 负责记录技能的进化历史，包括状态变更、性能变化等
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('evolution:skills:evolution-history');

/**
 * 进化事件类型
 */
export type EvolutionEventType =
  | 'created'
  | 'promoted'
  | 'demoted'
  | 'deprecated'
  | 'restored'
  | 'updated'
  | 'usage_success'
  | 'usage_failure';

/**
 * 进化历史记录
 */
export interface SkillEvolution {
  skillId: string;
  skillName: string;
  eventType: EvolutionEventType;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
  metadata?: {
    score?: number;
    successRate?: number;
    usageCount?: number;
    confidence?: number;
    cautiousFactor?: number;
    [key: string]: unknown;
  };
  timestamp: string;
  source: string;
}

/**
 * 进化统计
 */
export interface EvolutionStats {
  totalEvents: number;
  byEventType: Map<EvolutionEventType, number>;
  bySkill: Map<string, SkillEvolutionSummary>;
  recentEvents: SkillEvolution[];
}

/**
 * 技能进化摘要
 */
export interface SkillEvolutionSummary {
  skillId: string;
  skillName: string;
  currentStatus: string;
  totalEvents: number;
  promotions: number;
  demotions: number;
  successfulUsages: number;
  failedUsages: number;
  firstSeen: string;
  lastUpdated: string;
  statusHistory: Array<{ status: string; timestamp: string }>;
}

/**
 * 进化历史存储
 */
export class EvolutionHistoryStorage {
  private readonly historyFile: string;
  private cache: SkillEvolution[] = [];
  private cacheLoaded = false;
  private statsCache: EvolutionStats | null = null;
  private statsCacheTimestamp = 0;

  constructor(dataDir: string) {
    this.historyFile = join(dataDir, 'evolution-history.jsonl');
  }

  /**
   * 记录进化事件
   */
  async recordEvent(
    skillId: string,
    skillName: string,
    eventType: EvolutionEventType,
    options: {
      fromStatus?: string;
      toStatus?: string;
      reason?: string;
      metadata?: Record<string, unknown>;
      source?: string;
    } = {}
  ): Promise<void> {
    const event: SkillEvolution = {
      skillId,
      skillName,
      eventType,
      fromStatus: options.fromStatus,
      toStatus: options.toStatus,
      reason: options.reason,
      metadata: options.metadata,
      timestamp: new Date().toISOString(),
      source: options.source || 'system'
    };

    // 添加到缓存
    this.cache.push(event);

    // 追加到文件
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(this.historyFile, line, 'utf-8');

    // 使统计缓存失效
    this.statsCache = null;

    logger.debug(`Recorded evolution event: ${eventType} for skill ${skillName}`, {
      eventType,
      fromStatus: options.fromStatus,
      toStatus: options.toStatus
    });
  }

  /**
   * 加载历史记录
   */
  async loadHistory(limit?: number): Promise<SkillEvolution[]> {
    if (this.cacheLoaded && (!limit || this.cache.length <= limit)) {
      return limit ? this.cache.slice(-limit) : [...this.cache];
    }

    try {
      const content = await fs.readFile(this.historyFile, 'utf-8');
      const lines = content.trim().split('\n');

      this.cache = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line) as SkillEvolution;
          this.cache.push(event);
        } catch {
          // 忽略无效行
        }
      }

      this.cacheLoaded = true;

      // 按时间排序
      this.cache.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return limit ? this.cache.slice(-limit) : [...this.cache];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.cache = [];
        this.cacheLoaded = true;
        return [];
      }
      throw error;
    }
  }

  /**
   * 获取技能的进化历史
   */
  async getSkillHistory(skillId: string, limit?: number): Promise<SkillEvolution[]> {
    const allHistory = await this.loadHistory();
    const skillHistory = allHistory.filter(e => e.skillId === skillId);

    // 按时间倒序排列
    skillHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return limit ? skillHistory.slice(0, limit) : skillHistory;
  }

  /**
   * 获取技能的进化摘要
   */
  async getSkillSummary(skillId: string): Promise<SkillEvolutionSummary | null> {
    const history = await this.getSkillHistory(skillId);
    if (history.length === 0) {
      return null;
    }

    const latest = history[0]!;
    const oldest = history[history.length - 1]!;

    // 提取状态历史
    const statusHistory: Array<{ status: string; timestamp: string }> = [];
    for (const event of history.reverse()) {
      const lastStatus = statusHistory[statusHistory.length - 1];
      if (event.toStatus && (statusHistory.length === 0 || lastStatus?.status !== event.toStatus)) {
        statusHistory.push({
          status: event.toStatus,
          timestamp: event.timestamp
        });
      }
    }

    return {
      skillId,
      skillName: latest.skillName,
      currentStatus: latest.toStatus || latest.fromStatus || 'unknown',
      totalEvents: history.length,
      promotions: history.filter(e => e.eventType === 'promoted').length,
      demotions: history.filter(e => e.eventType === 'demoted').length,
      successfulUsages: history.filter(e => e.eventType === 'usage_success').length,
      failedUsages: history.filter(e => e.eventType === 'usage_failure').length,
      firstSeen: oldest.timestamp,
      lastUpdated: latest.timestamp,
      statusHistory
    };
  }

  /**
   * 获取进化统计
   */
  async getStats(): Promise<EvolutionStats> {
    const now = Date.now();

    // 检查缓存（5分钟内有效）
    if (this.statsCache && (now - this.statsCacheTimestamp) < 5 * 60 * 1000) {
      return this.statsCache;
    }

    const history = await this.loadHistory();

    const stats: EvolutionStats = {
      totalEvents: history.length,
      byEventType: new Map(),
      bySkill: new Map(),
      recentEvents: history.slice(-100) // 最近100条事件
    };

    // 按事件类型统计
    for (const event of history) {
      const count = stats.byEventType.get(event.eventType) || 0;
      stats.byEventType.set(event.eventType, count + 1);
    }

    // 按技能统计
    const skillIds = new Set(history.map(e => e.skillId));
    for (const skillId of skillIds) {
      const summary = await this.getSkillSummary(skillId);
      if (summary) {
        stats.bySkill.set(skillId, summary);
      }
    }

    this.statsCache = stats;
    this.statsCacheTimestamp = now;

    return stats;
  }

  /**
   * 获取最近的进化事件
   */
  async getRecentEvents(limit: number = 50, eventType?: EvolutionEventType): Promise<SkillEvolution[]> {
    const history = await this.loadHistory();

    let filtered = history;
    if (eventType) {
      filtered = history.filter(e => e.eventType === eventType);
    }

    // 按时间倒序排列
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return filtered.slice(0, limit);
  }

  /**
   * 获取技能的状态变更历史
   */
  async getStatusChanges(skillId: string): Promise<Array<{
    fromStatus: string;
    toStatus: string;
    reason?: string;
    timestamp: string;
  }>> {
    const history = await this.getSkillHistory(skillId);

    return history
      .filter(e => e.eventType === 'promoted' || e.eventType === 'demoted' || e.eventType === 'deprecated')
      .map(e => ({
        fromStatus: e.fromStatus || 'unknown',
        toStatus: e.toStatus || 'unknown',
        reason: e.reason,
        timestamp: e.timestamp
      }));
  }

  /**
   * 清理旧记录
   */
  async cleanup(maxAgeMs: number = 90 * 24 * 60 * 60 * 1000): Promise<number> {
    const history = await this.loadHistory();
    const now = Date.now();

    const toKeep = history.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      return (now - eventTime) < maxAgeMs;
    });

    if (toKeep.length === history.length) {
      return 0;
    }

    // 重写文件
    const lines = toKeep.map(e => JSON.stringify(e)).join('\n') + '\n';
    await fs.writeFile(this.historyFile, lines, 'utf-8');

    // 更新缓存
    this.cache = toKeep;
    this.statsCache = null;

    logger.info(`Cleaned up ${history.length - toKeep.length} old evolution events`);

    return history.length - toKeep.length;
  }

  /**
   * 删除技能的历史记录
   */
  async deleteSkillHistory(skillId: string): Promise<void> {
    const history = await this.loadHistory();
    const toKeep = history.filter(e => e.skillId !== skillId);

    if (toKeep.length === history.length) {
      return;
    }

    const lines = toKeep.map(e => JSON.stringify(e)).join('\n') + '\n';
    await fs.writeFile(this.historyFile, lines, 'utf-8');

    this.cache = toKeep;
    this.statsCache = null;

    logger.info(`Deleted evolution history for skill: ${skillId}`);
  }

  /**
   * 导出进化历史
   */
  async exportHistory(
    startDate?: Date,
    endDate?: Date,
    skillId?: string,
    eventType?: EvolutionEventType
  ): Promise<SkillEvolution[]> {
    let history = await this.loadHistory();

    if (startDate) {
      history = history.filter(e => new Date(e.timestamp) >= startDate);
    }

    if (endDate) {
      history = history.filter(e => new Date(e.timestamp) <= endDate);
    }

    if (skillId) {
      history = history.filter(e => e.skillId === skillId);
    }

    if (eventType) {
      history = history.filter(e => e.eventType === eventType);
    }

    return history;
  }
}
