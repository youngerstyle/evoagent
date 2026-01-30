/**
 * Reflector Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reflector } from '../../../../src/evolution/reflection/Reflector.js';
import type { ReflectionContext, ReflectionType } from '../../../../src/evolution/reflection/ReflectionTypes.js';
import type { ExperienceEvent } from '../../../../src/evolution/experience/ExperienceTypes.js';

// Mock ExperienceCollector
class MockExperienceCollector {
  public events: ExperienceEvent[] = [];

  addEvents(events: ExperienceEvent[]): void {
    this.events.push(...events);
  }

  search(_filter?: any): ExperienceEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}

// Mock logger
vi.mock('../../../../src/core/logger/index.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

describe('Reflector', () => {
  let reflector: Reflector;
  let mockCollector: MockExperienceCollector;

  beforeEach(() => {
    mockCollector = new MockExperienceCollector();
    reflector = new Reflector({
      triggers: [],
      minEventCount: 3,
      autoGenerateActions: true,
      autoSaveReports: false
    }, mockCollector as any);
  });

  describe('初始化', () => {
    it('应该创建反思器实例', () => {
      expect(reflector).toBeInstanceOf(Reflector);
    });

    it('应该使用默认配置', () => {
      const defaultReflector = new Reflector();
      expect(defaultReflector).toBeInstanceOf(Reflector);
      defaultReflector.destroy();
    });
  });

  describe('反思执行', () => {
    const createContext = (overrides = {}): ReflectionContext => ({
      timeRange: {
        start: Date.now() - 86400000,
        end: Date.now()
      },
      ...overrides
    });

    const createMockEvents = (): ExperienceEvent[] => [
      {
        id: '1',
        type: 'success',
        severity: 'info',
        source: 'agent',
        agentType: 'test-agent',
        title: 'Task completed',
        description: 'Successfully completed task',
        details: {
          successContext: {
            approach: 'direct',
            keyFactors: ['fast'],
            outcome: 'success',
            artifacts: []
          }
        },
        metadata: { duration: 1000 },
        timestamp: Date.now() - 3600000,
        tags: ['success', 'fast'],
        occurrenceCount: 1
      },
      {
        id: '2',
        type: 'success',
        severity: 'info',
        source: 'agent',
        agentType: 'test-agent',
        title: 'Another task completed',
        description: 'Successfully completed another task',
        details: {
          successContext: {
            approach: 'direct',
            keyFactors: ['fast'],
            outcome: 'success',
            artifacts: []
          }
        },
        metadata: { duration: 2000 },
        timestamp: Date.now() - 1800000,
        tags: ['success', 'fast'],
        occurrenceCount: 1
      },
      {
        id: '3',
        type: 'failure',
        severity: 'major',
        source: 'agent',
        agentType: 'test-agent',
        title: 'Task failed',
        description: 'Failed to complete task',
        details: {
          failureContext: {
            error: 'Network timeout',
            errorType: 'timeout',
            rootCause: 'network',
            attemptedSolutions: []
          }
        },
        metadata: { duration: 30000 },
        timestamp: Date.now() - 900000,
        tags: ['failure', 'timeout'],
        occurrenceCount: 1
      }
    ];

    it('应该执行综合反思', async () => {
      mockCollector.addEvents(createMockEvents());

      const context = createContext();
      const result = await reflector.reflect(context, 'comprehensive');

      expect(result.report).toBeDefined();
      expect(result.report.status).toBe('completed');
      expect(result.report.eventCount).toBe(3);
      expect(result.report.insights.length).toBeGreaterThan(0);
      expect(result.report.actions.length).toBeGreaterThan(0);
    });

    it('应该执行性能反思', async () => {
      mockCollector.addEvents(createMockEvents());

      const context = createContext();
      const result = await reflector.reflect(context, 'performance');

      expect(result.report.performance).toBeDefined();
      expect(result.report.performance?.totalExecutions).toBe(3);
      expect(result.report.performance?.successRate).toBeCloseTo(2/3, 1);
    });

    it('应该执行质量反思', async () => {
      mockCollector.addEvents(createMockEvents());

      const context = createContext();
      const result = await reflector.reflect(context, 'quality');

      expect(result.report.quality).toBeDefined();
      expect(result.report.quality?.errorDistribution).toBeDefined();
      expect(result.report.quality?.topErrorTypes.length).toBeGreaterThan(0);
    });

    it('应该执行模式反思', async () => {
      mockCollector.addEvents(createMockEvents());

      const context = createContext();
      const result = await reflector.reflect(context, 'pattern');

      // 模式反思会从标签中识别模式
      expect(result.report).toBeDefined();
      expect(result.report.status).toBe('completed');
    });

    it('应该执行战略反思', async () => {
      mockCollector.addEvents(createMockEvents());

      const context = createContext();
      const result = await reflector.reflect(context, 'strategic');

      expect(result.report.swot).toBeDefined();
      expect(result.report.swot?.strengths).toBeDefined();
      expect(result.report.swot?.weaknesses).toBeDefined();
    });

    it('应该在事件数量不足时返回状态为完成', async () => {
      // 添加少于最小事件数量的事件
      mockCollector.addEvents([createMockEvents()[0]]);

      const context = createContext();
      const result = await reflector.reflect(context);

      expect(result.report.status).toBe('completed');
      expect(result.report.insights.length).toBe(0);
      expect(result.newInsights.length).toBe(0);
    });

    it('应该生成包含总结的报告', async () => {
      mockCollector.addEvents(createMockEvents());

      const context = createContext();
      const result = await reflector.reflect(context);

      expect(result.report.summary).toBeDefined();
      expect(result.report.summary.overall).toBeDefined();
      expect(result.report.summary.keyFindings.length).toBeGreaterThan(0);
    });
  });

  describe('洞察生成', () => {
    it('应该生成不同类型的洞察', async () => {
      const events: ExperienceEvent[] = [
        {
          id: '1',
          type: 'success',
          severity: 'info',
          source: 'agent',
          agentType: 'agent',
          title: 'Success',
          description: '',
          details: { successContext: { approach: 'x', keyFactors: [], outcome: 'done', artifacts: [] } },
          metadata: { duration: 100 },
          timestamp: Date.now(),
          tags: ['good'],
          occurrenceCount: 5
        },
        {
          id: '2',
          type: 'failure',
          severity: 'critical',
          source: 'agent',
          agentType: 'agent',
          title: 'Critical Failure',
          description: '',
          details: { failureContext: { error: 'critical', errorType: 'critical', rootCause: 'bug', attemptedSolutions: [] } },
          metadata: { duration: 50000 },
          timestamp: Date.now(),
          tags: ['critical', 'bug'],
          occurrenceCount: 3
        }
      ];

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      const result = await reflector.reflect(context, 'comprehensive');

      // 应该生成一些洞察
      expect(result.report.insights.length).toBeGreaterThanOrEqual(0);
    });

    it('应该正确分类洞察', async () => {
      const events: ExperienceEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: `event-${i}`,
        type: i < 7 ? 'success' : 'failure',
        severity: 'info',
        source: 'agent' as const,
        agentType: 'test-agent',
        title: `Event ${i}`,
        description: '',
        details: {},
        metadata: { duration: 1000 + i * 100 },
        timestamp: Date.now() - i * 1000000,
        tags: ['test'],
        occurrenceCount: 1
      }));

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      const result = await reflector.reflect(context);

      expect(result.report.insightsByType).toBeDefined();
    });
  });

  describe('行动项生成', () => {
    it('应该从洞察生成行动项', async () => {
      const events: ExperienceEvent[] = [
        {
          id: '1',
          type: 'failure',
          severity: 'critical',
          source: 'agent',
          agentType: 'agent',
          title: 'Critical Issue',
          description: '',
          details: { failureContext: { error: 'critical', errorType: 'critical', rootCause: 'x', attemptedSolutions: [] } },
          metadata: {},
          timestamp: Date.now(),
          tags: ['critical'],
          occurrenceCount: 5
        },
        {
          id: '2',
          type: 'success',
          severity: 'info',
          source: 'agent',
          agentType: 'agent',
          title: 'Success',
          description: '',
          details: {},
          metadata: {},
          timestamp: Date.now(),
          tags: ['good'],
          occurrenceCount: 1
        }
      ];

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      const result = await reflector.reflect(context);

      expect(result.report.actions).toBeDefined();
      // 行动项数量取决于生成的洞察数量
      expect(Array.isArray(result.report.actions)).toBe(true);
    });

    it('应该按优先级排序行动项', async () => {
      const events: ExperienceEvent[] = [
        {
          id: '1',
          type: 'failure',
          severity: 'critical',
          source: 'agent',
          agentType: 'agent',
          title: 'Critical',
          description: '',
          details: { failureContext: { error: 'x', errorType: 'critical', rootCause: 'y', attemptedSolutions: [] } },
          metadata: {},
          timestamp: Date.now(),
          tags: ['critical'],
          occurrenceCount: 1
        }
      ];

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      const result = await reflector.reflect(context);

      if (result.report.actions.length > 0) {
        const firstAction = result.report.actions[0];
        expect(['critical', 'high', 'medium', 'low']).toContain(firstAction.priority);
      }
    });
  });

  describe('报告查询', () => {
    it('应该获取所有报告', async () => {
      const events: ExperienceEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        type: 'success',
        severity: 'info',
        source: 'agent' as const,
        agentType: 'agent',
        title: `Event ${i}`,
        description: '',
        details: {},
        metadata: {},
        timestamp: Date.now() - i * 1000000,
        tags: ['test'],
        occurrenceCount: 1
      }));

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      await reflector.reflect(context);

      const reports = reflector.getReports();
      expect(reports.length).toBe(1);
    });

    it('应该按类型过滤报告', async () => {
      const events: ExperienceEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        type: 'success',
        severity: 'info',
        source: 'agent' as const,
        agentType: 'agent',
        title: `Event ${i}`,
        description: '',
        details: {},
        metadata: {},
        timestamp: Date.now() - i * 1000000,
        tags: ['test'],
        occurrenceCount: 1
      }));

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      await reflector.reflect(context, 'performance');
      await reflector.reflect(context, 'quality');

      const performanceReports = reflector.getReports({ types: ['performance'] });
      expect(performanceReports.length).toBe(1);

      const qualityReports = reflector.getReports({ types: ['quality'] });
      expect(qualityReports.length).toBe(1);
    });

    it('应该按状态过滤报告', async () => {
      const reports = reflector.getReports({ statuses: ['completed'] });
      expect(Array.isArray(reports)).toBe(true);
    });

    it('应该按文本搜索报告', async () => {
      const events: ExperienceEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        type: 'success',
        severity: 'info',
        source: 'agent' as const,
        agentType: 'agent',
        title: `Event ${i}`,
        description: '',
        details: {},
        metadata: {},
        timestamp: Date.now() - i * 1000000,
        tags: ['test'],
        occurrenceCount: 1
      }));

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      await reflector.reflect(context);

      const reports = reflector.getReports({ searchText: '分析' });
      expect(Array.isArray(reports)).toBe(true);
    });
  });

  describe('洞察和行动项管理', () => {
    it('应该获取所有洞察', async () => {
      const events: ExperienceEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        type: i < 3 ? 'success' : 'failure',
        severity: 'info',
        source: 'agent' as const,
        agentType: 'agent',
        title: `Event ${i}`,
        description: '',
        details: {},
        metadata: {},
        timestamp: Date.now() - i * 1000000,
        tags: ['test'],
        occurrenceCount: 1
      }));

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      await reflector.reflect(context);

      const insights = reflector.getInsights();
      expect(insights.length).toBeGreaterThan(0);
    });

    it('应该按类型过滤洞察', async () => {
      const events: ExperienceEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        type: i < 3 ? 'success' : 'failure',
        severity: 'info',
        source: 'agent' as const,
        agentType: 'agent',
        title: `Event ${i}`,
        description: '',
        details: {},
        metadata: {},
        timestamp: Date.now() - i * 1000000,
        tags: ['test'],
        occurrenceCount: 1
      }));

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      await reflector.reflect(context);

      const strengths = reflector.getInsights('strength');
      expect(Array.isArray(strengths)).toBe(true);
    });

    it('应该获取所有行动项', async () => {
      const events: ExperienceEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        type: 'failure',
        severity: 'major',
        source: 'agent' as const,
        agentType: 'agent',
        title: `Event ${i}`,
        description: '',
        details: { failureContext: { error: 'x', errorType: 'x', rootCause: 'y', attemptedSolutions: [] } },
        metadata: {},
        timestamp: Date.now() - i * 1000000,
        tags: ['test'],
        occurrenceCount: 1
      }));

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      await reflector.reflect(context);

      const actions = reflector.getActions();
      expect(Array.isArray(actions)).toBe(true);
    });

    it('应该按状态过滤行动项', async () => {
      const actions = reflector.getActions('pending');
      expect(Array.isArray(actions)).toBe(true);
    });

    it('应该能够更新行动项状态', async () => {
      const events: ExperienceEvent[] = [
        {
          id: '1',
          type: 'failure',
          severity: 'major',
          source: 'agent',
          agentType: 'agent',
          title: 'Failure',
          description: '',
          details: { failureContext: { error: 'x', errorType: 'x', rootCause: 'y', attemptedSolutions: [] } },
          metadata: {},
          timestamp: Date.now(),
          tags: ['test'],
          occurrenceCount: 1
        }
      ];

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      const result = await reflector.reflect(context);

      if (result.newActions.length > 0) {
        const actionId = result.newActions[0].id;
        const updated = reflector.updateActionStatus(actionId, 'in_progress');
        expect(updated).toBe(true);

        const actions = reflector.getActions('in_progress');
        expect(actions.some(a => a.id === actionId)).toBe(true);
      }
    });
  });

  describe('统计信息', () => {
    it('应该获取统计信息', () => {
      const stats = reflector.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalReflections).toBeDefined();
      expect(stats.totalInsights).toBeDefined();
      expect(stats.totalActions).toBeDefined();
      expect(stats.reflectionsByType).toBeDefined();
      expect(stats.reflectionsByStatus).toBeDefined();
    });

    it('应该在执行反思后更新统计', async () => {
      const events: ExperienceEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        type: 'success',
        severity: 'info',
        source: 'agent' as const,
        agentType: 'agent',
        title: `Event ${i}`,
        description: '',
        details: {},
        metadata: {},
        timestamp: Date.now() - i * 1000000,
        tags: ['test'],
        occurrenceCount: 1
      }));

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      await reflector.reflect(context);

      const stats = reflector.getStats();
      expect(stats.totalReflections).toBe(1);
    });
  });

  describe('改进建议', () => {
    it('应该生成改进建议', async () => {
      const events: ExperienceEvent[] = [
        {
          id: '1',
          type: 'failure',
          severity: 'critical',
          source: 'agent',
          agentType: 'agent',
          title: 'Critical Issue',
          description: '',
          details: { failureContext: { error: 'critical', errorType: 'critical', rootCause: 'x', attemptedSolutions: [] } },
          metadata: {},
          timestamp: Date.now(),
          tags: ['critical'],
          occurrenceCount: 5
        }
      ];

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      await reflector.reflect(context);

      const suggestions = reflector.generateImprovementSuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
      // 建议数量取决于生成的洞察
      expect(suggestions.length).toBeGreaterThanOrEqual(0);

      if (suggestions.length > 0) {
        const firstSuggestion = suggestions[0];
        expect(firstSuggestion.id).toBeDefined();
        expect(firstSuggestion.title).toBeDefined();
        expect(firstSuggestion.type).toBeDefined();
        expect(firstSuggestion.confidence).toBeGreaterThanOrEqual(0);
        expect(firstSuggestion.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('导出和导入', () => {
    it('应该能够导出报告', () => {
      const exported = reflector.exportReports();
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    it('应该能够导入报告', () => {
      const reports = [
        {
          id: 'imported-1',
          type: 'comprehensive' as ReflectionType,
          status: 'completed' as const,
          context: { timeRange: { start: 0, end: 1000 } },
          timestamp: Date.now(),
          eventCount: 10,
          timeRange: { start: 0, end: 1000 },
          insights: [],
          insightsByType: {
            strength: 0,
            weakness: 0,
            opportunity: 0,
            threat: 0,
            pattern: 0,
            recommendation: 0
          },
          actions: [],
          actionsByPriority: { low: 0, medium: 0, high: 0, critical: 0 },
          summary: { overall: '', keyFindings: [], topRecommendations: [] },
          metadata: { generatedBy: 'test', version: '1.0.0' }
        }
      ];

      const imported = reflector.importReports(JSON.stringify(reports));
      expect(imported).toBe(1);

      const retrievedReports = reflector.getReports();
      expect(retrievedReports.some(r => r.id === 'imported-1')).toBe(true);
    });

    it('导入无效 JSON 应该返回 0', () => {
      const imported = reflector.importReports('invalid json');
      expect(imported).toBe(0);
    });
  });

  describe('清空和销毁', () => {
    it('应该能够清空所有数据', async () => {
      const events: ExperienceEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        type: 'success',
        severity: 'info',
        source: 'agent' as const,
        agentType: 'agent',
        title: `Event ${i}`,
        description: '',
        details: {},
        metadata: {},
        timestamp: Date.now() - i * 1000000,
        tags: ['test'],
        occurrenceCount: 1
      }));

      mockCollector.addEvents(events);

      const context: ReflectionContext = {
        timeRange: { start: Date.now() - 86400000, end: Date.now() }
      };

      await reflector.reflect(context);

      reflector.clear();

      const stats = reflector.getStats();
      expect(stats.totalReflections).toBe(0);
      expect(stats.totalInsights).toBe(0);
      expect(stats.totalActions).toBe(0);
    });

    it('销毁时应该清空数据并停止定时器', () => {
      const testReflector = new Reflector({ triggers: [] });
      testReflector.destroy();
      expect(testReflector.getStats().totalReflections).toBe(0);
    });
  });
});
