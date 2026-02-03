/**
 * Graceful Degradation - 优雅降级
 *
 * 在服务降级时提供备选方案
 */

import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('resilience:degradation');

/**
 * 降级策略
 */
export type FallbackStrategy =
  | 'cache'           // 使用缓存
  | 'default-value'   // 返回默认值
  | 'empty-result'    // 返回空结果
  | 'throw'           // 抛出异常
  | 'retry-later'     // 稍后重试
  | 'alternative';    // 使用备用服务

/**
 * 降级行为
 */
export interface DegradationBehavior {
  strategy: FallbackStrategy;
  fallbackValue?: unknown;
  cacheTtl?: number;
  retryAfter?: number;
}

/**
 * 服务降级配置
 */
export interface DegradationConfig {
  // 服务名称
  name: string;

  // 降级行为
  behavior: DegradationBehavior;

  // 是否启用降级
  enabled: boolean;

  // 降级触发条件
  triggers: {
    errorRate?: number;        // 错误率阈值
    latencyThreshold?: number;  // 延迟阈值（毫秒）
    consecutiveErrors?: number; // 连续错误数
  };
}

/**
 * 降级状态
 */
export interface DegradationStatus {
  serviceName: string;
  isDegraded: boolean;
  degradedAt?: number;
  reason?: string;
  strategy: FallbackStrategy;
}

/**
 * 服务健康状态
 */
interface ServiceHealth {
  isHealthy: boolean;
  errorRate: number;
  avgLatency: number;
  consecutiveErrors: number;
  lastCheck: number;
}

/**
 * 优雅降级管理器
 */
export class GracefulDegradationManager {
  private readonly services: Map<string, DegradationConfig> = new Map();
  private readonly healthStatus: Map<string, ServiceHealth> = new Map();
  private readonly caches: Map<string, Map<string, { value: unknown; expiresAt: number }>> = new Map();

  constructor() {}

  /**
   * 注册服务
   */
  register(config: DegradationConfig): void {
    this.services.set(config.name, config);
    this.healthStatus.set(config.name, {
      isHealthy: true,
      errorRate: 0,
      avgLatency: 0,
      consecutiveErrors: 0,
      lastCheck: Date.now()
    });
    this.caches.set(config.name, new Map());

    logger.debug(`Registered degradation for service: ${config.name}`);
  }

  /**
   * 执行操作（带降级保护）
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    customFallback?: () => Promise<T>
  ): Promise<T> {
    const config = this.services.get(serviceName);
    if (!config || !config.enabled) {
      return operation();
    }

    const health = this.healthStatus.get(serviceName)!;
    const isDegraded = !health.isHealthy && this.shouldDegrade(serviceName, health);

    if (isDegraded) {
      return this.applyFallback(serviceName, config, customFallback);
    }

    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.recordSuccess(serviceName, duration);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordFailure(serviceName, duration);

      // 检查是否应该降级
      if (this.shouldDegrade(serviceName, health)) {
        logger.warn(`Service "${serviceName}" degraded`, { error });
        this.markDegraded(serviceName, `Error: ${error}`);
      }

      return this.applyFallback(serviceName, config, customFallback);
    }
  }

  /**
   * 应用降级策略
   */
  private async applyFallback<T>(
    serviceName: string,
    config: DegradationConfig,
    customFallback?: () => Promise<T>
  ): Promise<T> {
    const { strategy, fallbackValue } = config.behavior;

    // 如果有自定义降级方法，优先使用
    if (customFallback) {
      try {
        return await customFallback();
      } catch (error) {
        logger.error(`Custom fallback failed for ${serviceName}`, { error });
      }
    }

    switch (strategy) {
      case 'cache': {
        const cached = this.getFromCache<T>(serviceName);
        if (cached) {
          logger.debug(`Using cached value for ${serviceName}`);
          return cached;
        }
        // 如果没有缓存，返回默认值
        return fallbackValue as T;
      }

      case 'default-value':
        logger.debug(`Using default value for ${serviceName}`);
        return fallbackValue as T;

      case 'empty-result':
        logger.debug(`Returning empty result for ${serviceName}`);
        return [] as unknown as T;

      case 'throw':
        throw new Error(`Service "${serviceName}" is degraded`);

      case 'retry-later':
        throw new Error(`Service "${serviceName}" unavailable, retry later`);

      case 'alternative': {
        // 尝试调用备用服务
        const alternativeService = config.behavior.fallbackValue as { serviceName?: string; operation?: () => Promise<T> };
        if (alternativeService?.operation) {
          try {
            logger.info(`Using alternative service for ${serviceName}`);
            return await alternativeService.operation();
          } catch (error) {
            logger.error(`Alternative service failed for ${serviceName}`, { error });
          }
        }
        logger.warn(`Alternative service not configured for ${serviceName}`);
        return fallbackValue as T;
      }

      default:
        return fallbackValue as T;
    }
  }

