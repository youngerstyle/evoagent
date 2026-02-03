/**
 * Spaced Repetition - 间隔重复强化
 *
 * 基于间隔重复算法优化记忆巩固时机
 */

import { getLogger } from '../../core/logger/index.js';
import { ForgettingCurve, type MemoryStrength } from '../forgetting/ForgettingCurve.js';

const logger = getLogger('memory:spaced-repetition');

/**
 * 间隔重复算法类型
 */
export type SpacedRepetitionAlgorithm = 'sm2' | 'fsrs' | 'leitner';

/**
 * 复习间隔单位
 */
export type IntervalUnit = 'minutes' | 'hours' | 'days' | 'months';

/**
 * 复习项
 */
export interface ReviewItem {
  id: string;
  easeFactor: number;      // 难度因子 (SM-2)
  interval: number;        // 当前间隔
  repetitions: number;     // 复习次数
  nextReview: number;      // 下次复习时间
  lastReview: number;      // 上次复习时间
  strength: MemoryStrength;
}

/**
 * 复习结果
 */
export interface ReviewResult {
  item: ReviewItem;
  quality: number;         // 质量评分 (0-5)
  nextInterval: number;    // 下次间隔
  easeFactor: number;      // 更新后的难度因子
}

/**
 * 间隔重复配置
 */
export interface SpacedRepetitionConfig {
  algorithm: SpacedRepetitionAlgorithm;
  minEaseFactor: number;
  maxEaseFactor: number;
  defaultEaseFactor: number;
  minInterval: number;     // 最小间隔（天）
  maxInterval: number;     // 最大间隔（天）
}

/**
 * SM-2 算法实现
 */
class SM2Algorithm {
  constructor(private readonly config: SpacedRepetitionConfig) {}

  /**
   * 计算下次复习
   */
  calculateNextReview(item: ReviewItem, quality: number): ReviewResult {
    // 限制 quality 在 0-5 范围
    quality = Math.max(0, Math.min(5, quality));

    // 更新难度因子
    let newEaseFactor = item.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEaseFactor = Math.max(
      this.config.minEaseFactor,
      Math.min(this.config.maxEaseFactor, newEaseFactor)
    );

    // 计算间隔
    let nextInterval: number;

    if (quality < 3) {
      // 回到起点
      nextInterval = 1;
      item.repetitions = 0;
    } else {
      switch (item.repetitions) {
        case 0:
          nextInterval = 1;
          break;
        case 1:
          nextInterval = 6;
          break;
        default:
          nextInterval = Math.round(item.interval * newEaseFactor);
      }
    }

    nextInterval = Math.max(
      this.config.minInterval,
      Math.min(this.config.maxInterval, nextInterval)
    );

    // 更新项
    item.repetitions++;
    item.interval = nextInterval;
    item.easeFactor = newEaseFactor;
    item.lastReview = Date.now();
    item.nextReview = Date.now() + nextInterval * 24 * 60 * 60 * 1000;

    return {
      item,
      quality,
      nextInterval,
      easeFactor: newEaseFactor
    };
  }
}

/**
 * 间隔重复强化管理器
 */
export class SpacedRepetition {
  private readonly items: Map<string, ReviewItem> = new Map();
  private readonly forgettingCurve: ForgettingCurve;
  private readonly sm2: SM2Algorithm;

  constructor(
    private readonly config: Partial<SpacedRepetitionConfig> = {}
  ) {
    const fullConfig: SpacedRepetitionConfig = {
      algorithm: config.algorithm || 'sm2',
      minEaseFactor: config.minEaseFactor ?? 1.3,
      maxEaseFactor: config.maxEaseFactor ?? 2.5,
      defaultEaseFactor: config.defaultEaseFactor ?? 2.5,
      minInterval: config.minInterval ?? 1,
      maxInterval: config.maxInterval ?? 365
    };

    this.forgettingCurve = new ForgettingCurve();
    this.sm2 = new SM2Algorithm(fullConfig);
  }

  /**
   * 创建新的复习项
   */
  createItem(id: string): ReviewItem {
    const item: ReviewItem = {
      id,
      easeFactor: this.config.defaultEaseFactor || 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: Date.now(),
      lastReview: Date.now(),
      strength: this.forgettingCurve.createInitialStrength()
    };

    this.items.set(id, item);
    logger.debug(`Created review item: ${id}`);

    return item;
  }

  /**
   * 记录复习结果
   */
  recordReview(id: string, quality: number): ReviewResult | null {
    const item = this.items.get(id);
    if (!item) {
      logger.warn(`Review item not found: ${id}`);
      return null;
    }

    // 更新记忆强度
    item.strength = this.forgettingCurve.recordAccess(item.strength);

    // 计算下次复习
    const result = this.sm2.calculateNextReview(item, quality);

    logger.debug(`Recorded review for ${id}: quality=${quality}, nextInterval=${result.nextInterval}d`);

    return result;
  }

