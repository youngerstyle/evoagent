/**
 * Commit Analyzer
 *
 * 分析 Git 提交历史，提取统计信息和模式
 */

import { getLogger } from '../../core/logger/index.js';
import { GitClient } from './GitClient.js';
import type {
  GitCommit,
  GitLogOptions,
  GitAnalysis,
  AuthorStats,
  FileChangeStats,
  PatternMatch
} from './GitIntegrationTypes.js';

const logger = getLogger('evolution:git:analyzer');

// 提交消息模式
const COMMIT_PATTERNS = {
  bugFix: /^(fix|bugfix|fixes|fixed|fixing)\s*[:#\-]?\s*/i,
  feature: /^(feat|feature|features?)\s*[:#\-]?\s*/i,
  refactor: /^(refactor|refactored?|refactoring)\s*[:#\-]?\s*/i,
  docs: /^(doc|docs|documentation)\s*[:#\-]?\s*/i,
  test: /^(test|tests?|testing)\s*[:#\-]?\s*/i,
  chore: /^(chore|build|ci)\s*[:#\-]?\s*/i
};

/**
 * CommitAnalyzer - 提交历史分析器
 */
export class CommitAnalyzer {
  private client: GitClient;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTtl: number = 5 * 60 * 1000; // 5分钟

  constructor(client: GitClient) {
    this.client = client;
  }

  /**
   * 分析仓库历史
   */
  async analyze(options?: GitLogOptions): Promise<GitAnalysis> {
    const cacheKey = `analyze:${JSON.stringify(options)}`;
    const cached = this.getFromCache<GitAnalysis>(cacheKey);
    if (cached) {
      return cached;
    }

    const commits = await this.client.getLog(options);

    const analysis: GitAnalysis = {
      totalCommits: commits.length,
      totalFiles: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      authors: this.analyzeAuthors(commits),
      commitsByDay: this.groupCommitsByDay(commits),
      commitsByHour: this.groupCommitsByHour(commits),
      fileChanges: this.analyzeFileChanges(commits),
      commonPatterns: this.analyzePatterns(commits)
    };

    // 计算总文件数
    const uniqueFiles = new Set<string>();
    for (const commit of commits) {
      commit.files.forEach(f => uniqueFiles.add(f));
    }
    analysis.totalFiles = uniqueFiles.size;

    // 计算总变更数
    for (const commit of commits) {
      if (commit.stats) {
        analysis.totalAdditions += commit.stats.additions;
        analysis.totalDeletions += commit.stats.deletions;
      }
    }

    this.setCache(cacheKey, analysis);
    return analysis;
  }

  /**
   * 分析作者统计
   */
  private analyzeAuthors(commits: GitCommit[]): AuthorStats[] {
    const authorMap = new Map<string, AuthorStats>();

    for (const commit of commits) {
      const key = commit.authorEmail;
      let stats = authorMap.get(key);

      if (!stats) {
        stats = {
          author: commit.author,
          email: commit.authorEmail,
          commits: 0,
          additions: 0,
          deletions: 0,
          firstCommit: commit.timestamp,
          lastCommit: commit.timestamp
        };
        authorMap.set(key, stats);
      }

      stats.commits++;
      if (commit.stats) {
        stats.additions += commit.stats.additions;
        stats.deletions += commit.stats.deletions;
      }

      if (commit.timestamp < stats.firstCommit) {
        stats.firstCommit = commit.timestamp;
      }
      if (commit.timestamp > stats.lastCommit) {
        stats.lastCommit = commit.timestamp;
      }
    }

    return Array.from(authorMap.values()).sort((a, b) => b.commits - a.commits);
  }

  /**
   * 按日期分组提交
   */
  private groupCommitsByDay(commits: GitCommit[]): Record<string, number> {
    const byDay: Record<string, number> = {};

    for (const commit of commits) {
      const date = new Date(commit.timestamp * 1000);
      const key = date.toISOString().split('T')[0] || date.toDateString();
      byDay[key] = (byDay[key] || 0) + 1;
    }

    return byDay;
  }

  /**
   * 按小时分组提交
   */
  private groupCommitsByHour(commits: GitCommit[]): Record<number, number> {
    const byHour: Record<number, number> = {};

    for (const commit of commits) {
      const date = new Date(commit.timestamp * 1000);
      const hour = date.getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
    }

    return byHour;
  }

  /**
   * 分析文件变更
   */
  private analyzeFileChanges(commits: GitCommit[]): FileChangeStats[] {
    const fileMap = new Map<string, FileChangeStats>();

    for (const commit of commits) {
      for (const file of commit.files) {
        let stats = fileMap.get(file);

        if (!stats) {
          stats = {
            path: file,
            commits: 0,
            authors: [],
            additions: 0,
            deletions: 0
          };
          fileMap.set(file, stats);
        }

        stats.commits++;

        if (!stats.authors.includes(commit.author)) {
          stats.authors.push(commit.author);
        }

        // 注意：这里只是粗略估计，因为 commit.files 不包含具体的增删行数
        // 真实的文件级别统计需要解析每个文件的 diff
      }
    }

    // 从 commit.stats 中按文件比例分配增删数
    for (const commit of commits) {
      if (commit.stats && commit.files.length > 0) {
        const perFileAdditions = Math.floor(commit.stats.additions / commit.files.length);
        const perFileDeletions = Math.floor(commit.stats.deletions / commit.files.length);

        for (const file of commit.files) {
          const stats = fileMap.get(file);
          if (stats) {
            stats.additions += perFileAdditions;
            stats.deletions += perFileDeletions;
          }
        }
      }
    }

    return Array.from(fileMap.values())
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 100); // 限制返回前100个文件
  }

  /**
   * 分析提交模式
   */
  private analyzePatterns(commits: GitCommit[]): PatternMatch[] {
    const patternsMap: Record<string, PatternMatch> = {
      bug_fix: { pattern: 'bug_fix', type: 'bug_fix', count: 0, examples: [] },
      feature: { pattern: 'feature', type: 'feature', count: 0, examples: [] },
      refactor: { pattern: 'refactor', type: 'refactor', count: 0, examples: [] },
      docs: { pattern: 'docs', type: 'docs', count: 0, examples: [] },
      test: { pattern: 'test', type: 'test', count: 0, examples: [] },
      chore: { pattern: 'chore', type: 'chore', count: 0, examples: [] },
      unknown: { pattern: 'unknown', type: 'unknown', count: 0, examples: [] }
    };

    for (const commit of commits) {
      const summary = commit.summary;
      let matched = false;

      if (COMMIT_PATTERNS.bugFix.test(summary)) {
        const p = patternsMap.bug_fix;
        if (p) {
          p.count++;
          if (p.examples.length < 5) p.examples.push(summary);
        }
        matched = true;
      }

      if (COMMIT_PATTERNS.feature.test(summary)) {
        const p = patternsMap.feature;
        if (p) {
          p.count++;
          if (p.examples.length < 5) p.examples.push(summary);
        }
        matched = true;
      }

      if (COMMIT_PATTERNS.refactor.test(summary)) {
        const p = patternsMap.refactor;
        if (p) {
          p.count++;
          if (p.examples.length < 5) p.examples.push(summary);
        }
        matched = true;
      }

      if (COMMIT_PATTERNS.docs.test(summary)) {
        const p = patternsMap.docs;
        if (p) {
          p.count++;
          if (p.examples.length < 5) p.examples.push(summary);
        }
        matched = true;
      }

      if (COMMIT_PATTERNS.test.test(summary)) {
        const p = patternsMap.test;
        if (p) {
          p.count++;
          if (p.examples.length < 5) p.examples.push(summary);
        }
        matched = true;
      }

      if (COMMIT_PATTERNS.chore.test(summary)) {
        const p = patternsMap.chore;
        if (p) {
          p.count++;
          if (p.examples.length < 5) p.examples.push(summary);
        }
        matched = true;
      }

      if (!matched) {
        const p = patternsMap.unknown;
        if (p) {
          p.count++;
          if (p.examples.length < 5) p.examples.push(summary);
        }
      }
    }

    return Object.values(patternsMap).sort((a, b) => b.count - a.count);
  }

  /**
   * 获取热门文件
   */
  async getTopFiles(limit: number = 10, options?: GitLogOptions): Promise<FileChangeStats[]> {
    const analysis = await this.analyze(options);
    return analysis.fileChanges.slice(0, limit);
  }

  /**
   * 获取活跃作者
   */
  async getTopAuthors(limit: number = 10, options?: GitLogOptions): Promise<AuthorStats[]> {
    const analysis = await this.analyze(options);
    return analysis.authors.slice(0, limit);
  }

  /**
   * 获取提交趋势
   */
  async getCommitTrend(days: number = 30): Promise<Array<{ date: string; count: number }>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const commits = await this.client.getLog({ since });
    const byDay = this.groupCommitsByDay(commits);

    // 填充缺失的日期
    const trend: Array<{ date: string; count: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0] || date.toDateString();
      trend.push({
        date: key,
        count: byDay[key] || 0
      });
    }

    return trend;
  }

  /**
   * 分析提交范围
   */
  async analyzeCommitRange(from: string, to: string): Promise<{
    commits: GitCommit[];
    summary: {
      total: number;
      byType: Record<string, number>;
      byAuthor: Record<string, number>;
    };
  }> {
    const commits: GitCommit[] = [];

    // 获取范围内的提交
    let current = to;
    while (current && current !== from) {
      const commit = await this.client.getCommit(current);
      if (!commit) break;

      commits.push(commit);

      // 获取父提交
      try {
        const { stdout } = await (this.client as any).exec(['rev-parse', `${current}^`]);
        current = stdout.trim();
      } catch {
        break;
      }

      if (commits.length > 1000) break; // 安全限制
    }

    const summary = {
      total: commits.length,
      byType: {} as Record<string, number>,
      byAuthor: {} as Record<string, number>
    };

    for (const commit of commits) {
      // 按类型统计
      let type = 'unknown';
      if (COMMIT_PATTERNS.feature.test(commit.summary)) type = 'feature';
      else if (COMMIT_PATTERNS.bugFix.test(commit.summary)) type = 'bug_fix';
      else if (COMMIT_PATTERNS.refactor.test(commit.summary)) type = 'refactor';
      else if (COMMIT_PATTERNS.docs.test(commit.summary)) type = 'docs';
      else if (COMMIT_PATTERNS.test.test(commit.summary)) type = 'test';
      else if (COMMIT_PATTERNS.chore.test(commit.summary)) type = 'chore';

      summary.byType[type] = (summary.byType[type] || 0) + 1;

      // 按作者统计
      summary.byAuthor[commit.author] = (summary.byAuthor[commit.author] || 0) + 1;
    }

    return { commits, summary };
  }

  /**
   * 检测提交质量
   */
  assessCommitQuality(commits: GitCommit[]): {
    score: number;
    issues: Array<{ commit: string; issue: string; severity: 'low' | 'medium' | 'high' }>;
    suggestions: string[];
  } {
    let score = 100;
    const issues: Array<{ commit: string; issue: string; severity: 'low' | 'medium' | 'high' }> = [];
    const suggestions: string[] = [];

    for (const commit of commits) {
      // 检查提交消息格式
      if (commit.summary.length < 10) {
        score -= 5;
        issues.push({
          commit: commit.shortHash,
          issue: 'Commit message too short',
          severity: 'low'
        });
      }

      // 检查是否有详细的描述
      if (!commit.body && commit.stats && commit.stats.changes > 100) {
        score -= 2;
        issues.push({
          commit: commit.shortHash,
          issue: 'Large commit without description',
          severity: 'low'
        });
      }

      // 检查是否包含 "fixup" 或 "wip"
      if (/fixup|wip|todo|xxxxx/i.test(commit.summary)) {
        score -= 10;
        issues.push({
          commit: commit.shortHash,
          issue: 'Commit appears to be temporary',
          severity: 'medium'
        });
      }

      // 检查是否包含合并提交
      if (/^Merge branch/.test(commit.summary)) {
        // 合并提交不算质量问题，但可以标记
      }

      // 检查是否有太多的文件变更
      if (commit.files.length > 20) {
        score -= 5;
        issues.push({
          commit: commit.shortHash,
          issue: `Too many files changed (${commit.files.length})`,
          severity: 'medium'
        });
        suggestions.push(`Consider splitting commit ${commit.shortHash} into smaller, focused commits`);
      }
    }

    if (issues.length > 0) {
      suggestions.push('Review commit message guidelines and ensure each commit has a clear, descriptive message');
      suggestions.push('Consider using conventional commit format (feat:, fix:, docs:, etc.)');
    }

    return {
      score: Math.max(0, score),
      issues,
      suggestions
    };
  }

  /**
   * 从缓存获取
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.data as T;
    }
    return null;
  }

  /**
   * 设置缓存
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('CommitAnalyzer cache cleared');
  }
}
