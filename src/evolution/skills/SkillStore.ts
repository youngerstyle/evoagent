/**
 * Skill Store - 技能存储
 *
 * 负责技能的持久化、索引和管理
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join, basename, resolve, relative } from 'path';
import { getLogger } from '../../core/logger/index.js';
import type {
  Skill,
  SkillMetadata,
  SkillTemplate,
  SkillIndex,
  SkillIndexEntry,
  SkillSearchFilter,
  SkillStoreConfig,
  SkillValidationStatus,
  SkillUsageStats
} from './SkillTypes.js';

const logger = getLogger('evolution:skills:store');

/**
 * 技能存储
 */
export class SkillStore {
  private readonly config: SkillStoreConfig;
  private index: SkillIndex | null = null;

  constructor(
    evoagentDir: string,
    config?: Partial<SkillStoreConfig>
  ) {
    const baseSkillsDir = join(evoagentDir, 'skills');
    this.config = {
      skillsDir: config?.skillsDir ?? baseSkillsDir,
      autoDir: config?.autoDir ?? join(baseSkillsDir, 'auto'),
      manualDir: config?.manualDir ?? join(baseSkillsDir, 'manual'),
      deprecatedDir: config?.deprecatedDir ?? join(baseSkillsDir, 'deprecated'),
      backupDir: config?.backupDir ?? join(baseSkillsDir, '.backup'),
      patternCandidatesFile: config?.patternCandidatesFile ?? join(evoagentDir, 'pattern-candidates.jsonl'),
      indexFile: config?.indexFile ?? join(baseSkillsDir, 'index.json')
    };
  }

  /**
   * 验证文件名安全性（防止路径遍历）
   */
  private validateFileName(fileName: string): string {
    // 只保留文件名，移除任何路径分隔符
    const safeName = basename(fileName);

    // 检查是否包含危险字符
    if (safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
      throw new Error(`Invalid file name: ${fileName}`);
    }

    // 检查文件名长度
    if (safeName.length === 0 || safeName.length > 255) {
      throw new Error(`File name length invalid: ${fileName}`);
    }

    return safeName;
  }

  /**
   * 验证路径安全性（确保在允许的目录内）
   */
  private validatePath(targetPath: string, allowedDir: string): void {
    const resolvedTarget = resolve(targetPath);
    const resolvedAllowed = resolve(allowedDir);
    const relativePath = relative(resolvedAllowed, resolvedTarget);

    // 检查是否在允许的目录内
    if (relativePath.startsWith('..') || resolve(relativePath) === relativePath) {
      throw new Error(`Path traversal detected: ${targetPath}`);
    }
  }

  /**
   * 初始化存储
   */
  async init(): Promise<void> {
    // 创建目录结构
    await fs.mkdir(this.config.autoDir, { recursive: true });
    await fs.mkdir(this.config.manualDir, { recursive: true });
    await fs.mkdir(this.config.deprecatedDir, { recursive: true });
    await fs.mkdir(this.config.backupDir, { recursive: true });

    // 加载或创建索引
    await this.loadIndex();

    logger.info('SkillStore initialized');
  }

