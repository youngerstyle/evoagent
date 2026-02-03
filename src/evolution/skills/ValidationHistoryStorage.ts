/**
 * 验证历史存储
 *
 * 负责持久化技能验证历史记录
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('evolution:skills:validation-history');

/**
 * 验证历史记录
 */
export interface ValidationHistoryRecord {
  skillId: string;
  skillName: string;
  passed: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  testCount: number;
  passedTests: number;
  timestamp: string;
  source: string;
}

/**
 * 验证统计
 */
export interface ValidationStats {
  totalValidations: number;
  passedValidations: number;
  failedValidations: number;
  averageScore: number;
  bySkill: Map<string, SkillValidationStats>;
  byStatus: Map<string, number>;
  recentHistory: ValidationHistoryRecord[];
}

/**
 * 单个技能的验证统计
 */
export interface SkillValidationStats {
  skillId: string;
  skillName: string;
  totalValidations: number;
  passedValidations: number;
  failedValidations: number;
  averageScore: number;
  lastValidated: string;
  status: string;
}

/**
 * 验证历史存储
 */
export class ValidationHistoryStorage {
  private readonly historyFile: string;
  private cache: ValidationHistoryRecord[] = [];
  private cacheLoaded = false;
  private statsCache: ValidationStats | null = null;
  private statsCacheTimestamp = 0;

  constructor(dataDir: string) {
    this.historyFile = join(dataDir, 'validation-history.jsonl');
  }

  /**
   * 记录验证结果
   */
  async recordValidation(
    skillId: string,
    skillName: string,
    passed: boolean,
    score: number,
    errors: string[],
    warnings: string[],
    testCount: number,
    passedTests: number,
    source: string
  ): Promise<void> {
    const record: ValidationHistoryRecord = {
      skillId,
      skillName,
      passed,
      score,
      errors,
      warnings,
      testCount,
      passedTests,
      timestamp: new Date().toISOString(),
      source
    };

    // 添加到缓存
    this.cache.push(record);

    // 追加到文件（原子操作）
    const line = JSON.stringify(record) + '\n';
    await fs.appendFile(this.historyFile, line, 'utf-8');

    // 使统计缓存失效
    this.statsCache = null;

    logger.debug(`Recorded validation for skill: ${skillName}`, {
      passed,
      score
    });
  }

  /**
   * 加载历史记录
   */
  async loadHistory(limit?: number): Promise<ValidationHistoryRecord[]> {
    if (this.cacheLoaded && (!limit || this.cache.length <= limit)) {
      return limit ? this.cache.slice(-limit) : [...this.cache];
    }

    try {
      const content = await fs.readFile(this.historyFile, 'utf-8');
      const lines = content.trim().split('\n');

      this.cache = [];
      for (const line of lines) {
        try {
          const record = JSON.parse(line) as ValidationHistoryRecord;
          this.cache.push(record);
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
   * 获取技能的验证历史
   */
  async getSkillHistory(skillId: string, limit?: number): Promise<ValidationHistoryRecord[]> {
    const allHistory = await this.loadHistory();
    const skillHistory = allHistory.filter(r => r.skillId === skillId);

    // 按时间倒序排列
    skillHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return limit ? skillHistory.slice(0, limit) : skillHistory;
  }

  /**
   * 获取验证统计
   */
  async getStats(): Promise<ValidationStats> {
    const now = Date.now();

    // 检查缓存（5分钟内有效）
    if (this.statsCache && (now - this.statsCacheTimestamp) < 5 * 60 * 1000) {
      return this.statsCache;
    }

    const history = await this.loadHistory();

    const stats: ValidationStats = {
      totalValidations: history.length,
      passedValidations: history.filter(r => r.passed).length,
      failedValidations: history.filter(r => !r.passed).length,
      averageScore: 0,
      bySkill: new Map(),
      byStatus: new Map(),
      recentHistory: history.slice(-100) // 最近100条记录
    };

    // 计算平均分
    if (stats.totalValidations > 0) {
      const totalScore = history.reduce((sum, r) => sum + r.score, 0);
      stats.averageScore = totalScore / stats.totalValidations;
    }

    // 按技能分组统计
    const skillMap = new Map<string, ValidationHistoryRecord[]>();
    for (const record of history) {
      if (!skillMap.has(record.skillId)) {
        skillMap.set(record.skillId, []);
      }
      skillMap.get(record.skillId)!.push(record);
    }

    for (const [skillId, skillRecords] of skillMap.entries()) {
      const latest = skillRecords[skillRecords.length - 1]!;
      const skillStats: SkillValidationStats = {
        skillId,
        skillName: latest.skillName,
        totalValidations: skillRecords.length,
        passedValidations: skillRecords.filter(r => r.passed).length,
        failedValidations: skillRecords.filter(r => !r.passed).length,
        averageScore: skillRecords.reduce((sum, r) => sum + r.score, 0) / skillRecords.length,
        lastValidated: latest.timestamp,
        status: latest.passed ? 'passing' : 'failing'
      };
      stats.bySkill.set(skillId, skillStats);
    }

    // 按来源统计
    const sourceMap = new Map<string, number>();
    for (const record of history) {
      const count = sourceMap.get(record.source) || 0;
      sourceMap.set(record.source, count + 1);
    }
    stats.byStatus = sourceMap;

    this.statsCache = stats;
    this.statsCacheTimestamp = now;

    return stats;
  }

  /**
   * 获取单个技能的统计
   */
  async getSkillStats(skillId: string): Promise<SkillValidationStats | null> {
    const stats = await this.getStats();
    return stats.bySkill.get(skillId) || null;
  }

  /**
   * 清理旧记录
   */
  async cleanup(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const history = await this.loadHistory();
    const now = Date.now();

    const toKeep = history.filter(record => {
      const recordTime = new Date(record.timestamp).getTime();
      return (now - recordTime) < maxAgeMs;
    });

    if (toKeep.length === history.length) {
      return 0;
    }

    // 重写文件
    const lines = toKeep.map(r => JSON.stringify(r)).join('\n') + '\n';
    await fs.writeFile(this.historyFile, lines, 'utf-8');

    // 更新缓存
    this.cache = toKeep;

    logger.info(`Cleaned up ${history.length - toKeep.length} old validation records`);

    return history.length - toKeep.length;
  }

  /**
   * 删除技能的历史记录
   */
  async deleteSkillHistory(skillId: string): Promise<void> {
    const history = await this.loadHistory();
    const toKeep = history.filter(r => r.skillId !== skillId);

    if (toKeep.length === history.length) {
      return;
    }

    const lines = toKeep.map(r => JSON.stringify(r)).join('\n') + '\n';
    await fs.writeFile(this.historyFile, lines, 'utf-8');

    this.cache = toKeep;
    this.statsCache = null;

    logger.info(`Deleted history for skill: ${skillId}`);
  }

  /**
   * 导出历史记录
   */
  async exportHistory(
    startDate?: Date,
    endDate?: Date,
    skillId?: string
  ): Promise<ValidationHistoryRecord[]> {
    let history = await this.loadHistory();

    if (startDate) {
      history = history.filter(r => new Date(r.timestamp) >= startDate);
    }

    if (endDate) {
      history = history.filter(r => new Date(r.timestamp) <= endDate);
    }

    if (skillId) {
      history = history.filter(r => r.skillId === skillId);
    }

    return history;
  }
}