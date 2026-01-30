/**
 * ExperienceExtractor Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExperienceExtractor, type ExtractionRule } from '../../../../src/evolution/experience/ExperienceExtractor.js';

describe('ExperienceExtractor', () => {
  let extractor: ExperienceExtractor;

  beforeEach(() => {
    extractor = new ExperienceExtractor();
  });

  describe('初始化', () => {
    it('应该创建提取器实例', () => {
      expect(extractor).toBeInstanceOf(ExperienceExtractor);
    });

    it('应该注册默认规则', () => {
      const rules = extractor.getAllRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.id === 'extract-failure')).toBe(true);
      expect(rules.some(r => r.id === 'extract-success')).toBe(true);
    });
  });

  describe('规则管理', () => {
    it('应该能够添加自定义规则', () => {
      const customRule: ExtractionRule = {
        id: 'custom-rule',
        name: 'Custom Rule',
        description: 'A custom extraction rule',
        trigger: {
          type: 'custom',
          custom: (ctx) => ctx.agentType === 'test-agent'
        },
        extractor: {
          type: 'template',
          template: {
            title: 'Custom Event',
            description: 'Custom event description',
            eventType: 'insight',
            severity: 'info',
            tags: ['custom'],
            detailsFn: () => ({ extra: { custom: true } })
          }
        }
      };

      extractor.addRule(customRule);
      const rules = extractor.getAllRules();
      expect(rules.some(r => r.id === 'custom-rule')).toBe(true);
    });

    it('应该能够移除规则', () => {
      const removed = extractor.removeRule('extract-failure');
      expect(removed).toBe(true);

      const rules = extractor.getAllRules();
      expect(rules.some(r => r.id === 'extract-failure')).toBe(false);
    });

    it('移除不存在的规则应该返回 false', () => {
      const removed = extractor.removeRule('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('经验提取', () => {
    const createContext = (overrides = {}): Parameters<typeof extractor.extract>[0] => ({
      agentType: 'test-agent',
      runResult: {
        success: true,
        output: 'Task completed successfully',
        duration: 1000,
        metadata: {}
      },
      sessionId: 'session-123',
      runId: 'run-456',
      timestamp: Date.now(),
      ...overrides
    });

    it('应该从成功结果中提取成功事件', async () => {
      const context = createContext({
        runResult: {
          success: true,
          output: 'Successfully completed the task',
          duration: 5000,
          metadata: {}
        }
      });

      const events = await extractor.extract(context);

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'success')).toBe(true);
    });

    it('应该从失败结果中提取失败事件', async () => {
      const context = createContext({
        runResult: {
          success: false,
          output: '',
          error: 'Network timeout occurred',
          duration: 30000,
          metadata: {}
        }
      });

      const events = await extractor.extract(context);

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'failure')).toBe(true);
      expect(events.some(e => e.type === 'pitfall')).toBe(true);
    });

    it('应该从慢执行中提取优化事件', async () => {
      const context = createContext({
        runResult: {
          success: true,
          output: 'Task completed',
          duration: 120000, // 2 minutes
          metadata: {}
        }
      });

      const events = await extractor.extract(context);

      expect(events.some(e => e.type === 'optimization')).toBe(true);
    });

    it('应该从包含代码的输出中提取模式事件', async () => {
      const context = createContext({
        runResult: {
          success: true,
          output: 'Here is the code:\n```typescript\nfunction test() { return true; }\n```',
          duration: 5000,
          metadata: {}
        }
      });

      const events = await extractor.extract(context);

      expect(events.some(e => e.type === 'pattern')).toBe(true);
    });

    it('应该正确解析模板变量', async () => {
      const context = createContext({
        agentType: 'MyAgent',
        runResult: {
          success: false,
          output: 'Some output',
          error: 'Test error',
          duration: 10000,
          metadata: {}
        },
        sessionId: 'test-session',
        runId: 'test-run'
      });

      const events = await extractor.extract(context);
      const failureEvent = events.find(e => e.type === 'failure');

      expect(failureEvent?.title).toContain('MyAgent');
      expect(failureEvent?.description).toContain('MyAgent');
    });

    it('应该忽略不匹配触发条件的规则', async () => {
      const context = createContext({
        agentType: 'rare-agent',
        runResult: {
          success: true,
          output: 'Done',
          duration: 5000,
          metadata: {}
        }
      });

      const events = await extractor.extract(context);
      // 应该仍然有默认成功规则提取的事件
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('函数提取器', () => {
    it('应该支持函数提取器', async () => {
      const functionRule: ExtractionRule = {
        id: 'function-extractor',
        name: 'Function Extractor',
        description: 'Test function extractor',
        trigger: {
          type: 'custom',
          custom: () => true
        },
        extractor: {
          type: 'function',
          function: (ctx) => ({
            id: 'test-id',
            type: 'insight',
            severity: 'info',
            source: 'agent',
            agentType: ctx.agentType,
            title: 'Function Generated',
            description: 'Generated by function',
            details: { extra: { func: true } },
            metadata: {},
            timestamp: Date.now(),
            tags: ['function'],
            occurrenceCount: 1
          })
        }
      };

      extractor.addRule(functionRule);

      const context = {
        agentType: 'test',
        runResult: {
          success: true,
          output: 'Test',
          duration: 1000,
          metadata: {}
        },
        sessionId: 's1',
        runId: 'r1',
        timestamp: Date.now()
      };

      const events = await extractor.extract(context);
      expect(events.some(e => e.title === 'Function Generated')).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该在提取规则出错时继续处理其他规则', async () => {
      const badRule: ExtractionRule = {
        id: 'bad-rule',
        name: 'Bad Rule',
        description: 'Throws error',
        trigger: {
          type: 'custom',
          custom: () => true
        },
        extractor: {
          type: 'function',
          function: () => {
            throw new Error('Intentional error');
          }
        }
      };

      extractor.addRule(badRule);

      const context = {
        agentType: 'test',
        runResult: {
          success: true,
          output: 'Test',
          duration: 1000,
          metadata: {}
        },
        sessionId: 's1',
        runId: 'r1',
        timestamp: Date.now()
      };

      // 不应该抛出错误，应该继续处理
      const events = await extractor.extract(context);
      // 应该仍然有其他规则提取的事件
      expect(Array.isArray(events)).toBe(true);
    });
  });
});