  /**
   * 保存技能
   */
  async saveSkill(skill: Skill, source: 'auto' | 'manual' = 'auto'): Promise<string> {
    // 验证技能ID安全性
    const skillId = this.validateFileName(skill.metadata.name);
    const baseDir = source === 'auto' ? this.config.autoDir : this.config.manualDir;
    const skillDir = join(baseDir, skillId);

    // 验证路径安全性
    this.validatePath(skillDir, baseDir);

    // 创建技能目录
    await fs.mkdir(skillDir, { recursive: true });

    // 保存 SKILL.md
    const skillMdPath = join(skillDir, 'SKILL.md');
    const skillContent = this.formatSkillMd(skill);
    await fs.writeFile(skillMdPath, skillContent, 'utf-8');

    // 保存模板
    if (skill.templates.size > 0) {
      const templatesDir = join(skillDir, 'templates');
      await fs.mkdir(templatesDir, { recursive: true });
      for (const [name, template] of skill.templates.entries()) {
        // 验证文件名安全性
        const safeName = this.validateFileName(name);
        const templatePath = join(templatesDir, safeName);
        this.validatePath(templatePath, templatesDir);
        await fs.writeFile(templatePath, template.content, 'utf-8');
      }
    }

    // 保存测试
    if (skill.tests.size > 0) {
      const testsDir = join(skillDir, 'tests');
      await fs.mkdir(testsDir, { recursive: true });
      for (const [name, content] of skill.tests.entries()) {
        // 验证文件名安全性
        const safeName = this.validateFileName(name);
        const testPath = join(testsDir, safeName);
        this.validatePath(testPath, testsDir);
        await fs.writeFile(testPath, content, 'utf-8');
      }
    }

    // 保存 meta.json
    const metaPath = join(skillDir, 'meta.json');
    await fs.writeFile(metaPath, JSON.stringify(skill.metadata, null, 2), 'utf-8');

    // 更新索引
    await this.updateIndex(skillId, skill);

    logger.info(`Saved skill: ${skillId} (${source})`);
    return skillId;
  }

