/**
 * Experience Collector
 *
 * 聚合和管理从 Agent 运行中收集的经验
 */

import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../core/logger/index.js';
import type { KnowledgeStorage } from '../../memory/knowledge/KnowledgeStorage.js';
import type { VectorStore } from '../../memory/vector/VectorStore.js';
import type {
  ExperienceEvent,
  ExperienceEventType,
  EventSeverity,
  EventFilter,
  PaginationOptions,
  ExperienceStats
} from './ExperienceTypes.js';
import type { ExtractionContext } from './ExperienceTypes.js';
import { ExperienceExtractor } from './ExperienceExtractor.js';

const logger = getLogger('evolution:collector');

/**
 * 经验收集配置
 */
export interface ExperienceCollectorConfig {
  enableAutoSave?: boolean;     // 自动保存到 Knowledge
  enableVectorIndex?: boolean;  // 索引到向量存储
  maxEvents?: number;           // 最大事件数
  retentionDays?: number;       // 保留天数
  enableAggregation?: boolean;  // 启用事件聚合
}

/**
 * 聚合配置
 */
export interface AggregationConfig {
  windowMs?: number;            // 时间窗口（毫秒）
  minOccurrences?: number;      // 最小出现次数
  groupBy?: string[];           // 分组字段
}

/**
 * 经验收集器
 *
 * 功能：
 * 1. 收集来自 Agent 运行的经验事件
 * 2. 存储和管理经验事件
 * 3. 聚合相似事件
 * 4. 搜索和检索经验
 * 5. 导出到 Knowledge 和 Vector Store
 */
export class ExperienceCollector {
  private events: Map<string, ExperienceEvent> = new Map();
  private extractor: ExperienceExtractor;

  private config: Required<ExperienceCollectorConfig>;
  private aggregations: Map<string, ExperienceEvent> = new Map();

  constructor(
    config: ExperienceCollectorConfig = {},
    private knowledge?: KnowledgeStorage,
    private vectorStore?: VectorStore
  ) {
    this.config = {
      enableAutoSave: config.enableAutoSave ?? true,
      enableVectorIndex: config.enableVectorIndex ?? true,
      maxEvents: config.maxEvents ?? 10000,
      retentionDays: config.retentionDays ?? 90,
      enableAggregation: config.enableAggregation ?? true
    };

    this.extractor = new ExperienceExtractor();

    // 启动定期清理
    this.startCleanup();

    logger.info('ExperienceCollector initialized');
  }

  /**
   * 从 Agent 运行结果中收集经验
   */
  async collect(context: ExtractionContext): Promise<ExperienceEvent[]> {
    logger.debug(`Collecting experiences from ${context.agentType} run`);

    // 提取经验事件
    const partialEvents = await this.extractor.extract(context);

    // 转换为完整事件并收集
    const completeEvents: ExperienceEvent[] = [];
    for (const partialEvent of partialEvents) {
      const completeEvent = this.toCompleteEvent(partialEvent);
      await this.addEvent(completeEvent);
      completeEvents.push(completeEvent);
    }

    return completeEvents;
  }

  /**
   * 将 Partial<ExperienceEvent> 转换为完整的 ExperienceEvent
   */
  private toCompleteEvent(partial: Partial<ExperienceEvent>): ExperienceEvent {
    return {
      id: partial.id || uuidv4(),
      type: partial.type || 'insight',
      severity: partial.severity || 'info',
      source: partial.source || 'agent',
      agentType: partial.agentType,
      sessionId: partial.sessionId,
      taskId: partial.taskId,
      runId: partial.runId,
      title: partial.title || '未命名事件',
      description: partial.description || '',
      details: partial.details || {},
      metadata: partial.metadata || {},
      timestamp: partial.timestamp || Date.now(),
      expiresAt: partial.expiresAt,
      relatedEvents: partial.relatedEvents,
      tags: partial.tags || [],
      occurrenceCount: partial.occurrenceCount || 1,
      lastOccurrence: partial.lastOccurrence || partial.timestamp || Date.now()
    };
  }

