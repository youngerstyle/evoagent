/**
 * Git Integration
 *
 * Git 集成主类，整合 Git 操作、分析和提取功能
 */

import { GitClient } from './GitClient.js';
import { CommitAnalyzer } from './CommitAnalyzer.js';
import { ChangeExtractor } from './ChangeExtractor.js';
import type {
  GitIntegrationConfig,
  GitLogOptions,
  GitAnalysis,
  ChangeExtraction,
  GitReport,
  CommitExperienceLink,
  CommitReflectionLink
} from './GitIntegrationTypes.js';
import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('evolution:git:integration');

/**
 * GitIntegration - Git 集成主类
 */
export class GitIntegration {
  private client: GitClient;
  private analyzer: CommitAnalyzer;
  private extractor: ChangeExtractor;
  private experienceLinks: Map<string, CommitExperienceLink[]> = new Map();
  private reflectionLinks: Map<string, CommitReflectionLink[]> = new Map();

  constructor(config: GitIntegrationConfig) {
    this.client = new GitClient(config.repoPath, config.gitPath);
    this.analyzer = new CommitAnalyzer(this.client);
    this.extractor = new ChangeExtractor(
      this.client,
      config.extractionConfig?.maxContextLines || 5
    );
  }

  /**
   * 初始化
   */
  async init(): Promise<boolean> {
    const success = await this.client.init();
    if (success) {
      logger.info('GitIntegration initialized successfully');
    }
    return success;
  }

  /**
   * 获取 Git 客户端
   */
  getClient(): GitClient {
    return this.client;
  }

  /**
   * 获取分析器
   */
  getAnalyzer(): CommitAnalyzer {
    return this.analyzer;
  }

  /**
   * 获取提取器
   */
  getExtractor(): ChangeExtractor {
    return this.extractor;
  }

  /**
   * 分析仓库
   */
  async analyze(options?: GitLogOptions): Promise<GitAnalysis> {
    return this.analyzer.analyze(options);
  }

  /**
   * 从提交中提取变更
   */
  async extract(commitHash: string): Promise<ChangeExtraction> {
    return this.extractor.extractFromCommit(commitHash);
  }

  /**
   * 批量提取
   */
  async extractBatch(commitHashes: string[]): Promise<ChangeExtraction[]> {
    return this.extractor.extractFromCommits(commitHashes);
  }

  /**
   * 生成报告
   */
  async generateReport(options: {
    title?: string;
    timeRange?: { start: Date; end: Date };
    includeCommits?: boolean;
    limit?: number;
  }): Promise<GitReport> {
    const logOptions: GitLogOptions = {
      limit: options.limit || 100
    };

    if (options.timeRange) {
      logOptions.since = options.timeRange.start;
      logOptions.until = options.timeRange.end;
    }

    const commits = await this.client.getLog(logOptions);
    const analysis = await this.analyzer.analyze(logOptions);

    const report: GitReport = {
      title: options.title || 'Git Repository Report',
      timeRange: {
        start: options.timeRange?.start || new Date(commits[commits.length - 1]?.timestamp || Date.now()),
        end: options.timeRange?.end || new Date(commits[0]?.timestamp || Date.now())
      },
      summary: {
        totalCommits: analysis.totalCommits,
        totalFiles: analysis.totalFiles,
        totalAdditions: analysis.totalAdditions,
        totalDeletions: analysis.totalDeletions,
        topContributors: analysis.authors.slice(0, 5).map(a => ({
          name: a.author,
          commits: a.commits
        })),
        mostChangedFiles: analysis.fileChanges.slice(0, 10).map(f => ({
          path: f.path,
          changes: f.commits
        }))
      },
      commits: options.includeCommits ? commits : [],
      authors: analysis.authors,
      changes: analysis.fileChanges,
      insights: this.generateInsights(analysis),
      generatedAt: Date.now()
    };

    return report;
  }

  /**
   * 关联提交与经验
   */
  linkExperience(link: CommitExperienceLink): void {
    const links = this.experienceLinks.get(link.commitHash) || [];
    links.push(link);
    this.experienceLinks.set(link.commitHash, links);
    logger.debug(`Linked experience ${link.experienceId} to commit ${link.commitHash}`);
  }

  /**
   * 关联提交与反思
   */
  linkReflection(link: CommitReflectionLink): void {
    const links = this.reflectionLinks.get(link.commitHash) || [];
    links.push(link);
    this.reflectionLinks.set(link.commitHash, links);
    logger.debug(`Linked reflection ${link.reflectionId} to commit ${link.commitHash}`);
  }

  /**
   * 获取提交的经验关联
   */
  getExperienceLinks(commitHash: string): CommitExperienceLink[] {
    return this.experienceLinks.get(commitHash) || [];
  }

  /**
   * 获取提交的反思关联
   */
  getReflectionLinks(commitHash: string): CommitReflectionLink[] {
    return this.reflectionLinks.get(commitHash) || [];
  }

  /**
   * 查找相关提交
   */
  async findRelatedCommits(experienceId: string): Promise<string[]> {
    const relatedCommits: string[] = [];

    for (const [commitHash, links] of this.experienceLinks) {
      if (links.some(l => l.experienceId === experienceId)) {
        relatedCommits.push(commitHash);
      }
    }

    return relatedCommits;
  }

