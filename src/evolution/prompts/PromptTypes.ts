/**
 * Prompt 优化系统类型定义
 */

/**
 * Prompt 版本
 */
export interface PromptVersion {
  id: string;
  agentType: string;
  version: number;
  content: string;
  createdAt: string;
  createdBy: 'system' | 'user' | 'evolution';
  metadata: {
    description?: string;
    tags?: string[];
    parentVersion?: string;
    changeReason?: string;
  };
}

/**
 * Prompt 性能指标
 */
export interface PromptMetrics {
  promptId: string;
  version: number;
  usageCount: number;
  successCount: number;
  failureCount: number;
  averageLatency: number;
  averageTokens: number;
  successRate: number;
  lastUsed: string;
}

/**
 * Prompt A/B 测试配置
 */
export interface ABTestConfig {
  id: string;
  name: string;
  agentType: string;
  variants: {
    id: string;
    promptVersion: number;
    weight: number; // 流量分配权重 0-1
  }[];
  startTime: string;
  endTime?: string;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  metrics: {
    [variantId: string]: PromptMetrics;
  };
}

/**
 * Prompt 优化建议
 */
export interface PromptOptimizationSuggestion {
  type: 'clarity' | 'specificity' | 'structure' | 'examples' | 'constraints';
  severity: 'low' | 'medium' | 'high';
  description: string;
  currentText?: string;
  suggestedText?: string;
  reasoning: string;
}

/**
 * Prompt 分析结果
 */
export interface PromptAnalysis {
  promptId: string;
  version: number;
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  suggestions: PromptOptimizationSuggestion[];
  complexity: {
    tokenCount: number;
    sentenceCount: number;
    avgSentenceLength: number;
    readabilityScore: number;
  };
}

/**
 * Prompt 优化配置
 */
export interface PromptOptimizerConfig {
  storageDir: string;
  enableABTesting: boolean;
  minSamplesForOptimization: number;
  optimizationInterval: number; // 毫秒
  autoApplyThreshold: number; // 自动应用优化的成功率阈值
}

/**
 * Prompt 存储索引
 */
export interface PromptIndex {
  version: string;
  lastUpdated: string;
  prompts: {
    [agentType: string]: {
      currentVersion: number;
      versions: number[];
      abTests: string[];
    };
  };
}

/**
 * Prompt 优化历史
 */
export interface PromptOptimizationHistory {
  id: string;
  agentType: string;
  fromVersion: number;
  toVersion: number;
  timestamp: string;
  reason: string;
  metrics: {
    before: PromptMetrics;
    after: PromptMetrics;
    improvement: number; // 百分比
  };
  approved: boolean;
  approvedBy?: string;
}