  /**
   * 加载技能
   */
  async loadSkill(skillId: string): Promise<Skill | null> {
    // 先从 auto 目录查找
    let skillDir = join(this.config.autoDir, skillId);
    if (!existsSync(skillDir)) {
      // 再从 manual 目录查找
      skillDir = join(this.config.manualDir, skillId);
    }
    if (!existsSync(skillDir)) {
      return null;
    }

    try {
      // 读取 SKILL.md
      const skillMdPath = join(skillDir, 'SKILL.md');
      const skillContent = await fs.readFile(skillMdPath, 'utf-8');
      const { metadata, content } = this.parseSkillMd(skillContent);

      // 读取模板
      const templates = new Map<string, SkillTemplate>();
      const templatesDir = join(skillDir, 'templates');
      if (existsSync(templatesDir)) {
        const templateFiles = await fs.readdir(templatesDir);
        for (const file of templateFiles) {
          const templatePath = join(templatesDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf-8');
          templates.set(file, {
            id: file,
            name: file,
            content: templateContent,
            parameters: this.extractTemplateParameters(templateContent)
          });
        }
      }

      // 读取测试
      const tests = new Map<string, string>();
      const testsDir = join(skillDir, 'tests');
      if (existsSync(testsDir)) {
        const testFiles = await fs.readdir(testsDir);
        for (const file of testFiles) {
          const testPath = join(testsDir, file);
          const testContent = await fs.readFile(testPath, 'utf-8');
          tests.set(file, testContent);
        }
      }

      return { metadata, content, templates, tests };
    } catch (error) {
      logger.error(`Failed to load skill: ${skillId}`, { error });
      return null;
    }
  }

  /**
   * 删除技能
   */
  async deleteSkill(skillId: string): Promise<boolean> {
    const skill = await this.loadSkill(skillId);
    if (!skill) {
      return false;
    }

    // 确定目录
    const source = skill.metadata.source;
    const skillDir = join(
      source === 'auto' ? this.config.autoDir : this.config.manualDir,
      skillId
    );

    // 备份到 .backup 目录
    await this.backupSkill(skillId, skill);

    // 删除目录
    await fs.rm(skillDir, { recursive: true, force: true });

    // 更新索引
    await this.removeFromIndex(skillId);

    logger.info(`Deleted skill: ${skillId}`);
    return true;
  }

  /**
   * 废弃技能
   */
  async deprecateSkill(skillId: string, reason: string): Promise<boolean> {
    const skill = await this.loadSkill(skillId);
    if (!skill) {
      return false;
    }

    // 更新状态
    skill.metadata.validation.status = 'deprecated';

    // 移动到 deprecated 目录
    const source = skill.metadata.source;
    const sourceDir = join(
      source === 'auto' ? this.config.autoDir : this.config.manualDir,
      skillId
    );
    const targetDir = join(this.config.deprecatedDir, skillId);

    // 如果目标已存在，先删除
    if (existsSync(targetDir)) {
      await fs.rm(targetDir, { recursive: true, force: true });
    }

    await fs.rename(sourceDir, targetDir);

    // 更新 SKILL.md 添加废弃原因
    const skillMdPath = join(targetDir, 'SKILL.md');
    const oldContent = await fs.readFile(skillMdPath, 'utf-8');
    const deprecatedNotice = `\n\n---\n\n**DEPRECATED**: ${reason}\n`;
    await fs.writeFile(skillMdPath, oldContent + deprecatedNotice, 'utf-8');

    // 更新索引
    await this.updateIndex(skillId, skill);

    logger.info(`Deprecated skill: ${skillId} - ${reason}`);
    return true;
  }

  /**
   * 搜索技能
   */
  async searchSkills(filter: SkillSearchFilter): Promise<Skill[]> {
    const results: Skill[] = [];

    // 从索引获取匹配的技能 ID
    const matchedIds = this.getMatchingSkillIds(filter);

    // 加载技能
    for (const skillId of matchedIds) {
      const skill = await this.loadSkill(skillId);
      if (skill) {
        results.push(skill);
      }
    }

    return results;
  }

  /**
   * 获取技能统计
   */
  async getSkillStats(skillId: string): Promise<SkillUsageStats | null> {
    const skill = await this.loadSkill(skillId);
    if (!skill) {
      return null;
    }

    const meta = skill.metadata;
    return {
      skillId,
      timesUsed: meta.timesUsed,
      timesSucceeded: meta.timesSucceeded,
      timesFailed: meta.timesFailed,
      lastUsed: meta.validation.lastValidated,
      averageDuration: 0 // 可以后续添加
    };
  }

  /**
   * 更新技能使用统计
   */
  async updateUsageStats(
    skillId: string,
    success: boolean,
    _duration: number
  ): Promise<void> {
    const skill = await this.loadSkill(skillId);
    if (!skill) {
      return;
    }

    skill.metadata.timesUsed++;
    if (success) {
      skill.metadata.timesSucceeded++;
    } else {
      skill.metadata.timesFailed++;
    }
    skill.metadata.validation.lastValidated = new Date().toISOString();

    // 检查是否需要升级状态
    this.checkSkillStatusUpgrade(skill);

    // 保存
    await this.saveSkill(skill, skill.metadata.source);

    logger.debug(`Updated usage stats for ${skillId}: success=${success}`);
  }

  /**
   * 获取所有技能
   */
  async getAllSkills(): Promise<Skill[]> {
    const skills: Skill[] = [];

    // 从 auto 目录
    const autoDirs = await this.getSkillDirectories(this.config.autoDir);
    for (const dir of autoDirs) {
      const skill = await this.loadSkill(dir);
      if (skill) {
        skills.push(skill);
      }
    }

    // 从 manual 目录
    const manualDirs = await this.getSkillDirectories(this.config.manualDir);
    for (const dir of manualDirs) {
      const skill = await this.loadSkill(dir);
      if (skill && !skills.find(s => s.metadata.name === dir)) {
        skills.push(skill);
      }
    }

    return skills;
  }

  /**
   * 获取索引
   */
  getIndex(): SkillIndex | null {
    return this.index;
  }

  /**
   * 重建索引
   */
  async rebuildIndex(): Promise<void> {
    const skills = await this.getAllSkills();

    this.index = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      skills: [],
      deprecatedSkills: []
    };

    for (const skill of skills) {
      const entry: SkillIndexEntry = {
        id: skill.metadata.name,
        name: skill.metadata.name,
        status: skill.metadata.validation.status,
        tags: skill.metadata.tags,
        timesUsed: skill.metadata.timesUsed,
        successRate: skill.metadata.timesUsed > 0
          ? skill.metadata.timesSucceeded / skill.metadata.timesUsed
          : 0,
        lastUsed: skill.metadata.validation.lastValidated
      };

      if (skill.metadata.validation.status === 'deprecated') {
        this.index.deprecatedSkills.push(entry.id);
      } else {
        this.index.skills.push(entry);
      }
    }

    await this.saveIndex();
    logger.info(`Rebuilt index with ${skills.length} skills`);
  }

