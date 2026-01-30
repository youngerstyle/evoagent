/**
 * Agent Registry - Agent 注册中心
 *
 * 管理 Agent 的注册、发现和生命周期
 */

import { getLogger } from '../../core/logger/index.js';
import type { AgentAddress } from './Messages.js';

const logger = getLogger('agent:communication:registry');

/**
 * Agent 注册信息
 */
export interface AgentRegistration {
  agentId: string;
  agentType: string;
  address: AgentAddress;
  capabilities: string[];
  status: 'online' | 'offline' | 'busy' | 'error';
  metadata: Record<string, unknown>;
  registeredAt: number;
  lastHeartbeat: number;
}

/**
 * 服务发现条件
 */
export interface DiscoveryCriteria {
  agentType?: string | string[];
  capabilities?: string[];
  status?: AgentRegistration['status'] | AgentRegistration['status'][];
  minHeartbeat?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Agent 注册中心配置
 */
export interface AgentRegistryConfig {
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  enableAutoCleanup?: boolean;
}

/**
 * Agent 注册中心
 *
 * 功能：
 * 1. 注册/注销 Agent
 * 2. 发现 Agent
 * 3. 更新 Agent 状态
 * 4. 心跳检测
 * 5. 自动清理过期 Agent
 */
export class AgentRegistry {
  private agents: Map<string, AgentRegistration> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  private config: Required<AgentRegistryConfig>;

  constructor(config: AgentRegistryConfig = {}) {
    this.config = {
      heartbeatInterval: config.heartbeatInterval ?? 30000, // 30秒
      heartbeatTimeout: config.heartbeatTimeout ?? 90000,   // 90秒
      enableAutoCleanup: config.enableAutoCleanup ?? true
    };

    // 启动自动清理
    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }

    logger.info('AgentRegistry initialized');
  }

  /**
   * 注册 Agent
   */
  register(
    agentId: string,
    agentType: string,
    capabilities: string[] = [],
    metadata: Record<string, unknown> = {}
  ): AgentRegistration {
    const now = Date.now();

    const registration: AgentRegistration = {
      agentId,
      agentType,
      address: {
        agentId,
        agentType,
        sessionId: metadata.sessionId as string | undefined,
        lane: metadata.lane as string | undefined
      },
      capabilities,
      status: 'online',
      metadata,
      registeredAt: now,
      lastHeartbeat: now
    };

    this.agents.set(agentId, registration);

    logger.info(`Agent registered: ${agentId} (${agentType})`);

    // 触发注册事件
    this.emit('registered', registration);

    return registration;
  }

  /**
   * 注销 Agent
   */
  unregister(agentId: string): boolean {
    const registration = this.agents.get(agentId);
    if (!registration) {
      return false;
    }

    this.agents.delete(agentId);

    logger.info(`Agent unregistered: ${agentId}`);

    // 触发注销事件
    this.emit('unregistered', registration);

    return true;
  }

  /**
   * 更新 Agent 状态
   */
  updateStatus(agentId: string, status: AgentRegistration['status']): boolean {
    const registration = this.agents.get(agentId);
    if (!registration) {
      return false;
    }

    const oldStatus = registration.status;
    registration.status = status;

    if (oldStatus !== status) {
      logger.debug(`Agent ${agentId} status changed: ${oldStatus} -> ${status}`);
      this.emit('status-changed', registration, oldStatus);
    }

    return true;
  }

  /**
   * 更新心跳
   */
  heartbeat(agentId: string): boolean {
    const registration = this.agents.get(agentId);
    if (!registration) {
      return false;
    }

    registration.lastHeartbeat = Date.now();

    // 如果 Agent 之前离线，现在恢复在线
    if (registration.status === 'offline') {
      registration.status = 'online';
      this.emit('reconnected', registration);
    }

    return true;
  }

  /**
   * 更新 Agent 元数据
   */
  updateMetadata(agentId: string, metadata: Record<string, unknown>): boolean {
    const registration = this.agents.get(agentId);
    if (!registration) {
      return false;
    }

    registration.metadata = { ...registration.metadata, ...metadata };
    registration.address.sessionId = metadata.sessionId as string | undefined;
    registration.address.lane = metadata.lane as string | undefined;

    return true;
  }

  /**
   * 获取 Agent 信息
   */
  get(agentId: string): AgentRegistration | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 检查 Agent 是否存在
   */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * 检查 Agent 是否在线
   */
  isOnline(agentId: string): boolean {
    const registration = this.agents.get(agentId);
    if (!registration) {
      return false;
    }

    return registration.status === 'online' &&
           Date.now() - registration.lastHeartbeat < this.config.heartbeatTimeout;
  }

