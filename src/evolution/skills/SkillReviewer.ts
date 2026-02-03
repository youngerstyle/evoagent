/**
 * Skill Reviewer - 技能验证器
 *
 * 负责验证技能质量，运行测试用例，更新验证状态
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getLogger } from '../../core/logger/index.js';
import type { Logger } from '../../core/logger/index.js';
import type {
  Skill,
  SkillValidationResult,
  SkillReviewerConfig
} from './SkillTypes.js';
import { SkillStore } from './SkillStore.js';
import { ValidationHistoryStorage } from './ValidationHistoryStorage.js';

const logger = getLogger('evolution:skills:reviewer');

/**
 * 技能验证器
 */
export class SkillReviewer {
  private readonly config: SkillReviewerConfig;
  private readonly validationHistory: ValidationHistoryStorage;

  constructor(
    private readonly store: SkillStore,
    private readonly workspaceRoot: string,
    private readonly log: Logger = logger,
    config?: Partial<SkillReviewerConfig>
  ) {
    this.config = {
      validationTimeout: config?.validationTimeout ?? 30000,
      maxTestDuration: config?.maxTestDuration ?? 10000,
      successRateThreshold: config?.successRateThreshold ?? 0.8,
      probationUsageThreshold: config?.probationUsageThreshold ?? 10
    };

    // 初始化验证历史存储
    const historyDir = join(workspaceRoot, '.evoagent', 'skills');
    this.validationHistory = new ValidationHistoryStorage(historyDir);
  }

  /**
   * 验证技能
   */
  async validateSkill(skillId: string): Promise<SkillValidationResult> {
    this.log.info(`Validating skill: ${skillId}`);

    const result: SkillValidationResult = {
      skillId,
      passed: false,
      score: 0,
      errors: [],
      warnings: [],
      testResults: []
    };

    const skill = await this.store.loadSkill(skillId);
    if (!skill) {
      result.errors.push('Skill not found');
      return result;
    }

    // 1. 验证元数据完整性
    this.validateMetadata(skill, result);

    // 2. 验证模板
    await this.validateTemplates(skill, result);

    // 3. 运行测试用例
    await this.runTests(skill, result);

    // 4. 计算总体分数
    result.score = this.calculateScore(result);
    result.passed = result.score >= this.config.successRateThreshold;

    // 5. 更新技能状态
    await this.updateSkillStatus(skill, result);

    // 6. 记录验证历史
    await this.validationHistory.recordValidation(
      skillId,
      skill.metadata.name,
      result.passed,
      result.score,
      result.errors,
      result.warnings,
      result.testResults.length,
      result.testResults.filter(t => t.passed).length,
      skill.metadata.source
    );

    this.log.info(`Skill ${skillId} validation: ${result.passed ? 'PASSED' : 'FAILED'} (score: ${result.score.toFixed(2)})`);
    return result;
  }

  /**
   * 批量验证技能
   */
  async validateSkills(skillIds: string[]): Promise<SkillValidationResult[]> {
    const results: SkillValidationResult[] = [];

    for (const skillId of skillIds) {
      try {
        const result = await this.validateSkill(skillId);
        results.push(result);
      } catch (error) {
        this.log.error(`Failed to validate skill ${skillId}`, { error });
        results.push({
          skillId,
          passed: false,
          score: 0,
          errors: [`Validation failed: ${error}`],
          warnings: [],
          testResults: []
        });
      }
    }

    return results;
  }

  /**
   * 验证所有 draft 状态的技能
   */
  async validateDraftSkills(): Promise<SkillValidationResult[]> {
    const allSkills = await this.store.getAllSkills();
    const draftSkills = allSkills.filter(s => s.metadata.validation.status === 'draft');
    const draftIds = draftSkills.map(s => s.metadata.name);

    this.log.info(`Validating ${draftIds.length} draft skills`);
    return this.validateSkills(draftIds);
  }