  /**
   * 添加事件
   */
  async addEvent(event: ExperienceEvent): Promise<void> {
    // 检查是否是重复事件
    const existing = this.findSimilarEvent(event);
    if (existing) {
      // 更新现有事件的统计
      existing.occurrenceCount++;
      existing.lastOccurrence = event.timestamp;
      existing.relatedEvents = existing.relatedEvents || [];
      existing.relatedEvents.push(event.id);
      logger.debug(`Merged event into existing: ${existing.id}`);
      return;
    }

    // 添加新事件
    this.events.set(event.id, event);

    // 自动保存到 Knowledge
    if (this.config.enableAutoSave && this.knowledge) {
      await this.saveToKnowledge(event);
    }

    // 索引到 Vector Store
    if (this.config.enableVectorIndex && this.vectorStore) {
      await this.indexToVector(event);
    }

    // 检查事件数量限制
    this.enforceMaxEvents();

    logger.debug(`Added event: ${event.id} (${event.type})`);
  }

  /**
   * 查找相似事件
   */
  private findSimilarEvent(event: ExperienceEvent): ExperienceEvent | undefined {
    for (const existing of this.events.values()) {
      if (this.areSimilar(existing, event)) {
        return existing;
      }
    }
    return undefined;
  }

  /**
   * 判断两个事件是否相似
   */
  private areSimilar(a: ExperienceEvent, b: ExperienceEvent): boolean {
    // 类型相同
    if (a.type !== b.type) return false;

    // Agent 类型相同
    if (a.agentType !== b.agentType) return false;

    // 标题相似（简单包含检查）
    if (a.title.toLowerCase().includes(b.title.toLowerCase()) ||
        b.title.toLowerCase().includes(a.title.toLowerCase())) {
      return true;
    }

    // 标签有重叠
    const tagIntersection = a.tags.filter(t => b.tags.includes(t));
    if (tagIntersection.length >= 2) {
      return true;
    }

    return false;
  }

  /**
   * 保存到 Knowledge Storage
   */
  private async saveToKnowledge(event: ExperienceEvent): Promise<void> {
    if (!this.knowledge) return;

    try {
      // 根据事件类型确定分类
      const category = this.getCategoryForEventType(event.type);

      // 生成 Markdown 内容
      const content = this.eventToMarkdown(event);

      // 生成文件名
      const filename = this.generateFilename(event);

      await this.knowledge.writeAuto(category, filename, content);

      logger.debug(`Saved event to Knowledge: ${category}/${filename}`);
    } catch (error) {
      logger.error('Failed to save event to Knowledge:', error);
    }
  }

  /**
   * 索引到 Vector Store
   */
  private async indexToVector(event: ExperienceEvent): Promise<void> {
    if (!this.vectorStore) return;

    try {
      // 生成嵌入文本
      const embeddingText = this.generateEmbeddingText(event);

      // 使用 EmbeddingService 生成向量
      // 这里简化处理，实际应该调用 EmbeddingService
      const mockEmbedding = this.generateMockEmbedding(embeddingText);

      await this.vectorStore.add({
        id: `exp-${event.id}`,
        collection: 'experiences',
        embedding: mockEmbedding,
        content: embeddingText,
        metadata: {
          eventType: event.type,
          agentType: event.agentType,
          severity: event.severity,
          tags: event.tags.join(','),
          timestamp: event.timestamp
        },
        consolidated: false
      });

      logger.debug(`Indexed event to vector: ${event.id}`);
    } catch (error) {
      logger.error('Failed to index event to Vector Store:', error);
    }
  }

  /**
   * 搜索事件
   */
  search(filter: EventFilter, pagination?: PaginationOptions): ExperienceEvent[] {
    let results = Array.from(this.events.values());

    // 应用过滤条件
    results = results.filter(event => this.matchesFilter(event, filter));

    // 排序
    const sortBy = pagination?.sortBy || 'timestamp';
    const sortOrder = pagination?.sortOrder || 'desc';
    results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'severity':
          const severityOrder = ['info', 'minor', 'major', 'critical'];
          comparison = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
          break;
        case 'occurrenceCount':
          comparison = a.occurrenceCount - b.occurrenceCount;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // 分页
    if (pagination) {
      const page = pagination.page || 0;
      const pageSize = pagination.pageSize || 50;
      const start = page * pageSize;
      const end = start + pageSize;
      results = results.slice(start, end);
    }

    return results;
  }

