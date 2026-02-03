/**
 * Skill Collector - 模式候选收集器
 *
 * 负责从 Agent 执行过程中收集模式候选
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { getLogger } from '../../core/logger/index.js';
import type {
  PatternCandidate,
  SkillCollectorConfig
} from './SkillTypes.js';

const logger = getLogger('evolution:skills:collector');

/**
 * 模式候选收集器
 */
export class SkillCollector {
  private readonly config: SkillCollectorConfig;
  private readonly candidatesFile: string;
  private readonly archivedCandidatesFile: string;
  private candidates: Map<string, PatternCandidate[]> = new Map();

  constructor(
    private readonly evoagentDir: string,
    config?: Partial<SkillCollectorConfig>
  ) {
    this.config = {
      minOccurrence: config?.minOccurrence ?? 3,
      confidenceThreshold: config?.confidenceThreshold ?? 0.7,
      maxCandidates: config?.maxCandidates ?? 1000
    };
    this.candidatesFile = join(evoagentDir, 'pattern-candidates.jsonl');
    this.archivedCandidatesFile = join(evoagentDir, 'pattern-candidates.archived.jsonl');
  }

  /**
   * 初始化收集器
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(this.evoagentDir, { recursive: true });
      await this.loadCandidates();
      logger.info(`SkillCollector initialized with ${this.getTotalCandidateCount()} candidates`);
    } catch (error) {
      logger.warn('Failed to initialize SkillCollector', { error });
      // 创建空文件
      await fs.writeFile(this.candidatesFile, '', 'utf-8');
    }
  }

  /**
   * 记录模式候选
   */
  async recordCandidate(
    pattern: string,
    snippet: string,
    context: {
      sessionId: string;
      agentType: string;
      context?: string;
    }
  ): Promise<void> {
    const candidate: PatternCandidate = {
      timestamp: new Date().toISOString(),
      pattern: this.normalizePatternName(pattern),
      occurrence: 1,
      sessionId: context.sessionId,
      snippet: snippet.slice(0, 500), // 限制大小
      context: context.context,
      agentType: context.agentType
    };

    // 检查是否已存在类似模式
    const existing = this.candidates.get(candidate.pattern);
    if (existing && existing.length > 0) {
      // 更新出现次数
      candidate.occurrence = existing.length + 1;
    }

    // 添加到内存缓存
    if (!this.candidates.has(candidate.pattern)) {
      this.candidates.set(candidate.pattern, []);
    }
    this.candidates.get(candidate.pattern)!.push(candidate);

    // 追加到文件
    await this.appendCandidateToFile(candidate);

    logger.debug(`Recorded pattern candidate: ${candidate.pattern} (occurrence: ${candidate.occurrence})`);
  }

  /**
   * 从代码片段中提取模式
   */
  extractPatternsFromCode(
    code: string,
    language: string,
    context: { sessionId: string; agentType: string }
  ): string[] {
    const patterns: string[] = [];

    // 基于常见模式进行提取
    switch (language) {
      case 'typescript':
      case 'javascript':
        patterns.push(...this.extractJSPatterns(code));
        break;
      case 'python':
        patterns.push(...this.extractPythonPatterns(code));
        break;
      case 'rust':
        patterns.push(...this.extractRustPatterns(code));
        break;
      // 可扩展更多语言
    }

    // 异步记录模式
    for (const pattern of patterns) {
      this.recordCandidate(pattern, code.slice(0, 200), context).catch(err => {
        logger.warn('Failed to record pattern', { error: err });
      });
    }

    return patterns;
  }