  /**
   * 发现 Agent
   */
  discover(criteria: DiscoveryCriteria = {}): AgentRegistration[] {
    const results: AgentRegistration[] = [];

    for (const registration of this.agents.values()) {
      if (this.matchesCriteria(registration, criteria)) {
        results.push(registration);
      }
    }

    return results;
  }

  /**
   * 查找指定类型的 Agent
   */
  findByType(agentType: string): AgentRegistration[] {
    return this.discover({ agentType });
  }

  /**
   * 查找具有指定能力的 Agent
   */
  findByCapability(capability: string): AgentRegistration[] {
    return this.discover({ capabilities: [capability] });
  }

  /**
   * 查找在线的 Agent
   */
  findOnline(): AgentRegistration[] {
    return this.discover({ status: 'online' });
  }

  /**
   * 随机选择一个 Agent
   */
  selectOne(criteria: DiscoveryCriteria = {}): AgentRegistration | undefined {
    const results = this.discover(criteria);
    if (results.length === 0) {
      return undefined;
    }

    // 优先选择在线且空闲的
    const onlineAndIdle = results.filter(r => r.status === 'online');
    const pool = onlineAndIdle.length > 0 ? onlineAndIdle : results;

    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  /**
   * 获取所有 Agent
   */
  getAll(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }

  /**
   * 按 Agent 类型分组
   */
  groupByType(): Map<string, AgentRegistration[]> {
    const groups = new Map<string, AgentRegistration[]>();

    for (const registration of this.agents.values()) {
      const existing = groups.get(registration.agentType) || [];
      existing.push(registration);
      groups.set(registration.agentType, existing);
    }

    return groups;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    online: number;
  } {
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let online = 0;

    for (const registration of this.agents.values()) {
      byType[registration.agentType] = (byType[registration.agentType] || 0) + 1;
      byStatus[registration.status] = (byStatus[registration.status] || 0) + 1;
      if (registration.status === 'online') {
        online++;
      }
    }

    return {
      total: this.agents.size,
      byType,
      byStatus,
      online
    };
  }

  /**
   * 清理过期的 Agent
   */
  cleanup(): number {
    const now = Date.now();
    const timeout = this.config.heartbeatTimeout;
    const expired: string[] = [];

    for (const [agentId, registration] of this.agents) {
      if (registration.status !== 'offline' &&
          now - registration.lastHeartbeat > timeout) {
        registration.status = 'offline';
        expired.push(agentId);
        logger.debug(`Agent ${agentId} marked as offline (heartbeat timeout)`);
        this.emit('offline', registration);
      }
    }

    return expired.length;
  }

  /**
   * 检查 Agent 是否匹配条件
   */
  private matchesCriteria(registration: AgentRegistration, criteria: DiscoveryCriteria): boolean {
    // 检查类型
    if (criteria.agentType) {
      const types = Array.isArray(criteria.agentType) ? criteria.agentType : [criteria.agentType];
      if (!types.includes(registration.agentType)) {
        return false;
      }
    }

    // 检查能力
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      const hasAllCapabilities = criteria.capabilities.every(cap =>
        registration.capabilities.includes(cap)
      );
      if (!hasAllCapabilities) {
        return false;
      }
    }

    // 检查状态
    if (criteria.status) {
      const statuses = Array.isArray(criteria.status) ? criteria.status : [criteria.status];
      if (!statuses.includes(registration.status)) {
        return false;
      }
    }

    // 检查心跳时间
    if (criteria.minHeartbeat !== undefined) {
      if (registration.lastHeartbeat < criteria.minHeartbeat) {
        return false;
      }
    }

    // 检查元数据
    if (criteria.metadata) {
      for (const [key, value] of Object.entries(criteria.metadata)) {
        if (registration.metadata[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 启动自动清理
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.heartbeatInterval);

    logger.debug('Auto cleanup started');
  }

  /**
   * 停止自动清理
   */
  private stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * 事件发射器（简单实现）
   */
  private emit(
    event: 'registered' | 'unregistered' | 'status-changed' | 'reconnected' | 'offline',
    registration: AgentRegistration,
    oldStatus?: string
  ): void {
    // 简单的事件日志，后续可以扩展为完整的事件系统
    logger.debug(`Registry event: ${event}`, {
      agentId: registration.agentId,
      agentType: registration.agentType,
      status: registration.status,
      oldStatus
    });
  }

  /**
   * 销毁注册中心
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.agents.clear();

    logger.info('AgentRegistry destroyed');
  }
}
