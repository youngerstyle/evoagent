/**
 * A2A Communication Module
 *
 * Agent 之间的通信机制
 */

// 消息类型和工具
export {
  // 类型定义
  type MessageType,
  type MessagePriority,
  type MessageStatus,
  type AgentMessage,
  type AgentAddress,
  type MessagePayload,
  type StringPayload,
  type DataPayload,
  type CommandPayload,
  type EventPayload,
  type ErrorPayload,
  type DeliveryOptions,
  type MessageResult,
  type MessageHandler,
  type MessageFilter,

  // 工具类
  MessageBuilder,
  MessageSerializer,
  MessageValidator,

  // 过滤器
  MessageFilters
} from './Messages.js';

// 消息总线
export {
  MessageBus,
  type MessageBusConfig,
  type MessageBusMetrics
} from './MessageBus.js';

// Agent 注册中心
export {
  AgentRegistry,
  type AgentRegistration,
  type DiscoveryCriteria,
  type AgentRegistryConfig
} from './AgentRegistry.js';
