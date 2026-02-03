/**
 * SkillExecutor 单元测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SkillExecutor } from '../../../src/evolution/skills/SkillExecutor.js';
import type { Skill } from '../../../src/evolution/skills/SkillTypes.js';
import type { AgentContext } from '../../../src/agent/base/types.js';

describe('SkillExecutor', () => {
  let executor: SkillExecutor;
  let mockContext: AgentContext;

  beforeEach(() => {
    executor = new SkillExecutor();
    mockContext = {
      agentId: 'test-agent',
      agentType: 'test',
      sessionId: 'test-session',
      runId: 'test-run',
      input: 'test input',
      workspace: '/tmp/test',
      tools: {},
      metadata: {}
    };
  });

  describe('validateSecurity', () => {
    it('应该检测危险的 require 调用', () => {
      const code = 'const fs = require("fs");';
      const result = executor.validateSecurity(code);
      expect(result.safe).toBe(false);
      expect(result.issues).toContain('Direct require() calls are not allowed');
    });

    it('应该检测 eval 调用', () => {
      const code = 'eval("malicious code");';
      const result = executor.validateSecurity(code);
      expect(result.safe).toBe(false);
      expect(result.issues).toContain('eval() is not allowed');
    });

    it('应该检测 process 访问', () => {
      const code = 'process.exit(1);';
      const result = executor.validateSecurity(code);
      expect(result.safe).toBe(false);
      expect(result.issues).toContain('Process access is not allowed');
    });

    it('应该允许安全的代码', () => {
      const code = 'const result = 1 + 1; return result;';
      const result = executor.validateSecurity(code);
      expect(result.safe).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('应该检测代码长度超限', () => {
      const code = 'a'.repeat(200000);
      const result = executor.validateSecurity(code);
      expect(result.safe).toBe(false);
      expect(result.issues.some(i => i.includes('too long'))).toBe(true);
    });

    it('应该检测嵌套深度超限', () => {
      const code = '{'.repeat(20) + '}'.repeat(20);
      const result = executor.validateSecurity(code);
      expect(result.safe).toBe(false);
      expect(result.issues.some(i => i.includes('nesting depth'))).toBe(true);
    });
  });

  describe('execute', () => {
    it('应该拒绝执行已废弃', async () => {
      const skill: Skill = {
        metadata: {
          name: 'test-skill',
          description: 'Test',
          version: '1.0.0',
          created: new Date().toISOString(),
          source: 'manual',
          author: 'test',
          occurrence: 1,
          confidence: 0.9,
          validation: {
            status: 'deprecated',
            score: 0,
            testResults: '',
            lastValidated: new Date().toISOString()
          },
          tags: [],
          dependencies: [],
          requirements: { bins: [], env: [] },
          cautiousFactor: 0.5,
          timesUsed: 0,
          timesSucceeded: 0,
          timesFailed: 0,
          probationThreshold: 10,
          sourceSessionIds: []
        },
        content: 'test',
        templates: new Map(),
        tests: new Map()
      };

      const result = await executor.execute(skill, {}, mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('deprecated');
    });

    it('应该在没有模板时返回错误', async () => {
      const skill: Skill = {
        metadata: {
          name: 'test-skill',
          description: 'Test',
          version: '1.0.0',
          created: new Date().toISOString(),
          source: 'manual',
          author: 'test',
          occurrence: 1,
          confidence: 0.9,
          validation: {
            status: 'validated',
            score: 1,
            testResults: '',
            lastValidated: new Date().toISOString()
          },
          tags: [],
          dependencies: [],
          requirements: { bins: [], env: [] },
          cautiousFactor: 0.5,
          timesUsed: 0,
          timesSucceeded: 0,
          timesFailed: 0,
          probationThreshold: 10,
          sourceSessionIds: []
        },
        content: 'test',
        templates: new Map(),
        tests: new Map()
      };

      const result = await executor.execute(skill, {}, mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No suitable template');
    });
  });
});
