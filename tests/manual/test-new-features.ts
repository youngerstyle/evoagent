/**
 * 手动测试脚本
 *
 * 运行方式: tsx tests/manual/test-new-features.ts
 */

import { SkillExecutor } from '../../src/evolution/skills/SkillExecutor.js';
import { InputValidator } from '../../src/evolution/skills/InputValidator.js';
import { SkillStore } from '../../src/evolution/skills/SkillStore.js';
import { SkillDependencyResolver } from '../../src/evolution/skills/SkillDependencyResolver.js';
import { globalHealthChecker } from '../../src/observability/health/HealthChecker.js';
import { globalMetricsCollector } from '../../src/observability/metrics/MetricsCollector.js';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Skill } from '../../src/evolution/skills/SkillTypes.js';

async function runTests() {
  console.log('🧪 开始手动功能测试...\n');

  // 测试 1: 安全验证
  console.log('📋 测试 1: 安全验证');
  const executor = new SkillExecutor();

  const dangerousCode = `
  const fs = require('fs');
  fs.readFileSync('/etc/passwd');
`;

  const securityResult = executor.validateSecurity(dangerousCode);
  console.log('  危险代码检测:', securityResult.safe ? '❌ 失败' : '✅ 通过');
  console.log('  检测到的问题:', securityResult.issues.length, '个');
  console.log('  问题列表:', securityResult.issues.slice(0, 3).join(', '));

  const safeCode = 'const result = 1 + 1; return result;';
  const safeResult = executor.validateSecurity(safeCode);
  console.log('  安全代码检测:', safeResult.safe ? '✅ 通过' : '❌ 失败');
  console.log('');

  // 测试 2: 输入验证
  console.log('📋 测试 2: 输入验证');

  const validId = InputValidator.validateSkillId('valid-skill-123');
  console.log('  有效ID验证:', validId.valid ? '✅ 通过' : '❌ 失败');

  const invalidId = InputValidator.validateSkillId('invalid@skill');
  console.log('  无效ID验证:', !invalidId.valid ? '✅ 通过' : '❌ 失败');
  console.log('  错误信息:', invalidId.errors[0]);

  const validScore = InputValidator.validateScore(0.85);
  console.log('  有效分数验证:', validScore.valid ? '✅ 通过' : '❌ 失败');

  const invalidScore = InputValidator.validateScore(1.5);
  console.log('  无效分数验证:', !invalidScore.valid ? '✅ 通过' : '❌ 失败');
  console.log('');

  // 测试 3: 技能存储和依赖解析
  console.log('📋 测试 3: 技能存储和依赖解析');

  const testDir = join(tmpdir(), `evoagent-manual-test-${Date.now()}`);
  const store = new SkillStore(testDir);
  await store.init();

  const resolver = new SkillDependencyResolver(store);

  // 创建测试技能
  const skillA: Skill = {
    metadata: {
      name: 'skill-a',
      description: 'Test skill A',
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
      tags: ['test'],
      dependencies: [],
      requirements: { bins: [], env: [] },
      cautiousFactor: 0.5,
      timesUsed: 0,
      timesSucceeded: 0,
      timesFailed: 0,
      probationThreshold: 10,
      sourceSessionIds: []
    },
    content: 'Test content',
    templates: new Map([
      ['main.template', {
        id: 'main.template',
        name: 'main.template',
        content: 'return "Hello {{name}}";',
        parameters: ['name']
      }]
    ]),
    tests: new Map()
  };

  const skillB: Skill = {
    ...skillA,
    metadata: {
      ...skillA.metadata,
      name: 'skill-b',
      dependencies: ['skill-a']
    }
  };

  // 保存技能
  await store.saveSkill(skillA);
  console.log('  保存技能 A:', '✅ 成功');

  await store.saveSkill(skillB);
  console.log('  保存技能 B:', '✅ 成功');

  // 加载技能
  const loadedA = await store.loadSkill('skill-a');
  console.log('  加载技能 A:', loadedA ? '✅ 成功' : '❌ 失败');

  // 验证依赖
  const depResult = await resolver.validateDependencies('skill-b');
  console.log('  依赖验证:', depResult.valid ? '✅ 通过' : '❌ 失败');
  console.log('  执行顺序:', depResult.executionOrder?.join(' -> '));

  // 测试循环依赖检测
  const skillC: Skill = {
    ...skillA,
    metadata: {
      ...skillA.metadata,
      name: 'skill-c',
      dependencies: ['skill-b']
    }
  };

  // 修改 skill-a 依赖 skill-c（形成循环）
  skillA.metadata.dependencies = ['skill-c'];
  await store.saveSkill(skillA);
  await store.saveSkill(skillC);

  const circularResult = await resolver.validateDependencies('skill-a');
  console.log('  循环依赖检测:', !circularResult.valid ? '✅ 通过' : '❌ 失败');
  console.log('');

  // 测试 4: 健康检查
  console.log('📋 测试 4: 健康检查');

  globalHealthChecker.registerCheck('database', async () => {
    // 模拟数据库检查
    return true;
  });

  globalHealthChecker.registerCheck('storage', async () => {
    // 模拟存储检查
    return true;
  });

  const healthStatus = await globalHealthChecker.check();
  console.log('  健康状态:', healthStatus.status);
  console.log('  运行时间:', Math.floor(healthStatus.uptime / 1000), '秒');
  console.log('  检查项数量:', Object.keys(healthStatus.checks).length);
  console.log('  所有检查通过:', healthStatus.status === 'healthy' ? '✅ 是' : '❌ 否');
  console.log('');

  // 测试 5: 指标收集
  console.log('📋 测试 5: 指标收集');

  globalMetricsCollector.incrementCounter('skill_execution_total', { status: 'success' });
  globalMetricsCollector.incrementCounter('skill_execution_total', { status: 'success' });
  globalMetricsCollector.incrementCounter('skill_execution_total', { status: 'failure' });
  globalMetricsCollector.setGauge('active_skills', 10);
  globalMetricsCollector.recordHistogram('skill_execution_duration_seconds', 0.5);

  const metrics = globalMetricsCollector.exportPrometheus();
  console.log('  指标导出:', metrics.split('\n').length > 0 ? '✅ 成功' : '❌ 失败');
  console.log('  指标数量:', metrics.split('\n').length);
  console.log('  示例指标:');
  metrics.split('\n').slice(0, 3).forEach(line => {
    console.log('    ', line);
  });
  console.log('');

  console.log('✅ 所有手动测试完成！');
}

// 运行测试
runTests().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
