/**
 * 告警规则引擎
 *
 * 基于指标和事件触发告警
 */

import { getLogger } from '../../core/logger/index.js';
import { globalEventBus, type EventData } from '../../core/events/index.js';

const logger = getLogger('observability:alerting');

/**
 * 告警级别
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * 告警规则
 */
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: AlertSeverity;
  condition: AlertCondition;
  actions: AlertAction[];
  cooldown?: number; // 冷却时间（毫秒）
  metadata?: Record<string, unknown>;
}

/**
 * 告警条件
 */
export interface AlertCondition {
  type: 'metric' | 'event' | 'composite';
  metric?: {
    name: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number;
    duration?: number; // 持续时间（毫秒）
  };
  event?: {
    type: string;
    filter?: Record<string, unknown>;
  };
  composite?: {
    operator: 'AND' | 'OR';
    conditions: AlertCondition[];
  };
}

/**
 * 告警动作
 */
export interface AlertAction {
  type: 'log' | 'webhook' | 'email' | 'custom';
  config: Record<string, unknown>;
}

/**
 * 告警实例
 */
export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 告警引擎
 */
export class AlertEngine {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private metricValues: Map<string, number[]> = new Map();

  constructor() {
    // 订阅事件
    globalEventBus.on('agent.failed', (event) => void this.handleEvent(event));
    globalEventBus.on('system.shutdown', (event) => void this.handleEvent(event));
  }

