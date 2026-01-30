/**
 * A2A (Agent-to-Agent) Communication
 *
 * 定义 Agent 之间的消息格式和通信协议
 */

/**
 * 消息类型
 */
export type MessageType =
  | 'request'        // 请求消息，需要响应
  | 'response'       // 响应消息
  | 'notification'   // 通知消息，不需要响应
  | 'broadcast'      // 广播消息
  | 'error'          // 错误消息
  | 'heartbeat';     // 心跳消息

/**
 * 消息优先级
 */
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * 消息状态
 */
export type MessageStatus = 'pending' | 'delivering' | 'delivered' | 'failed' | 'timeout';

/**
 * Agent 消息
 */
export interface AgentMessage {
  // 基本信息
  id: string;
  type: MessageType;
  priority: MessagePriority;
  status: MessageStatus;

  // 发送者和接收者
  from: AgentAddress;
  to: AgentAddress | AgentAddress[]; // 支持单播和广播

  // 内容
  payload: MessagePayload;

  // 时间戳
  timestamp: number;
  expiresAt?: number;

  // 响应相关
  replyTo?: string;  // 响应的消息 ID
  correlationId?: string; // 关联 ID，用于追踪请求-响应

  // 重试相关
  retryCount?: number;
  maxRetries?: number;

  // 元数据
  metadata?: Record<string, unknown>;
}

/**
 * Agent 地址
 */
export interface AgentAddress {
  agentId: string;
  agentType: string;
  sessionId?: string;
  lane?: string;
}

/**
 * 消息负载
 */
export type MessagePayload =
  | StringPayload
  | DataPayload
  | CommandPayload
  | EventPayload
  | ErrorPayload;

export interface StringPayload {
  type: 'string';
  content: string;
}

export interface DataPayload {
  type: 'data';
  data: Record<string, unknown>;
  schema?: string;
}

export interface CommandPayload {
  type: 'command';
  command: string;
  parameters: Record<string, unknown>;
}

export interface EventPayload {
  type: 'event';
  event: string;
  data: Record<string, unknown>;
}

export interface ErrorPayload {
  type: 'error';
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * 消息投递选项
 */
export interface DeliveryOptions {
  timeout?: number;       // 超时时间（毫秒）
  priority?: MessagePriority;
  retries?: number;       // 重试次数
  delay?: number;         // 延迟投递（毫秒）
  persistent?: boolean;   // 是否持久化
  maxRetries?: number;    // 最大重试次数（同 retries，别名）
  expiresAt?: number;     // 过期时间戳
}

/**
 * 消息处理结果
 */
export interface MessageResult {
  success: boolean;
  messageId: string;
  response?: MessagePayload;
  error?: string;
  processedAt: number;
  duration: number;
}

/**
 * 消息处理器
 */
export interface MessageHandler {
  /**
   * 处理消息
   */
  handle(message: AgentMessage): Promise<MessagePayload | void>;

  /**
   * 检查是否可以处理该消息
   */
  canHandle?(message: AgentMessage): boolean;
}

/**
 * 消息过滤器
 */
export interface MessageFilter {
  /**
   * 测试消息是否通过过滤器
   */
  test(message: AgentMessage): boolean;
}

/**
 * 常用消息过滤器
 */
export const MessageFilters = {
  /**
   * 按消息类型过滤
   */
  byType: (...types: MessageType[]): MessageFilter => ({
    test: (message) => types.includes(message.type)
  }),

  /**
   * 按发送者过滤
   */
  fromAgent: (...agentIds: string[]): MessageFilter => ({
    test: (message) => agentIds.includes(message.from.agentId)
  }),

  /**
   * 按优先级过滤
   */
  withPriority: (...priorities: MessagePriority[]): MessageFilter => ({
    test: (message) => priorities.includes(message.priority)
  }),

  /**
   * 按会话过滤
   */
  fromSession: (...sessionIds: string[]): MessageFilter => ({
    test: (message) =>
      message.from.sessionId !== undefined &&
      sessionIds.includes(message.from.sessionId)
  }),

  /**
   * 组合过滤器（AND）
   */
  and: (...filters: MessageFilter[]): MessageFilter => ({
    test: (message) => filters.every(f => f.test(message))
  }),

  /**
   * 组合过滤器（OR）
   */
  or: (...filters: MessageFilter[]): MessageFilter => ({
    test: (message) => filters.some(f => f.test(message))
  }),

  /**
   * 取反过滤器
   */
  not: (filter: MessageFilter): MessageFilter => ({
    test: (message) => !filter.test(message)
  })
};

/**
 * 消息构建器
 */
export class MessageBuilder {
  private message: Partial<AgentMessage> = {
    priority: 'normal',
    status: 'pending',
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: 3
  };

  /**
   * 设置消息类型
   */
  type(type: MessageType): this {
    this.message.type = type;
    return this;
  }

  /**
   * 设置优先级
   */
  priority(priority: MessagePriority): this {
    this.message.priority = priority;
    return this;
  }

  /**
   * 设置发送者
   */
  from(from: AgentAddress): this {
    this.message.from = from;
    return this;
  }

  /**
   * 设置接收者
   */
  to(to: AgentAddress | AgentAddress[]): this {
    this.message.to = to;
    return this;
  }

  /**
   * 设置负载
   */
  payload(payload: MessagePayload): this {
    this.message.payload = payload;
    return this;
  }

  /**
   * 设置文本负载
   */
  content(content: string): this {
    this.message.payload = { type: 'string', content };
    return this;
  }

  /**
   * 设置数据负载
   */
  data(data: Record<string, unknown>, schema?: string): this {
    this.message.payload = { type: 'data', data, schema };
    return this;
  }

