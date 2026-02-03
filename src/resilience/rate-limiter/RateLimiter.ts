/**
 * Rate Limiter - 速率限制器
 *
 * 实现 Token Bucket 算法
 */

import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('resilience:rate-limiter');

/**
 * 速率限制配置
 */
export interface RateLimiterConfig {
  // 令牌容量
  capacity: number;

  // 填充速率（每秒令牌数）
  refillRate: number;

  // 每次请求消耗的令牌数
  tokensPerRequest: number;
}

/**
 * 速率限制结果
 */
export interface RateLimitResult {
  allowed: boolean;
  tokensRemaining: number;
  resetTime?: number;
  retryAfter?: number;
}

/**
 * Token Bucket 限流器
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    name: string,
    private readonly config: RateLimiterConfig
  ) {
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
    logger.debug(`RateLimiter "${name}" initialized`, config as unknown as Record<string, unknown>);
  }

  /**
   * 尝试获取令牌
   */
  tryAcquire(tokens: number = this.config.tokensPerRequest): RateLimitResult {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return {
        allowed: true,
        tokensRemaining: this.tokens
      };
    }

    // 计算需要等待的时间
    const tokensNeeded = tokens - this.tokens;
    const retryAfter = (tokensNeeded / this.config.refillRate) * 1000;

    return {
      allowed: false,
      tokensRemaining: this.tokens,
      retryAfter,
      resetTime: Date.now() + retryAfter
    };
  }

  /**
   * 填充令牌
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // 秒
    const tokensToAdd = elapsed * this.config.refillRate;

    this.tokens = Math.min(this.config.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * 重置限流器
   */
  reset(): void {
    this.tokens = this.config.capacity;
    this.lastRefill = Date.now();
  }

  /**
   * 获取当前令牌数
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * 获取容量
   */
  getCapacity(): number {
    return this.config.capacity;
  }
}

/**
 * 速率限制管理器
 */
export class RateLimiterManager {
  private readonly limiters: Map<string, TokenBucketRateLimiter> = new Map();

  /**
   * 获取或创建限流器
   */
  get(name: string, config: RateLimiterConfig): TokenBucketRateLimiter {
    if (!this.limiters.has(name)) {
      this.limiters.set(name, new TokenBucketRateLimiter(name, config));
    }
    return this.limiters.get(name)!;
  }

  /**
   * 获取所有限流器状态
   */
  getAllStates(): Record<string, { tokens: number; capacity: number }> {
    const states: Record<string, { tokens: number; capacity: number }> = {};
    for (const [name, limiter] of this.limiters) {
      states[name] = {
        tokens: limiter.getTokens(),
        capacity: limiter.getCapacity()
      };
    }
    return states;
  }

  /**
   * 重置所有限流器
   */
  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }
}

/**
 * 默认限流器管理器
 */
export const defaultRateLimiterManager = new RateLimiterManager();

/**
 * 预定义的限流配置
 */
export const RateLimitPresets = {
  // LLM API 调用限制
  llmApi: {
    capacity: 60,
    refillRate: 1, // 每秒 1 个令牌
    tokensPerRequest: 1
  },

  // Agent 执行限制
  agentExecution: {
    capacity: 10,
    refillRate: 0.1, // 每 10 秒 1 个令牌
    tokensPerRequest: 1
  },

  // WebSocket 消息限制
  wsMessage: {
    capacity: 100,
    refillRate: 10,
    tokensPerRequest: 1
  },

  // 数据库查询限制
  dbQuery: {
    capacity: 1000,
    refillRate: 100,
    tokensPerRequest: 1
  },

  // 内存操作限制
  memoryOperation: {
    capacity: 10000,
    refillRate: 1000,
    tokensPerRequest: 1
  }
};