  /**
   * 获取达到阈值的模式
   */
  getReadyPatterns(
    minOccurrence?: number,
    minConfidence?: number
  ): Array<{ pattern: string; candidates: PatternCandidate[] }> {
    const threshold = minOccurrence ?? this.config.minOccurrence;
    const ready: Array<{ pattern: string; candidates: PatternCandidate[] }> = [];

    for (const [pattern, candidates] of this.candidates.entries()) {
      if (candidates.length >= threshold) {
        // 计算置信度
        const confidence = this.calculateConfidence(candidates);
        if (confidence >= (minConfidence ?? this.config.confidenceThreshold)) {
          ready.push({ pattern, candidates });
        }
      }
    }

    // 按出现次数排序
    ready.sort((a, b) => b.candidates.length - a.candidates.length);

    return ready;
  }

  /**
   * 获取模式的所有候选
   */
  getCandidates(pattern: string): PatternCandidate[] {
    return this.candidates.get(pattern) || [];
  }

  /**
   * 获取所有模式
   */
  getAllPatterns(): string[] {
    return Array.from(this.candidates.keys());
  }

  /**
   * 归档已处理的模式
   */
  async archivePatterns(patterns: string[]): Promise<void> {
    const archivedCandidates: PatternCandidate[] = [];

    for (const pattern of patterns) {
      const candidates = this.candidates.get(pattern);
      if (candidates) {
        archivedCandidates.push(...candidates);
        this.candidates.delete(pattern);
      }
    }

    if (archivedCandidates.length === 0) {
      return;
    }

    // 追加到归档文件
    try {
      for (const candidate of archivedCandidates) {
        await fs.appendFile(
          this.archivedCandidatesFile,
          JSON.stringify(candidate) + '\n',
          'utf-8'
        );
      }
      logger.info(`Archived ${archivedCandidates.length} pattern candidates for ${patterns.length} patterns`);
    } catch (error) {
      logger.error('Failed to archive patterns', { error });
    }
  }

  /**
   * 清理过期的候选
   */
  async cleanupOldCandidates(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let removed = 0;

    for (const [pattern, candidates] of this.candidates.entries()) {
      const filtered = candidates.filter(c => {
        const candidateDate = new Date(c.timestamp);
        return candidateDate > cutoffDate;
      });

      if (filtered.length < candidates.length) {
        removed += candidates.length - filtered.length;
        if (filtered.length > 0) {
          this.candidates.set(pattern, filtered);
        } else {
          this.candidates.delete(pattern);
        }
      }
    }

    if (removed > 0) {
      // 重写文件
      await this.rewriteCandidatesFile();
      logger.info(`Cleaned up ${removed} old pattern candidates`);
    }

    return removed;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalPatterns: number;
    totalCandidates: number;
    readyPatterns: number;
    topPatterns: Array<{ pattern: string; count: number }>;
  } {
    const topPatterns: Array<{ pattern: string; count: number }> = [];

    for (const [pattern, candidates] of this.candidates.entries()) {
      topPatterns.push({ pattern, count: candidates.length });
    }

    topPatterns.sort((a, b) => b.count - a.count);

    return {
      totalPatterns: this.candidates.size,
      totalCandidates: this.getTotalCandidateCount(),
      readyPatterns: this.getReadyPatterns().length,
      topPatterns: topPatterns.slice(0, 10)
    };
  }

