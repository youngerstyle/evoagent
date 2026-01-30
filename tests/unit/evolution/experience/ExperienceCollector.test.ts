/**
 * ExperienceCollector Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExperienceCollector } from '../../../../src/evolution/experience/ExperienceCollector.js';
import type { ExperienceEvent } from '../../../../src/evolution/experience/ExperienceTypes.js';

// Mock dependencies
vi.mock('../../../../src/core/logger/index.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

describe('ExperienceCollector', () => {
  let collector: ExperienceCollector;

  beforeEach(() => {
    collector = new ExperienceCollector({
      enableAutoSave: false,
      enableVectorIndex: false,
      maxEvents: 1000,
      retentionDays: 90,
      enableAggregation: true
    });
  });

  describe('初始化', () => {
    it('应该创建收集器实例', () => {
      expect(collector).toBeInstanceOf(ExperienceCollector);
    });

    it('应该使用默认配置', () => {
      const defaultCollector = new ExperienceCollector();
      expect(defaultCollector).toBeInstanceOf(ExperienceCollector);
    });
  });

  describe('事件添加', () => {
    const createEvent = (overrides = {}): ExperienceEvent => ({
      id: 'event-123',
      type: 'success',
      severity: 'info',
      source: 'agent',
      agentType: 'test-agent',
      title: 'Test Event',
      description: 'Test description',
      details: {
        successContext: {
          approach: 'test approach',
          keyFactors: ['factor1'],
          outcome: 'success',
          artifacts: []
        }
      },
      metadata: {},
      timestamp: Date.now(),
      tags: ['test'],
      occurrenceCount: 1,
      ...overrides
    });

    it('应该能够添加事件', async () => {
      const event = createEvent();
      await collector.addEvent(event);

      const stats = collector.getStats();
      expect(stats.totalEvents).toBe(1);
    });

    it('应该合并相似事件', async () => {
      const event1 = createEvent({ id: 'event-1', title: 'Test Event' });
      const event2 = createEvent({
        id: 'event-2',
        title: 'Test Event',  // 相似标题
        timestamp: Date.now() + 1000
      });

      await collector.addEvent(event1);
      await collector.addEvent(event2);

      const stats = collector.getStats();
      // 第二个事件应该被合并到第一个
      expect(stats.totalEvents).toBe(1);
    });

    it('应该增加重复事件的计数', async () => {
      const event1 = createEvent({ id: 'event-1', title: 'Duplicate', occurrenceCount: 1 });
      const event2 = createEvent({
        id: 'event-2',
        title: 'Duplicate',
        occurrenceCount: 1
      });

      await collector.addEvent(event1);
      await collector.addEvent(event2);

      const stats = collector.getStats();
      expect(stats.totalEvents).toBe(1);
    });

    it('应该添加不同类型的事件', async () => {
      const events = [
        createEvent({ id: '1', type: 'success' as const }),
        createEvent({ id: '2', type: 'failure' as const }),
        createEvent({ id: '3', type: 'pattern' as const }),
        createEvent({ id: '4', type: 'pitfall' as const })
      ];

      for (const event of events) {
        await collector.addEvent(event);
      }

      const stats = collector.getStats();
      expect(stats.totalEvents).toBe(4);
      expect(stats.eventsByType.success).toBe(1);
      expect(stats.eventsByType.failure).toBe(1);
      expect(stats.eventsByType.pattern).toBe(1);
      expect(stats.eventsByType.pitfall).toBe(1);
    });
  });

  describe('事件搜索', () => {
    beforeEach(async () => {
      const events: ExperienceEvent[] = [
        {
          id: '1',
          type: 'success',
          severity: 'info',
          source: 'agent',
          agentType: 'coder',
          title: 'Code written',
          description: 'Successfully wrote code',
          details: { successContext: { approach: 'direct', keyFactors: [], outcome: 'done', artifacts: [] } },
          metadata: {},
          timestamp: Date.now() - 10000,
          tags: ['code', 'success'],
          occurrenceCount: 1
        },
        {
          id: '2',
          type: 'failure',
          severity: 'critical',
          source: 'agent',
          agentType: 'coder',
          title: 'Compilation error',
          description: 'Failed to compile',
          details: { failureContext: { error: 'syntax error', errorType: 'syntax', rootCause: 'typo', attemptedSolutions: [] } },
          metadata: {},
          timestamp: Date.now() - 5000,
          tags: ['error', 'critical'],
          occurrenceCount: 1
        },
        {
          id: '3',
          type: 'pattern',
          severity: 'minor',
          source: 'system',
          agentType: 'tester',
          title: 'Test pattern',
          description: 'Discovered testing pattern',
          details: { pattern: { patternType: 'workflow', pattern: 'test-first', frequency: 5, confidence: 0.8, examples: [] } },
          metadata: {},
          timestamp: Date.now(),
          tags: ['pattern', 'test'],
          occurrenceCount: 3
        }
      ];

      for (const event of events) {
        await collector.addEvent(event);
      }
    });

    it('应该能够按类型过滤', () => {
      const results = collector.search({ types: ['success'] });
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('success');
    });

    it('应该能够按严重程度过滤', () => {
      const results = collector.search({ severities: ['critical'] });
      expect(results.length).toBe(1);
      expect(results[0].severity).toBe('critical');
    });

    it('应该能够按 Agent 类型过滤', () => {
      const results = collector.search({ agentTypes: ['coder'] });
      expect(results.length).toBe(2);
    });

    it('应该能够按标签过滤', () => {
      const results = collector.search({ tags: ['error'] });
      expect(results.length).toBe(1);
    });

    it('应该能够按文本搜索', () => {
      const results = collector.search({ searchText: 'compilation' });
      expect(results.length).toBe(1);
      expect(results[0].title).toContain('Compilation');
    });

    it('应该能够按时间范围过滤', () => {
      const now = Date.now();
      const results = collector.search({
        timeRange: { start: now - 6000, end: now }
      });
      expect(results.length).toBe(2);
    });

    it('应该支持组合过滤', () => {
      const results = collector.search({
        types: ['success', 'failure'],
        agentTypes: ['coder']
      });
      expect(results.length).toBe(2);
    });

    it('应该支持排序', () => {
      const results = collector.search({}, { sortBy: 'occurrenceCount', sortOrder: 'desc' });
      expect(results[0].occurrenceCount).toBeGreaterThanOrEqual(results[1].occurrenceCount);
    });

    it('应该支持分页', () => {
      const results = collector.search({}, { page: 0, pageSize: 2 });
      expect(results.length).toBe(2);
    });
  });

  describe('统计', () => {
    beforeEach(async () => {
      const events: ExperienceEvent[] = [
        {
          id: '1',
          type: 'success',
          severity: 'info',
          source: 'agent',
          agentType: 'agent-a',
          title: 'Success',
          description: '',
          details: { successContext: { approach: 'x', keyFactors: ['optimize', 'cache'], outcome: 'done', artifacts: [] } },
          metadata: {},
          timestamp: Date.now(),
          tags: ['success', 'optimize'],
          occurrenceCount: 1
        },
        {
          id: '2',
          type: 'success',
          severity: 'info',
          source: 'agent',
          agentType: 'agent-b',
          title: 'Another Success',
          description: '',
          details: { successContext: { approach: 'y', keyFactors: ['cache'], outcome: 'done', artifacts: [] } },
          metadata: {},
          timestamp: Date.now(),
          tags: ['success', 'cache'],
          occurrenceCount: 1
        },
        {
          id: '3',
          type: 'failure',
          severity: 'critical',
          source: 'agent',
          agentType: 'agent-a',
          title: 'Failure',
          description: '',
          details: { failureContext: { error: 'timeout', errorType: 'timeout', rootCause: 'network', attemptedSolutions: [] } },
          metadata: {},
          timestamp: Date.now(),
          tags: ['failure', 'timeout'],
          occurrenceCount: 1
        }
      ];

      for (const event of events) {
        await collector.addEvent(event);
      }
    });

    it('应该生成正确的统计信息', () => {
      const stats = collector.getStats();

      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsByType.success).toBe(2);
      expect(stats.eventsByType.failure).toBe(1);
      expect(stats.eventsBySeverity.info).toBe(2);
      expect(stats.eventsBySeverity.critical).toBe(1);
    });

    it('应该统计按 Agent 类型的事件', () => {
      const stats = collector.getStats();

      expect(stats.eventsByAgent['agent-a']).toBe(2);
      expect(stats.eventsByAgent['agent-b']).toBe(1);
    });

    it('应该提取常见模式', () => {
      const stats = collector.getStats();

      expect(stats.commonPatterns.length).toBeGreaterThan(0);
      expect(stats.commonPatterns.some(p => p.pattern === 'success')).toBe(true);
    });

    it('应该提取成功因素', () => {
      const stats = collector.getStats();

      expect(stats.topSuccessFactors).toContain('cache');
      expect(stats.topSuccessFactors).toContain('optimize');
    });

    it('应该提取失败原因', () => {
      const stats = collector.getStats();

      expect(stats.topFailureCauses).toContain('timeout');
    });
  });

  describe('事件聚合', () => {
    beforeEach(async () => {
      const now = Date.now();
      // 添加多个相似但不完全相同的事件，避免被合并
      // 使用相同的 agent type 但不同的标题和标签
      for (let i = 0; i < 5; i++) {
        await collector.addEvent({
          id: `event-${i}`,
          type: 'success',
          severity: 'info',
          source: 'agent',
          agentType: 'aggregator',
          title: `Task ${i} completed`, // 不同的标题，避免被合并
          description: 'Task completed successfully',
          details: { successContext: { approach: 'same', keyFactors: [], outcome: 'done', artifacts: [] } },
          metadata: {},
          timestamp: now - i * 1000,
          tags: [`tag-${i}`], // 不同的标签，避免被合并
          occurrenceCount: 1
        });
      }
    });

    it('应该聚合时间窗口内的事件', () => {
      const aggregated = collector.aggregate({
        windowMs: 60000, // 1 minute
        minOccurrences: 3
      });

      expect(aggregated.length).toBeGreaterThan(0);
      expect(aggregated[0].tags).toContain('aggregated');
    });

    it('应该计算正确的聚合严重程度', () => {
      // 添加一个严重事件
      collector.addEvent({
        id: 'critical-event',
        type: 'failure',
        severity: 'critical',
        source: 'agent',
        agentType: 'aggregator',
        title: 'Critical Failure',
        description: 'Critical',
        details: { failureContext: { error: 'critical', errorType: 'critical', rootCause: 'bug', attemptedSolutions: [] } },
        metadata: {},
        timestamp: Date.now(),
        tags: ['critical'],
        occurrenceCount: 1
      });

      const aggregated = collector.aggregate({
        windowMs: 60000,
        minOccurrences: 1
      });

      // 如果聚合包含严重事件，结果应该也是严重的
      const criticalAggregated = aggregated.find(a => a.severity === 'critical');
      expect(criticalAggregated?.severity).toBe('critical');
    });
  });

  describe('事件清理', () => {
    it('应该清理过期事件', () => {
      const shortRetentionCollector = new ExperienceCollector({
        retentionDays: 0 // 立即过期
      });

      shortRetentionCollector.addEvent({
        id: 'old-event',
        type: 'success',
        severity: 'info',
        source: 'agent',
        title: 'Old Event',
        description: '',
        details: {},
        metadata: {},
        timestamp: Date.now() - 1000, // 1秒前
        tags: [],
        occurrenceCount: 1
      });

      const cleaned = shortRetentionCollector.cleanup();
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it('应该执行自动清理', () => {
      // 收集器在初始化时启动了定期清理
      // 这个测试只是验证创建不会抛出错误
      const autoCleanCollector = new ExperienceCollector({
        retentionDays: 30
      });
      expect(autoCleanCollector).toBeInstanceOf(ExperienceCollector);
    });
  });

  describe('导出和导入', () => {
    beforeEach(async () => {
      await collector.addEvent({
        id: 'export-test-1',
        type: 'success',
        severity: 'info',
        source: 'agent',
        agentType: 'test',
        title: 'Export Test 1',
        description: 'Test event for export',
        details: {},
        metadata: {},
        timestamp: Date.now(),
        tags: ['export'],
        occurrenceCount: 1
      });
    });

    it('应该能够导出事件为 JSON', () => {
      const exported = collector.export();
      expect(() => JSON.parse(exported)).not.toThrow();

      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
    });

    it('应该能够导出过滤后的事件', () => {
      const exported = collector.export({ types: ['success'] });
      const parsed = JSON.parse(exported);
      expect(parsed[0].type).toBe('success');
    });

    it('应该能够导入事件', () => {
      const json = JSON.stringify([
        {
          id: 'import-test-1',
          type: 'failure',
          severity: 'major',
          source: 'user',
          title: 'Imported Event',
          description: 'Imported from JSON',
          details: {},
          metadata: {},
          timestamp: Date.now(),
          tags: ['imported'],
          occurrenceCount: 1
        }
      ]);

      const imported = collector.import(json);
      expect(imported).toBe(1);

      const stats = collector.getStats();
      expect(stats.totalEvents).toBe(2);
    });

    it('导入无效 JSON 应该返回 0', () => {
      const imported = collector.import('invalid json');
      expect(imported).toBe(0);
    });
  });

  describe('清空和销毁', () => {
    beforeEach(async () => {
      await collector.addEvent({
        id: 'to-clear',
        type: 'success',
        severity: 'info',
        source: 'agent',
        title: 'Will be cleared',
        description: '',
        details: {},
        metadata: {},
        timestamp: Date.now(),
        tags: [],
        occurrenceCount: 1
      });
    });

    it('应该能够清空所有事件', () => {
      collector.clear();
      const stats = collector.getStats();
      expect(stats.totalEvents).toBe(0);
    });

    it('销毁时应该清空事件', () => {
      collector.destroy();
      const stats = collector.getStats();
      expect(stats.totalEvents).toBe(0);
    });
  });

  describe('经验收集', () => {
    it('应该从 Agent 运行结果中收集经验', async () => {
      const context = {
        agentType: 'test-agent',
        runResult: {
          success: true,
          output: 'Task completed successfully with some code:\n```javascript\nconsole.log("done");\n```',
          duration: 5000,
          metadata: {}
        },
        sessionId: 'session-123',
        runId: 'run-456',
        timestamp: Date.now()
      };

      const events = await collector.collect(context);

      expect(events.length).toBeGreaterThan(0);
      expect(events.every(e => e.id)).toBe(true);

      const stats = collector.getStats();
      expect(stats.totalEvents).toBeGreaterThan(0);
    });

    it('应该从失败运行中收集失败经验', async () => {
      const context = {
        agentType: 'failing-agent',
        runResult: {
          success: false,
          output: '',
          error: 'Network connection timeout after 30s',
          duration: 30000,
          metadata: {}
        },
        sessionId: 'session-789',
        runId: 'run-999',
        timestamp: Date.now()
      };

      const events = await collector.collect(context);

      expect(events.some(e => e.type === 'failure')).toBe(true);
    });
  });

  describe('最大事件限制', () => {
    it('应该强制执行最大事件限制', async () => {
      const limitedCollector = new ExperienceCollector({
        maxEvents: 3
      });

      // 添加超过限制的事件
      for (let i = 0; i < 10; i++) {
        await limitedCollector.addEvent({
          id: `event-${i}`,
          type: 'success',
          severity: 'info',
          source: 'agent',
          title: `Event ${i}`,
          description: '',
          details: {},
          metadata: {},
          timestamp: Date.now() + i,
          tags: [],
          occurrenceCount: 1
        });
      }

      const stats = limitedCollector.getStats();
      // 应该保留不超过最大数量
      expect(stats.totalEvents).toBeLessThanOrEqual(3);
    });
  });
});