  /**
   * 验证元数据
   */
  private validateMetadata(skill: Skill, result: SkillValidationResult): void {
    const meta = skill.metadata;

    // 检查必填字段
    if (!meta.name) {
      result.errors.push('Missing skill name');
    }
    if (!meta.description) {
      result.warnings.push('Missing skill description');
    }
    if (!meta.tags || meta.tags.length === 0) {
      result.warnings.push('Skill has no tags');
    }

    // 检查格式
    if (!meta.version.match(/^\d+\.\d+\.\d+$/)) {
      result.errors.push('Invalid version format (should be x.y.z)');
    }

    // 检查置信度
    if (meta.confidence < 0 || meta.confidence > 1) {
      result.errors.push('Confidence must be between 0 and 1');
    }

    // 检查谨慎系数
    if (meta.cautiousFactor < 0 || meta.cautiousFactor > 1) {
      result.errors.push('Cautious factor must be between 0 and 1');
    }
  }

  /**
   * 验证模板
   */
  private async validateTemplates(skill: Skill, result: SkillValidationResult): Promise<void> {
    if (skill.templates.size === 0) {
      result.warnings.push('Skill has no templates');
      return;
    }

    for (const [name, template] of skill.templates.entries()) {
      // 检查模板语法
      const errors = this.checkTemplateSyntax(template.content);
      if (errors.length > 0) {
        result.errors.push(`Template ${name}: ${errors.join(', ')}`);
      }

      // 检查占位符
      const placeholders = this.extractPlaceholders(template.content);
      if (placeholders.length > 0) {
        this.log.debug(`Template ${name} has placeholders: ${placeholders.join(', ')}`);
      }
    }
  }

  /**
   * 运行测试用例
   */
  private async runTests(skill: Skill, result: SkillValidationResult): Promise<void> {
    if (skill.tests.size === 0) {
      result.warnings.push('Skill has no tests');
      return;
    }

    for (const [name, content] of skill.tests.entries()) {
      const testResult = await this.runSingleTest(skill, name, content);
      result.testResults.push(testResult);

      if (!testResult.passed) {
        result.errors.push(`Test ${name} failed: ${testResult.output || 'Unknown error'}`);
      }
    }
  }

  /**
   * 运行单个测试
   */
  private async runSingleTest(
    skill: Skill,
    testName: string,
    testContent: string
  ): Promise<{ name: string; passed: boolean; output?: string }> {
    const result: { name: string; passed: boolean; output?: string } = { name: testName, passed: false };

    // 检查测试类型
    const testType = this.detectTestType(testName);

    try {
      switch (testType) {
        case 'typescript':
        case 'javascript':
          result.passed = await this.runJavaScriptTest(skill, testName, testContent);
          break;

        case 'python':
          result.passed = await this.runPythonTest(skill, testName, testContent);
          break;

        default:
          // 对于未知类型，只做语法检查
          result.passed = this.hasValidSyntax(testContent, testType);
          if (!result.passed) {
            result.output = 'Syntax check failed';
          }
      }
    } catch (error) {
      result.output = String(error);
    }

    return result;
  }

  /**
   * 运行 JavaScript/TypeScript 测试
   */
  private async runJavaScriptTest(
    skill: Skill,
    testName: string,
    testContent: string
  ): Promise<boolean> {
    // 创建临时测试文件
    const testDir = join(this.workspaceRoot, '.evoagent', 'temp-tests');
    await fs.mkdir(testDir, { recursive: true });

    const testFile = join(testDir, `${skill.metadata.name}-${testName}`);
    await fs.writeFile(testFile, testContent, 'utf-8');

    try {
      // 尝试编译 TypeScript
      if (testName.endsWith('.ts')) {
        execSync(`npx tsc --noEmit "${testFile}"`, {
          cwd: this.workspaceRoot,
          timeout: this.config.maxTestDuration,
          stdio: 'pipe'
        });
      }

      // 尝试运行测试
      if (testName.includes('.test.')) {
        execSync(`node --test "${testFile}"`, {
          cwd: this.workspaceRoot,
          timeout: this.config.maxTestDuration,
          stdio: 'pipe'
        });
      }

      return true;
    } catch (error) {
      this.log.debug(`JS test failed: ${error}`);
      return false;
    } finally {
      // 清理临时文件
      try {
        await fs.unlink(testFile);
      } catch {
        // 忽略清理错误
      }
    }
  }