  /**
   * 从文件加载候选
   */
  private async loadCandidates(): Promise<void> {
    try {
      const content = await fs.readFile(this.candidatesFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      for (const line of lines) {
        try {
          const candidate: PatternCandidate = JSON.parse(line);
          const pattern = candidate.pattern;

          if (!this.candidates.has(pattern)) {
            this.candidates.set(pattern, []);
          }
          this.candidates.get(pattern)!.push(candidate);
        } catch {
          // 跳过无效行
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('Failed to load candidates', { error });
      }
    }
  }

  /**
   * 追加候选到文件
   */
  private async appendCandidateToFile(candidate: PatternCandidate): Promise<void> {
    try {
      await fs.appendFile(
        this.candidatesFile,
        JSON.stringify(candidate) + '\n',
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to append candidate to file', { error });
    }
  }

  /**
   * 重写候选文件
   */
  private async rewriteCandidatesFile(): Promise<void> {
    const lines: string[] = [];

    for (const candidates of this.candidates.values()) {
      for (const candidate of candidates) {
        lines.push(JSON.stringify(candidate));
      }
    }

    await fs.writeFile(this.candidatesFile, lines.join('\n') + '\n', 'utf-8');
  }

  /**
   * 规范化模式名称
   */
  private normalizePatternName(pattern: string): string {
    return pattern
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(candidates: PatternCandidate[]): number {
    if (candidates.length < 3) return 0;

    // 基于多个因素计算置信度
    // 1. 出现次数 (最多贡献 0.4)
    const occurrenceScore = Math.min(candidates.length / 10, 0.4);

    // 2. 多样性 (不同 session 的比例，贡献 0.3)
    const uniqueSessions = new Set(candidates.map(c => c.sessionId)).size;
    const diversityScore = Math.min(uniqueSessions / candidates.length, 0.3);

    // 3. 一致性 (相似片段的比例，贡献 0.3)
    const avgSnippetLength = candidates.reduce((sum, c) => sum + c.snippet.length, 0) / candidates.length;
    const consistencyScore = Math.min(avgSnippetLength / 200, 0.3);

    return occurrenceScore + diversityScore + consistencyScore;
  }

  /**
   * 获取总候选数
   */
  private getTotalCandidateCount(): number {
    let total = 0;
    for (const candidates of this.candidates.values()) {
      total += candidates.length;
    }
    return total;
  }

  /**
   * 提取 JavaScript/TypeScript 模式
   */
  private extractJSPatterns(code: string): string[] {
    const patterns: string[] = [];

    // 函数组件模式
    if (/export\s+(async\s+)?function\s+\w+/.test(code)) {
      patterns.push('function-export');
    }
    if (/export\s+const\s+\w+\s*=\s*\(/.test(code)) {
      patterns.push('arrow-function-export');
    }

    // React 组件模式
    if (/export\s+function\s+\w+\([^)]*\)\s*:\s*React\.FC/.test(code) ||
        /export\s+function\s+\w+\([^)]*\)\s*{\s*return\s*</.test(code)) {
      patterns.push('react-function-component');
    }

    // Hook 模式
    if (/use[A-Z]\w+/.test(code)) {
      patterns.push('custom-hook');
    }

    // Class 模式
    if (/export\s+class\s+\w+/.test(code)) {
      patterns.push('class-export');
    }

    // async/await 模式
    if (/\bawait\s+/.test(code) && /\basync\s+/.test(code)) {
      patterns.push('async-await');
    }

    // Promise 链式调用
    if (/\.\s*then\s*\(/.test(code)) {
      patterns.push('promise-chain');
    }

    return patterns;
  }

  /**
   * 提取 Python 模式
   */
  private extractPythonPatterns(code: string): string[] {
    const patterns: string[] = [];

    // async def 模式
    if (/async\s+def\s+\w+/.test(code)) {
      patterns.push('async-function');
    }

    // class 模式
    if (/^class\s+\w+/.test(code)) {
      patterns.push('class-definition');
    }

    // decorator 模式
    if (/@\w+/.test(code)) {
      patterns.push('decorator');
    }

    // context manager 模式
    if (/with\s+\w+/.test(code)) {
      patterns.push('context-manager');
    }

    return patterns;
  }

  /**
   * 提取 Rust 模式
   */
  private extractRustPatterns(code: string): string[] {
    const patterns: string[] = [];

    // async fn 模式
    if (/async\s+fn\s+\w+/.test(code)) {
      patterns.push('async-function');
    }

    // impl 模式
    if (/impl\s+\w+/.test(code)) {
      patterns.push('trait-implementation');
    }

    // macro 模式
    if (/\w+!/.test(code)) {
      patterns.push('macro-invocation');
    }

    return patterns;
  }
}