  /**
   * 获取事件统计
   */
  getStats(): ExperienceStats {
    const stats: ExperienceStats = {
      totalEvents: this.events.size,
      eventsByType: {
        success: 0,
        failure: 0,
        pattern: 0,
        optimization: 0,
        pitfall: 0,
        solution: 0,
        insight: 0
      },
      eventsBySeverity: {
        info: 0,
        minor: 0,
        major: 0,
        critical: 0
      },
      eventsByAgent: {},
      commonPatterns: [],
      topSuccessFactors: [],
      topFailureCauses: []
    };

    // 统计事件
    for (const event of this.events.values()) {
      stats.eventsByType[event.type]++;
      stats.eventsBySeverity[event.severity]++;

      if (event.agentType) {
        stats.eventsByAgent[event.agentType] =
          (stats.eventsByAgent[event.agentType] || 0) + 1;
      }
    }

    // 提取常见模式
    const patternMap = new Map<string, number>();
    for (const event of this.events.values()) {
      for (const tag of event.tags) {
        patternMap.set(tag, (patternMap.get(tag) || 0) + 1);
      }
    }

    stats.commonPatterns = Array.from(patternMap.entries())
      .map(([pattern, count]) => ({ pattern, count, lastSeen: Date.now() }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 提取成功因素
    const successFactors = new Map<string, number>();
    for (const event of this.events.values()) {
      if (event.type === 'success' && event.details.successContext) {
        for (const factor of event.details.successContext.keyFactors) {
          successFactors.set(factor, (successFactors.get(factor) || 0) + 1);
        }
      }
    }

    stats.topSuccessFactors = Array.from(successFactors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([factor]) => factor);

    // 提取失败原因
    const failureCauses = new Map<string, number>();
    for (const event of this.events.values()) {
      if (event.type === 'failure' && event.details.failureContext) {
        const cause = event.details.failureContext.errorType;
        failureCauses.set(cause, (failureCauses.get(cause) || 0) + 1);
      }
    }

    stats.topFailureCauses = Array.from(failureCauses.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cause]) => cause);

    return stats;
  }

  /**
   * 聚合事件
   */
  aggregate(config: AggregationConfig): ExperienceEvent[] {
    if (!this.config.enableAggregation) {
      return [];
    }

    const windowMs = config.windowMs || 3600000; // 默认1小时
    const minOccurrences = config.minOccurrences || 3;
    const now = Date.now();

    // 按时间窗口分组
    const timeWindows = new Map<number, ExperienceEvent[]>();

    for (const event of this.events.values()) {
      if (event.timestamp < now - windowMs) continue;

      const windowKey = Math.floor(event.timestamp / windowMs) * windowMs;
      const windowEvents = timeWindows.get(windowKey) || [];
      windowEvents.push(event);
      timeWindows.set(windowKey, windowEvents);
    }

    const aggregated: ExperienceEvent[] = [];

    // 对每个时间窗口进行聚合
    for (const [_windowKey, events] of timeWindows) {
      // 按类型分组
      const typeGroups = new Map<ExperienceEventType, ExperienceEvent[]>();

      for (const event of events) {
        const group = typeGroups.get(event.type) || [];
        group.push(event);
        typeGroups.set(event.type, group);
      }

      // 生成聚合事件
      for (const [type, groupEvents] of typeGroups) {
        if (groupEvents.length >= minOccurrences) {
          aggregated.push(this.createAggregatedEvent(type, groupEvents));
        }
      }
    }

    logger.debug(`Aggregated ${aggregated.length} events from time windows`);

    return aggregated;
  }

