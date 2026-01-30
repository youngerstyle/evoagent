/**
 * Prompt Optimizer
 *
 * 基于反思结果优化 Agent 提示词
 */

import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../core/logger/index.js';
import type {
  OptimizationConfig,
  OptimizationRequest,
  OptimizationResult,
  OptimizationResponse,
  OptimizationStrategy,
  OptimizationGoal,
  OptimizationSuggestion,
  PromptAnalysis,
  PromptIssue,
  PromptSection,
  PromptType,
  PromptVersion,
  OptimizationStats,
  OptimizationFilter,
  PatternInjection,
  BatchOptimizationRequest,
  BatchOptimizationResponse
} from './OptimizationTypes.js';

const logger = getLogger('evolution:optimizer');

/**
 * PromptOptimizer - 提示词优化器
 *
 * 功能：
 * 1. 分析提示词质量
 * 2. 生成优化建议
 * 3. 应用优化
 * 4. 管理提示词版本
 */
export class PromptOptimizer {
  private versions: Map<string, PromptVersion[]> = new Map();
  private optimizations: Map<string, OptimizationResult> = new Map();
  private patterns: Map<string, PatternInjection> = new Map();
  private config: OptimizationConfig & { disabledStrategies: OptimizationStrategy[] };

  constructor(
    config: Partial<OptimizationConfig> = {}
  ) {
    this.config = {
      goals: config.goals || ['clarity', 'effectiveness', 'safety'],
      maxIterations: config.maxIterations || 3,
      minImprovementThreshold: config.minImprovementThreshold ?? 0.1,
      autoApply: config.autoApply ?? false,
      keepBackup: config.keepBackup ?? true,
      maxSuggestions: config.maxSuggestions || 10,
      minConfidence: config.minConfidence ?? 0.6,
      disabledStrategies: config.disabledStrategies || []
    };

    // 加载内置模式
    this.loadBuiltInPatterns();

    logger.info('PromptOptimizer initialized');
  }

  /**
   * 分析提示词
   */
  analyze(prompt: string, type: PromptType = 'agent'): PromptAnalysis {
    const issues: PromptIssue[] = [];
    const sections = this.extractSections(prompt);

    // 检测问题
    issues.push(...this.detectAmbiguity(prompt));
    issues.push(...this.detectRedundancy(prompt));
    issues.push(...this.detectMissingContext(prompt, sections));
    issues.push(...this.detectVagueInstructions(prompt, sections));
    issues.push(...this.detectSafetyConcerns(prompt));

    // 计算指标
    const metrics = {
      length: prompt.length,
      tokenEstimate: this.estimateTokens(prompt),
      clarity: this.calculateClarity(prompt, issues),
      structure: this.calculateStructure(sections),
      completeness: this.calculateCompleteness(sections, type)
    };

    return {
      prompt,
      type,
      issues,
      metrics,
      sections
    };
  }

