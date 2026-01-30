/**
 * Optimization Types
 *
 * 定义提示词优化相关的类型和结构
 */

/**
 * 优化目标
 */
export type OptimizationGoal =
  | 'clarity'         // 清晰度
  | 'conciseness'     // 简洁性
  | 'effectiveness'   // 有效性
  | 'safety'          // 安全性
  | 'performance';    // 性能

/**
 * 优化策略
 */
export type OptimizationStrategy =
  | 'add_context'     // 添加上下文
  | 'remove_redundancy' // 删除冗余
  | 'refine_instruction' // 精炼指令
  | 'add_examples'    // 添加示例
  | 'add_constraints' // 添加约束
  | 'restructure'     // 重组结构
  | 'inject_patterns' // 注入模式
  | 'avoid_pitfalls'; // 避免陷阱

/**
 * 提示词类型
 */
export type PromptType =
  | 'system'
  | 'user'
  | 'agent'
  | 'tool';

/**
 * 优化状态
 */
export type OptimizationStatus = 'pending' | 'applying' | 'applied' | 'failed' | 'rolled_back';

/**
 * 优化问题
 */
export interface PromptIssue {
  type: 'ambiguity' | 'redundancy' | 'missing_context' | 'vague_instruction' | 'safety_concern' | 'performance_issue';
  severity: 'info' | 'minor' | 'major' | 'critical';
  location: {
    start: number;
    end: number;
    line?: number;
  };
  message: string;
  suggestion?: string;
}

/**
 * 优化建议
 */
export interface OptimizationSuggestion {
  id: string;
  strategy: OptimizationStrategy;
  goal: OptimizationGoal;
  description: string;
  original: string;
  suggested: string;
  reason: string;
  expectedImpact: 'low' | 'medium' | 'high';
  confidence: number;
  estimatedImprovement?: string;
}

/**
 * 提示词分析结果
 */
export interface PromptAnalysis {
  prompt: string;
  type: PromptType;
  issues: PromptIssue[];
  metrics: {
    length: number;
    tokenEstimate: number;
    clarity: number; // 0-1
    structure: number; // 0-1
    completeness: number; // 0-1
  };
  sections: PromptSection[];
}

/**
 * 提示词区块
 */
export interface PromptSection {
  type: 'instruction' | 'context' | 'constraint' | 'example' | 'output_format' | 'other';
  content: string;
  start: number;
  end: number;
}

/**
 * 优化配置
 */
export interface OptimizationConfig {
  // 优化目标
  goals: OptimizationGoal[];

  // 最大优化次数
  maxIterations: number;

  // 最小改进阈值
  minImprovementThreshold: number;

  // 是否自动应用优化
  autoApply: boolean;

  // 是否保留备份
  keepBackup: boolean;

  // 最大建议数量
  maxSuggestions: number;

  // 最小置信度
  minConfidence: number;

  // 禁用的策略
  disabledStrategies: OptimizationStrategy[];
}

/**
 * 优化结果
 */
export interface OptimizationResult {
  id: string;
  promptId: string;
  status: OptimizationStatus;
  originalPrompt: string;
  optimizedPrompt: string;
  suggestions: OptimizationSuggestion[];
  appliedSuggestions: string[];
  analysis: PromptAnalysis;
  metrics: {
    originalScore: number;
    optimizedScore: number;
    improvement: number;
  };
  timestamp: number;
  appliedAt?: number;
  metadata: {
    iterations: number;
    duration: number;
    strategies: OptimizationStrategy[];
  };
}

/**
 * 提示词版本
 */
export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  prompt: string;
  createdAt: number;
  createdBy: 'system' | 'user';
  description?: string;
  optimizationId?: string;
  metrics?: {
    clarity: number;
    effectiveness?: number;
  };
}

/**
 * 提示词模板
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  type: PromptType;
  template: string;
  variables: string[];
  examples?: string[];
  tags: string[];
}

/**
 * 模式注入
 */
export interface PatternInjection {
  id: string;
  pattern: string;
  type: 'success_pattern' | 'avoidance_pattern' | 'best_practice';
  source: 'reflection' | 'manual';
  confidence: number;
  applicableTo: PromptType[];
  template: string;
}

/**
 * 优化统计
 */
export interface OptimizationStats {
  totalOptimizations: number;
  successfulOptimizations: number;
  failedOptimizations: number;
  avgImprovement: number;
  optimizationsByGoal: Record<OptimizationGoal, number>;
  optimizationsByStrategy: Record<OptimizationStrategy, number>;
  totalSuggestions: number;
  appliedSuggestions: number;
  promptVersions: number;
  lastOptimizationTime?: number;
}

/**
 * 优化历史过滤器
 */
export interface OptimizationFilter {
  statuses?: OptimizationStatus[];
  goals?: OptimizationGoal[];
  strategies?: OptimizationStrategy[];
  minImprovement?: number;
  timeRange?: {
    start: number;
    end: number;
  };
  promptId?: string;
}

/**
 * 优化请求
 */
export interface OptimizationRequest {
  prompt: string;
  type: PromptType;
  config?: Partial<OptimizationConfig>;
  context?: {
    agentType?: string;
    previousPerformance?: {
      successRate: number;
      avgDuration: number;
    };
    reflectionResults?: {
      insights: string[];
      patterns: string[];
      pitfalls: string[];
    };
  };
}

/**
 * 优化响应
 */
export interface OptimizationResponse {
  result: OptimizationResult;
  hasChanges: boolean;
  canAutoApply: boolean;
  warnings: string[];
}

/**
 * 批量优化请求
 */
export interface BatchOptimizationRequest {
  prompts: Array<{
    id: string;
    prompt: string;
    type: PromptType;
  }>;
  config?: Partial<OptimizationConfig>;
}

/**
 * 批量优化响应
 */
export interface BatchOptimizationResponse {
  results: Array<{
    id: string;
    result: OptimizationResult;
  }>;
  summary: {
    total: number;
    optimized: number;
    skipped: number;
    failed: number;
    avgImprovement: number;
  };
}
