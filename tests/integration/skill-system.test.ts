/**
 * 集成测试 - 技能系统
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { SkillStore } from '../../src/evolution/skills/SkillStore.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';
import type { Skill } from '../../src/evolution/skills/SkillTypes.js';

describe('Skill System Integration Tests', () => {
  let skillStore: SkillStore;
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `evoagent-skills-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    skillStore = new SkillStore(testDir);
    await skillStore.init();
  });

  afterAll(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test directory:', error);
    }
  });

  it('should save and load a skill', async () => {
    const skill: Skill = {
      metadata: {
        name: 'test-skill',
        description: 'A test skill',
        version: '1.0.0',
        created: new Date().toISOString(),
        source: 'manual',
        author: 'test',
        occurrence: 1,
        confidence: 0.9,
        validation: {
          status: 'draft',
          score: 0,
          testResults: '',
          lastValidated: new Date().toISOString()
        },
        tags: ['test'],
        dependencies: [],
        requirements: {
          bins: [],
          env: []
        },
        cautiousFactor: 0.8,
        timesUsed: 0,
        timesSucceeded: 0,
        timesFailed: 0,
        probationThreshold: 3,
        sourceSessionIds: []
      },
      content: '# Test Skill\n\nThis is a test skill.',
      templates: new Map(),
      tests: new Map()
    };

    await skillStore.saveSkill(skill, 'manual');

    const loaded = await skillStore.loadSkill('test-skill');
    expect(loaded).toBeDefined();
    expect(loaded!.metadata.name).toBe('test-skill');
  });

  it('should search skills', async () => {
    const skills = await skillStore.searchSkills({
      searchText: 'test'
    });

    expect(Array.isArray(skills)).toBe(true);
  });

  it('should get all skills', async () => {
    const allSkills = await skillStore.getAllSkills();
    expect(Array.isArray(allSkills)).toBe(true);
  });
});
