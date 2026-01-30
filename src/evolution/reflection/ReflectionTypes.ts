/**
 * Reflection Types
 *
 * 定义反思相关的类型和结构
 */

/**
 * 反思触发器类型
 */
export type ReflectionTriggerType =
  | 'scheduled'     // 定时触发
  | 'event_count'   // 事件数量触发
  | 'failure_rate'  // 失败率触发
  | 'manual';       // 手动触发

/**
 * 反思状态
 */
export type ReflectionStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * 反思类型
 */
export type ReflectionType =
  | 'performance'    // 性能反思
  | 'quality'        // 质量反思
  | 'pattern'        // 模式反思
  | 'strategic'      // 战略反思
  | 'comprehensive'; // 综合反思

/**
 * 洞察类型
 */
export type InsightType =
  | 'strength'       // 优势
  | 'weakness'       // 弱点
  | 'opportunity'    // 机会
  | 'threat'         // 威胁
  | 'pattern'        // 模式
  | 'recommendation'; // 建议

/**
 * 行动优先级
 */
export type ActionPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * 反思触发器配置
 */
export interface ReflectionTrigger {
  type: ReflectionTriggerType;

  // 定时触发配置
  intervalMs?: number;

  // 事件数量触发配置
  minEventCount?: number;

  // 失败率触发配置
  maxFailureRate?: number;
  minSampleSize?: number;

  // 自定义触发条件
  custom?: (context: ReflectionContext) => boolean;

  // 是否启用
  enabled?: boolean;
}

/**
 * 反思上下文
 */
export interface ReflectionContext {
  agentType?: string;
  sessionId?: string;
  timeRange: {
    start: number;
    end: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * 洞察
 */
export interface Insight {
  id: string;
  type: InsightType;
  category: string;
  title: string;
  description: string;
  evidence: string[];
  confidence: number; // 0-1
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  relatedInsights?: string[];
  timestamp: number;
}

/**
 * 行动项
 */
export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: ActionPriority;
  category: string;
  effort: 'low' | 'medium' | 'high';
  estimatedImpact: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'deferred';
  dependencies?: string[];
  relatedInsights: string[];
  createdAt: number;
  dueDate?: number;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  // 执行效率
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;

  // 成功率
  successRate: number;
  failureRate: number;

  // 吞吐量
  totalExecutions: number;
  executionsPerHour: number;

  // 资源使用
  avgTokenUsage?: number;
  avgMemoryUsage?: number;

  // 趋势
  durationTrend: 'improving' | 'stable' | 'degrading';
  successRateTrend: 'improving' | 'stable' | 'degrading';
}

/**
 * 质量指标
 */
export interface QualityMetrics {
  // 输出质量
  avgOutputScore?: number;

  // 错误分析
  errorDistribution: Record<string, number>;
  topErrorTypes: Array<{ type: string; count: number; percentage: number }>;

  // 模式识别
  commonPatterns: Array<{ pattern: string; frequency: number; successRate: number }>;

  // 改进空间
  improvementAreas: string[];
}

/**
 * SWOT 分析
 */
export interface SWOTAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

/**
 * 反思报告
 */
export interface ReflectionReport {
  // 基本信息
  id: string;
  type: ReflectionType;
  status: ReflectionStatus;
  context: ReflectionContext;
  timestamp: number;
  completedAt?: number;

  // 分析范围
  eventCount: number;
  timeRange: { start: number; end: number };

  // 指标
  performance?: PerformanceMetrics;
  quality?: QualityMetrics;

  // 洞察
  insights: Insight[];
  insightsByType: Record<InsightType, number>;

  // 行动项
  actions: ActionItem[];
  actionsByPriority: Record<ActionPriority, number>;

  // SWOT 分析
  swot?: SWOTAnalysis;

  // 总结
  summary: {
    overall: string;
    keyFindings: string[];
    topRecommendations: string[];
  };

  // 元数据
  metadata: {
    generatedBy: string;
    version: string;
    duration?: number;
  };
}

/**
 * 反思配置
 */
export interface ReflectionConfig {
  // 触发器
  triggers: ReflectionTrigger[];

  // 反思类型
  defaultReflectionType: ReflectionType;

  // 最小事件数
  minEventCount: number;

  // 时间窗口（毫秒）
  defaultTimeWindow: number;

  // 是否自动生成行动项
  autoGenerateActions: boolean;

  // 是否自动保存报告
  autoSaveReports: boolean;

  // 最大洞察数量
  maxInsights: number;

  // 最大行动项数量
  maxActions: number;

  // 最小置信度阈值
  minConfidenceThreshold: number;
}

/**
 * 反思统计
 */
export interface ReflectionStats {
  totalReflections: number;
  reflectionsByType: Record<ReflectionType, number>;
  reflectionsByStatus: Record<ReflectionStatus, number>;
  totalInsights: number;
  totalActions: number;
  completedActions: number;
  avgReflectionDuration: number;
  lastReflectionTime?: number;
}

/**
 * 反思过滤器
 */
export interface ReflectionFilter {
  types?: ReflectionType[];
  statuses?: ReflectionStatus[];
  agentTypes?: string[];
  timeRange?: {
    start: number;
    end: number;
  };
  minInsights?: number;
  searchText?: string;
}

/**
 * 反思结果
 */
export interface ReflectionResult {
  report: ReflectionReport;
  newInsights: Insight[];
  newActions: ActionItem[];
  updatedKnowledge: string[];
}

/**
 * 学习模式
 */
export interface LearningPattern {
  id: string;
  pattern: string;
  description: string;
  context: string[];
  successRate: number;
  usageCount: number;
  lastUsed: number;
  confidence: number;
}

/**
 * 改进建议
 */
export interface ImprovementSuggestion {
  id: string;
  type: 'prompt' | 'workflow' | 'configuration' | 'tool';
  title: string;
  description: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  expectedImpact: string;
  confidence: number;
}