  /**
   * 格式化 SKILL.md
   */
  private formatSkillMd(skill: Skill): string {
    const meta = skill.metadata;
    let content = '---\n';

    // 基本信息
    content += `name: ${meta.name}\n`;
    content += `description: ${meta.description}\n`;
    content += `version: ${meta.version}\n`;
    content += `created: ${meta.created}\n`;
    content += `source: ${meta.source}\n`;
    content += `author: ${meta.author}\n`;

    // 统计
    content += `occurrence: ${meta.occurrence}\n`;

    // 验证
    content += `validation:\n`;
    content += `  status: ${meta.validation.status}\n`;
    content += `  score: ${meta.validation.score}\n`;
    content += `  testResults: ${meta.validation.testResults}\n`;
    content += `  lastValidated: ${meta.validation.lastValidated}\n`;

    // 分类
    content += `tags: [${meta.tags.map(t => `"${t}"`).join(', ')}]\n`;
    content += `dependencies: [${meta.dependencies.map(d => `"${d}"`).join(', ')}]\n`;

    // 要求
    content += `requirements:\n`;
    content += `  bins: [${meta.requirements.bins.map(b => `"${b}"`).join(', ')}]\n`;
    content += `  env: [${meta.requirements.env.map(e => `"${e}"`).join(', ')}]\n`;

    // v2.2 字段
    content += `confidence: ${meta.confidence}\n`;
    content += `cautiousFactor: ${meta.cautiousFactor}\n`;
    content += `timesUsed: ${meta.timesUsed}\n`;
    content += `timesSucceeded: ${meta.timesSucceeded}\n`;
    content += `timesFailed: ${meta.timesFailed}\n`;
    content += `probationThreshold: ${meta.probationThreshold}\n`;
    content += `sourceSessionIds: [${meta.sourceSessionIds.map(s => `"${s}"`).join(', ')}]\n`;

    content += '---\n\n';
    content += skill.content;

    return content;
  }