  /**
   * 获取需要复习的项目
   */
  getDueItems(): ReviewItem[] {
    const now = Date.now();
    const dueItems: ReviewItem[] = [];

    for (const item of this.items.values()) {
      if (item.nextReview <= now) {
        dueItems.push(item);
      }
    }

    return dueItems.sort((a, b) => a.nextReview - b.nextReview);
  }

  /**
   * 获取即将到期的项目
   */
  getUpcomingItems(withinHours: number = 24): ReviewItem[] {
    const now = Date.now();
    const cutoff = now + withinHours * 60 * 60 * 1000;
    const upcoming: ReviewItem[] = [];

    for (const item of this.items.values()) {
      if (item.nextReview > now && item.nextReview <= cutoff) {
        upcoming.push(item);
      }
    }

    return upcoming.sort((a, b) => a.nextReview - b.nextReview);
  }

  /**
   * 获取复习统计
   */
  getStats(): {
    totalItems: number;
    dueItems: number;
    upcomingItems: number;
    learnedItems: number;
    newItems: number;
    averageEaseFactor: number;
  } {
    const now = Date.now();
    let dueItems = 0;
    let upcomingItems = 0;
    let learnedItems = 0;
    let totalEaseFactor = 0;

    for (const item of this.items.values()) {
      if (item.nextReview <= now) {
        dueItems++;
      } else if (item.nextReview <= now + 24 * 60 * 60 * 1000) {
        upcomingItems++;
      }

      if (item.repetitions >= 3) {
        learnedItems++;
      }

      totalEaseFactor += item.easeFactor;
    }

    return {
      totalItems: this.items.size,
      dueItems,
      upcomingItems,
      learnedItems,
      newItems: this.items.size - learnedItems,
      averageEaseFactor: this.items.size > 0 ? totalEaseFactor / this.items.size : 0
    };
  }

  /**
   * 获取复习进度
   */
  getProgress(id: string): {
    progress: number;      // 0-100
    level: 'new' | 'learning' | 'review' | 'mastered';
    nextReview: number;
  } | null {
    const item = this.items.get(id);
    if (!item) {
      return null;
    }

    let level: 'new' | 'learning' | 'review' | 'mastered';
    let progress: number;

    if (item.repetitions === 0) {
      level = 'new';
      progress = 0;
    } else if (item.repetitions < 3) {
      level = 'learning';
      progress = (item.repetitions / 3) * 50;
    } else if (item.repetitions < 7) {
      level = 'review';
      progress = 50 + ((item.repetitions - 3) / 4) * 40;
    } else {
      level = 'mastered';
      progress = 90 + Math.min(10, (item.repetitions - 7) * 2);
    }

    return {
      progress: Math.min(100, progress),
      level,
      nextReview: item.nextReview
    };
  }

  /**
   * 重置项目
   */
  resetItem(id: string): boolean {
    const item = this.items.get(id);
    if (!item) {
      return false;
    }

    item.easeFactor = this.config.defaultEaseFactor || 2.5;
    item.interval = 0;
    item.repetitions = 0;
    item.nextReview = Date.now();
    item.lastReview = Date.now();
    item.strength = this.forgettingCurve.createInitialStrength();

    return true;
  }

  /**
   * 删除项目
   */
  deleteItem(id: string): boolean {
    return this.items.delete(id);
  }

  /**
   * 获取所有项目
   */
  getAllItems(): ReviewItem[] {
    return Array.from(this.items.values());
  }

  /**
   * 根据难度获取项目
   */
  getItemsByDifficulty(minEase: number, maxEase: number): ReviewItem[] {
    return Array.from(this.items.values()).filter(
      item => item.easeFactor >= minEase && item.easeFactor <= maxEase
    );
  }

  /**
   * 导出为 JSON
   */
  export(): string {
    const data = Array.from(this.items.entries());
    return JSON.stringify(data);
  }

  /**
   * 从 JSON 导入
   */
  import(json: string): number {
    try {
      const data = JSON.parse(json) as Array<[string, ReviewItem]>;
      let count = 0;

      for (const [id, item] of data) {
        this.items.set(id, item);
        count++;
      }

      logger.info(`Imported ${count} review items`);
      return count;
    } catch (error) {
      logger.error('Failed to import review data', { error });
      return 0;
    }
  }
}

/**
 * 默认间隔重复实例
 */
export const defaultSpacedRepetition = new SpacedRepetition();

/**
 * 质量评分标准
 */
export const QualityRating = {
  PERFECT: 5,    // 完美回忆
  GOOD: 4,       // 犹豫但正确
  OK: 3,         // 困难但回忆起
  DIFFICULT: 2,  // 提示后想起
  WRONG: 1,      // 完全忘记
  FAILED: 0      // 失败
};
