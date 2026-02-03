/**
 * 技能进化系统类型定义
 *
 * 第三轨进化：技能进化轨道
 */

/**
 * 技能验证状态
 */
export type SkillValidationStatus = 'draft' | 'probation' | 'validated' | 'deprecated';

/**
 * 技能来源
 */
export type SkillSource = 'auto' | 'manual';

/**
 * 技能元数据 (SKILL.md frontmatter)
 */
export interface SkillMetadata {
  // 基本信息
  name: string;
  description: string;
  version: string;
  created: string;
  source: SkillSource;
  author: string;

  // 统计信息
  occurrence: number;
  confidence: number;

  // 验证信息
  validation: SkillValidationInfo;

  // 分类
  tags: string[];
  dependencies: string[];

  // 要求
  requirements: SkillRequirements;

  // v2.2 新增字段
  cautiousFactor: number;
  timesUsed: number;
  timesSucceeded: number;
  timesFailed: number;
  probationThreshold: number;
  sourceSessionIds: string[];
}

/**
 * 技能验证信息
 */
export interface SkillValidationInfo {
  status: SkillValidationStatus;
  score: number;
  testResults: string;
  lastValidated: string;
}

/**
 * 技能要求
 */
export interface SkillRequirements {
  bins: string[];
  env: string[];
}

/**
 * 技能模板
 */
export interface SkillTemplate {
  id: string;
  name: string;
  content: string;
  parameters?: string[];
}

/**
 * 完整技能定义
 */
export interface Skill {
  metadata: SkillMetadata;
  content: string;
  templates: Map<string, SkillTemplate>;
  tests: Map<string, string>;
}

/**
 * 模式候选 (pattern-candidates.jsonl)
 */
export interface PatternCandidate {
  timestamp: string;
  pattern: string;
  occurrence: number;
  sessionId: string;
  snippet: string;
  context?: string;
  agentType?: string;
}

/**
 * 技能生成参数
 */
export interface SkillGenerationParams {
  patternName: string;
  candidates: PatternCandidate[];
  agentType: string;
  minOccurrence?: number;
  confidenceThreshold?: number;
}

/**
 * 技能验证结果
 */
export interface SkillValidationResult {
  skillId: string;
  passed: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  testResults: Array<{
    name: string;
    passed: boolean;
    output?: string;
  }>;
}

/**
 * 技能使用统计
 */
export interface SkillUsageStats {
  skillId: string;
  timesUsed: number;
  timesSucceeded: number;
  timesFailed: number;
  lastUsed: string;
  averageDuration: number;
}

/**
 * 技能降级条件
 */
export interface SkillDegradationCriteria {
  consecutiveFailures: number;
  daysSinceLastUse: number;
  failureRateThreshold: number;
}

/**
 * 技能索引 (index.json)
 */
export interface SkillIndex {
  version: string;
  lastUpdated: string;
  skills: SkillIndexEntry[];
  deprecatedSkills: string[];
}

/**
 * 技能索引条目
 */
export interface SkillIndexEntry {
  id: string;
  name: string;
  status: SkillValidationStatus;
  tags: string[];
  timesUsed: number;
  successRate: number;
  lastUsed: string;
}

/**
 * 技能存储配置
 */
export interface SkillStoreConfig {
  skillsDir: string;
  autoDir: string;
  manualDir: string;
  deprecatedDir: string;
  backupDir: string;
  patternCandidatesFile: string;
  indexFile: string;
}

/**
 * 技能收集器配置
 */
export interface SkillCollectorConfig {
  minOccurrence: number;
  confidenceThreshold: number;
  maxCandidates: number;
}

/**
 * 技能反思器配置
 */
export interface SkillReflectorConfig {
  minCandidatesForGeneration: number;
  minOccurrenceForGeneration: number;
  defaultProbationThreshold: number;
  defaultCautiousFactor: number;
}

/**
 * 技能验证器配置
 */
export interface SkillReviewerConfig {
  validationTimeout: number;
  maxTestDuration: number;
  successRateThreshold: number;
  probationUsageThreshold: number;
}

/**
 * 技能搜索过滤器
 */
export interface SkillSearchFilter {
  status?: SkillValidationStatus[];
  tags?: string[];
  agentType?: string;
  minSuccessRate?: number;
  minTimesUsed?: number;
  searchText?: string;
}

/**
 * 技能执行结果
 */
export interface SkillExecutionResult {
  skillId: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

/**
 * 技能执行上下文
 */
export interface SkillExecutionContext {
  agentType: string;
  sessionId: string;
  taskId: string;
  variables: Record<string, unknown>;
}
