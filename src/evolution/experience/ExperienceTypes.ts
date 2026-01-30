/**
 * Experience Event Types
 *
 * 定义经验事件的类型和结构
 */

/**
 * 事件类型
 */
export type ExperienceEventType =
  | 'success'         // 成功事件
  | 'failure'         // 失败事件
  | 'pattern'         // 模式发现
  | 'optimization'    // 优化建议
  | 'pitfall'         // 坑点/陷阱
  | 'solution'        // 解决方案
  | 'insight';        // 洞察/发现

/**
 * 事件严重程度
 */
export type EventSeverity = 'info' | 'minor' | 'major' | 'critical';

/**
 * 事件来源
 */
export type EventSource = 'agent' | 'user' | 'system' | 'external';

/**
 * 经验事件
 */
export interface ExperienceEvent {
  // 基本信息
  id: string;
  type: ExperienceEventType;
  severity: EventSeverity;
  source: EventSource;

  // 上下文
  agentType?: string;
  sessionId?: string;
  taskId?: string;
  runId?: string;

  // 内容
  title: string;
  description: string;

  // 详细信息
  details: EventDetails;

  // 元数据
  metadata: EventMetadata;

  // 时间戳
  timestamp: number;
  expiresAt?: number;

  // 关联
  relatedEvents?: string[];  // 相关事件 ID
  tags: string[];

  // 统计
  occurrenceCount: number;
  lastOccurrence?: number;
}

/**
 * 事件详情
 */
export interface EventDetails {
  // 成功/失败相关
  successContext?: SuccessContext;
  failureContext?: FailureContext;

  // 模式相关
  pattern?: PatternInfo;

  // 代码相关
  codeSnippet?: CodeSnippet;

  // 配置相关
  configuration?: Record<string, unknown>;

  // 额外数据
  extra?: Record<string, unknown>;
}

/**
 * 成功上下文
 */
export interface SuccessContext {
  approach: string;          // 采用的方法
  keyFactors: string[];      // 成功关键因素
  outcome: string;           // 结果描述
  artifacts: string[];       // 产生的产物
}

/**
 * 失败上下文
 */
export interface FailureContext {
  error: string;             // 错误信息
  errorType: string;         // 错误类型
  rootCause: string;         // 根本原因
  attemptedSolutions: string[]; // 尝试过的解决方案
  stackTrace?: string;       // 堆栈跟踪
}

/**
 * 模式信息
 */
export interface PatternInfo {
  patternType: 'code' | 'workflow' | 'communication' | 'data';
  pattern: string;           // 模式描述
  frequency: number;         // 出现频率
  confidence: number;        // 置信度 (0-1)
  examples: string[];        // 示例
}

/**
 * 代码片段
 */
export interface CodeSnippet {
  language: string;
  code: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  functionName?: string;
  description?: string;
}

/**
 * 事件元数据
 */
export interface EventMetadata {
  // 性能相关
  duration?: number;
  memoryUsage?: number;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };

  // 环境相关
  environment?: {
    os: string;
    runtime: string;
    dependencies?: Record<string, string>;
  };

  // Git 相关
  gitCommit?: string;
  gitBranch?: string;

  // 用户相关
  userId?: string;
  userFeedback?: number;  // 1-5 评分

  // 其他
  [key: string]: unknown;
}

/**
 * 提取规则
 */
export interface ExtractionRule {
  id: string;
  name: string;
  description: string;

  // 触发条件
  trigger: ExtractionTrigger;

  // 提取器
  extractor: Extractor;

  // 输出配置
  output: {
    eventType: ExperienceEventType;
    severity?: EventSeverity;
    tags?: string[];
  };
}

/**
 * 提取触发器
 */
export interface ExtractionTrigger {
  type: 'result' | 'error' | 'pattern' | 'custom';

  // 结果触发条件
  success?: boolean;
  agentType?: string | string[];
  durationRange?: [number, number];

  // 错误触发条件
  errorPattern?: RegExp | string;
  errorType?: string | string[];

  // 模式触发条件
  pattern?: RegExp | string;
  minOccurrences?: number;

  // 自定义触发器
  custom?: (context: ExtractionContext) => boolean;
}

/**
 * 提取器
 */
export interface Extractor {
  type: 'template' | 'function' | 'ai';

  // 模板提取器
  template?: {
    title: string;
    description: string;
    details: Record<string, string | ((context: ExtractionContext) => string)>;
  };

  // 函数提取器
  function?: (context: ExtractionContext) => Partial<ExperienceEvent>;

  // AI 提取器
  ai?: {
    prompt: string;
    model?: string;
  };
}

/**
 * 提取上下文
 */
export interface ExtractionContext {
  agentType: string;
  runResult: {
    success: boolean;
    output: string;
    error?: string;
    duration: number;
    metadata?: Record<string, unknown>;
  };
  sessionId: string;
  runId: string;
  timestamp: number;
}

/**
 * 模式匹配结果
 */
export interface PatternMatch {
  pattern: string;
  confidence: number;
  context: string;
  location?: {
    filePath: string;
    line?: number;
  };
}

/**
 * 经验统计
 */
export interface ExperienceStats {
  totalEvents: number;
  eventsByType: Record<ExperienceEventType, number>;
  eventsBySeverity: Record<EventSeverity, number>;
  eventsByAgent: Record<string, number>;
  commonPatterns: Array<{
    pattern: string;
    count: number;
    lastSeen: number;
  }>;
  topSuccessFactors: string[];
  topFailureCauses: string[];
}

/**
 * 事件过滤器
 */
export interface EventFilter {
  types?: ExperienceEventType[];
  severities?: EventSeverity[];
  agentTypes?: string[];
  tags?: string[];
  timeRange?: {
    start: number;
    end: number;
  };
  searchText?: string;
}

/**
 * 分页选项
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'timestamp' | 'severity' | 'occurrenceCount';
  sortOrder?: 'asc' | 'desc';
}
