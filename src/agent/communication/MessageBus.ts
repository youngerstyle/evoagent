/**
 * Message Bus - Agent 之间的消息总线
 *
 * 负责消息的发送、接收、路由和处理
 */

import { getLogger } from '../../core/logger/index.js';
import type {
  AgentMessage,
  MessageHandler,
  MessageResult,
  MessageFilter,
  AgentAddress,
  DeliveryOptions,
  MessagePayload
} from './Messages.js';
import {
  MessageBuilder,
  MessageValidator
} from './Messages.js';

const logger = getLogger('agent:communication:messagebus');

/**
 * 消息订阅
 */
interface MessageSubscription {
  id: string;
  agentId: string;
  handler: MessageHandler;
  filter?: MessageFilter;
  createdAt: number;
  active: boolean;
}

/**
 * 消息投递记录
 */
interface DeliveryRecord {
  messageId: string;
  status: 'pending' | 'delivered' | 'failed' | 'timeout';
  attempts: number;
  lastAttempt?: number;
  nextRetry?: number;
  result?: MessageResult;
}

/**
 * 消息总线配置
 */
export interface MessageBusConfig {
  maxQueueSize?: number;
  defaultMessageTimeout?: number;
  maxRetries?: number;
  enableMetrics?: boolean;
}

/**
 * 消息总线统计
 */
export interface MessageBusMetrics {
  messagesSent: number;
  messagesReceived: number;
  messagesDelivered: number;
  messagesFailed: number;
  messagesTimeout: number;
  activeSubscriptions: number;
  averageDeliveryTime: number;
}

/**
 * 消息总线
 *
 * 功能：
 * 1. 注册/注销 Agent
 * 2. 发送/接收消息
 * 3. 订阅/取消订阅消息
 * 4. 消息路由和过滤
 * 5. 重试和超时处理
 */
export class MessageBus {
  private subscriptions: Map<string, MessageSubscription> = new Map();
  private deliveryRecords: Map<string, DeliveryRecord> = new Map();
  private pendingMessages: AgentMessage[] = [];
  private processing = false;

  private config: Required<MessageBusConfig>;
  private metrics: MessageBusMetrics;

  constructor(config: MessageBusConfig = {}) {
    this.config = {
      maxQueueSize: config.maxQueueSize ?? 10000,
      defaultMessageTimeout: config.defaultMessageTimeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      enableMetrics: config.enableMetrics ?? true
    };

    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      messagesTimeout: 0,
      activeSubscriptions: 0,
      averageDeliveryTime: 0
    };

    // 启动消息处理循环
    this.startProcessing();

