/**
 * Forgetting Curve - 遗忘曲线
 *
 * 基于艾宾浩斯遗忘曲线模拟记忆衰减
 */

/**
 * 遗忆曲线类型
 */
export type ForgettingCurveType = 'ebbinghaus' | 'exponential' | 'logarithmic';

/**
 * 记忆强度
 */
export interface MemoryStrength {
  strength: number;      // 0-1，记忆强度
  lastAccess: number;     // 最后访问时间
  accessCount: number;    // 访问次数
  createdAt: number;      // 创建时间
}

/**
 * 遗忘曲线配置
 */
export interface ForgettingCurveConfig {
  type: ForgettingCurveType;
  baseDecayRate: number;  // 基础衰减率
  retentionFactor: number; // 记忆保持因子
  reviewBoost: number;     // 复习提升因子
}

/**
 * 遗忘曲线
 */
export class ForgettingCurve {
  private readonly config: ForgettingCurveConfig;

  constructor(config?: Partial<ForgettingCurveConfig>) {
    this.config = {
      type: config?.type || 'ebbinghaus',
      baseDecayRate: config?.baseDecayRate || 0.1,
      retentionFactor: config?.retentionFactor || 0.9,
      reviewBoost: config?.reviewBoost || 0.3
    };
  }

  /**
   * 计算当前记忆强度
   */
  calculateStrength(strength: MemoryStrength): number {
    const now = Date.now();
    const timeSinceAccess = (now - strength.lastAccess) / (1000 * 60 * 60 * 24); // 天

    let decayedStrength: number;

    switch (this.config.type) {
      case 'ebbinghaus':
        // R = e^(-t/S)
        decayedStrength = this.ebbinghausDecay(timeSinceAccess, strength.accessCount);
        break;

      case 'exponential':
        // R = R0 * e^(-kt)
        decayedStrength = this.exponentialDecay(strength.strength, timeSinceAccess);
        break;

      case 'logarithmic':
        // R = R0 / (1 + k * log(t + 1))
        decayedStrength = this.logarithmicDecay(strength.strength, timeSinceAccess);
        break;

      default:
        decayedStrength = this.ebbinghausDecay(timeSinceAccess, strength.accessCount);
    }

    // 应用保持因子
    decayedStrength *= this.config.retentionFactor;

    return Math.max(0, Math.min(1, decayedStrength));
  }

  /**
   * 艾宾浩斯遗忘曲线: R = e^(-t/S)
   * 其中 S 是记忆强度稳定性，与访问次数相关
   */
  private ebbinghausDecay(timeSinceAccess: number, accessCount: number): number {
    // 记忆稳定性随访问次数增加
    const stability = Math.log(accessCount + 2) * 10; // 天数
    return Math.exp(-timeSinceAccess / stability);
  }

  /**
   * 指数衰减: R = R0 * e^(-kt)
   */
  private exponentialDecay(initialStrength: number, timeSinceAccess: number): number {
    return initialStrength * Math.exp(-this.config.baseDecayRate * timeSinceAccess);
  }

  /**
   * 对数衰减: R = R0 / (1 + k * log(t + 1))
   */
  private logarithmicDecay(initialStrength: number, timeSinceAccess: number): number {
    const k = this.config.baseDecayRate * 10;
    return initialStrength / (1 + k * Math.log(timeSinceAccess + 1));
  }

  /**
   * 记录访问（增强记忆）
   */
  recordAccess(strength: MemoryStrength): MemoryStrength {
    const now = Date.now();

    // 计算当前强度
    const currentStrength = this.calculateStrength(strength);

    // 访问增强
    const boost = this.config.reviewBoost;
    const newStrength = Math.min(1, currentStrength + boost);

    return {
      strength: newStrength,
      lastAccess: now,
      accessCount: strength.accessCount + 1,
      createdAt: strength.createdAt
    };
  }

  /**
   * 创建新的记忆强度
   */
  createInitialStrength(): MemoryStrength {
    const now = Date.now();
    return {
      strength: 1.0, // 初始强度为 1
      lastAccess: now,
      accessCount: 1,
      createdAt: now
    };
  }

  /**
   * 判断是否需要复习
   */
  needsReview(strength: MemoryStrength, threshold: number = 0.3): boolean {
    const currentStrength = this.calculateStrength(strength);
    return currentStrength < threshold;
  }

  /**
   * 计算下次复习时间
   */
  calculateNextReview(strength: MemoryStrength): number {
    const currentStrength = this.calculateStrength(strength);
    const threshold = 0.3;
    const daysUntilReview = Math.ceil((threshold - currentStrength) / this.config.baseDecayRate);

    const now = Date.now();
    return now + Math.max(0, daysUntilReview * 24 * 60 * 60 * 1000);
  }

  /**
   * 获取记忆强度等级
   */
  getStrengthLevel(strength: MemoryStrength): 'weak' | 'medium' | 'strong' {
    const currentStrength = this.calculateStrength(strength);

    if (currentStrength < 0.3) return 'weak';
    if (currentStrength < 0.7) return 'medium';
    return 'strong';
  }

  /**
   * 批量计算记忆强度
   */
  batchCalculateStrength(strengths: MemoryStrength[]): Map<string, number> {
    const results = new Map<string, number>();

    for (const strength of strengths) {
      // 使用访问次数作为 key
      const key = `${strength.createdAt}-${strength.accessCount}`;
      results.set(key, this.calculateStrength(strength));
    }

    return results;
  }

  /**
   * 获取需要复习的项目
   */
  getItemsNeedingReview(
    strengths: MemoryStrength[],
    threshold: number = 0.3
  ): MemoryStrength[] {
    return strengths.filter(s => this.needsReview(s, threshold));
  }
}

/**
 * 默认遗忘曲线实例
 */
export const defaultForgettingCurve = new ForgettingCurve();
