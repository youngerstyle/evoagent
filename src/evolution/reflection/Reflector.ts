/**
 * Reflector
 *
 * 反思器 - 让 Agent 从经验中学习和改进
 */

import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../core/logger/index.js';
import type { ExperienceCollector } from '../experience/ExperienceCollector.js';
import type { ExperienceEvent, EventFilter } from '../experience/ExperienceTypes.js';
import type {
  ReflectionConfig,
  ReflectionContext,
  ReflectionReport,
  ReflectionType,
  ReflectionResult,
  Insight,
  InsightType,
  ActionItem,
  ActionPriority,
  PerformanceMetrics,
  QualityMetrics,
  SWOTAnalysis,
  ReflectionTrigger,
  ReflectionStats,
  ReflectionFilter,
  ImprovementSuggestion
} from './ReflectionTypes.js';

const logger = getLogger('evolution:reflector');

/**
 * 默认反思配置
 */
const DEFAULT_CONFIG: ReflectionConfig = {
  triggers: [
    {
      type: 'scheduled',
      intervalMs: 3600000, // 1 hour
      enabled: true
    },
    {
      type: 'event_count',
      minEventCount: 50,
      enabled: true
    },
    {
      type: 'failure_rate',
      maxFailureRate: 0.3,
      minSampleSize: 20,
      enabled: true
    }
  ],
  defaultReflectionType: 'comprehensive',
  minEventCount: 10,
  defaultTimeWindow: 86400000, // 24 hours
  autoGenerateActions: true,
  autoSaveReports: true,
  maxInsights: 20,
  maxActions: 10,
  minConfidenceThreshold: 0.5
};

/**
 * Reflector - 反思器
 *
 * 功能：
 * 1. 从经验事件中生成反思
 * 2. 分析性能和质量指标
 * 3. 生成洞察和行动项
 * 4. 提供改进建议
 */
export class Reflector {
  private reports: Map<string, ReflectionReport> = new Map();
  private insights: Map<string, Insight> = new Map();
  private actions: Map<string, ActionItem> = new Map();
  private config: Required<ReflectionConfig>;
  private reflectionHistory: Array<{ reportId: string; timestamp: number }> = [];

  private timer?: ReturnType<typeof setInterval>;

  constructor(
    config: Partial<ReflectionConfig> = {},
    private experienceCollector?: ExperienceCollector
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<ReflectionConfig>;

    // 启动定时反思
    this.startScheduledReflections();

    logger.info('Reflector initialized');
  }

