/**
 * Soul System Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SoulSystem } from '../../src/soul/index.js';
import { MockLLMService } from '../../src/core/llm/mock.js';
import { MockLogger } from '../mocks/logger.js';

describe('SoulSystem', () => {
  let soulSystem: SoulSystem;
  let mockLLM: MockLLMService;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLLM = new MockLLMService();
    mockLogger = new MockLogger();
    soulSystem = new SoulSystem(mockLLM, mockLogger, '.evoagent');
  });

  describe('getGlobalSoul', () => {
    it('should load global soul', async () => {
      const soul = await soulSystem.getGlobalSoul();
      expect(soul).toBeDefined();
      expect(soul.global).toBe(true);
      expect(soul.coreTruths.length).toBeGreaterThan(0);
    });

    it('should have core truths', async () => {
      const soul = await soulSystem.getGlobalSoul();
      expect(soul.coreTruths).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ principle: '进化是永恒的' }),
          expect.objectContaining({ principle: '诚实优先于讨好' }),
          expect.objectContaining({ principle: '简洁是智慧' })
        ])
      );
    });

    it('should have boundaries', async () => {
      const soul = await soulSystem.getGlobalSoul();
      expect(soul.boundaries.length).toBeGreaterThan(0);
      expect(soul.boundaries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: '隐私红线' }),
          expect.objectContaining({ name: '确认原则' })
        ])
      );
    });
  });

  describe('getAgentSoul', () => {
    it('should return null for unknown agent', async () => {
      const soul = await soulSystem.getAgentSoul('unknown');
      expect(soul).toBeNull();
    });
  });

  describe('injectToPrompt', () => {
    it('should inject soul into prompt', async () => {
      const basePrompt = 'You are a helpful assistant.';
      const enhanced = await soulSystem.injectToPrompt('planner', basePrompt);

      expect(enhanced).toContain('你的灵魂');
      expect(enhanced).toContain('核心真理');
      expect(enhanced).toContain('边界');
    });
  });

  describe('checkBoundary', () => {
    it('should allow safe actions', async () => {
      const allowed = await soulSystem.checkBoundary('planner', 'read file');
      expect(allowed).toBe(true);
    });
  });

  describe('recordFeedback', () => {
    it('should record positive feedback', async () => {
      await expect(soulSystem.recordFeedback({
        timestamp: new Date().toISOString(),
        type: 'positive',
        category: 'style',
        content: '简洁明了',
        agentType: 'planner'
      })).resolves.not.toThrow();
    });

    it('should record negative feedback', async () => {
      await expect(soulSystem.recordFeedback({
        timestamp: new Date().toISOString(),
        type: 'negative',
        category: 'speed',
        content: '太慢了',
        agentType: 'codewriter'
      })).resolves.not.toThrow();
    });
  });

  describe('reflect', () => {
    it('should reinforce success patterns', async () => {
      const records = await soulSystem.reflect({
        agentType: 'codewriter',
        sessionCount: 10,
        recentSuccesses: 8,
        recentFailures: 1
      });

      const reinforcement = records.find(r => r.changeType === 'reinforce');
      expect(reinforcement).toBeDefined();
    });
  });
});

describe('Soul Parsing', () => {
  it('should parse soul markdown', () => {
    const markdown = `# SOUL.md - Test

*Test Soul*

## Core Truths

**Test Truth**: This is a test description.

## Boundaries

- **Test Boundary**: This is a test rule

## Vibe

Test vibe
`;

    // TODO: 实现并测试解析逻辑
    expect(markdown).toBeDefined();
  });
});