  /**
   * 解析 SKILL.md
   */
  private parseSkillMd(content: string): { metadata: SkillMetadata; content: string } {
    // 分离 frontmatter 和内容
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]+)$/);
    if (!frontmatterMatch || !frontmatterMatch[1] || !frontmatterMatch[2]) {
      throw new Error('Invalid SKILL.md format');
    }

    const frontmatter = frontmatterMatch[1];
    const body = frontmatterMatch[2];

    // 解析 YAML frontmatter (简化版)
    const metadata: SkillMetadata = {
      name: this.extractYamlValue(frontmatter, 'name') || '',
      description: this.extractYamlValue(frontmatter, 'description') || '',
      version: this.extractYamlValue(frontmatter, 'version') || '1.0.0',
      created: this.extractYamlValue(frontmatter, 'created') || new Date().toISOString(),
      source: (this.extractYamlValue(frontmatter, 'source') as 'auto' | 'manual') || 'auto',
      author: this.extractYamlValue(frontmatter, 'author') || 'SkillReflector',
      occurrence: parseInt(this.extractYamlValue(frontmatter, 'occurrence') || '0'),
      confidence: parseFloat(this.extractYamlValue(frontmatter, 'confidence') || '0'),
      tags: this.extractYamlArray(frontmatter, 'tags') || [],
      dependencies: this.extractYamlArray(frontmatter, 'dependencies') || [],
      timesUsed: parseInt(this.extractYamlValue(frontmatter, 'timesUsed') || '0'),
      timesSucceeded: parseInt(this.extractYamlValue(frontmatter, 'timesSucceeded') || '0'),
      timesFailed: parseInt(this.extractYamlValue(frontmatter, 'timesFailed') || '0'),
      probationThreshold: parseInt(this.extractYamlValue(frontmatter, 'probationThreshold') || '10'),
      sourceSessionIds: this.extractYamlArray(frontmatter, 'sourceSessionIds') || [],
      validation: {
        status: (this.extractYamlValue(frontmatter, 'validation.status') as SkillValidationStatus) || 'draft',
        score: parseFloat(this.extractYamlValue(frontmatter, 'validation.score') || '0'),
        testResults: this.extractYamlValue(frontmatter, 'validation.testResults') || 'pending',
        lastValidated: this.extractYamlValue(frontmatter, 'validation.lastValidated') || new Date().toISOString()
      },
      requirements: {
        bins: this.extractYamlArray(frontmatter, 'requirements.bins') || [],
        env: this.extractYamlArray(frontmatter, 'requirements.env') || []
      },
      cautiousFactor: parseFloat(this.extractYamlValue(frontmatter, 'cautiousFactor') || '0.5')
    };

    return { metadata, content: body };
  }

  /**
   * 提取 YAML 值
   */
  private extractYamlValue(yaml: string, key: string): string {
    // 支持嵌套键如 "validation.status"
    const keys = key.split('.');
    let value: string | null = null;

    for (const k of keys) {
      const regex = new RegExp(`^${k}:\\s*(.+)$`, 'm');
      const match = yaml.match(regex);
      if (match && match[1]) {
        value = match[1].trim();
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
      }
    }

    return value || '';
  }

  /**
   * 提取 YAML 数组
   */
  private extractYamlArray(yaml: string, key: string): string[] | null {
    const regex = new RegExp(`${key}:\\s*\\[(.+?)\\]`, 's');
    const match = yaml.match(regex);
    if (!match || !match[1]) {
      return null;
    }

    const arrayContent = match[1];
    const items: string[] = [];

    // 匹配引号包裹的值
    const quotedRegex = /["']([^"']+)["']/g;
    let quotedMatch: RegExpExecArray | null;
    while ((quotedMatch = quotedRegex.exec(arrayContent)) !== null) {
      if (quotedMatch[1]) {
        items.push(quotedMatch[1]);
      }
    }

    return items.length > 0 ? items : null;
  }

  /**
   * 获取技能目录列表
   */
  private async getSkillDirectories(dir: string): Promise<string[]> {
    if (!existsSync(dir)) {
      return [];
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name);
  }

  /**
   * 加载索引
   */
  private async loadIndex(): Promise<void> {
    try {
      if (existsSync(this.config.indexFile)) {
        const content = await fs.readFile(this.config.indexFile, 'utf-8');
        this.index = JSON.parse(content);
      } else {
        // 创建新索引
        this.index = {
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          skills: [],
          deprecatedSkills: []
        };
        await this.saveIndex();
      }
    } catch (error) {
      logger.warn('Failed to load index, creating new one', { error });
      this.index = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        skills: [],
        deprecatedSkills: []
      };
    }
  }

  /**
   * 保存索引
   */
  private async saveIndex(): Promise<void> {
    if (!this.index) {
      return;
    }
    this.index.lastUpdated = new Date().toISOString();

    // 原子写入
    const tmpPath = this.config.indexFile + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(this.index, null, 2), 'utf-8');
    await fs.rename(tmpPath, this.config.indexFile);
  }

  /**
   * 更新索引
   */
  private async updateIndex(skillId: string, skill: Skill): Promise<void> {
    if (!this.index) {
      await this.loadIndex();
    }
    if (!this.index) {
      return;
    }

    const entry: SkillIndexEntry = {
      id: skillId,
      name: skill.metadata.name,
      status: skill.metadata.validation.status,
      tags: skill.metadata.tags,
      timesUsed: skill.metadata.timesUsed,
      successRate: skill.metadata.timesUsed > 0
        ? skill.metadata.timesSucceeded / skill.metadata.timesUsed
        : 0,
      lastUsed: skill.metadata.validation.lastValidated
    };

    // 移除旧条目
    this.index.skills = this.index.skills.filter(s => s.id !== skillId);
    this.index.deprecatedSkills = this.index.deprecatedSkills.filter(s => s !== skillId);

    // 添加新条目
    if (skill.metadata.validation.status === 'deprecated') {
      this.index.deprecatedSkills.push(skillId);
    } else {
      this.index.skills.push(entry);
    }

    await this.saveIndex();
  }

  /**
   * 从索引移除
   */
  private async removeFromIndex(skillId: string): Promise<void> {
    if (!this.index) {
      return;
    }

    this.index.skills = this.index.skills.filter(s => s.id !== skillId);
    this.index.deprecatedSkills = this.index.deprecatedSkills.filter(s => s !== skillId);

    await this.saveIndex();
  }

  /**
   * 获取匹配的技能 ID
   */
  private getMatchingSkillIds(filter: SkillSearchFilter): string[] {
    if (!this.index) {
      return [];
    }

    let candidates = [...this.index.skills];

    // 状态过滤
    if (filter.status && filter.status.length > 0) {
      candidates = candidates.filter(s => filter.status!.includes(s.status));
    }

    // 标签过滤
    if (filter.tags && filter.tags.length > 0) {
      candidates = candidates.filter(s =>
        filter.tags!.some(t => s.tags.includes(t))
      );
    }

    // 成功率过滤
    if (filter.minSuccessRate !== undefined) {
      candidates = candidates.filter(s => s.successRate >= filter.minSuccessRate!);
    }

    // 使用次数过滤
    if (filter.minTimesUsed !== undefined) {
      candidates = candidates.filter(s => s.timesUsed >= filter.minTimesUsed!);
    }

    // 文本搜索
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      candidates = candidates.filter(s =>
        s.name.toLowerCase().includes(searchLower) ||
        s.tags.some(t => t.toLowerCase().includes(searchLower))
      );
    }

    return candidates.map(s => s.id);
  }

  /**
   * 备份技能
   */
  private async backupSkill(skillId: string, skill: Skill): Promise<void> {
    const backupDir = join(this.config.backupDir, skillId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `${timestamp}.json`);

    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(backupPath, JSON.stringify(skill, null, 2), 'utf-8');

    // 清理旧备份（保留最近 10 个）
    const backups = await fs.readdir(backupDir);
    if (backups.length > 10) {
      backups.sort();
      const toDelete = backups.slice(0, backups.length - 10);
      for (const file of toDelete) {
        await fs.unlink(join(backupDir, file));
      }
    }
  }

  /**
   * 检查技能状态是否需要升级
   */
  private checkSkillStatusUpgrade(skill: Skill): void {
    const meta = skill.metadata;

    // probation -> validated
    if (meta.validation.status === 'probation') {
      if (meta.timesUsed >= meta.probationThreshold) {
        const successRate = meta.timesUsed > 0
          ? meta.timesSucceeded / meta.timesUsed
          : 0;
        if (successRate >= 0.8) {
          meta.validation.status = 'validated';
          meta.cautiousFactor = Math.max(0.1, meta.cautiousFactor - 0.2);
          logger.info(`Skill ${meta.name} upgraded to validated`);
        }
      }
    }

    // 任何状态 -> deprecated (连续失败)
    if (meta.timesFailed >= 5) {
      const recentFailures = meta.timesFailed;
      if (recentFailures >= 5 && meta.timesUsed > 0) {
        const failureRate = meta.timesFailed / meta.timesUsed;
        if (failureRate > 0.5) {
          meta.validation.status = 'deprecated';
          logger.info(`Skill ${meta.name} degraded to deprecated`);
        }
      }
    }
  }

  /**
   * 提取模板中的参数
   */
  private extractTemplateParameters(content: string): string[] {
    const paramRegex = /\{\{(\w+)\}\}/g;
    const params: string[] = [];
    let match;

    while ((match = paramRegex.exec(content)) !== null) {
      const paramName = match[1];
      if (paramName && !params.includes(paramName)) {
        params.push(paramName);
      }
    }

    return params;
  }
}