  /**
   * 智能提交
   */
  async smartCommit(message: string, options: {
    addPatterns?: string[];
    stageAll?: boolean;
      } = {}): Promise<boolean> {
    try {
      // 添加文件
      if (options.stageAll) {
        await this.client['exec'](['add', '-A']);
      } else if (options.addPatterns) {
        for (const pattern of options.addPatterns) {
          await this.client['exec'](['add', pattern]);
        }
      }

      // 提交
      await this.client['exec'](['commit', '-m', message]);

      logger.info('Smart commit completed');
      return true;
    } catch (error) {
      logger.error('Smart commit failed:', error);
      return false;
    }
  }

  /**
   * 分析最近的活动
   */
  async analyzeRecentActivity(days: number = 7): Promise<{
    commits: number;
    files: number;
    authors: number;
    trend: Array<{ date: string; count: number }>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const analysis = await this.analyzer.analyze({ since });
    const trend = await this.analyzer.getCommitTrend(days);

    return {
      commits: analysis.totalCommits,
      files: analysis.totalFiles,
      authors: analysis.authors.length,
      trend
    };
  }

  /**
   * 获取变更摘要
   */
  async getChangeSummary(from: string, to: string = 'HEAD'): Promise<{
    commits: number;
    files: number;
    authors: Array<{ name: string; commits: number }>;
    breakdown: Record<string, number>;
  }> {
    const commits = await this.client.getLog({ since: from, until: to });

    const authorCounts = new Map<string, number>();
    const breakdown: Record<string, number> & {
      feature: number;
      bug_fix: number;
      refactor: number;
      docs: number;
      test: number;
      chore: number;
      unknown: number;
    } = {
      feature: 0,
      bug_fix: 0,
      refactor: 0,
      docs: 0,
      test: 0,
      chore: 0,
      unknown: 0
    };

    const files = new Set<string>();

    for (const commit of commits) {
      authorCounts.set(commit.author, (authorCounts.get(commit.author) || 0) + 1);
      commit.files.forEach(f => files.add(f));

      // 分类提交
      const summary = commit.summary.toLowerCase();
      if (summary.startsWith('feat') || summary.startsWith('feature')) {
        breakdown.feature++;
      } else if (summary.startsWith('fix') || summary.startsWith('bugfix')) {
        breakdown.bug_fix++;
      } else if (summary.startsWith('refactor')) {
        breakdown.refactor++;
      } else if (summary.startsWith('doc')) {
        breakdown.docs++;
      } else if (summary.startsWith('test')) {
        breakdown.test++;
      } else if (summary.startsWith('chore')) {
        breakdown.chore++;
      } else {
        breakdown.unknown++;
      }
    }

    return {
      commits: commits.length,
      files: files.size,
      authors: Array.from(authorCounts.entries())
        .map(([name, commits]) => ({ name, commits }))
        .sort((a, b) => b.commits - a.commits),
      breakdown
    };
  }

  /**
   * 检测代码健康度
   */
  async assessCodeHealth(): Promise<{
    score: number;
    issues: string[];
    recommendations: string[];
  }> {
    const recentCommits = await this.client.getLog({ limit: 50 });
    const quality = this.analyzer.assessCommitQuality(recentCommits);

    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // 检查提交质量
    if (quality.score < 70) {
      issues.push(`Commit message quality score is ${quality.score}/100`);
      recommendations.push(...quality.suggestions);
      score -= 20;
    }

    // 检查是否有频繁的小提交
    const smallCommits = recentCommits.filter(c =>
      c.stats && c.stats.changes < 10
    ).length;

    if (smallCommits > recentCommits.length * 0.5) {
      issues.push('Many small commits detected. Consider squashing related changes.');
      score -= 10;
    }

    // 检查是否有大的单体提交
    const largeCommits = recentCommits.filter(c =>
      c.stats && c.stats.changes > 500
    ).length;

    if (largeCommits > 0) {
      issues.push(`${largeCommits} large commits detected. Consider breaking them down.`);
      score -= 15;
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  /**
   * 生成洞察
   */
  private generateInsights(analysis: GitAnalysis): string[] {
    const insights: string[] = [];

    // 提交频率洞察
    if (analysis.totalCommits > 100) {
      insights.push(`High activity: ${analysis.totalCommits} commits in the analyzed period`);
    }

    // 作者洞察
    if (analysis.authors.length > 5) {
      insights.push(`Collaborative effort: ${analysis.authors.length} contributors`);
    } else if (analysis.authors.length === 1) {
      insights.push('Single contributor project');
    }

    // 模式洞察
    const topPattern = analysis.commonPatterns[0];
    if (topPattern) {
      insights.push(`Primary work type: ${topPattern.type} (${topPattern.count} commits)`);
    }

    // 文件变更洞察
    const topFile = analysis.fileChanges[0];
    if (topFile && topFile.commits > 10) {
      insights.push(`Most active file: ${topFile.path} (${topFile.commits} changes)`);
    }

    return insights;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.analyzer.clearCache();
    logger.debug('GitIntegration cache cleared');
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.clearCache();
    this.experienceLinks.clear();
    this.reflectionLinks.clear();
    logger.info('GitIntegration destroyed');
  }
}
