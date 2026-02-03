/**
 * SkillDependencyResolver 单元测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SkillDependencyResolver } from '../../../src/evolution/skills/SkillDependencyResolver.js';
import { SkillStore } from '../../../src/evolution/skills/SkillStore.js';
import type { Skill } from '../../../src/evolution/skills/SkillTypes.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('SkillDependencyResolver', () => {
  let resolver: SkillDependencyResolver;
  let store: SkillStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `evoagent-dep-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    store = new SkillStore(testDir);
    await store.init();
    resolver = new SkillDependencyResolver(store);
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const createTestSkill = (name: string, dependencies: string[] = []): Skill => ({
    metadata: {
      name,
      description: 'Test skill',
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
      dependencies,
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
  });

  describe('validateDependencies', () => {
    it('应该验证无依赖的技能', async () => {
      const skill = createTestSkill('skill-a');
      await store.saveSkill(skill);

      const result = await resolver.validateDependencies('skill-a');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.executionOrder).toEqual(['skill-a']);
    });

    it('应该验证简单的依赖链', async () => {
      const skillA = createTestSkill('skill-a');
      const skillB = createTestSkill('skill-b', ['skill-a']);

      await store.saveSkill(skillA);
      await store.saveSkill(skillB);

      const result = await resolver.validateDependencies('skill-b');
      expect(result.valid).toBe(true);
      expect(result.executionOrder).toEqual(['skill-a', 'skill-b']);
    });

    it('应该检测缺失的依赖', async () => {
      const skill = createTestSkill('skill-a', ['missing-skill']);
      await store.saveSkill(skill);

      const result = await resolver.validateDependencies('skill-a');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('not found'))).toBe(true);
    });

    it('应该检测循环依赖', async () => {
      const skillA = createTestSkill('skill-a', ['skill-b']);
      const skillB = createTestSkill('skill-b', ['skill-a']);

      await store.saveSkill(skillA);
      await store.saveSkill(skillB);

      const result = await resolver.validateDependencies('skill-a');
      expect(result.valid).toBe(false);
    });

    it('应该警告已废弃的依赖', async () => {
      const skillA = createTestSkill('skill-a');
      skillA.metadata.validation.status = 'deprecated';
      const skillB = createTestSkill('skill-b', ['skill-a']);

      await store.saveSkill(skillA);
      await store.saveSkill(skillB);

      const result = await resolver.validateDependencies('skill-b');
      expect(result.warnings.some(w => w.includes('deprecated'))).toBe(true);
    });
  });

  describe('getAllDependencies', () => {
    it('应该获取所有递归依赖', async () => {
      const skillA = createTestSkill('skill-a');
      const skillB = createTestSkill('skill-b', ['skill-a']);
      const skillC = createTestSkill('skill-c', ['skill-b']);

      await store.saveSkill(skillA);
      await store.saveSkill(skillB);
      await store.saveSkill(skillC);

      const deps = await resolver.getAllDependencies('skill-c');
      expect(deps).toContain('skill-a');
      expect(deps).toContain('skill-b');
      expect(deps).toHaveLength(2);
    });
  });

  describe('getDependents', () => {
    it('应该获取所有依赖于指定技能的技能', async () => {
      const skillA = createTestSkill('skill-a');
      const skillB = createTestSkill('skill-b', ['skill-a']);
      const skillC = createTestSkill('skill-c', ['skill-a']);

      await store.saveSkill(skillA);
      await store.saveSkill(skillB);
      await store.saveSkill(skillC);

      const dependents = await resolver.getDependents('skill-a');
      expect(dependents).toContain('skill-b');
      expect(dependents).toContain('skill-c');
      expect(dependents).toHaveLength(2);
    });
  });

  describe('canSafelyDelete', () => {
    it('应该允许删除无依赖者的技能', async () => {
      const skill = createTestSkill('skill-a');
      await store.saveSkill(skill);

      const result = await resolver.canSafelyDelete('skill-a');
      expect(result.canDelete).toBe(true);
      expect(result.blockedBy).toHaveLength(0);
    });

    it('应该阻止删除有依赖者的技能', async () => {
      const skillA = createTestSkill('skill-a');
      const skillB = createTestSkill('skill-b', ['skill-a']);

      await store.saveSkill(skillA);
      await store.saveSkill(skillB);

      const result = await resolver.canSafelyDelete('skill-a');
      expect(result.canDelete).toBe(false);
      expect(result.blockedBy).toContain('skill-b');
    });
  });
});