  /**
   * 生成优化建议
   */
  generateSuggestions(
    analysis: PromptAnalysis,
    context?: OptimizationRequest['context']
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 基于问题生成建议
    for (const issue of analysis.issues) {
      const suggestion = this.suggestionFromIssue(issue);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // 基于反思结果生成建议
    if (context?.reflectionResults) {
      const reflectionSuggestions = this.suggestionsFromReflection(analysis, context);
      suggestions.push(...reflectionSuggestions);
    }

    // 基于模式生成建议
    const patternSuggestions = this.suggestionsFromPatterns(analysis);
    suggestions.push(...patternSuggestions);

    // 基于性能生成建议
    if (context?.previousPerformance) {
      const performanceSuggestions = this.suggestionsFromPerformance(analysis, context);
      suggestions.push(...performanceSuggestions);
    }

    // 过滤和排序
    return suggestions
      .filter(s => !this.config.disabledStrategies.includes(s.strategy))
      .filter(s => s.confidence >= this.config.minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxSuggestions);
  }

  /**
   * 优化提示词
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResponse> {
    const startTime = Date.now();
    const promptId = request.prompt.substring(0, 50) + '...';

    logger.debug(`Optimizing prompt: ${promptId}`);

    // 分析提示词
    const analysis = this.analyze(request.prompt, request.type);

    // 生成建议
    const suggestions = this.generateSuggestions(analysis, request.context);

    // 应用优化
    const optimizedPrompt = this.applyOptimizations(request.prompt, suggestions);

    // 计算改进
    const originalScore = this.calculatePromptScore(analysis);
    const optimizedAnalysis = this.analyze(optimizedPrompt, request.type);
    const optimizedScore = this.calculatePromptScore(optimizedAnalysis);
    const improvement = (optimizedScore - originalScore) / Math.max(originalScore, 0.01);

    // 创建结果
    const result: OptimizationResult = {
      id: uuidv4(),
      promptId,
      status: improvement >= this.config.minImprovementThreshold ? 'applied' : 'pending',
      originalPrompt: request.prompt,
      optimizedPrompt,
      suggestions,
      appliedSuggestions: suggestions.map(s => s.id),
      analysis,
      metrics: {
        originalScore,
        optimizedScore,
        improvement
      },
      timestamp: Date.now(),
      metadata: {
        iterations: 1,
        duration: Date.now() - startTime,
        strategies: suggestions.map(s => s.strategy)
      }
    };

    this.optimizations.set(result.id, result);

    // 自动应用
    let hasChanges = suggestions.length > 0;
    let canAutoApply = this.config.autoApply && improvement >= this.config.minImprovementThreshold;

    if (canAutoApply) {
      await this.applyOptimization(result);
    }

    // 保存版本
    if (this.config.keepBackup) {
      this.saveVersion(request.prompt, request.type);
    }

    const warnings: string[] = [];
    if (improvement < this.config.minImprovementThreshold) {
      warnings.push(`优化改进 (${improvement.toFixed(2)}) 低于阈值 (${this.config.minImprovementThreshold})`);
    }

    logger.info(`Optimization completed: improvement=${improvement.toFixed(2)}`);

    return {
      result,
      hasChanges,
      canAutoApply,
      warnings
    };
  }

  /**
   * 批量优化
   */
  async batchOptimize(request: BatchOptimizationRequest): Promise<BatchOptimizationResponse> {
    const results: BatchOptimizationResponse['results'] = [];
    let optimized = 0;
    let skipped = 0;
    let failed = 0;
    let totalImprovement = 0;

    for (const prompt of request.prompts) {
      try {
        const response = await this.optimize({
          prompt: prompt.prompt,
          type: prompt.type,
          config: request.config
        });

        results.push({
          id: prompt.id,
          result: response.result
        });

        if (response.hasChanges && response.result.status === 'applied') {
          optimized++;
          totalImprovement += response.result.metrics.improvement;
        } else if (!response.hasChanges) {
          skipped++;
        }
      } catch (error) {
        failed++;
        logger.error(`Failed to optimize prompt ${prompt.id}:`, error);
      }
    }

    const avgImprovement = optimized > 0 ? totalImprovement / optimized : 0;

    logger.info(`Batch optimization completed: ${optimized} optimized, ${skipped} skipped, ${failed} failed`);

    return {
      results,
      summary: {
        total: request.prompts.length,
        optimized,
        skipped,
        failed,
        avgImprovement
      }
    };
  }

  /**
   * 应用优化
   */
  async applyOptimization(result: OptimizationResult): Promise<void> {
    result.status = 'applying';
    result.appliedAt = Date.now();

    // 实际应用逻辑由调用方处理
    // 这里只更新状态
    result.status = 'applied';

    logger.debug(`Applied optimization: ${result.id}`);
  }

  /**
   * 回滚优化
   */
  rollback(optimizationId: string): boolean {
    const optimization = this.optimizations.get(optimizationId);
    if (!optimization) {
      return false;
    }

    // 如果优化已应用，可以回滚
    if (optimization.status === 'applied') {
      optimization.status = 'rolled_back';
      // 移除版本历史中的最新版本（如果存在）
      const versions = this.versions.get(optimization.promptId);
      if (versions && versions.length > 0) {
        versions.pop();
      }
      return true;
    }

    return false;
  }

  /**
   * 保存版本
   */
  saveVersion(prompt: string, _type: PromptType, description?: string): PromptVersion {
    const promptId = prompt.substring(0, 50) + '...';

    let versions = this.versions.get(promptId);
    if (!versions) {
      versions = [];
      this.versions.set(promptId, versions);
    }

    const version: PromptVersion = {
      id: uuidv4(),
      promptId,
      version: versions.length,
      prompt,
      createdAt: Date.now(),
      createdBy: 'system',
      description,
      metrics: this.analyze(prompt, _type).metrics
    };

    versions.push(version);

    return version;
  }

  /**
   * 获取版本历史
   */
  getVersions(promptId: string): PromptVersion[] {
    // 标准化 promptId 以匹配 saveVersion 中使用的格式
    const normalizedId = promptId.endsWith('...') ? promptId : promptId.substring(0, 50) + '...';
    return this.versions.get(normalizedId) || [];
  }

  /**
   * 添加模式
   */
  addPattern(pattern: PatternInjection): void {
    this.patterns.set(pattern.id, pattern);
    logger.debug(`Added pattern: ${pattern.id}`);
  }

  /**
   * 移除模式
   */
  removePattern(patternId: string): boolean {
    return this.patterns.delete(patternId);
  }

  /**
   * 获取模式
   */
  getPatterns(type?: PromptType): PatternInjection[] {
    let patterns = Array.from(this.patterns.values());

    if (type) {
      patterns = patterns.filter(p => p.applicableTo.includes(type));
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 获取优化历史
   */
  getOptimizations(filter?: OptimizationFilter): OptimizationResult[] {
    let results = Array.from(this.optimizations.values());

    if (filter) {
      if (filter.statuses) {
        results = results.filter(r => filter.statuses!.includes(r.status));
      }
      if (filter.goals) {
        // 需要从 suggestions 中筛选
        results = results.filter(r =>
          r.suggestions.some(s => filter.goals!.includes(this.strategyToGoal(s.strategy)))
        );
      }
      if (filter.strategies) {
        results = results.filter(r =>
          r.metadata.strategies.some(s => filter.strategies!.includes(s))
        );
      }
      if (filter.minImprovement) {
        results = results.filter(r => r.metrics.improvement >= filter.minImprovement!);
      }
      if (filter.timeRange) {
        results = results.filter(r =>
          r.timestamp >= filter.timeRange!.start &&
          r.timestamp <= filter.timeRange!.end
        );
      }
      if (filter.promptId) {
        results = results.filter(r => r.promptId === filter.promptId);
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 获取统计信息
   */
  getStats(): OptimizationStats {
    const stats: OptimizationStats = {
      totalOptimizations: this.optimizations.size,
      successfulOptimizations: 0,
      failedOptimizations: 0,
      avgImprovement: 0,
      optimizationsByGoal: {
        clarity: 0,
        conciseness: 0,
        effectiveness: 0,
        safety: 0,
        performance: 0
      },
      optimizationsByStrategy: {
        add_context: 0,
        remove_redundancy: 0,
        refine_instruction: 0,
        add_examples: 0,
        add_constraints: 0,
        restructure: 0,
        inject_patterns: 0,
        avoid_pitfalls: 0
      },
      totalSuggestions: 0,
      appliedSuggestions: 0,
      promptVersions: 0,
      lastOptimizationTime: undefined
    };

    let totalImprovement = 0;

    for (const opt of this.optimizations.values()) {
      if (opt.status === 'applied') {
        stats.successfulOptimizations++;
        totalImprovement += opt.metrics.improvement;
      } else if (opt.status === 'failed') {
        stats.failedOptimizations++;
      }

      for (const suggestion of opt.suggestions) {
        stats.optimizationsByGoal[this.strategyToGoal(suggestion.strategy)]++;
        stats.optimizationsByStrategy[suggestion.strategy]++;
      }

      stats.totalSuggestions += opt.suggestions.length;
      stats.appliedSuggestions += opt.appliedSuggestions.length;

      if (!stats.lastOptimizationTime || opt.timestamp > stats.lastOptimizationTime) {
        stats.lastOptimizationTime = opt.timestamp;
      }
    }

    if (stats.successfulOptimizations > 0) {
      stats.avgImprovement = totalImprovement / stats.successfulOptimizations;
    }

    stats.promptVersions = Array.from(this.versions.values())
      .reduce((sum, versions) => sum + versions.length, 0);

    return stats;
  }

  /**
   * 提取提示词区块
   */
  private extractSections(prompt: string): PromptSection[] {
    const sections: PromptSection[] = [];

    // 检测常见区块模式
    const patterns = [
      { regex: /(?:你|You are|你是一个|You are a)\s+(.{1,100}?)(?:，|,|。|\.|\n)/i, type: 'instruction' as const },
      { regex: /(?:上下文|Context|任务|Task)[:：]\s*\n([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i, type: 'context' as const },
      { regex: /(?:约束|要求|Constraints|Requirements)[:：]\s*\n([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i, type: 'constraint' as const },
      { regex: /(?:示例|Example|例子)[:：]\s*\n([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i, type: 'example' as const },
      { regex: /(?:输出格式|Output Format|格式)[:：]\s*\n([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i, type: 'output_format' as const }
    ];

    for (const pattern of patterns) {
      const match = prompt.match(pattern.regex);
      if (match) {
        sections.push({
          type: pattern.type,
          content: match[1] || match[0],
          start: match.index || 0,
          end: (match.index || 0) + match[0].length
        });
      }
    }

    return sections;
  }

  /**
   * 检测歧义
   */
  private detectAmbiguity(prompt: string): PromptIssue[] {
    const issues: PromptIssue[] = [];

    // 检测模糊词汇
    const ambiguousWords = ['可能', '也许', '大概', '尽量', '适当', 'some', 'maybe', 'possibly', 'try to'];
    for (const word of ambiguousWords) {
      // 不使用 word boundary，改用位置检测
      let index = 0;
      while ((index = prompt.indexOf(word, index)) !== -1) {
        issues.push({
          type: 'ambiguity',
          severity: 'minor',
          location: { start: index, end: index + word.length },
          message: `使用模糊词汇 "${word}"，建议使用更明确的表达`,
          suggestion: `将 "${word}" 替换为明确的指令`
        });
        index += word.length;
      }
    }

    return issues;
  }

  /**
   * 检测冗余
   */
  private detectRedundancy(prompt: string): PromptIssue[] {
    const issues: PromptIssue[] = [];

    // 检测重复句子
    const sentences = prompt.split(/[。！？.!?]+/);
    const seen = new Set<string>();

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]?.trim().toLowerCase();
      if (!sentence || sentence.length <= 10) continue;

      if (seen.has(sentence)) {
        // indexOf 返回 -1 时表示未找到，需要正确处理
        let start = prompt.indexOf(sentence);
        if (start < 0) {
          // 尝试用原始大小写查找
          const originalSentence = sentences[i]?.trim();
          start = originalSentence ? prompt.indexOf(originalSentence) : -1;
        }
        // 如果都找不到，使用 0 作为默认值
        const safeStart = start >= 0 ? start : 0;
        const length = sentences[i]?.length ?? sentence.length;
        issues.push({
          type: 'redundancy',
          severity: 'minor',
          location: { start: safeStart, end: safeStart + length },
          message: '重复的表达',
          suggestion: '删除重复的内容'
        });
      }
      seen.add(sentence);
    }

    return issues;
  }

  /**
   * 检测缺失上下文
   */
  private detectMissingContext(prompt: string, sections: PromptSection[]): PromptIssue[] {
    const issues: PromptIssue[] = [];

    // 检查是否有上下文区块
    const hasContext = sections.some(s => s.type === 'context');
    if (!hasContext) {
      issues.push({
        type: 'missing_context',
        severity: 'major',
        location: { start: 0, end: prompt.length },
        message: '缺少任务上下文信息',
        suggestion: '添加任务相关的背景信息和目标'
      });
    }

    return issues;
  }

  /**
   * 检测模糊指令
   */
  private detectVagueInstructions(prompt: string, sections: PromptSection[]): PromptIssue[] {
    const issues: PromptIssue[] = [];

    // 检查指令区块是否清晰
    const instructionSection = sections.find(s => s.type === 'instruction');
    if (!instructionSection || instructionSection.content.length < 20) {
      issues.push({
        type: 'vague_instruction',
        severity: 'major',
        location: { start: 0, end: Math.min(100, prompt.length) },
        message: '角色定义或指令不够明确',
        suggestion: '清晰定义 Agent 的角色、职责和任务目标'
      });
    }

    return issues;
  }

  /**
   * 检测安全问题
   */
  private detectSafetyConcerns(prompt: string): PromptIssue[] {
    const issues: PromptIssue[] = [];

    // 检测可能不安全的指令
    const unsafePatterns = [
      { pattern: /忽略|Ignore|跳过|Skip\s+(?:所有限制|限制|restriction|constraint)/gi, message: '指示忽略安全限制' },
      { pattern: /不要告诉我|不要显示|Don't tell|Don't show|隐藏|Hide/gi, message: '要求隐藏信息' },
      { pattern: /绕过|Bypass|突破|Break\s+(?:限制|restriction|security)/gi, message: '试图绕过安全机制' }
    ];

    for (const { pattern, message } of unsafePatterns) {
      const match = prompt.match(pattern);
      if (match) {
        issues.push({
          type: 'safety_concern',
          severity: 'critical',
          location: { start: match.index || 0, end: (match.index || 0) + match[0].length },
          message,
          suggestion: '移除可能违反安全准则的指令'
        });
      }
    }

    return issues;
  }

  /**
   * 计算清晰度
   */
  private calculateClarity(_prompt: string, issues: PromptIssue[]): number {
    let score = 1.0;

    // 每个歧义问题扣分
    const ambiguityIssues = issues.filter(i => i.type === 'ambiguity').length;
    score -= ambiguityIssues * 0.05;

    // 模糊指令扣分
    const vagueIssues = issues.filter(i => i.type === 'vague_instruction').length;
    score -= vagueIssues * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 计算结构化程度
   */
  private calculateStructure(sections: PromptSection[]): number {
    if (sections.length === 0) return 0.3;

    let score = 0.5;
    const uniqueTypes = new Set(sections.map(s => s.type));

    // 有更多类型的区块得分更高
    score += uniqueTypes.size * 0.1;

    // 有核心区块得分更高
    if (sections.some(s => s.type === 'instruction')) score += 0.1;
    if (sections.some(s => s.type === 'context')) score += 0.1;
    if (sections.some(s => s.type === 'output_format')) score += 0.1;

    return Math.min(1, score);
  }

  /**
   * 计算完整性
   */
  private calculateCompleteness(sections: PromptSection[], type: PromptType): number {
    let score = 0;

    // 基础区块
    if (sections.some(s => s.type === 'instruction')) score += 0.3;
    if (sections.some(s => s.type === 'context')) score += 0.2;

    // 类型特定区块
    if (type === 'agent') {
      if (sections.some(s => s.type === 'constraint')) score += 0.2;
      if (sections.some(s => s.type === 'example')) score += 0.15;
      if (sections.some(s => s.type === 'output_format')) score += 0.15;
    }

    return Math.min(1, score);
  }

  /**
   * 估算 token 数量
   */
  private estimateTokens(text: string): number {
    // 粗略估算：英文约 4 字符/token，中文约 2 字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = text.length - chineseChars;

    return Math.ceil(chineseChars / 2 + englishChars / 4);
  }

  /**
   * 从问题生成建议
   */
  private suggestionFromIssue(issue: PromptIssue): OptimizationSuggestion | null {
    const strategyMap: Record<string, OptimizationStrategy> = {
      ambiguity: 'refine_instruction',
      redundancy: 'remove_redundancy',
      missing_context: 'add_context',
      vague_instruction: 'refine_instruction',
      safety_concern: 'add_constraints',
      performance_issue: 'refine_instruction'
    };

    const strategy = strategyMap[issue.type];

    if (!strategy) {
      return null;
    }

    return {
      id: uuidv4(),
      strategy,
      goal: this.strategyToGoal(strategy),
      description: issue.message,
      original: '',
      suggested: issue.suggestion || '',
      reason: issue.message,
      expectedImpact: issue.severity === 'critical' ? 'high' : issue.severity === 'major' ? 'medium' : 'low',
      confidence: 0.8
    };
  }

  /**
   * 从反思结果生成建议
   */
  private suggestionsFromReflection(
    _analysis: PromptAnalysis,
    context: OptimizationRequest['context']
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    const reflectionResults = context?.reflectionResults;
    if (!reflectionResults) {
      return suggestions;
    }

    // 基于成功模式生成建议
    for (const pattern of reflectionResults.patterns || []) {
      suggestions.push({
        id: uuidv4(),
        strategy: 'inject_patterns',
        goal: 'effectiveness',
        description: `注入成功模式: ${pattern}`,
        original: '',
        suggested: `遵循以下成功模式: ${pattern}`,
        reason: '该模式在历史执行中表现出高成功率',
        expectedImpact: 'medium',
        confidence: 0.7
      });
    }

    // 基于陷阱生成建议
    for (const pitfall of reflectionResults.pitfalls || []) {
      suggestions.push({
        id: uuidv4(),
        strategy: 'avoid_pitfalls',
        goal: 'safety',
        description: `避免已知陷阱: ${pitfall}`,
        original: '',
        suggested: `注意避免: ${pitfall}`,
        reason: '该问题在历史执行中导致失败',
        expectedImpact: 'high',
        confidence: 0.8
      });
    }

    return suggestions;
  }

  /**
   * 从模式生成建议
   */
  private suggestionsFromPatterns(
    _analysis: PromptAnalysis
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    for (const pattern of this.getPatterns()) {
      suggestions.push({
        id: uuidv4(),
        strategy: 'inject_patterns',
        goal: 'effectiveness',
        description: `应用 ${pattern.type} 模式`,
        original: '',
        suggested: pattern.template,
        reason: pattern.type === 'success_pattern' ? '经过验证的成功模式' : '已知的最佳实践',
        expectedImpact: pattern.confidence > 0.8 ? 'high' : 'medium',
        confidence: pattern.confidence
      });
    }

    return suggestions;
  }

  /**
   * 从性能数据生成建议
   */
  private suggestionsFromPerformance(
    _analysis: PromptAnalysis,
    context: OptimizationRequest['context']
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    const performance = context?.previousPerformance;
    if (!performance) {
      return suggestions;
    }

    // 成功率低时建议优化
    if (performance.successRate < 0.7) {
      suggestions.push({
        id: uuidv4(),
        strategy: 'refine_instruction',
        goal: 'effectiveness',
        description: '当前成功率较低，建议优化指令',
        original: '',
        suggested: '添加更详细的步骤说明和成功标准',
        reason: `成功率仅为 ${(performance.successRate * 100).toFixed(1)}%`,
        expectedImpact: 'high',
        confidence: 0.8
      });
    }

    // 执行时间长时建议添加约束
    if (performance.avgDuration > 30000) {
      suggestions.push({
        id: uuidv4(),
        strategy: 'add_constraints',
        goal: 'performance',
        description: '执行时间较长，建议添加时间约束',
        original: '',
        suggested: '添加明确的执行时间限制和输出长度限制',
        reason: `平均执行时间 ${(performance.avgDuration / 1000).toFixed(1)}s`,
        expectedImpact: 'medium',
        confidence: 0.7
      });
    }

    return suggestions;
  }

  /**
   * 应用优化
   */
  private applyOptimizations(prompt: string, suggestions: OptimizationSuggestion[]): string {
    let optimized = prompt;

    // 按策略类型应用优化
    for (const suggestion of suggestions) {
      switch (suggestion.strategy) {
        case 'remove_redundancy':
          optimized = this.removeRedundancy(optimized);
          break;
        case 'add_context':
          optimized = this.addContext(optimized);
          break;
        case 'refine_instruction':
          optimized = this.refineInstruction(optimized);
          break;
        case 'add_constraints':
          optimized = this.addConstraints(optimized);
          break;
        case 'inject_patterns':
          optimized = this.injectPatterns(optimized, suggestion);
          break;
      }
    }

    return optimized;
  }

  /**
   * 移除冗余
   */
  private removeRedundancy(prompt: string): string {
    // 移除重复的句子
    const sentences = prompt.split(/([。！？.!?]+)/);
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        unique.push(sentence);
      } else if (!trimmed) {
        unique.push(sentence); // 保留分隔符
      }
    }

    return unique.join('');
  }

  /**
   * 添加上下文
   */
  private addContext(prompt: string): string {
    if (prompt.includes('上下文') || prompt.includes('Context')) {
      return prompt;
    }

    const contextSection = '\n## 上下文\n请根据以下背景信息执行任务：\n- 任务目标：明确任务的具体目标\n- 相关信息：提供必要的背景信息\n\n';
    return prompt + contextSection;
  }

  /**
   * 精炼指令
   */
  private refineInstruction(prompt: string): string {
    // 替换模糊词汇
    const replacements: Record<string, string> = {
      '可能': '必须',
      '也许': '应该',
      '大概': '准确',
      '尽量': '务必',
      '适当': '根据需要'
    };

    let refined = prompt;
    for (const [from, to] of Object.entries(replacements)) {
      const regex = new RegExp(from, 'gi');
      refined = refined.replace(regex, to);
    }

    return refined;
  }

  /**
   * 添加约束
   */
  private addConstraints(prompt: string): string {
    if (prompt.includes('约束') || prompt.includes('要求') || prompt.includes('Constraints')) {
      return prompt;
    }

    const constraintsSection = '\n## 约束条件\n- 遵循安全和伦理准则\n- 保持输出简洁准确\n- 确保可验证性\n\n';
    return prompt + constraintsSection;
  }

  /**
   * 注入模式
   */
  private injectPatterns(prompt: string, suggestion: OptimizationSuggestion): string {
    const patternSection = `\n## 经验模式\n${suggestion.suggested}\n`;
    return prompt + patternSection;
  }

  /**
   * 计算提示词得分
   */
  private calculatePromptScore(analysis: PromptAnalysis): number {
    return (
      analysis.metrics.clarity * 0.4 +
      analysis.metrics.structure * 0.3 +
      analysis.metrics.completeness * 0.3
    );
  }

  /**
   * 策略到目标的映射
   */
  private strategyToGoal(strategy: OptimizationStrategy): OptimizationGoal {
    const mapping: Record<OptimizationStrategy, OptimizationGoal> = {
      add_context: 'clarity',
      remove_redundancy: 'conciseness',
      refine_instruction: 'clarity',
      add_examples: 'effectiveness',
      add_constraints: 'safety',
      restructure: 'clarity',
      inject_patterns: 'effectiveness',
      avoid_pitfalls: 'safety'
    };

    return mapping[strategy];
  }

  /**
   * 加载内置模式
   */
  private loadBuiltInPatterns(): void {
    const builtInPatterns: PatternInjection[] = [
      {
        id: 'step-by-step',
        pattern: '分步执行',
        type: 'best_practice',
        source: 'manual',
        confidence: 0.9,
        applicableTo: ['agent', 'system'],
        template: '请按以下步骤执行：1. 理解任务 2. 分析需求 3. 制定计划 4. 执行并验证'
      },
      {
        id: 'think-before-act',
        pattern: '思考后行动',
        type: 'best_practice',
        source: 'manual',
        confidence: 0.85,
        applicableTo: ['agent', 'system'],
        template: '在执行前先思考：这个任务的目标是什么？最佳方法是什么？可能遇到什么问题？'
      },
      {
        id: 'verify-output',
        pattern: '验证输出',
        type: 'best_practice',
        source: 'manual',
        confidence: 0.9,
        applicableTo: ['agent'],
        template: '执行完成后，验证输出是否符合要求：检查完整性、准确性、格式是否正确'
      },
      {
        id: 'handle-errors',
        pattern: '错误处理',
        type: 'success_pattern',
        source: 'reflection',
        confidence: 0.8,
        applicableTo: ['agent'],
        template: '遇到错误时：1. 分析错误原因 2. 尝试替代方案 3. 记录问题以便后续改进'
      }
    ];

    for (const pattern of builtInPatterns) {
      this.patterns.set(pattern.id, pattern);
    }

    logger.debug(`Loaded ${builtInPatterns.length} built-in patterns`);
  }

  /**
   * 导出优化历史
   */
  exportOptimizations(filter?: OptimizationFilter): string {
    const optimizations = this.getOptimizations(filter);
    return JSON.stringify(optimizations, null, 2);
  }

  /**
   * 导入优化历史
   */
  importOptimizations(json: string): number {
    try {
      const data: OptimizationResult[] = JSON.parse(json);
      let imported = 0;

      for (const opt of data) {
        this.optimizations.set(opt.id, opt);
        imported++;
      }

      logger.info(`Imported ${imported} optimization records`);
      return imported;
    } catch (error) {
      logger.error('Failed to import optimizations:', error);
      return 0;
    }
  }

  /**
   * 清空数据
   */
  clear(): void {
    this.versions.clear();
    this.optimizations.clear();
    logger.info('PromptOptimizer cleared');
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.clear();
    logger.info('PromptOptimizer destroyed');
  }
}