  /**
   * 添加规则
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`Added alert rule: ${rule.name}`);
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info(`Removed alert rule: ${ruleId}`);
  }

  /**
   * 更新规则
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      logger.info(`Updated alert rule: ${ruleId}`);
    }
  }

  /**
   * 获取所有规则
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 记录指标值
   */
  recordMetric(name: string, value: number): void {
    if (!this.metricValues.has(name)) {
      this.metricValues.set(name, []);
    }

    const values = this.metricValues.get(name)!;
    values.push(value);

    // 保留最近100个值
    if (values.length > 100) {
      values.shift();
    }

    // 检查指标规则
    void this.checkMetricRules(name, value);
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.resolved);
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      logger.info(`Resolved alert: ${alertId}`);
    }
  }

  /**
   * 处理事件
   */
  private async handleEvent(event: EventData): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      if (rule.condition.type === 'event' && rule.condition.event) {
        if (this.matchesEventCondition(event, rule.condition.event)) {
          await this.triggerAlert(rule, `Event triggered: ${event.type}`, event);
        }
      }
    }
  }

  /**
   * 检查指标规则
   */
  private async checkMetricRules(metricName: string, value: number): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      if (rule.condition.type === 'metric' && rule.condition.metric) {
        const metric = rule.condition.metric;
        if (metric.name === metricName) {
          if (this.evaluateMetricCondition(value, metric)) {
            await this.triggerAlert(rule, `Metric ${metricName} ${metric.operator} ${metric.threshold}`, { metricName, value });
          }
        }
      }
    }
  }

  /**
   * 评估指标条件
   */
  private evaluateMetricCondition(value: number, metric: AlertCondition['metric']): boolean {
    if (!metric) return false;

    switch (metric.operator) {
      case '>': return value > metric.threshold;
      case '<': return value < metric.threshold;
      case '>=': return value >= metric.threshold;
      case '<=': return value <= metric.threshold;
      case '==': return value === metric.threshold;
      case '!=': return value !== metric.threshold;
      default: return false;
    }
  }

  /**
   * 匹配事件条件
   */
  private matchesEventCondition(event: EventData, condition: { type: string; filter?: Record<string, unknown> }): boolean {
    if (event.type !== condition.type) return false;

    if (condition.filter) {
      for (const [key, value] of Object.entries(condition.filter)) {
        if (event.data[key] !== value) return false;
      }
    }

    return true;
  }

  /**
   * 触发告警
   */
  private async triggerAlert(rule: AlertRule, message: string, context?: unknown): Promise<void> {
    // 检查冷却时间
    const lastTime = this.lastAlertTime.get(rule.id);
    const now = Date.now();
    if (lastTime && rule.cooldown && now - lastTime < rule.cooldown) {
      return;
    }

    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message,
      timestamp: now,
      resolved: false,
      metadata: { context }
    };

    this.activeAlerts.set(alert.id, alert);
    this.lastAlertTime.set(rule.id, now);

    logger.warn(`Alert triggered: ${rule.name} - ${message}`);

    // 执行动作
    await this.executeActions(rule.actions, alert);

    // 发布告警事件
    globalEventBus.emit('agent.failed', 'alert-engine', {
      alert,
      rule: rule.name
    });
  }

  /**
   * 执行告警动作
   */
  private async executeActions(actions: AlertAction[], alert: Alert): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'log':
            logger.warn(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
            break;

          case 'webhook':
            await this.executeWebhook(action.config, alert);
            break;

          case 'email':
            await this.executeEmail(action.config, alert);
            break;

          case 'custom':
            await this.executeCustomAction(action.config, alert);
            break;
        }
      } catch (error) {
        logger.error(`Failed to execute alert action ${action.type}:`, error);
      }
    }
  }

  /**
   * 执行 Webhook 调用
   */
  private async executeWebhook(config: Record<string, unknown>, alert: Alert): Promise<void> {
    const url = config.url as string;
    if (!url) {
      logger.error('Webhook URL not configured');
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers as Record<string, string> || {})
        },
        body: JSON.stringify({
          alert: {
            id: alert.id,
            ruleId: alert.ruleId,
            ruleName: alert.ruleName,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
            metadata: alert.metadata
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      logger.info(`Webhook sent successfully for alert: ${alert.id}`);
    } catch (error) {
      logger.error(`Failed to send webhook for alert ${alert.id}:`, error);
      throw error;
    }
  }

  /**
   * 执行邮件发送
   */
  private async executeEmail(config: Record<string, unknown>, alert: Alert): Promise<void> {
    const to = config.to as string | string[];
    const from = config.from as string;
    const smtpHost = config.smtpHost as string;

    if (!to || !from || !smtpHost) {
      logger.error('Email configuration incomplete');
      return;
    }

    // 简化实现：记录邮件内容
    const emailContent = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject: `[${alert.severity.toUpperCase()}] ${alert.ruleName}`,
      body: `
Alert Details:
-------
ID: ${alert.id}
Rule: ${alert.ruleName}
Severity: ${alert.severity}
Message: ${alert.message}
Timestamp: ${new Date(alert.timestamp).toISOString()}

Metadata:
${JSON.stringify(alert.metadata, null, 2)}
      `.trim()
    };

    logger.info(`Email alert prepared for: ${emailContent.to.join(', ')}`, {
      alertId: alert.id,
      subject: emailContent.subject
    });

    // 实际发送需要集成 nodemailer 或类似库
    // 这里仅记录日志
  }

  /**
   * 执行自定义动作
   */
  private async executeCustomAction(config: Record<string, unknown>, alert: Alert): Promise<void> {
    const handler = config.handler as string;
    const params = config.params as Record<string, unknown> || {};

    if (!handler) {
      logger.error('Custom action handler not configured');
      return;
    }

    logger.info(`Executing custom action: ${handler}`, {
      alertId: alert.id,
      params
    });

    // 自定义动作可以通过插件系统实现
    // 这里仅记录日志
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalRules: number;
    enabledRules: number;
    activeAlerts: number;
    totalAlerts: number;
  } {
    return {
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      activeAlerts: this.getActiveAlerts().length,
      totalAlerts: this.activeAlerts.size
    };
  }
}

/**
 * 全局告警引擎实例
 */
export const globalAlertEngine = new AlertEngine();

/**
 * 预定义告警规则
 */
export const defaultAlertRules: AlertRule[] = [
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    description: 'Agent failure rate exceeds threshold',
    enabled: true,
    severity: 'error',
    condition: {
      type: 'metric',
      metric: {
        name: 'agent.error_rate',
        operator: '>',
        threshold: 0.5
      }
    },
    actions: [
      { type: 'log', config: {} }
    ],
    cooldown: 300000 // 5分钟
  },
  {
    id: 'agent-failure',
    name: 'Agent Execution Failed',
    description: 'An agent execution has failed',
    enabled: true,
    severity: 'warning',
    condition: {
      type: 'event',
      event: {
        type: 'agent.failed'
      }
    },
    actions: [
      { type: 'log', config: {} }
    ],
    cooldown: 60000 // 1分钟
  },
  {
    id: 'system-shutdown',
    name: 'System Shutdown',
    description: 'System is shutting down',
    enabled: true,
    severity: 'info',
    condition: {
      type: 'event',
      event: {
        type: 'system.shutdown'
      }
    },
    actions: [
      { type: 'log', config: {} }
    ]
  }
];