  /**
   * 运行 Python 测试
   */
  private async runPythonTest(
    skill: Skill,
    testName: string,
    testContent: string
  ): Promise<boolean> {
    // 创建临时测试文件
    const testDir = join(this.workspaceRoot, '.evoagent', 'temp-tests');
    await fs.mkdir(testDir, { recursive: true });

    const testFile = join(testDir, `${skill.metadata.name}-${testName}`);
    await fs.writeFile(testFile, testContent, 'utf-8');

    try {
      // 尝试运行 Python 语法检查
      execSync(`python -m py_compile "${testFile}"`, {
        cwd: this.workspaceRoot,
        timeout: this.config.maxTestDuration,
        stdio: 'pipe'
      });

      return true;
    } catch (error) {
      this.log.debug(`Python test failed: ${error}`);
      return false;
    } finally {
      // 清理临时文件
      try {
        await fs.unlink(testFile);
      } catch {
        // 忽略清理错误
      }
    }
  }

  /**
   * 检测测试类型
   */
  private detectTestType(filename: string): string {
    if (filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.py')) return 'python';
    if (filename.endsWith('.rs')) return 'rust';
    return 'unknown';
  }

  /**
   * 检查模板语法
   */
  private checkTemplateSyntax(content: string): string[] {
    const errors: string[] = [];

    // 检查占位符格式
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    const placeholders = content.match(placeholderRegex);
    if (placeholders) {
      // 检查是否有未闭合的占位符
      const openBraces = (content.match(/\{\{/g) || []).length;
      const closeBraces = (content.match(/\}\}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push('Unclosed placeholders');
      }
    }

    return errors;
  }

  /**
   * 提取占位符
   */
  private extractPlaceholders(content: string): string[] {
    const placeholders: string[] = [];
    const regex = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        placeholders.push(match[1]);
      }
    }

    return Array.from(new Set(placeholders));
  }

  /**
   * 检查语法有效性
   */
  private hasValidSyntax(content: string, type: string): boolean {
    // 简单的语法检查
    if (type === 'typescript' || type === 'javascript') {
      // 检查基本的括号匹配
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      const openParens = (content.match(/\(/g) || []).length;
      const closeParens = (content.match(/\)/g) || []).length;

      return openBraces === closeBraces && openParens === closeParens;
    }

    return true;
  }

  /**
   * 计算验证分数
   */
  private calculateScore(result: SkillValidationResult): number {
    let score = 1.0;

    // 每个错误扣 0.2 分
    score -= result.errors.length * 0.2;

    // 每个警告扣 0.05 分
    score -= result.warnings.length * 0.05;

    // 测试通过率
    if (result.testResults.length > 0) {
      const passedTests = result.testResults.filter(t => t.passed).length;
      const testScore = passedTests / result.testResults.length;
      score = score * 0.5 + testScore * 0.5;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 更新技能状态
   */
  private async updateSkillStatus(
    skill: Skill,
    result: SkillValidationResult
  ): Promise<void> {
    const meta = skill.metadata;

    // 更新验证信息
    meta.validation.score = result.score;
    meta.validation.testResults = result.passed ? 'passing' : 'failing';
    meta.validation.lastValidated = new Date().toISOString();

    // 根据结果更新状态
    if (result.passed && meta.validation.status === 'draft') {
      meta.validation.status = 'probation';
      this.log.info(`Skill ${meta.name} promoted to probation`);
    }

    // 保存更新
    await this.store.saveSkill(skill, meta.source);
  }

  /**
   * 获取验证统计
   */
  async getValidationStats(): Promise<{
    totalValidations: number;
    passedValidations: number;
    failedValidations: number;
    averageScore: number;
  }> {
    const stats = await this.validationHistory.getStats();
    return {
      totalValidations: stats.totalValidations,
      passedValidations: stats.passedValidations,
      failedValidations: stats.failedValidations,
      averageScore: stats.averageScore
    };
  }

  /**
   * 获取技能的验证历史
   */
  async getSkillValidationHistory(skillId: string, limit?: number) {
    return this.validationHistory.getSkillHistory(skillId, limit);
  }

  /**
   * 获取技能的验证统计
   */
  async getSkillValidationStats(skillId: string) {
    return this.validationHistory.getSkillStats(skillId);
  }

  /**
   * 清理旧的验证记录
   */
  async cleanupOldValidations(maxAgeMs?: number) {
    return this.validationHistory.cleanup(maxAgeMs);
  }
}