  /**
   * 执行反思
   */
  async reflect(
    context: ReflectionContext,
    type?: ReflectionType
  ): Promise<ReflectionResult> {
    const startTime = Date.now();
    const reflectionType = type || this.config.defaultReflectionType;

    logger.debug(`Starting ${reflectionType} reflection for ${context.agentType || 'all agents'}`);

    // 创建报告
    const report: ReflectionReport = {
      id: uuidv4(),
      type: reflectionType,
      status: 'running',
      context,
      timestamp: startTime,
      eventCount: 0,
      timeRange: context.timeRange,
      insights: [],
      insightsByType: {} as Record<InsightType, number>,
      actions: [],
      actionsByPriority: {} as Record<ActionPriority, number>,
      summary: {
        overall: '',
        keyFindings: [],
        topRecommendations: []
      },
      metadata: {
        generatedBy: 'Reflector',
        version: '1.0.0'
      }
    };

    try {
      // 获取经验事件
      const events = this.getEventsInTimeRange(context);

      if (events.length < this.config.minEventCount) {
        logger.debug(`Not enough events for reflection: ${events.length} < ${this.config.minEventCount}`);
        report.status = 'completed';
        report.summary.overall = `事件数量不足 (${events.length}/${this.config.minEventCount})，无法生成有意义的反思。`;
        this.saveReport(report);
        return {
          report,
          newInsights: [],
          newActions: [],
          updatedKnowledge: []
        };
      }

      report.eventCount = events.length;

      // 根据反思类型执行不同的分析
      switch (reflectionType) {
        case 'performance':
          await this.performanceReflection(report, events);
          break;
        case 'quality':
          await this.qualityReflection(report, events);
          break;
        case 'pattern':
          await this.patternReflection(report, events);
          break;
        case 'strategic':
          await this.strategicReflection(report, events);
          break;
        case 'comprehensive':
          await this.comprehensiveReflection(report, events);
          break;
      }

      // 生成行动项
      if (this.config.autoGenerateActions) {
        this.generateActionItems(report);
      }

      // 生成总结
      this.generateSummary(report);

      report.status = 'completed';
      report.completedAt = Date.now();
      report.metadata.duration = report.completedAt - startTime;

      // 收集新增内容
      const newInsights = this.saveInsights(report.insights);
      const newActions = this.saveActions(report.actions);

      this.saveReport(report);
      this.reflectionHistory.push({ reportId: report.id, timestamp: startTime });

      logger.info(`Reflection completed: ${report.id} with ${report.insights.length} insights`);

      return {
        report,
        newInsights,
        newActions,
        updatedKnowledge: this.updateKnowledge(report)
      };
    } catch (error) {
      report.status = 'failed';
      report.metadata.duration = Date.now() - startTime;
      this.saveReport(report);

      logger.error('Reflection failed:', error);
      throw error;
    }
  }

  /**
   * 性能反思
   */
  private async performanceReflection(
    report: ReflectionReport,
    events: ExperienceEvent[]
  ): Promise<void> {
    const durations = events
      .filter(e => e.metadata.duration)
      .map(e => e.metadata.duration!);

    const successEvents = events.filter(e => e.type === 'success');
    const failureEvents = events.filter(e => e.type === 'failure');

    // 计算性能指标
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const performance: PerformanceMetrics = {
      avgDuration: durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0,
      p50Duration: this.percentile(sortedDurations, 50),
      p95Duration: this.percentile(sortedDurations, 95),
      p99Duration: this.percentile(sortedDurations, 99),
      successRate: events.length > 0 ? successEvents.length / events.length : 0,
      failureRate: events.length > 0 ? failureEvents.length / events.length : 0,
      totalExecutions: events.length,
      executionsPerHour: this.calculateExecutionsPerHour(events, report.timeRange),
      durationTrend: 'stable',
      successRateTrend: 'stable'
    };

    report.performance = performance;

    // 生成性能洞察
    this.generatePerformanceInsights(report, performance, events);
  }