  /**
   * 创建聚合事件
   */
  private createAggregatedEvent(type: ExperienceEventType, events: ExperienceEvent[]): ExperienceEvent {
    if (events.length === 0) {
      throw new Error('Cannot create aggregated event from empty events array');
    }

    const first = events[0]!;
    const last = events[events.length - 1]!;

    return {
      id: uuidv4(),
      type,
      severity: this.getAggregatedSeverity(events),
      source: 'system',
      agentType: first.agentType,
      title: this.generateAggregateTitle(type, events),
      description: `聚合了 ${events.length} 个 ${type} 事件`,
      details: {
        extra: {
          aggregatedFrom: events.map(e => e.id),
          timeRange: {
            start: first.timestamp,
            end: last.timestamp
          }
        }
      },
      metadata: {},
      timestamp: Date.now(),
      tags: ['aggregated', type],
      occurrenceCount: events.reduce((sum, e) => sum + e.occurrenceCount, 0),
      relatedEvents: events.map(e => e.id)
    };
  }

  /**
   * 获取聚合事件的严重程度
   */
  private getAggregatedSeverity(events: ExperienceEvent[]): EventSeverity {
    const severityCounts = {
      critical: 0,
      major: 0,
      minor: 0,
      info: 0
    };

    for (const event of events) {
      severityCounts[event.severity]++;
    }

    // 如果有任何一个严重事件，聚合事件也为严重
    if (severityCounts.critical > 0) return 'critical';
    if (severityCounts.major > 0) return 'major';
    if (severityCounts.minor > 0) return 'minor';
    return 'info';
  }

  /**
   * 生成聚合标题
   */
  private generateAggregateTitle(type: ExperienceEventType, events: ExperienceEvent[]): string {
    const typeNames: Record<ExperienceEventType, string> = {
      success: '批量成功',
      failure: '批量失败',
      pattern: '模式复现',
      optimization: '优化机会',
      pitfall: '常见陷阱',
      solution: '解决方案集',
      insight: '洞察发现'
    };

    return `${typeNames[type]}: ${events.length}次`;
  }