  /**
   * 设置命令负载
   */
  command(command: string, parameters: Record<string, unknown> = {}): this {
    this.message.payload = { type: 'command', command, parameters };
    return this;
  }

  /**
   * 设置事件负载
   */
  event(event: string, eventData: Record<string, unknown> = {}): this {
    this.message.payload = { type: 'event', event, data: eventData };
    return this;
  }

  /**
   * 设置错误负载
   */
  error(error: string, code?: string, details?: Record<string, unknown>): this {
    this.message.payload = { type: 'error', error, code, details };
    return this;
  }

  /**
   * 设置回复目标
   */
  replyTo(messageId: string): this {
    this.message.replyTo = messageId;
    return this;
  }

  /**
   * 设置关联 ID
   */
  correlationId(id: string): this {
    this.message.correlationId = id;
    return this;
  }

  /**
   * 设置过期时间
   */
  expiresAt(timestamp: number): this {
    this.message.expiresAt = timestamp;
    return this;
  }

  /**
   * 设置过期时间（相对时间，毫秒）
   */
  expiresIn(ms: number): this {
    this.message.expiresAt = Date.now() + ms;
    return this;
  }

  /**
   * 设置最大重试次数
   */
  maxRetries(count: number): this {
    this.message.maxRetries = count;
    return this;
  }

  /**
   * 设置元数据
   */
  metadata(metadata: Record<string, unknown>): this {
    this.message.metadata = { ...this.message.metadata, ...metadata };
    return this;
  }

  /**
   * 添加元数据
   */
  addMetadata(key: string, value: unknown): this {
    if (!this.message.metadata) {
      this.message.metadata = {};
    }
    this.message.metadata[key] = value;
    return this;
  }

  /**
   * 构建消息
   */
  build(): AgentMessage {
    if (!this.message.type) {
      throw new Error('Message type is required');
    }
    if (!this.message.from) {
      throw new Error('Message sender (from) is required');
    }
    if (!this.message.to) {
      throw new Error('Message receiver (to) is required');
    }
    if (!this.message.payload) {
      throw new Error('Message payload is required');
    }
    if (!this.message.id) {
      this.message.id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    return this.message as AgentMessage;
  }

  /**
   * 构建请求消息
   */
  static request(from: AgentAddress, to: AgentAddress, payload: MessagePayload): AgentMessage {
    return new MessageBuilder()
      .type('request')
      .from(from)
      .to(to)
      .payload(payload)
      .build();
  }

  /**
   * 构建响应消息
   */
  static response(originalMessage: AgentMessage, payload: MessagePayload): AgentMessage {
    return new MessageBuilder()
      .type('response')
      .from(originalMessage.to as AgentAddress)
      .to(originalMessage.from)
      .payload(payload)
      .replyTo(originalMessage.id)
      .correlationId(originalMessage.correlationId || originalMessage.id)
      .build();
  }

  /**
   * 构建通知消息
   */
  static notification(from: AgentAddress, to: AgentAddress | AgentAddress[], payload: MessagePayload): AgentMessage {
    return new MessageBuilder()
      .type('notification')
      .from(from)
      .to(to)
      .payload(payload)
      .build();
  }

  /**
   * 构建错误消息
   */
  static error(originalMessage: AgentMessage, error: string, code?: string): AgentMessage {
    return new MessageBuilder()
      .type('error')
      .from(originalMessage.to as AgentAddress)
      .to(originalMessage.from)
      .error(error, code)
      .replyTo(originalMessage.id)
      .correlationId(originalMessage.correlationId || originalMessage.id)
      .build();
  }
}

/**
 * 消息序列化
 */
export class MessageSerializer {
  /**
   * 序列化消息为 JSON
   */
  static serialize(message: AgentMessage): string {
    return JSON.stringify(message);
  }

  /**
   * 从 JSON 反序列化消息
   */
  static deserialize(json: string): AgentMessage {
    const parsed = JSON.parse(json);
    // 验证基本结构
    if (!parsed.id || !parsed.type || !parsed.from || !parsed.to) {
      throw new Error('Invalid message format');
    }
    return parsed as AgentMessage;
  }

  /**
   * 序列化消息负载
   */
  static serializePayload(payload: MessagePayload): string {
    return JSON.stringify(payload);
  }

  /**
   * 反序列化消息负载
   */
  static deserializePayload(json: string): MessagePayload {
    return JSON.parse(json) as MessagePayload;
  }
}

/**
 * 消息验证器
 */
export class MessageValidator {
  /**
   * 验证消息结构
   */
  static validate(message: AgentMessage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!message.id) {
      errors.push('Message ID is required');
    }
    if (!message.type) {
      errors.push('Message type is required');
    }
    if (!message.from) {
      errors.push('Message sender (from) is required');
    }
    if (!message.to) {
      errors.push('Message receiver (to) is required');
    }
    if (!message.payload) {
      errors.push('Message payload is required');
    }
    if (!message.timestamp) {
      errors.push('Message timestamp is required');
    }

    // 验证地址
    if (message.from && !message.from.agentId) {
      errors.push('Sender agentId is required');
    }
    if (message.to) {
      const tos = Array.isArray(message.to) ? message.to : [message.to];
      tos.forEach((to, i) => {
        if (!to.agentId) {
          errors.push(`Receiver ${i} agentId is required`);
        }
      });
    }

    // 验证过期时间
    if (message.expiresAt && message.expiresAt < Date.now()) {
      errors.push('Message has expired');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证消息是否过期
   */
  static isExpired(message: AgentMessage): boolean {
    return message.expiresAt !== undefined && message.expiresAt < Date.now();
  }

  /**
   * 验证消息是否需要重试
   */
  static shouldRetry(message: AgentMessage): boolean {
    return (message.retryCount || 0) < (message.maxRetries || 0);
  }
}