  /**
   * 记录成功
   */
  private recordSuccess(serviceName: string, duration: number): void {
    const health = this.healthStatus.get(serviceName)!;
    health.isHealthy = true;
    health.consecutiveErrors = 0;
    health.lastCheck = Date.now();

    // 更新平均延迟
    if (health.avgLatency === 0) {
      health.avgLatency = duration;
    } else {
      health.avgLatency = health.avgLatency * 0.9 + duration * 0.1;
    }
  }

  /**
   * 记录失败
   */
  private recordFailure(serviceName: string, duration: number): void {
    const health = this.healthStatus.get(serviceName)!;
    health.consecutiveErrors++;
    health.lastCheck = Date.now();

    // 更新平均延迟
    if (health.avgLatency === 0) {
      health.avgLatency = duration;
    } else {
      health.avgLatency = health.avgLatency * 0.9 + duration * 0.1;
    }
  }

  /**
   * 检查是否应该降级
   */
  private shouldDegrade(serviceName: string, health: ServiceHealth): boolean {
    const config = this.services.get(serviceName)!;
    const { triggers } = config;

    // 检查连续错误数
    if (triggers.consecutiveErrors && health.consecutiveErrors >= triggers.consecutiveErrors) {
      return true;
    }

    // 检查错误率
    if (triggers.errorRate && health.errorRate >= triggers.errorRate) {
      return true;
    }

    // 检查延迟阈值
    if (triggers.latencyThreshold && health.avgLatency >= triggers.latencyThreshold) {
      return true;
    }

    return false;
  }

  /**
   * 标记服务为降级状态
   */
  markDegraded(serviceName: string, reason: string): void {
    const health = this.healthStatus.get(serviceName);
    if (health) {
      health.isHealthy = false;
    }
    logger.warn(`Service "${serviceName}" marked as degraded`, { reason });
  }

  /**
   * 恢复服务
   */
  recover(serviceName: string): void {
    const health = this.healthStatus.get(serviceName);
    if (health) {
      health.isHealthy = true;
      health.consecutiveErrors = 0;
      health.errorRate = 0;
    }
    logger.info(`Service "${serviceName}" recovered`);
  }

  /**
   * 获取降级状态
   */
  getStatus(serviceName: string): DegradationStatus | null {
    const config = this.services.get(serviceName);
    const health = this.healthStatus.get(serviceName);

    if (!config || !health) {
      return null;
    }

    return {
      serviceName,
      isDegraded: !health.isHealthy,
      degradedAt: !health.isHealthy ? health.lastCheck : undefined,
      reason: !health.isHealthy ? 'Service health check failed' : undefined,
      strategy: config.behavior.strategy
    };
  }

  /**
   * 获取所有降级状态
   */
  getAllStatus(): DegradationStatus[] {
    const statuses: DegradationStatus[] = [];
    for (const serviceName of this.services.keys()) {
      const status = this.getStatus(serviceName);
      if (status) {
        statuses.push(status);
      }
    }
    return statuses;
  }

  /**
   * 缓存值
   */
  setCache(serviceName: string, key: string, value: unknown, ttl?: number): void {
    const cache = this.caches.get(serviceName);
    if (cache) {
      cache.set(key, {
        value,
        expiresAt: Date.now() + (ttl || 60000)
      });
    }
  }

  /**
   * 从缓存获取值
   */
  getFromCache<T>(serviceName: string, key?: string): T | null {
    const cache = this.caches.get(serviceName);
    if (!cache) {
      return null;
    }

    if (key) {
      const entry = cache.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        return entry.value as T;
      }
      cache.delete(key);
    } else {
      // 返回任意一个缓存值
      for (const [k, entry] of cache.entries()) {
        if (entry.expiresAt > Date.now()) {
          return entry.value as T;
        }
        cache.delete(k);
      }
    }

    return null;
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    for (const [_serviceName, cache] of this.caches) {
      for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt < now) {
          cache.delete(key);
        }
      }
    }
  }
}

/**
 * 默认降级管理器
 */
export const defaultDegradationManager = new GracefulDegradationManager();

/**
 * 预定义的降级配置
 */
export const DegradationPresets: Record<string, DegradationConfig> = {
  llm: {
    name: 'llm',
    enabled: true,
    behavior: {
      strategy: 'cache',
      cacheTtl: 300000 // 5 分钟
    },
    triggers: {
      consecutiveErrors: 3,
      latencyThreshold: 30000
    }
  },

  embedding: {
    name: 'embedding',
    enabled: true,
    behavior: {
      strategy: 'default-value',
      fallbackValue: []
    },
    triggers: {
      consecutiveErrors: 5
    }
  },

  memory: {
    name: 'memory',
    enabled: true,
    behavior: {
      strategy: 'empty-result'
    },
    triggers: {
      consecutiveErrors: 10
    }
  },

  vectorSearch: {
    name: 'vector-search',
    enabled: true,
    behavior: {
      strategy: 'default-value', // 回退到关键词搜索
      fallbackValue: []
    },
    triggers: {
      consecutiveErrors: 3
    }
  }
};
