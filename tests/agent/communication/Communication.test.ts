/**
 * A2A Communication Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MessageBuilder,
  MessageSerializer,
  MessageValidator,
  MessageFilters,
  type AgentMessage,
  type AgentAddress,
  type MessagePayload,
  type MessageHandler
} from '../../../src/agent/communication/Messages.js';
import { MessageBus, type MessageBusConfig } from '../../../src/agent/communication/MessageBus.js';
import { AgentRegistry, type AgentRegistration } from '../../../src/agent/communication/AgentRegistry.js';

describe('MessageBuilder', () => {
  it('should build a simple message', () => {
    const from: AgentAddress = { agentId: 'agent-1', agentType: 'test' };
    const to: AgentAddress = { agentId: 'agent-2', agentType: 'test' };

    const message = new MessageBuilder()
      .type('request')
      .from(from)
      .to(to)
      .content('Hello')
      .build();

    expect(message.id).toBeDefined();
    expect(message.type).toBe('request');
    expect(message.from).toEqual(from);
    expect(message.to).toEqual(to);
    expect(message.payload).toEqual({ type: 'string', content: 'Hello' });
  });

  it('should build a request message using static method', () => {
    const from: AgentAddress = { agentId: 'agent-1', agentType: 'test' };
    const to: AgentAddress = { agentId: 'agent-2', agentType: 'test' };
    const payload: MessagePayload = { type: 'data', data: { key: 'value' } };

    const message = MessageBuilder.request(from, to, payload);

    expect(message.type).toBe('request');
    expect(message.payload).toEqual(payload);
  });

  it('should build a response message', () => {
    const from: AgentAddress = { agentId: 'agent-1', agentType: 'test' };
    const to: AgentAddress = { agentId: 'agent-2', agentType: 'test' };
    const original = MessageBuilder.request(from, to, { type: 'string', content: 'Test' });

    const response = MessageBuilder.response(original, { type: 'string', content: 'Response' });

    expect(response.type).toBe('response');
    expect(response.from).toEqual(to);
    expect(response.to).toEqual(from);
    expect(response.replyTo).toBe(original.id);
    expect(response.correlationId).toBe(original.id);
  });

  it('should build an error message', () => {
    const from: AgentAddress = { agentId: 'agent-1', agentType: 'test' };
    const to: AgentAddress = { agentId: 'agent-2', agentType: 'test' };
    const original = MessageBuilder.request(from, to, { type: 'string', content: 'Test' });

    const error = MessageBuilder.error(original, 'Something went wrong', 'ERR_CODE');

    expect(error.type).toBe('error');
    expect(error.payload).toEqual({
      type: 'error',
      error: 'Something went wrong',
      code: 'ERR_CODE'
    });
  });

  it('should set message priority', () => {
    const from: AgentAddress = { agentId: 'agent-1', agentType: 'test' };
    const to: AgentAddress = { agentId: 'agent-2', agentType: 'test' };

    const message = new MessageBuilder()
      .type('notification')
      .from(from)
      .to(to)
      .priority('urgent')
      .content('Urgent message')
      .build();

    expect(message.priority).toBe('urgent');
  });

  it('should set expiration time', () => {
    const from: AgentAddress = { agentId: 'agent-1', agentType: 'test' };
    const to: AgentAddress = { agentId: 'agent-2', agentType: 'test' };

    const message = new MessageBuilder()
      .type('notification')
      .from(from)
      .to(to)
      .content('Test')
      .expiresIn(60000) // 1 minute
      .build();

    expect(message.expiresAt).toBeDefined();
    expect(message.expiresAt! - Date.now()).toBeGreaterThan(59000);
    expect(message.expiresAt! - Date.now()).toBeLessThan(61000);
  });
});

describe('MessageSerializer', () => {
  it('should serialize and deserialize message', () => {
    const from: AgentAddress = { agentId: 'agent-1', agentType: 'test' };
    const to: AgentAddress = { agentId: 'agent-2', agentType: 'test' };

    const original = new MessageBuilder()
      .type('request')
      .from(from)
      .to(to)
      .data({ key: 'value' })
      .build();

    const serialized = MessageSerializer.serialize(original);
    const deserialized = MessageSerializer.deserialize(serialized);

    expect(deserialized).toEqual(original);
  });

  it('should serialize payload', () => {
    const payload: MessagePayload = { type: 'data', data: { complex: { nested: 'value' } } };

    const serialized = MessageSerializer.serializePayload(payload);
    const deserialized = MessageSerializer.deserializePayload(serialized);

    expect(deserialized).toEqual(payload);
  });

  it('should throw on invalid message format', () => {
    expect(() => MessageSerializer.deserialize('invalid json')).toThrow();
    expect(() => MessageSerializer.deserialize('{"id": "test"}')).toThrow();
  });
});

describe('MessageValidator', () => {
  it('should validate correct message', () => {
    const from: AgentAddress = { agentId: 'agent-1', agentType: 'test' };
    const to: AgentAddress = { agentId: 'agent-2', agentType: 'test' };

    const message = new MessageBuilder()
      .type('request')
      .from(from)
      .to(to)
      .content('Test')
      .build();

    const result = MessageValidator.validate(message);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required fields', () => {
    const message = {
      id: 'test-id',
      type: 'request' as const,
      priority: 'normal' as const,
      status: 'pending' as const,
      from: { agentId: 'agent-1', agentType: 'test' },
      to: { agentId: 'agent-2', agentType: 'test' },
      payload: undefined,
      timestamp: Date.now()
    };

    const result = MessageValidator.validate(message as AgentMessage);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Message payload is required');
  });

  it('should detect expired messages', () => {
    const from: AgentAddress = { agentId: 'agent-1', agentType: 'test' };
    const to: AgentAddress = { agentId: 'agent-2', agentType: 'test' };

    const message = new MessageBuilder()
      .type('request')
      .from(from)
      .to(to)
      .content('Test')
      .expiresAt(Date.now() - 1000) // expired 1 second ago
      .build();

    expect(MessageValidator.isExpired(message)).toBe(true);
  });

  it('should determine if message should retry', () => {
    const from: AgentAddress = { agentId: 'agent-1', agentType: 'test' };
    const to: AgentAddress = { agentId: 'agent-2', agentType: 'test' };

    const message = new MessageBuilder()
      .type('request')
      .from(from)
      .to(to)
      .content('Test')
      .maxRetries(3)
      .build();

    // Initially should retry
    expect(MessageValidator.shouldRetry(message)).toBe(true);

    // After exceeding max retries
    message.retryCount = 3;
    expect(MessageValidator.shouldRetry(message)).toBe(false);
  });
});

describe('MessageFilters', () => {
  const createMessage = (type: string, agentId: string, priority: string): AgentMessage => ({
    id: `msg-${Date.now()}`,
    type: type as any,
    priority: priority as any,
    status: 'pending',
    from: { agentId, agentType: 'test' },
    to: { agentId: 'receiver', agentType: 'test' },
    payload: { type: 'string', content: 'Test' },
    timestamp: Date.now()
  });

  it('should filter by message type', () => {
    const filter = MessageFilters.byType('request', 'response');

    expect(filter.test(createMessage('request', 'agent-1', 'normal'))).toBe(true);
    expect(filter.test(createMessage('notification', 'agent-1', 'normal'))).toBe(false);
  });

  it('should filter by sender', () => {
    const filter = MessageFilters.fromAgent('agent-1', 'agent-2');

    expect(filter.test(createMessage('request', 'agent-1', 'normal'))).toBe(true);
    expect(filter.test(createMessage('request', 'agent-3', 'normal'))).toBe(false);
  });

  it('should filter by priority', () => {
    const filter = MessageFilters.withPriority('high', 'urgent');

    expect(filter.test(createMessage('request', 'agent-1', 'high'))).toBe(true);
    expect(filter.test(createMessage('request', 'agent-1', 'normal'))).toBe(false);
  });

  it('should combine filters with AND', () => {
    const filter = MessageFilters.and(
      MessageFilters.byType('request'),
      MessageFilters.withPriority('urgent')
    );

    expect(filter.test(createMessage('request', 'agent-1', 'urgent'))).toBe(true);
    expect(filter.test(createMessage('request', 'agent-1', 'normal'))).toBe(false);
    expect(filter.test(createMessage('notification', 'agent-1', 'urgent'))).toBe(false);
  });

  it('should combine filters with OR', () => {
    const filter = MessageFilters.or(
      MessageFilters.byType('request'),
      MessageFilters.byType('response')
    );

    expect(filter.test(createMessage('request', 'agent-1', 'normal'))).toBe(true);
    expect(filter.test(createMessage('response', 'agent-1', 'normal'))).toBe(true);
    expect(filter.test(createMessage('notification', 'agent-1', 'normal'))).toBe(false);
  });

  it('should negate filter', () => {
    const filter = MessageFilters.not(MessageFilters.byType('error'));

    expect(filter.test(createMessage('request', 'agent-1', 'normal'))).toBe(true);
    expect(filter.test(createMessage('error', 'agent-1', 'normal'))).toBe(false);
  });
});

describe('MessageBus', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  afterEach(() => {
    messageBus.destroy();
  });

  it('should send and receive message', async () => {
    const from: AgentAddress = { agentId: 'sender', agentType: 'test' };
    const to: AgentAddress = { agentId: 'receiver', agentType: 'test' };

    let receivedMessage: AgentMessage | undefined;
    const handler: MessageHandler = {
      handle: async (message) => {
        receivedMessage = message;
        return { type: 'string', content: 'ACK' };
      }
    };

    messageBus.subscribe('receiver', handler);

    const message = MessageBuilder.request(from, to, { type: 'string', content: 'Hello' });
    const result = await messageBus.send(message);

    expect(result.success).toBe(true);
    expect(receivedMessage).toBeDefined();
    expect(receivedMessage!.payload.content).toBe('Hello');
  });

  it('should apply message filters', async () => {
    const from: AgentAddress = { agentId: 'sender', agentType: 'test' };
    const to: AgentAddress = { agentId: 'receiver', agentType: 'test' };

    let callCount = 0;
    const handler: MessageHandler = {
      handle: async () => {
        callCount++;
        return { type: 'string', content: 'ACK' };
      }
    };

    // 只接收 'request' 类型的消息
    messageBus.subscribe('receiver', handler, MessageFilters.byType('request'));

    await messageBus.send(MessageBuilder.request(from, to, { type: 'string', content: 'Request' }));
    await messageBus.send(MessageBuilder.notification(from, to, { type: 'string', content: 'Notification' }));

    expect(callCount).toBe(1); // 只有 request 被处理
  });

  it('should support unsubscribe', async () => {
    const from: AgentAddress = { agentId: 'sender', agentType: 'test' };
    const to: AgentAddress = { agentId: 'receiver', agentType: 'test' };

    let callCount = 0;
    const handler: MessageHandler = {
      handle: async () => {
        callCount++;
        return { type: 'string', content: 'ACK' };
      }
    };

    const subscriptionId = messageBus.subscribe('receiver', handler);

    await messageBus.send(MessageBuilder.request(from, to, { type: 'string', content: 'First' }));
    expect(callCount).toBe(1);

    messageBus.unsubscribe(subscriptionId);

    await messageBus.send(MessageBuilder.request(from, to, { type: 'string', content: 'Second' }));
    expect(callCount).toBe(1); // 没有增加
  });

  it('should track metrics', async () => {
    const from: AgentAddress = { agentId: 'sender', agentType: 'test' };
    const to: AgentAddress = { agentId: 'receiver', agentType: 'test' };

    const handler: MessageHandler = {
      handle: async () => ({ type: 'string', content: 'ACK' })
    };

    messageBus.subscribe('receiver', handler);

    await messageBus.send(MessageBuilder.request(from, to, { type: 'string', content: 'Test' }));

    const metrics = messageBus.getMetrics();

    expect(metrics.messagesSent).toBe(1);
    expect(metrics.messagesDelivered).toBe(1);
    expect(metrics.activeSubscriptions).toBe(1);
  });

  it('should validate messages before sending', async () => {
    const invalidMessage = {
      id: 'invalid',
      type: 'request' as const,
      priority: 'normal' as const,
      status: 'pending' as const,
      from: undefined as any,
      to: undefined as any,
      payload: undefined,
      timestamp: Date.now()
    };

    const result = await messageBus.send(invalidMessage as AgentMessage);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });
});

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry({ heartbeatInterval: 1000, enableAutoCleanup: false });
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should register and unregister agents', () => {
    const registration = registry.register('agent-1', 'test', ['read', 'write']);

    expect(registration.agentId).toBe('agent-1');
    expect(registration.agentType).toBe('test');
    expect(registration.capabilities).toEqual(['read', 'write']);
    expect(registration.status).toBe('online');

    expect(registry.has('agent-1')).toBe(true);

    registry.unregister('agent-1');
    expect(registry.has('agent-1')).toBe(false);
  });

  it('should discover agents by type', () => {
    registry.register('agent-1', 'writer', ['write']);
    registry.register('agent-2', 'reader', ['read']);
    registry.register('agent-3', 'writer', ['write']);

    const writers = registry.findByType('writer');

    expect(writers).toHaveLength(2);
    expect(writers.map(w => w.agentId)).toEqual(['agent-1', 'agent-3']);
  });

  it('should discover agents by capability', () => {
    registry.register('agent-1', 'test', ['read', 'write']);
    registry.register('agent-2', 'test', ['read']);
    registry.register('agent-3', 'test', ['write']);

    const readers = registry.findByCapability('read');

    expect(readers).toHaveLength(2);
    expect(readers.map(r => r.agentId)).toEqual(['agent-1', 'agent-2']);
  });

  it('should track agent status', () => {
    registry.register('agent-1', 'test');

    expect(registry.isOnline('agent-1')).toBe(true);

    registry.updateStatus('agent-1', 'busy');
    expect(registry.get('agent-1')?.status).toBe('busy');
  });

  it('should handle heartbeat', async () => {
    registry.register('agent-1', 'test');

    const initialLastHeartbeat = registry.get('agent-1')!.lastHeartbeat;

    // Small delay to ensure timestamp changes
    await new Promise(resolve => setTimeout(resolve, 2));

    registry.heartbeat('agent-1');

    expect(registry.get('agent-1')!.lastHeartbeat).toBeGreaterThan(initialLastHeartbeat);
  });

  it('should group agents by type', () => {
    registry.register('agent-1', 'writer');
    registry.register('agent-2', 'writer');
    registry.register('agent-3', 'reader');

    const groups = registry.groupByType();

    expect(groups.get('writer')).toHaveLength(2);
    expect(groups.get('reader')).toHaveLength(1);
  });

  it('should provide statistics', () => {
    registry.register('agent-1', 'writer');
    registry.register('agent-2', 'writer');
    registry.register('agent-3', 'reader');

    const stats = registry.getStats();

    expect(stats.total).toBe(3);
    expect(stats.byType.writer).toBe(2);
    expect(stats.byType.reader).toBe(1);
    expect(stats.online).toBe(3);
  });

  it('should select one agent', () => {
    registry.register('agent-1', 'writer');
    registry.register('agent-2', 'writer');
    registry.register('agent-3', 'reader');

    const writer = registry.selectOne({ agentType: 'writer' });

    expect(writer).toBeDefined();
    expect(writer!.agentType).toBe('writer');
  });
});
