/**
 * Knowledge Storage
 *
 * 存储结构化知识（坑点、模式、决策、解决方案）
 * 支持 auto/manual 分离，防止 Reflector 覆盖人工编辑的内容
 */

import { readdir, readFile, writeFile, mkdir, stat, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('memory:knowledge');

// ========== 类型定义 ==========

export interface KnowledgeFrontmatter {
  title: string;
  category: string;
  tags: string[];
  severity?: 'critical' | 'high' | 'medium' | 'low';
  discovered: string; // ISO date
  occurrences?: number;
  related_sessions?: string[];
  source: 'auto' | 'manual';
  manual_edited?: boolean;
  reflector_can_update?: boolean;
  version?: number;
}

export interface KnowledgeItem {
  path: string;           // "auto/pits/nextjs-trap" or "manual/pits/nextjs-trap"
  category: string;       // pits, patterns, decisions, solutions
  slug: string;           // nextjs-trap
  source: 'auto' | 'manual';
  frontmatter: KnowledgeFrontmatter;
  content: string;        // Markdown content (excluding frontmatter)
}

export interface KnowledgeStats {
  totalItems: number;
  autoItems: number;
  manualItems: number;
  byCategory: Record<string, number>;
  totalSize: number;
}

// ========== KnowledgeStorage 类 ==========

export class KnowledgeStorage {
  private knowledgeDir: string;
  private autoDir: string;
  private manualDir: string;
  private initialized = false;

  constructor(knowledgeDir: string) {
    this.knowledgeDir = knowledgeDir;
    this.autoDir = join(knowledgeDir, 'auto');
    this.manualDir = join(knowledgeDir, 'manual');
  }

  /**
   * 初始化：创建目录结构
   */
  async init(): Promise<void> {
    logger.debug(`Initializing KnowledgeStorage at ${this.knowledgeDir}`);

    // 创建主目录和子目录
    const categories = ['pits', 'patterns', 'decisions', 'solutions'];

    for (const source of ['auto', 'manual']) {
      const baseDir = source === 'auto' ? this.autoDir : this.manualDir;
      for (const category of categories) {
        await mkdir(join(baseDir, category), { recursive: true });
      }
    }

    this.initialized = true;
    logger.debug('KnowledgeStorage initialized');
  }

  /**
   * 写入自动生成的知识（auto/ 目录）
   */
  async writeAuto(category: string, slug: string, content: string): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    // 验证 category
    const validCategories = ['pits', 'patterns', 'decisions', 'solutions'];
    if (!validCategories.includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }

    // 检查 manual/ 是否有同名文件
    const manualPath = join(this.manualDir, category, `${slug}.md`);
    if (existsSync(manualPath)) {
      logger.warn(`manual/${category}/${slug}.md exists, skipping auto generation`);
      return;
    }

    // 确保目录存在
    const autoPath = join(this.autoDir, category, `${slug}.md`);
    await mkdir(dirname(autoPath), { recursive: true });

    // 确保 frontmatter 中有 source: auto
    const processedContent = this.ensureSourceField(content, 'auto');

    await writeFile(autoPath, processedContent, 'utf-8');
    logger.debug(`Wrote auto/${category}/${slug}.md`);
  }

  /**
   * 写入手动知识（manual/ 目录）
   */
  async writeManual(category: string, slug: string, content: string): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    // 验证 category
    const validCategories = ['pits', 'patterns', 'decisions', 'solutions'];
    if (!validCategories.includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }

    const manualPath = join(this.manualDir, category, `${slug}.md`);
    await mkdir(dirname(manualPath), { recursive: true });

    // 确保 frontmatter 中有 source: manual
    const processedContent = this.ensureSourceField(content, 'manual');

    await writeFile(manualPath, processedContent, 'utf-8');
    logger.debug(`Wrote manual/${category}/${slug}.md`);
  }

  /**
   * 读取知识（manual 优先）
   */
  async read(category: string, slug: string): Promise<KnowledgeItem | null> {
    if (!this.initialized) {
      await this.init();
    }

    // 先尝试 manual/
    let filePath = join(this.manualDir, category, `${slug}.md`);
    let source: 'auto' | 'manual' = 'manual';

    if (!existsSync(filePath)) {
      // 再尝试 auto/
      filePath = join(this.autoDir, category, `${slug}.md`);
      source = 'auto';
    }

    if (!existsSync(filePath)) {
      return null;
    }

    return this.parseKnowledgeFile(filePath, source, category, slug);
  }

  /**
   * 通过完整路径读取知识
   */
  async get(path: string): Promise<KnowledgeItem | null> {
    if (!this.initialized) {
      await this.init();
    }

    // 解析路径: "auto/pits/nextjs-trap" or "manual/pits/nextjs-trap"
    const parts = path.split('/');
    if (parts.length !== 3) {
      return null;
    }

    const [sourceRaw, category, slugWithExt] = parts;
    if (sourceRaw !== 'auto' && sourceRaw !== 'manual') {
      return null;
    }

    if (!category || !slugWithExt) {
      return null;
    }

    const slug = slugWithExt.endsWith('.md') ? slugWithExt.slice(0, -3) : slugWithExt;

    return this.read(category, slug);
  }

  /**
   * 列出知识项
   */
  async list(category?: string, source?: 'auto' | 'manual'): Promise<KnowledgeItem[]> {
    if (!this.initialized) {
      await this.init();
    }

    const results: KnowledgeItem[] = [];

    const sourcesToList = source ? [source] : ['auto', 'manual'];
    const categoriesToList = category ? [category] : ['pits', 'patterns', 'decisions', 'solutions'];

    for (const src of sourcesToList) {
      const baseDir = src === 'auto' ? this.autoDir : this.manualDir;

      for (const cat of categoriesToList) {
        const catDir = join(baseDir, cat);

        if (!existsSync(catDir)) {
          continue;
        }

        try {
          const files = await readdir(catDir);

          for (const file of files) {
            if (!file.endsWith('.md')) continue;

            const slug = file.slice(0, -3);
            const filePath = join(catDir, file);

            try {
              const item = await this.parseKnowledgeFile(filePath, src as 'auto' | 'manual', cat, slug);
              results.push(item);
            } catch (error) {
              logger.warn(`Failed to parse ${filePath}:`, { error });
            }
          }
        } catch (error) {
          logger.warn(`Failed to read directory ${catDir}:`, { error });
        }
      }
    }

    // 按发现时间倒序
    return results.sort((a, b) =>
      new Date(b.frontmatter.discovered).getTime() - new Date(a.frontmatter.discovered).getTime()
    );
  }

  /**
   * 按文件名搜索
   */
  async searchByFilename(query: string, limit = 10): Promise<KnowledgeItem[]> {
    if (!this.initialized) {
      await this.init();
    }

    const all = await this.list();
    const lowerQuery = query.toLowerCase();

    // 匹配文件名（slug）或标题
    const matches = all.filter(item =>
      item.slug.toLowerCase().includes(lowerQuery) ||
      item.frontmatter.title.toLowerCase().includes(lowerQuery)
    );

    return matches.slice(0, limit);
  }

  /**
   * 按内容搜索
   */
  async searchByContent(query: string, options: {
    category?: string;
    source?: 'auto' | 'manual';
    limit?: number;
  } = {}): Promise<Array<{ item: KnowledgeItem; score: number }>> {
    if (!this.initialized) {
      await this.init();
    }

    const items = await this.list(options.category, options.source);
    const lowerQuery = query.toLowerCase();
    const results: Array<{ item: KnowledgeItem; score: number }> = [];

    for (const item of items) {
      let score = 0;
      const contentLower = item.content.toLowerCase();

      // 标题匹配（权重高）
      if (item.frontmatter.title.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }

      // 标签匹配
      for (const tag of item.frontmatter.tags) {
        if (tag.toLowerCase().includes(lowerQuery)) {
          score += 5;
        }
      }

      // 内容匹配
      const occurrences = (contentLower.match(new RegExp(lowerQuery, 'g')) || []).length;
      score += occurrences;

      // 类别匹配
      if (item.category.toLowerCase().includes(lowerQuery)) {
        score += 3;
      }

      if (score > 0) {
        results.push({ item, score });
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, options.limit || 10);
  }

  /**
   * 删除知识
   */
  async delete(path: string): Promise<boolean> {
    if (!this.initialized) {
      await this.init();
    }

    const parts = path.split('/');
    if (parts.length !== 3) {
      return false;
    }

    const [sourceRaw, category, slugWithExt] = parts;
    if (sourceRaw !== 'auto' && sourceRaw !== 'manual') {
      return false;
    }

    if (!category || !slugWithExt) {
      return false;
    }

    const source = sourceRaw as 'auto' | 'manual';
    const slug = slugWithExt.endsWith('.md') ? slugWithExt.slice(0, -3) : slugWithExt;
    const baseDir = source === 'auto' ? this.autoDir : this.manualDir;
    const filePath = join(baseDir, category, `${slug}.md`);

    if (!existsSync(filePath)) {
      return false;
    }

    await unlink(filePath);
    logger.debug(`Deleted ${path}`);
    return true;
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<KnowledgeStats> {
    if (!this.initialized) {
      await this.init();
    }

    const all = await this.list();
    const stats: KnowledgeStats = {
      totalItems: all.length,
      autoItems: 0,
      manualItems: 0,
      byCategory: {
        pits: 0,
        patterns: 0,
        decisions: 0,
        solutions: 0
      },
      totalSize: 0
    };

    for (const item of all) {
      if (item.source === 'auto') {
        stats.autoItems++;
      } else {
        stats.manualItems++;
      }

      const cat = item.category;
      if (cat && typeof stats.byCategory[cat] === 'number') {
        stats.byCategory[cat]++;
      }

      // 计算文件大小
      const filePath = this.getFilePath(item);
      try {
        const fileStat = await stat(filePath);
        stats.totalSize += fileStat.size;
      } catch {
        // 文件可能不存在
      }
    }

    return stats;
  }

  /**
   * 锁定知识（防止 Reflector 更新）
   */
  async lock(path: string, locked = true): Promise<boolean> {
    const item = await this.get(path);
    if (!item) {
      return false;
    }

    // 只有 auto/ 目录的文件可以锁定
    if (item.source !== 'auto') {
      return false;
    }

    // 更新 frontmatter
    item.frontmatter.reflector_can_update = !locked;

    // 重写文件
    const content = this.formatKnowledgeItem(item);
    const filePath = this.getFilePath(item);

    await writeFile(filePath, content, 'utf-8');
    logger.debug(`${locked ? 'Locked' : 'Unlocked'} ${path}`);

    return true;
  }

  /**
   * 将 auto/ 文件移动到 manual/（手动编辑时调用）
   */
  async promoteToManual(path: string): Promise<boolean> {
    const item = await this.get(path);
    if (!item || item.source !== 'auto') {
      return false;
    }

    // 读取内容
    const autoPath = this.getFilePath(item);
    const content = await readFile(autoPath, 'utf-8');

    // 更新 frontmatter
    const updatedContent = this.ensureSourceField(content, 'manual');

    // 写入 manual/
    await this.writeManual(item.category, item.slug, updatedContent);

    // 删除 auto/ 文件
    await this.delete(path);

    logger.debug(`Promoted ${path} to manual`);
    return true;
  }

  // ========== 私有方法 ==========

  /**
   * 解析知识文件
   */
  private async parseKnowledgeFile(
    filePath: string,
    source: 'auto' | 'manual',
    category: string,
    slug: string
  ): Promise<KnowledgeItem> {
    const content = await readFile(filePath, 'utf-8');

    // 解析 frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
    let frontmatter: KnowledgeFrontmatter;
    let bodyContent = content;

    if (frontmatterMatch) {
      try {
        // 简单的 YAML 解析（对于复杂情况可以使用 yaml 库）
        frontmatter = this.parseYaml(frontmatterMatch[1] ?? '');
        bodyContent = content.slice(frontmatterMatch[0].length).trim();
      } catch (error) {
        logger.warn(`Failed to parse frontmatter in ${filePath}:`, { error });
        frontmatter = this.createDefaultFrontmatter(category, slug, source);
      }
    } else {
      frontmatter = this.createDefaultFrontmatter(category, slug, source);
    }

    return {
      path: `${source}/${category}/${slug}`,
      category,
      slug,
      source,
      frontmatter,
      content: bodyContent
    };
  }

  /**
   * 简单的 YAML 解析器
   */
  private parseYaml(yaml: string): KnowledgeFrontmatter {
    const result: Record<string, unknown> = {};

    for (const line of yaml.split('\n')) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;

        if (value === undefined) {
          continue;
        }

        // 处理数组
        if (value.startsWith('[') && value.endsWith(']')) {
          result[key as keyof Record<string, unknown>] = value
            .slice(1, -1)
            .split(',')
            .map(v => v.trim().replace(/^"|"$/g, ''))
            .filter(v => v.length > 0);
        }
        // 处理布尔值
        else if (value === 'true') {
          result[key as keyof Record<string, unknown>] = true;
        } else if (value === 'false') {
          result[key as keyof Record<string, unknown>] = false;
        }
        // 处理数字
        else if (/^\d+$/.test(value)) {
          result[key as keyof Record<string, unknown>] = parseInt(value, 10);
        }
        // 字符串
        else {
          result[key as keyof Record<string, unknown>] = value.replace(/^"|"$/g, '');
        }
      }
    }

    // 确保必需字段存在
    const today = new Date().toISOString().split('T')[0] as string;
    return {
      title: (result.title as string | undefined) || 'Untitled',
      category: (result.category as string | undefined) || 'unknown',
      tags: (result.tags as string[] | undefined) || [],
      discovered: (result.discovered as string | undefined) || today,
      source: (result.source as 'auto' | 'manual' | undefined) || 'auto',
      severity: result.severity as KnowledgeFrontmatter['severity'],
      occurrences: result.occurrences as number | undefined,
      related_sessions: result.related_sessions as string[] | undefined,
      manual_edited: result.manual_edited as boolean | undefined,
      reflector_can_update: result.reflector_can_update as boolean | undefined,
      version: result.version as number | undefined
    };
  }

  /**
   * 创建默认 frontmatter
   */
  private createDefaultFrontmatter(
    category: string,
    slug: string,
    source: 'auto' | 'manual'
  ): KnowledgeFrontmatter {
    const today = new Date().toISOString().split('T')[0] as string;
    return {
      title: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      category,
      tags: [],
      discovered: today,
      source,
      reflector_can_update: source === 'auto'
    };
  }

  /**
   * 确保 frontmatter 中有 source 字段
   */
  private ensureSourceField(content: string, source: 'auto' | 'manual'): string {
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);

    if (frontmatterMatch) {
      const yaml = frontmatterMatch[1] ?? '';
      const sourceMatch = yaml.match(/^source:\s*\w+$/m);

      if (sourceMatch) {
        // 替换现有的 source
        const updatedYaml = yaml.replace(/^source:\s*\w+$/m, `source: ${source}`);
        return content.replace(/^---\n[\s\S]+?\n---/, `---\n${updatedYaml}\n---`);
      } else {
        // 添加 source
        const updatedYaml = `${yaml}\nsource: ${source}`;
        return content.replace(/^---\n[\s\S]+?\n---/, `---\n${updatedYaml}\n---`);
      }
    } else {
      // 添加完整的 frontmatter
      const defaultFrontmatter = this.createDefaultFrontmatter('unknown', 'item', source);
      const yaml = Object.entries(defaultFrontmatter)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join('\n');
      return `---\n${yaml}\n---\n\n${content}`;
    }
  }

  /**
   * 格式化知识项为 Markdown
   */
  private formatKnowledgeItem(item: KnowledgeItem): string {
    const yaml = Object.entries(item.frontmatter)
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          return `${k}: [${v.map(x => `"${x}"`).join(', ')}]`;
        }
        return `${k}: ${JSON.stringify(v)}`;
      })
      .join('\n');

    return `---\n${yaml}\n---\n\n${item.content}`;
  }

  /**
   * 获取文件路径
   */
  private getFilePath(item: KnowledgeItem): string {
    const baseDir = item.source === 'auto' ? this.autoDir : this.manualDir;
    return join(baseDir, item.category, `${item.slug}.md`);
  }
}