  /**
   * 质量反思
   */
  private async qualityReflection(
    report: ReflectionReport,
    events: ExperienceEvent[]
  ): Promise<void> {
    const failureEvents = events.filter(e => e.type === 'failure');

    // 错误分布
    const errorDistribution: Record<string, number> = {};
    for (const event of failureEvents) {
      const errorType = event.details.failureContext?.errorType || 'unknown';
      errorDistribution[errorType] = (errorDistribution[errorType] || 0) + 1;
    }

    const totalErrors = failureEvents.length;
    const topErrorTypes = Object.entries(errorDistribution)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 模式识别
    const patternMap = new Map<string, { count: number; successes: number }>();
    for (const event of events) {
      for (const tag of event.tags) {
        const existing = patternMap.get(tag) || { count: 0, successes: 0 };
        existing.count++;
        if (event.type === 'success') {
          existing.successes++;
        }
        patternMap.set(tag, existing);
      }
    }

    const commonPatterns = Array.from(patternMap.entries())
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        successRate: data.count > 0 ? data.successes / data.count : 0
      }))
      .filter(p => p.frequency >= 2)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    // 改进空间
    const improvementAreas: string[] = [];
    if (topErrorTypes.length > 0 && topErrorTypes[0]) {
      improvementAreas.push(`减少 ${topErrorTypes[0].type} 错误`);
    }
    const lowSuccessPatterns = commonPatterns.filter(p => p.successRate < 0.5);
    if (lowSuccessPatterns.length > 0) {
      improvementAreas.push(...lowSuccessPatterns.map(p => `优化 ${p.pattern} 模式的成功率`));
    }

    const quality: QualityMetrics = {
      errorDistribution,
      topErrorTypes,
      commonPatterns,
      improvementAreas
    };

    report.quality = quality;

    // 生成质量洞察
    this.generateQualityInsights(report, quality, events);
  }

  /**
   * 模式反思
   */
  private async patternReflection(
    report: ReflectionReport,
    events: ExperienceEvent[]
  ): Promise<void> {
    // 分析重复模式
    const patternFrequency = new Map<string, ExperienceEvent[]>();

    for (const event of events) {
      for (const tag of event.tags) {
        const existing = patternFrequency.get(tag) || [];
        existing.push(event);
        patternFrequency.set(tag, existing);
      }
    }

    // 识别高频模式
    for (const [pattern, patternEvents] of patternFrequency) {
      if (patternEvents.length >= 3) {
        const successCount = patternEvents.filter(e => e.type === 'success').length;
        const successRate = successCount / patternEvents.length;

        let insightType: InsightType;
        if (successRate > 0.8) {
          insightType = 'strength';
        } else if (successRate < 0.5) {
          insightType = 'weakness';
        } else {
          insightType = 'pattern';
        }

        report.insights.push(this.createInsight({
          type: insightType,
          category: 'pattern',
          title: `模式: ${pattern}`,
          description: `该模式在 ${patternEvents.length} 次执行中出现，成功率为 ${(successRate * 100).toFixed(1)}%`,
          evidence: patternEvents.slice(0, 3).map(e => e.title),
          confidence: Math.min(0.5 + (patternEvents.length * 0.1), 1)
        }));
      }
    }

    this.categorizeInsights(report);
  }

  /**
   * 战略反思
   */
  private async strategicReflection(
    report: ReflectionReport,
    events: ExperienceEvent[]
  ): Promise<void> {
    // SWOT 分析
    const swot: SWOTAnalysis = {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: []
    };

    // 分析优势
    const highSuccessPatterns = this.getPatternsBySuccessRate(events, 0.8);
    swot.strengths = highSuccessPatterns.map(p => `${p} 模式表现良好`);

    // 分析弱点
    const lowSuccessPatterns = this.getPatternsBySuccessRate(events, 0.5);
    swot.weaknesses = lowSuccessPatterns.map(p => `${p} 模式需要改进`);

    // 分析机会
    const optimizationEvents = events.filter(e => e.type === 'optimization');
    swot.opportunities = optimizationEvents.slice(0, 5).map(e => e.title);

    // 分析威胁
    const criticalFailures = events.filter(e => e.severity === 'critical' && e.type === 'failure');
    swot.threats = criticalFailures.slice(0, 5).map(e => e.title);

    report.swot = swot;

    // 生成战略洞察
    if (swot.strengths.length > 0) {
      report.insights.push(this.createInsight({
        type: 'strength',
        category: 'strategic',
        title: '核心优势',
        description: `当前在以下方面表现强劲: ${swot.strengths.slice(0, 3).join(', ')}`,
        evidence: swot.strengths,
        confidence: 0.7
      }));
    }

    if (swot.weaknesses.length > 0) {
      report.insights.push(this.createInsight({
        type: 'weakness',
        category: 'strategic',
        title: '需要改进',
        description: `以下方面需要关注: ${swot.weaknesses.slice(0, 3).join(', ')}`,
        evidence: swot.weaknesses,
        confidence: 0.7
      }));
    }

    if (swot.opportunities.length > 0) {
      report.insights.push(this.createInsight({
        type: 'opportunity',
        category: 'strategic',
        title: '优化机会',
        description: `发现 ${swot.opportunities.length} 个优化机会`,
        evidence: swot.opportunities,
        confidence: 0.6
      }));
    }

    if (swot.threats.length > 0) {
      report.insights.push(this.createInsight({
        type: 'threat',
        category: 'strategic',
        title: '潜在风险',
        description: `需要注意 ${swot.threats.length} 个关键风险`,
        evidence: swot.threats,
        confidence: 0.8
      }));
    }

    this.categorizeInsights(report);
  }

  /**
   * 综合反思
   */
  private async comprehensiveReflection(
    report: ReflectionReport,
    events: ExperienceEvent[]
  ): Promise<void> {
    // 执行所有类型的反思
    await this.performanceReflection(report, events);
    await this.qualityReflection(report, events);
    await this.patternReflection(report, events);
    await this.strategicReflection(report, events);

    // 去重洞察
    report.insights = this.deduplicateInsights(report.insights);
    this.categorizeInsights(report);

    // 限制洞察数量
    if (report.insights.length > this.config.maxInsights) {
      report.insights = report.insights
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.config.maxInsights);
    }
  }

  /**
   * 获取时间范围内的事件
   */
  private getEventsInTimeRange(context: ReflectionContext): ExperienceEvent[] {
    if (!this.experienceCollector) {
      return [];
    }

    const filter: EventFilter = {
      timeRange: context.timeRange,
      agentTypes: context.agentType ? [context.agentType] : undefined
    };

    return this.experienceCollector.search(filter);
  }

  /**
   * 生成性能洞察
   */
  private generatePerformanceInsights(
    report: ReflectionReport,
    performance: PerformanceMetrics,
    _events: ExperienceEvent[]
  ): void {
    // 慢执行洞察
    if (performance.p95Duration > 30000) {
      report.insights.push(this.createInsight({
        type: 'weakness',
        category: 'performance',
        title: '执行速度较慢',
        description: `95% 的执行在 ${performance.p95Duration}ms 内完成，存在优化空间`,
        evidence: [`平均执行时间: ${performance.avgDuration.toFixed(0)}ms`],
        confidence: 0.8,
        impact: 'high'
      }));
    }

    // 成功率洞察
    if (performance.successRate > 0.9) {
      report.insights.push(this.createInsight({
        type: 'strength',
        category: 'performance',
        title: '高成功率',
        description: `成功率达到 ${(performance.successRate * 100).toFixed(1)}%，表现优异`,
        evidence: [`成功: ${performance.totalExecutions * performance.successRate} 次`],
        confidence: 0.9,
        impact: 'high'
      }));
    } else if (performance.successRate < 0.7) {
      report.insights.push(this.createInsight({
        type: 'weakness',
        category: 'performance',
        title: '成功率偏低',
        description: `成功率仅为 ${(performance.successRate * 100).toFixed(1)}%，需要改进`,
        evidence: [`失败: ${performance.totalExecutions * performance.failureRate} 次`],
        confidence: 0.9,
        impact: 'high'
      }));
    }

    this.categorizeInsights(report);
  }

  /**
   * 生成质量洞察
   */
  private generateQualityInsights(
    report: ReflectionReport,
    quality: QualityMetrics,
    _events: ExperienceEvent[]
  ): void {
    // 错误类型洞察
    if (quality.topErrorTypes.length > 0) {
      const topError = quality.topErrorTypes[0];
      if (topError) {
        report.insights.push(this.createInsight({
          type: topError.percentage > 30 ? 'threat' : 'weakness',
          category: 'quality',
          title: `主要错误: ${topError.type}`,
          description: `${topError.type} 错误占所有错误的 ${topError.percentage.toFixed(1)}%`,
          evidence: [`出现次数: ${topError.count}`],
          confidence: 0.8,
          impact: topError.percentage > 30 ? 'high' : 'medium'
        }));
      }
    }

    // 改进建议洞察
    if (quality.improvementAreas.length > 0) {
      report.insights.push(this.createInsight({
        type: 'recommendation',
        category: 'quality',
        title: '改进建议',
        description: `建议关注以下方面: ${quality.improvementAreas.slice(0, 3).join(', ')}`,
        evidence: quality.improvementAreas,
        confidence: 0.6,
        impact: 'medium'
      }));
    }

    this.categorizeInsights(report);
  }

  /**
   * 生成行动项
   */
  private generateActionItems(report: ReflectionReport): void {
    for (const insight of report.insights) {
      if (!insight.actionable) continue;

      const priority = this.getPriorityFromInsight(insight);

      const action: ActionItem = {
        id: uuidv4(),
        title: this.generateActionTitle(insight),
        description: insight.description,
        priority,
        category: insight.category,
        effort: this.estimateEffort(insight),
        estimatedImpact: insight.impact,
        status: 'pending',
        relatedInsights: [insight.id],
        createdAt: Date.now()
      };

      report.actions.push(action);
    }

    // 去重和限制
    report.actions = this.deduplicateActions(report.actions);

    if (report.actions.length > this.config.maxActions) {
      report.actions = report.actions
        .sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })
        .slice(0, this.config.maxActions);
    }

    this.categorizeActions(report);
  }

  /**
   * 生成总结
   */
  private generateSummary(report: ReflectionReport): void {
    const findings: string[] = [];
    const recommendations: string[] = [];

    // 关键发现
    const strengths = report.insights.filter(i => i.type === 'strength');
    const weaknesses = report.insights.filter(i => i.type === 'weakness');
    const threats = report.insights.filter(i => i.type === 'threat');

    if (strengths.length > 0) {
      findings.push(`优势: ${strengths.map(s => s.title).join(', ')}`);
    }
    if (weaknesses.length > 0) {
      findings.push(`需改进: ${weaknesses.map(w => w.title).join(', ')}`);
    }
    if (threats.length > 0) {
      findings.push(`风险: ${threats.map(t => t.title).join(', ')}`);
    }

    // 性能相关
    if (report.performance) {
      findings.push(`平均执行时间: ${report.performance.avgDuration.toFixed(0)}ms`);
      findings.push(`成功率: ${(report.performance.successRate * 100).toFixed(1)}%`);
    }

    // 顶级建议
    const highPriorityActions = report.actions.filter(a => a.priority === 'high' || a.priority === 'critical');
    recommendations.push(...highPriorityActions.slice(0, 3).map(a => a.title));

    report.summary = {
      overall: this.generateOverallSummary(report),
      keyFindings: findings,
      topRecommendations: recommendations
    };
  }

  /**
   * 生成总体总结
   */
  private generateOverallSummary(report: ReflectionReport): string {
    const parts: string[] = [];

    parts.push(`分析了 ${report.eventCount} 个事件`);

    if (report.performance) {
      const trend = report.performance.successRateTrend;
      const trendText = trend === 'improving' ? '改善' : trend === 'degrading' ? '下降' : '稳定';
      parts.push(`成功率为 ${(report.performance.successRate * 100).toFixed(1)}% (${trendText})`);
    }

    parts.push(`发现 ${report.insights.length} 个洞察`);
    parts.push(`生成 ${report.actions.length} 个行动项`);

    return parts.join('，') + '。';
  }

  /**
   * 创建洞察
   */
  private createInsight(config: {
    type: InsightType;
    category: string;
    title: string;
    description: string;
    evidence: string[];
    confidence: number;
    impact?: 'low' | 'medium' | 'high';
  }): Insight {
    return {
      id: uuidv4(),
      type: config.type,
      category: config.category,
      title: config.title,
      description: config.description,
      evidence: config.evidence,
      confidence: Math.max(0, Math.min(1, config.confidence)),
      impact: config.impact || 'medium',
      actionable: ['weakness', 'threat', 'recommendation'].includes(config.type),
      timestamp: Date.now()
    };
  }

  /**
   * 生成行动标题
   */
  private generateActionTitle(insight: Insight): string {
    const prefixes: Record<InsightType, string> = {
      strength: '利用',
      weakness: '改进',
      opportunity: '探索',
      threat: '缓解',
      pattern: '优化',
      recommendation: '实施'
    };

    return `${prefixes[insight.type]}: ${insight.title}`;
  }

  /**
   * 从洞察获取优先级
   */
  private getPriorityFromInsight(insight: Insight): ActionPriority {
    if (insight.type === 'threat' || insight.impact === 'high') {
      return insight.confidence > 0.7 ? 'critical' : 'high';
    }
    if (insight.type === 'weakness') {
      return insight.confidence > 0.6 ? 'high' : 'medium';
    }
    if (insight.type === 'opportunity') {
      return insight.confidence > 0.7 ? 'medium' : 'low';
    }
    return 'medium';
  }

  /**
   * 估算工作量
   */
  private estimateEffort(insight: Insight): 'low' | 'medium' | 'high' {
    if (insight.category === 'performance' || insight.category === 'quality') {
      return insight.impact === 'high' ? 'high' : 'medium';
    }
    return 'medium';
  }

  /**
   * 分类洞察
   */
  private categorizeInsights(report: ReflectionReport): void {
    report.insightsByType = {
      strength: 0,
      weakness: 0,
      opportunity: 0,
      threat: 0,
      pattern: 0,
      recommendation: 0
    };

    for (const insight of report.insights) {
      report.insightsByType[insight.type]++;
    }
  }

  /**
   * 分类行动项
   */
  private categorizeActions(report: ReflectionReport): void {
    report.actionsByPriority = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    for (const action of report.actions) {
      report.actionsByPriority[action.priority]++;
    }
  }

  /**
   * 去重洞察
   */
  private deduplicateInsights(insights: Insight[]): Insight[] {
    const seen = new Set<string>();
    const unique: Insight[] = [];

    for (const insight of insights) {
      const key = `${insight.type}:${insight.category}:${insight.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(insight);
      }
    }

    return unique;
  }

  /**
   * 去重行动项
   */
  private deduplicateActions(actions: ActionItem[]): ActionItem[] {
    const seen = new Set<string>();
    const unique: ActionItem[] = [];

    for (const action of actions) {
      const key = `${action.category}:${action.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(action);
      }
    }

    return unique;
  }

  /**
   * 保存报告
   */
  private saveReport(report: ReflectionReport): void {
    this.reports.set(report.id, report);
  }

  /**
   * 保存洞察
   */
  private saveInsights(insights: Insight[]): Insight[] {
    const newInsights: Insight[] = [];

    for (const insight of insights) {
      if (!this.insights.has(insight.id)) {
        this.insights.set(insight.id, insight);
        newInsights.push(insight);
      }
    }

    return newInsights;
  }

  /**
   * 保存行动项
   */
  private saveActions(actions: ActionItem[]): ActionItem[] {
    const newActions: ActionItem[] = [];

    for (const action of actions) {
      if (!this.actions.has(action.id)) {
        this.actions.set(action.id, action);
        newActions.push(action);
      }
    }

    return newActions;
  }

  /**
   * 更新知识
   */
  private updateKnowledge(report: ReflectionReport): string[] {
    const knowledge: string[] = [];

    // 从洞察中提取知识
    for (const insight of report.insights) {
      if (insight.confidence >= this.config.minConfidenceThreshold) {
        knowledge.push(`[${insight.type}] ${insight.title}: ${insight.description}`);
      }
    }

    return knowledge;
  }

  /**
   * 获取按成功率排序的模式
   */
  private getPatternsBySuccessRate(events: ExperienceEvent[], threshold: number): string[] {
    const patternMap = new Map<string, { total: number; successes: number }>();

    for (const event of events) {
      for (const tag of event.tags) {
        const data = patternMap.get(tag) || { total: 0, successes: 0 };
        data.total++;
        if (event.type === 'success') {
          data.successes++;
        }
        patternMap.set(tag, data);
      }
    }

    return Array.from(patternMap.entries())
      .filter(([_, data]) => data.total >= 3 && (data.successes / data.total) < threshold)
      .map(([pattern]) => pattern);
  }

  /**
   * 获取报告
   */
  getReports(filter?: ReflectionFilter): ReflectionReport[] {
    let reports = Array.from(this.reports.values());

    if (filter) {
      if (filter.types) {
        reports = reports.filter(r => filter.types!.includes(r.type));
      }
      if (filter.statuses) {
        reports = reports.filter(r => filter.statuses!.includes(r.status));
      }
      if (filter.agentTypes) {
        reports = reports.filter(r => r.context.agentType && filter.agentTypes!.includes(r.context.agentType));
      }
      if (filter.timeRange) {
        reports = reports.filter(r =>
          r.timestamp >= filter.timeRange!.start &&
          r.timestamp <= filter.timeRange!.end
        );
      }
      if (filter.minInsights) {
        reports = reports.filter(r => r.insights.length >= filter.minInsights!);
      }
      if (filter.searchText) {
        const lower = filter.searchText.toLowerCase();
        reports = reports.filter(r =>
          r.summary.overall.toLowerCase().includes(lower) ||
          r.insights.some(i => i.title.toLowerCase().includes(lower))
        );
      }
    }

    return reports.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 获取洞察
   */
  getInsights(type?: InsightType): Insight[] {
    let insights = Array.from(this.insights.values());

    if (type) {
      insights = insights.filter(i => i.type === type);
    }

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 获取行动项
   */
  getActions(status?: ActionItem['status']): ActionItem[] {
    let actions = Array.from(this.actions.values());

    if (status) {
      actions = actions.filter(a => a.status === status);
    }

    return actions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * 更新行动项状态
   */
  updateActionStatus(actionId: string, status: ActionItem['status']): boolean {
    const action = this.actions.get(actionId);
    if (action) {
      action.status = status;
      return true;
    }
    return false;
  }

  /**
   * 获取统计信息
   */
  getStats(): ReflectionStats {
    const stats: ReflectionStats = {
      totalReflections: this.reports.size,
      reflectionsByType: {
        performance: 0,
        quality: 0,
        pattern: 0,
        strategic: 0,
        comprehensive: 0
      },
      reflectionsByStatus: {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0
      },
      totalInsights: this.insights.size,
      totalActions: this.actions.size,
      completedActions: Array.from(this.actions.values()).filter(a => a.status === 'completed').length,
      avgReflectionDuration: 0
    };

    let totalDuration = 0;
    let durationCount = 0;

    for (const report of this.reports.values()) {
      stats.reflectionsByType[report.type]++;
      stats.reflectionsByStatus[report.status]++;

      if (report.metadata.duration) {
        totalDuration += report.metadata.duration;
        durationCount++;
      }
    }

    if (durationCount > 0) {
      stats.avgReflectionDuration = totalDuration / durationCount;
    }

    const last = this.reflectionHistory[this.reflectionHistory.length - 1];
    if (last) {
      stats.lastReflectionTime = last.timestamp;
    }

    return stats;
  }

  /**
   * 生成改进建议
   */
  generateImprovementSuggestions(): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    // 基于洞察生成建议
    const weaknessInsights = this.getInsights('weakness');
    for (const insight of weaknessInsights.slice(0, 5)) {
      suggestions.push({
        id: uuidv4(),
        type: 'workflow',
        title: `改进: ${insight.title}`,
        description: insight.description,
        currentValue: '当前状态',
        suggestedValue: '建议改进',
        reason: insight.description,
        expectedImpact: insight.impact,
        confidence: insight.confidence
      });
    }

    // 基于行动项生成建议
    const pendingActions = this.getActions('pending');
    for (const action of pendingActions.slice(0, 3)) {
      suggestions.push({
        id: uuidv4(),
        type: 'configuration',
        title: action.title,
        description: action.description,
        currentValue: '未实施',
        suggestedValue: '已实施',
        reason: action.description,
        expectedImpact: action.estimatedImpact,
        confidence: action.priority === 'high' ? 0.8 : 0.6
      });
    }

    return suggestions;
  }

  /**
   * 检查是否应该触发反思
   */
  shouldTrigger(context: ReflectionContext): boolean {
    for (const trigger of this.config.triggers) {
      if (trigger.enabled === false) continue;

      if (this.matchesTrigger(trigger, context)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 匹配触发器
   */
  private matchesTrigger(trigger: ReflectionTrigger, context: ReflectionContext): boolean {
    switch (trigger.type) {
      case 'scheduled':
        // 由定时器处理，这里返回 false
        return false;

      case 'event_count':
        if (trigger.minEventCount) {
          const events = this.getEventsInTimeRange(context);
          return events.length >= trigger.minEventCount;
        }
        return false;

      case 'failure_rate':
        if (trigger.maxFailureRate && trigger.minSampleSize) {
          const events = this.getEventsInTimeRange(context);
          if (events.length < trigger.minSampleSize) {
            return false;
          }
          const failures = events.filter(e => e.type === 'failure').length;
          const failureRate = failures / events.length;
          return failureRate > trigger.maxFailureRate;
        }
        return false;

      case 'manual':
        return trigger.custom ? trigger.custom(context) : false;

      default:
        return false;
    }
  }

  /**
   * 启动定时反思
   */
  private startScheduledReflections(): void {
    const scheduledTrigger = this.config.triggers.find(
      t => t.type === 'scheduled' && t.enabled !== false
    );

    if (scheduledTrigger && scheduledTrigger.intervalMs) {
      this.timer = setInterval(() => {
        const context: ReflectionContext = {
          timeRange: {
            start: Date.now() - this.config.defaultTimeWindow,
            end: Date.now()
          }
        };

        if (this.shouldTrigger(context)) {
          this.reflect(context).catch(error => {
            logger.error('Scheduled reflection failed:', error);
          });
        }
      }, scheduledTrigger.intervalMs);

      logger.debug(`Scheduled reflections enabled (interval: ${scheduledTrigger.intervalMs}ms)`);
    }
  }

  /**
   * 计算百分位数
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]!;
  }

  /**
   * 计算每小时执行次数
   */
  private calculateExecutionsPerHour(events: ExperienceEvent[], timeRange: { start: number; end: number }): number {
    const durationMs = timeRange.end - timeRange.start;
    const durationHours = durationMs / (1000 * 60 * 60);
    return durationHours > 0 ? events.length / durationHours : 0;
  }

  /**
   * 导出报告
   */
  exportReports(filter?: ReflectionFilter): string {
    const reports = this.getReports(filter);
    return JSON.stringify(reports, null, 2);
  }

  /**
   * 导入报告
   */
  importReports(json: string): number {
    try {
      const reports: ReflectionReport[] = JSON.parse(json);
      let imported = 0;

      for (const report of reports) {
        this.reports.set(report.id, report);
        imported++;
      }

      logger.info(`Imported ${imported} reflection reports`);
      return imported;
    } catch (error) {
      logger.error('Failed to import reports:', error);
      return 0;
    }
  }

  /**
   * 清空数据
   */
  clear(): void {
    this.reports.clear();
    this.insights.clear();
    this.actions.clear();
    this.reflectionHistory = [];
    logger.info('Reflector cleared');
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.clear();

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    logger.info('Reflector destroyed');
  }
}