  /**
   * 清理过期事件
   */
  cleanup(): number {
    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = now - retentionMs;

    let cleaned = 0;

    for (const [id, event] of this.events) {
      if (event.timestamp < cutoffTime) {
        this.events.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired events`);
    }

    return cleaned;
  }

  /**
   * 导出事件
   */
  export(filter?: EventFilter): string {
    const events = filter ? this.search(filter) : Array.from(this.events.values());

    return JSON.stringify(events, null, 2);
  }

  /**
   * 导入事件
   */
  import(json: string): number {
    try {
      const events: ExperienceEvent[] = JSON.parse(json);
      let imported = 0;

      for (const event of events) {
        this.events.set(event.id, event);
        imported++;
      }

      logger.info(`Imported ${imported} events`);
      return imported;
    } catch (error) {
      logger.error('Failed to import events:', error);
      return 0;
    }
  }

  /**
   * 清空所有事件
   */
  clear(): void {
    this.events.clear();
    this.aggregations.clear();
    logger.info('Cleared all events');
  }

  /**
   * 销毁收集器
   */
  destroy(): void {
    this.clear();

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    logger.info('ExperienceCollector destroyed');
  }

  // ========== 私有方法 ==========

  private cleanupTimer?: NodeJS.Timeout;

  private startCleanup(): void {
    // 每天清理一次过期事件
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 24 * 60 * 60 * 1000);
  }

  private enforceMaxEvents(): void {
    if (this.events.size <= this.config.maxEvents) {
      return;
    }

    // 按时间和出现次数排序，保留重要事件
    const sorted = Array.from(this.events.values())
      .sort((a, b) => {
        // 优先保留高严重程度的
        const severityOrder = ['critical', 'major', 'minor', 'info'];
        const severityDiff = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);

        if (severityDiff !== 0) return -severityDiff;

        // 其次保留出现次数多的
        return b.occurrenceCount - a.occurrenceCount;
      });

    // 删除最旧的事件
    const toRemove = sorted.slice(0, sorted.length - this.config.maxEvents);
    for (const event of toRemove) {
      this.events.delete(event.id);
    }

    logger.debug(`Removed ${toRemove.length} events due to max limit`);
  }

  private matchesFilter(event: ExperienceEvent, filter: EventFilter): boolean {
    // 类型过滤
    if (filter.types && !filter.types.includes(event.type)) {
      return false;
    }

    // 严重程度过滤
    if (filter.severities && !filter.severities.includes(event.severity)) {
      return false;
    }

    // Agent 类型过滤
    if (filter.agentTypes && event.agentType && !filter.agentTypes.includes(event.agentType)) {
      return false;
    }

    // 标签过滤
    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tags.some(tag => event.tags.includes(tag));
      if (!hasTag) return false;
    }

    // 时间范围过滤
    if (filter.timeRange) {
      if (event.timestamp < filter.timeRange.start || event.timestamp > filter.timeRange.end) {
        return false;
      }
    }

    // 文本搜索
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      const text = `${event.title} ${event.description}`.toLowerCase();
      if (!text.includes(searchLower)) {
        return false;
      }
    }

    return true;
  }

  private getCategoryForEventType(type: ExperienceEventType): string {
    const categories: Record<ExperienceEventType, string> = {
      success: 'successes',
      failure: 'failures',
      pattern: 'patterns',
      optimization: 'optimizations',
      pitfall: 'pits',
      solution: 'solutions',
      insight: 'insights'
    };
    return categories[type] || 'general';
  }

  private eventToMarkdown(event: ExperienceEvent): string {
    const lines = [
      `---`,
      `title: "${event.title}"`,
      `category: ${this.getCategoryForEventType(event.type)}`,
      `tags: [${event.tags.map(t => `"${t}"`).join(', ')}]`,
      `severity: ${event.severity}`,
      `source: ${event.source}`,
      `agentType: ${event.agentType || 'unknown'}`,
      `occurrences: ${event.occurrenceCount}`,
      `createdAt: ${new Date(event.timestamp).toISOString()}`,
      `---`,
      ``,
      `## 描述`,
      ``,
      event.description,
      ``,
      `## 详细信息`,
      ``
    ];

    // 添加详细内容
    if (event.details.successContext) {
      lines.push('### 成功上下文');
      lines.push(`- 方法: ${event.details.successContext.approach}`);
      lines.push(`- 关键因素: ${event.details.successContext.keyFactors.join(', ')}`);
      lines.push(`- 结果: ${event.details.successContext.outcome}`);
      lines.push('');
    }

    if (event.details.failureContext) {
      lines.push('### 失败上下文');
      lines.push(`- 错误: ${event.details.failureContext.error}`);
      lines.push(`- 类型: ${event.details.failureContext.errorType}`);
      lines.push(`- 根因: ${event.details.failureContext.rootCause}`);
      lines.push('');
    }

    if (event.details.pattern) {
      lines.push('### 模式信息');
      lines.push(`- 类型: ${event.details.pattern.patternType}`);
      lines.push(`- 模式: ${event.details.pattern.pattern}`);
      lines.push(`- 置信度: ${event.details.pattern.confidence}`);
      lines.push('');
    }

    if (event.details.codeSnippet) {
      lines.push('### 代码片段');
      lines.push(`\`\`\`${event.details.codeSnippet.language}`);
      lines.push(event.details.codeSnippet.code);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateFilename(event: ExperienceEvent): string {
    const timestamp = new Date(event.timestamp);
    const dateStr = (timestamp.toISOString().split('T')[0] || '').replace(/-/g, '');
    const typePrefix = event.type.slice(0, 3);
    const hash = Math.random().toString(36).slice(2, 6);

    return `${dateStr}-${typePrefix}-${event.agentType || 'unknown'}-${hash}.md`;
  }

  private generateEmbeddingText(event: ExperienceEvent): string {
    return `${event.title}\n\n${event.description}\n\nTags: ${event.tags.join(', ')}`;
  }

  private generateMockEmbedding(text: string): number[] {
    // 简单的哈希函数生成伪嵌入向量
    const size = 128;
    const embedding: number[] = [];
    let hash = 0;

    for (let i = 0; i < size; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i % text.length);
      embedding.push((hash & 0xffff) / 0xffff);
    }

    return embedding;
  }
}
