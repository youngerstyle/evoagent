/**
 * Circuit Breaker - 熔断器
 *
 * 实现熔断器模式，防止级联故障
 */

import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('resilience:circuit-breaker');

/**
 * 熔断器状态
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  // 失败阈值：达到此失败率后打开熔断器
  failureThreshold: number;

  // 滚动窗口大小（请求数量）
  rollingWindowSize: number;

  // 超时：打开后多久进入半开状态（毫秒）
  timeout: number;

  // 半开状态下允许的测试请求数
  halfOpenMaxCalls: number;

  // 最小请求数：达到此请求数后才开始计算失败率
  minRequests: number;
}

/**
 * 熔断器事件
 */
export interface CircuitBreakerEvent {
  type: 'open' | 'close' | 'half-open' | 'reject';
  state: CircuitState;
  reason?: string;
  timestamp: number;
}

/**
 * 熔断器事件监听器
 */
export type CircuitBreakerEventListener = (event: CircuitBreakerEvent) => void;

/**
 * 滑动窗口中的结果
 */
interface WindowResult {
  success: boolean;
  timestamp: number;
  duration?: number;
}

/**
 * 熔断器
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private window: WindowResult[] = [];
  private halfOpenCalls = 0;
  private openedAt?: number;
  private listeners: Set<CircuitBreakerEventListener> = new Set();

  constructor(
    private readonly name: string,
    private readonly config: Partial<CircuitBreakerConfig> = {}
  ) {
    // 默认配置
    const defaults: CircuitBreakerConfig = {
      failureThreshold: 0.5,
      rollingWindowSize: 100,
      timeout: 60000,
      halfOpenMaxCalls: 3,
      minRequests: 10
    };

    this.config = { ...defaults, ...config };
    logger.debug(`CircuitBreaker "${name}" initialized`, this.config);
  }

  /**
   * 执行操作（带熔断保护）
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // 检查是否可以执行
    if (!this.allowRequest()) {
      const event: CircuitBreakerEvent = {
        type: 'reject',
        state: this.state,
        reason: 'Circuit breaker is OPEN',
        timestamp: Date.now()
      };
      this.emit(event);
      throw new Error(`CircuitBreaker "${this.name}" is OPEN`);
    }

    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.onSuccess(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.onFailure(duration);
      throw error;
    }
  }

  /**
   * 检查是否允许请求
   */
  allowRequest(): boolean {
    // 检查是否应该从 open 转为 half-open
    if (this.state === 'open') {
      if (this.openedAt && Date.now() - this.openedAt >= this.config.timeout!) {
        this.toHalfOpen();
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * 记录成功
   */
  private onSuccess(duration: number): void {
    this.addToWindow({ success: true, timestamp: Date.now(), duration });

    if (this.state === 'half-open') {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls!) {
        this.close();
      }
    }
  }

  /**
   * 记录失败
   */
  private onFailure(duration: number): void {
    this.addToWindow({ success: false, timestamp: Date.now(), duration });

    if (this.state === 'half-open') {
      this.open('Failed in half-open state');
      return;
    }

    // 检查是否需要打开熔断器
    if (this.shouldOpen()) {
      this.open('Failure threshold reached');
    }
  }

  /**
   * 添加到滑动窗口
   */
  private addToWindow(result: WindowResult): void {
    this.window.push(result);

    // 保持窗口大小
    while (this.window.length > this.config.rollingWindowSize!) {
      this.window.shift();
    }
  }

  /**
   * 检查是否应该打开熔断器
   */
  private shouldOpen(): boolean {
    const minRequests = this.config.minRequests!;
    if (this.window.length < minRequests) {
      return false;
    }

    const failures = this.window.filter(r => !r.success).length;
    const failureRate = failures / this.window.length;

    return failureRate >= this.config.failureThreshold!;
  }

  /**
   * 打开熔断器
   */
  private open(reason: string): void {
    if (this.state !== 'open') {
      this.state = 'open';
      this.openedAt = Date.now();
      const event: CircuitBreakerEvent = {
        type: 'open',
        state: this.state,
        reason,
        timestamp: Date.now()
      };
      this.emit(event);
      logger.warn(`CircuitBreaker "${this.name}" opened`, { reason });
    }
  }

  /**
   * 关闭熔断器
   */
  private close(): void {
    if (this.state !== 'closed') {
      this.state = 'closed';
      this.window = [];
      this.halfOpenCalls = 0;
      this.openedAt = undefined;
      const event: CircuitBreakerEvent = {
        type: 'close',
        state: this.state,
        timestamp: Date.now()
      };
      this.emit(event);
      logger.info(`CircuitBreaker "${this.name}" closed`);
    }
  }

  /**
   * 转为半开状态
   */
  private toHalfOpen(): void {
    if (this.state !== 'half-open') {
      this.state = 'half-open';
      this.halfOpenCalls = 0;
      const event: CircuitBreakerEvent = {
        type: 'half-open',
        state: this.state,
        timestamp: Date.now()
      };
      this.emit(event);
      logger.info(`CircuitBreaker "${this.name}" entered half-open state`);
    }
  }

  /**
   * 手动重置熔断器
   */
  reset(): void {
    this.close();
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    state: CircuitState;
    windowSize: number;
    failures: number;
    successes: number;
    failureRate: number;
    openedAt?: number;
  } {
    const failures = this.window.filter(r => !r.success).length;
    const successes = this.window.filter(r => r.success).length;
    const failureRate = this.window.length > 0 ? failures / this.window.length : 0;

    return {
      state: this.state,
      windowSize: this.window.length,
      failures,
      successes,
      failureRate,
      openedAt: this.openedAt
    };
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: CircuitBreakerEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: CircuitBreakerEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 触发事件
   */
  private emit(event: CircuitBreakerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('EventListener error', { error });
      }
    }
  }
}

/**
 * 熔断器管理器
 */
export class CircuitBreakerManager {
  private readonly breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * 获取或创建熔断器
   */
  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * 获取所有熔断器的状态
   */
  getAllStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    for (const [name, breaker] of this.breakers) {
      states[name] = breaker.getState();
    }
    return states;
  }

  /**
   * 获取所有熔断器的统计
   */
  getAllStats(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * 重置所有熔断器
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

/**
 * 默认熔断器管理器
 */
export const defaultCircuitBreakerManager = new CircuitBreakerManager();
