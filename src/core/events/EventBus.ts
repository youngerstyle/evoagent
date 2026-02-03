/**
 * 事件总线 - 模块间通信
 *
 * 提供发布-订阅模式的事件系统，用于模块间解耦通信
 */

import { EventEmitter } from 'events';
import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('core:event-bus');

/**
 * 事件类型
 */
export type EventType =
  // Agent 事件
  | 'agent.started'
  | 'agent.completed'
  | 'agent.failed'
  | 'agent.progress'
  // Session 事件
  | 'session.created'
  | 'session.updated'
  | 'session.archived'
  // Skill 事件
  | 'skill.created'
  | 'skill.used'
  | 'skill.promoted'
  | 'skill.deprecated'
  // Memory 事件
  | 'memory.consolidated'
  | 'memory.retrieved'
  // Soul 事件
  | 'soul.evolved'
  | 'soul.reflected'
  // Prompt 事件
  | 'prompt.optimized'
  | 'prompt.abtest.started'
  | 'prompt.abtest.completed'
  // System 事件
  | 'system.initialized'
  | 'system.shutdown';

/**
 * 事件数据
 */
export interface EventData {
  type: EventType;
  timestamp: number;
  source: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * 事件处理器
 */
export type EventHandler = (event: EventData) => void | Promise<void>;

/**
 * 事件总线
 */
export class EventBus {
  private emitter: EventEmitter;
  private handlers: Map<EventType, Set<EventHandler>> = new Map();
  private eventHistory: EventData[] = [];
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 1000) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // 增加最大监听器数量
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * 订阅事件
   */
  on(eventType: EventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    this.handlers.get(eventType)!.add(handler);
    this.emitter.on(eventType, handler);

    logger.debug(`Subscribed to event: ${eventType}`);
  }

  /**
   * 订阅一次性事件
   */
  once(eventType: EventType, handler: EventHandler): void {
    const wrappedHandler = (event: EventData) => {
      handler(event);
      this.off(eventType, wrappedHandler);
    };

    this.on(eventType, wrappedHandler);
  }

  /**
   * 取消订阅
   */
  off(eventType: EventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      this.emitter.off(eventType, handler);
    }

    logger.debug(`Unsubscribed from event: ${eventType}`);
  }

  /**
   * 发布事件
   */
  async emit(eventType: EventType, source: string, data: Record<string, unknown>, metadata?: Record<string, unknown>): Promise<void> {
    const event: EventData = {
      type: eventType,
      timestamp: Date.now(),
      source,
      data,
      metadata
    };

    // 记录到历史
    this.addToHistory(event);

    // 发布事件
    logger.debug(`Emitting event: ${eventType} from ${source}`);

    try {
      // 同步发布
      this.emitter.emit(eventType, event);

      // 异步处理器
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const promises = Array.from(handlers).map(handler => {
          try {
            return Promise.resolve(handler(event));
          } catch (error) {
            logger.error(`Error in event handler for ${eventType}:`, error);
            return Promise.resolve();
          }
        });

        await Promise.allSettled(promises);
      }
    } catch (error) {
      logger.error(`Error emitting event ${eventType}:`, error);
    }
  }

  /**
   * 获取事件历史
   */
  getHistory(filter?: {
    type?: EventType;
    source?: string;
    since?: number;
    limit?: number;
  }): EventData[] {
    let filtered = this.eventHistory;

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(e => e.type === filter.type);
      }
      if (filter.source) {
        filtered = filtered.filter(e => e.source === filter.source);
      }
      if (filter.since !== undefined) {
        filtered = filtered.filter(e => e.timestamp >= filter.since!);
      }
      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * 清空事件历史
   */
  clearHistory(): void {
    this.eventHistory = [];
    logger.debug('Event history cleared');
  }

  /**
   * 获取订阅统计
   */
  getStats(): {
    totalHandlers: number;
    eventTypes: Record<EventType, number>;
    historySize: number;
  } {
    const eventTypes: Record<string, number> = {};

    for (const [type, handlers] of this.handlers.entries()) {
      eventTypes[type] = handlers.size;
    }

    return {
      totalHandlers: Array.from(this.handlers.values()).reduce((sum, set) => sum + set.size, 0),
      eventTypes: eventTypes as Record<EventType, number>,
      historySize: this.eventHistory.length
    };
  }

  /**
   * 添加到历史
   */
  private addToHistory(event: EventData): void {
    this.eventHistory.push(event);

    // 限制历史大小
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 清理所有订阅
   */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
    this.handlers.clear();
    logger.debug('All event listeners removed');
  }
}

/**
 * 全局事件总线实例
 */
export const globalEventBus = new EventBus();