    logger.info('MessageBus initialized');
  }

  /**
   * 发送消息
   */
  async send(
    message: AgentMessage,
    options: DeliveryOptions = {}
  ): Promise<MessageResult> {
    const startTime = Date.now();

    // 验证消息
    const validation = MessageValidator.validate(message);
    if (!validation.valid) {
      logger.warn(`Message validation failed: ${validation.errors.join(', ')}`);
      return {
        success: false,
        messageId: message.id,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        processedAt: startTime,
        duration: Date.now() - startTime
      };
    }

    // 检查消息是否过期
    if (MessageValidator.isExpired(message)) {
      logger.warn(`Message ${message.id} has expired`);
      return {
        success: false,
        messageId: message.id,
        error: 'Message expired',
        processedAt: startTime,
        duration: Date.now() - startTime
      };
    }

    // 应用投递选项
    if (options.priority) {
      message.priority = options.priority;
    }
    if (options.maxRetries !== undefined) {
      message.maxRetries = options.maxRetries;
    }
    if (options.expiresAt !== undefined) {
      message.expiresAt = options.expiresAt;
    }

    this.metrics.messagesSent++;

    // 处理消息
    try {
      const result = await this.deliverMessage(message, options);

      if (result.success) {
        this.metrics.messagesDelivered++;
      } else {
        this.metrics.messagesFailed++;
      }

      this.updateAverageDeliveryTime(Date.now() - startTime);
      return result;

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Error sending message ${message.id}: ${errMsg}`);

      this.metrics.messagesFailed++;
      return {
        success: false,
        messageId: message.id,
        error: errMsg,
        processedAt: startTime,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 发送并等待响应
   */
  async sendAndWait(
    from: AgentAddress,
    to: AgentAddress,
    payload: MessagePayload,
    options: DeliveryOptions = {}
  ): Promise<MessageResult> {
    const timeout = options.timeout ?? this.config.defaultMessageTimeout;

    // 创建请求消息
    const request = MessageBuilder.request(from, to, payload);

    // 创建响应等待器
    const responsePromise = this.waitForResponse(request.id, timeout);

    // 发送请求
    await this.send(request, options);

    // 等待响应
    try {
      const response = await responsePromise;
      return response;
    } catch (error) {
      return {
        success: false,
        messageId: request.id,
        error: error instanceof Error ? error.message : String(error),
        processedAt: Date.now(),
        duration: timeout
      };
    }
  }

  /**
   * 广播消息
   */
  async broadcast(
    from: AgentAddress,
    payload: MessagePayload,
    options: DeliveryOptions = {}
  ): Promise<MessageResult[]> {
    const recipients = this.getActiveAgentIds();
    const to = recipients.map(agentId => ({ agentId, agentType: 'unknown' }));

    const message = new MessageBuilder()
      .type('broadcast')
      .from(from)
      .to(to)
      .payload(payload)
      .build();

    return this.deliverToMultiple(message, options);
  }

  /**
   * 订阅消息
   */
  subscribe(
    agentId: string,
    handler: MessageHandler,
    filter?: MessageFilter
  ): string {
    const subscription: MessageSubscription = {
      id: `sub-${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      handler,
      filter,
      createdAt: Date.now(),
      active: true
    };

    this.subscriptions.set(subscription.id, subscription);
    this.metrics.activeSubscriptions = this.getActiveSubscriptions().length;

    logger.debug(`Agent ${agentId} subscribed to messages (${subscription.id})`);

    return subscription.id;
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    subscription.active = false;
    this.subscriptions.delete(subscriptionId);
    this.metrics.activeSubscriptions = this.getActiveSubscriptions().length;

    logger.debug(`Subscription ${subscriptionId} removed`);

    return true;
  }

  /**
   * 取消 Agent 的所有订阅
   */
  unsubscribeAll(agentId: string): number {
    let count = 0;
    for (const [id, subscription] of this.subscriptions) {
      if (subscription.agentId === agentId && subscription.active) {
        subscription.active = false;
        this.subscriptions.delete(id);
        count++;
      }
    }
    this.metrics.activeSubscriptions = this.getActiveSubscriptions().length;

    logger.debug(`Removed ${count} subscriptions for agent ${agentId}`);

    return count;
  }

  /**
   * 投递消息到单个接收者
   */
  private async deliverMessage(
    message: AgentMessage,
    _options: DeliveryOptions
  ): Promise<MessageResult> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    if (recipients.length === 1) {
      const recipient = recipients[0];
      if (!recipient) {
        return {
          success: false,
          messageId: message.id,
          error: 'No recipient specified',
          processedAt: Date.now(),
          duration: 0
        };
      }
      return this.deliverToSingle(message, recipient, _options);
    }

    // 多个接收者，使用第一个的成功结果
    const results = await this.deliverToMultiple(message, _options);
    const firstSuccess = results.find(r => r.success);

    if (firstSuccess) {
      return firstSuccess;
    }

    // 返回第一个结果（即使失败）
    return results[0] || {
      success: false,
      messageId: message.id,
      error: 'No recipients to deliver to',
      processedAt: Date.now(),
      duration: 0
    };
  }

  /**
   * 投递消息到单个接收者
   */
  private async deliverToSingle(
    message: AgentMessage,
    recipient: AgentAddress,
    _options: DeliveryOptions
  ): Promise<MessageResult> {
    const startTime = Date.now();

    // 查找订阅
    const subscription = this.findSubscriptionFor(recipient.agentId, message);

    if (!subscription) {
      logger.warn(`No subscription found for agent ${recipient.agentId}`);
      return {
        success: false,
        messageId: message.id,
        error: `No subscription for agent ${recipient.agentId}`,
        processedAt: startTime,
        duration: Date.now() - startTime
      };
    }

    // 检查过滤器
    if (subscription.filter && !subscription.filter.test(message)) {
      logger.debug(`Message ${message.id} filtered by subscription ${subscription.id}`);
      return {
        success: false,
        messageId: message.id,
        error: 'Message filtered by subscription',
        processedAt: startTime,
        duration: Date.now() - startTime
      };
    }

    // 投递消息
    try {
      const responsePayload = await subscription.handler.handle(message);

      // 如果是请求消息，自动发送响应
      if (message.type === 'request' && responsePayload) {
        const response = MessageBuilder.response(message, responsePayload);
        this.pendingMessages.push(response);
      }

      return {
        success: true,
        messageId: message.id,
        response: responsePayload ?? undefined,
        processedAt: startTime,
        duration: Date.now() - startTime
      };

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Handler error for subscription ${subscription.id}: ${errMsg}`);

      // 发送错误响应
      if (message.type === 'request') {
        const errorResponse = MessageBuilder.error(message, errMsg);
        this.pendingMessages.push(errorResponse);
      }

      return {
        success: false,
        messageId: message.id,
        error: errMsg,
        processedAt: startTime,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 投递消息到多个接收者
   */
  private async deliverToMultiple(
    message: AgentMessage,
    options: DeliveryOptions
  ): Promise<MessageResult[]> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    const results = await Promise.all(
      recipients.map(recipient => this.deliverToSingle(message, recipient, options))
    );

    return results;
  }

  /**
   * 查找订阅
   */
  private findSubscriptionFor(agentId: string, message: AgentMessage): MessageSubscription | undefined {
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.active) continue;
      if (subscription.agentId !== agentId) continue;
      if (subscription.filter && !subscription.filter.test(message)) continue;
      return subscription;
    }
    return undefined;
  }

  /**
   * 等待响应消息
   */
  private waitForResponse(messageId: string, timeout: number): Promise<MessageResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.unsubscribe(responseSubscriptionId);
        reject(new Error(`Response timeout for message ${messageId}`));
      }, timeout);

      // 创建临时订阅来接收响应
      const responseSubscriptionId = this.subscribe(
        `temp-${messageId}`,
        {
          handle: async (message) => {
            if (message.replyTo === messageId) {
              clearTimeout(timeoutId);
              this.unsubscribe(responseSubscriptionId);

              if (message.type === 'error') {
                const errorPayload = message.payload;
                if (errorPayload.type === 'error') {
                  return reject(new Error(errorPayload.error));
                }
              }

              return resolve({
                success: true,
                messageId: message.id,
                response: message.payload,
                processedAt: Date.now(),
                duration: 0
              });
            }
          }
        },
        undefined
      );
    });
  }

  /**
   * 启动消息处理循环
   */
  private startProcessing(): void {
    if (this.processing) return;
    this.processing = true;

    const process = async () => {
      while (this.pendingMessages.length > 0) {
        const message = this.pendingMessages.shift();
        if (!message) continue;

        try {
          await this.deliverMessage(message, {});
        } catch (error) {
          logger.error(`Error processing pending message: ${error}`);
        }
      }

      if (this.pendingMessages.length > 0) {
        // 继续处理
        setImmediate(process);
      } else {
        // 稍后检查
        setTimeout(process, 100);
      }
    };

    process();
  }

  /**
   * 获取活跃的订阅
   */
  private getActiveSubscriptions(): MessageSubscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.active);
  }

  /**
   * 获取活跃的 Agent ID 列表
   */
  private getActiveAgentIds(): string[] {
    const agentIds = new Set<string>();
    for (const subscription of this.subscriptions.values()) {
      if (subscription.active) {
        agentIds.add(subscription.agentId);
      }
    }
    return Array.from(agentIds);
  }

  /**
   * 更新平均投递时间
   */
  private updateAverageDeliveryTime(duration: number): void {
    const count = this.metrics.messagesDelivered;
    if (count === 0) {
      this.metrics.averageDeliveryTime = duration;
    } else {
      this.metrics.averageDeliveryTime =
        (this.metrics.averageDeliveryTime * (count - 1) + duration) / count;
    }
  }

  /**
   * 获取统计信息
   */
  getMetrics(): MessageBusMetrics {
    return { ...this.metrics };
  }

  /**
   * 重置统计信息
   */
  resetMetrics(): void {
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      messagesTimeout: 0,
      activeSubscriptions: this.getActiveSubscriptions().length,
      averageDeliveryTime: 0
    };
  }

  /**
   * 清理过期消息和订阅
   */
  cleanup(): void {
    const now = Date.now();

    // 清理不活跃的订阅
    for (const [id, subscription] of this.subscriptions) {
      if (!subscription.active) {
        this.subscriptions.delete(id);
      }
    }

    // 清理过期的投递记录
    for (const [, record] of this.deliveryRecords) {
      if (record.nextRetry && record.nextRetry < now) {
        // 重试时间已过，但消息仍未投递，标记为失败
        record.status = 'timeout';
        this.metrics.messagesTimeout++;
      }
    }

    logger.debug('MessageBus cleanup completed');
  }

  /**
   * 销毁消息总线
   */
  destroy(): void {
    this.processing = false;
    this.subscriptions.clear();
    this.deliveryRecords.clear();
    this.pendingMessages = [];

    logger.info('MessageBus destroyed');
  }
}
