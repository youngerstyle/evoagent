/**
 * Git Integration Types
 *
 * 定义 Git 集成相关的类型和结构
 */

/**
 * Git 提交信息
 */
export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  committer: string;
  committerEmail: string;
  message: string;
  summary: string;
  body: string;
  timestamp: number;
  date: Date;
  files: string[];
  stats?: GitFileStats;
}

/**
 * Git 文件变更统计
 */
export interface GitFileStats {
  total: number;
  additions: number;
  deletions: number;
  changes: number;
}

/**
 * Git 文件变更
 */
export interface GitFileChange {
  path: string;
  status: GitFileStatus;
  additions: number;
  deletions: number;
  patch?: string;
}

/**
 * Git 文件状态
 */
export type GitFileStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'unmerged'
  | 'unknown';

/**
 * Git 分支信息
 */
export interface GitBranch {
  name: string;
  current: boolean;
  commit: string;
  tracked?: string;
}

/**
 * Git 仓库状态
 */
export interface GitStatus {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: string[];
  conflicted: string[];
}

/**
 * Git 差异
 */
export interface GitDiff {
  from: string;
  to: string;
  files: GitFileChange[];
  summary: string;
}

/**
 * Git 历史查询选项
 */
export interface GitLogOptions {
  limit?: number;
  skip?: number;
  since?: string | Date;
  until?: string | Date;
  author?: string;
  file?: string;
  path?: string;
  branch?: string;
}

/**
 * Git 分析结果
 */
export interface GitAnalysis {
  totalCommits: number;
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  authors: AuthorStats[];
  commitsByDay: Record<string, number>;
  commitsByHour: Record<number, number>;
  fileChanges: FileChangeStats[];
  commonPatterns: PatternMatch[];
}

/**
 * 作者统计
 */
export interface AuthorStats {
  author: string;
  email: string;
  commits: number;
  additions: number;
  deletions: number;
  firstCommit: number;
  lastCommit: number;
}

/**
 * 文件变更统计
 */
export interface FileChangeStats {
  path: string;
  commits: number;
  authors: string[];
  additions: number;
  deletions: number;
}

/**
 * 模式匹配
 */
export interface PatternMatch {
  pattern: string;
  type: 'bug_fix' | 'feature' | 'refactor' | 'docs' | 'test' | 'chore' | 'unknown';
  count: number;
  examples: string[];
}

/**
 * 代码变更提取结果
 */
export interface ChangeExtraction {
  commitHash: string;
  timestamp: number;
  changes: ExtractedChange[];
  patterns: CodePattern[];
}

/**
 * 提取的变更
 */
export interface ExtractedChange {
  file: string;
  type: 'create' | 'modify' | 'delete' | 'rename';
  addedLines: string[];
  removedLines: string[];
  description: string;
  category?: 'bug_fix' | 'feature' | 'refactor' | 'test' | 'config';
}

/**
 * 代码模式
 */
export interface CodePattern {
  name: string;
  type: 'success' | 'anti_pattern' | 'best_practice';
  description: string;
  snippet: string;
  frequency: number;
}

/**
 * Git 集成配置
 */
export interface GitIntegrationConfig {
  // Git 可执行文件路径
  gitPath?: string;

  // 仓库路径
  repoPath: string;

  // 是否分析子模块
  analyzeSubmodules?: boolean;

  // 最大提交历史数量
  maxHistory?: number;

  // 排除的文件模式
  excludePatterns?: string[];

  // 包含的文件模式
  includePatterns?: string[];

  // 是否缓存结果
  cacheEnabled?: boolean;

  // 缓存过期时间（毫秒）
  cacheTtl?: number;

  // 提取器的配置
  extractionConfig?: ExtractionConfig;
}

/**
 * 提取器配置
 */
export interface ExtractionConfig {
  // 是否提取函数变更
  extractFunctionChanges?: boolean;

  // 是否提取类变更
  extractClassChanges?: boolean;

  // 是否提取导入变更
  extractImportChanges?: boolean;

  // 最大变更上下文行数
  maxContextLines?: number;

  // 语言特定提取器
  languageExtractors?: Record<string, LanguageExtractorConfig>;
}

/**
 * 语言提取器配置
 */
export interface LanguageExtractorConfig {
  enabled: boolean;
  patterns: string[];
  customExtractors?: string[];
}

/**
 * Git 提交与经验关联
 */
export interface CommitExperienceLink {
  commitHash: string;
  experienceId: string;
  linkType: 'caused' | 'resolved' | 'related' | 'documented';
  confidence: number;
  notes?: string;
}

/**
 * Git 提交与反思关联
 */
export interface CommitReflectionLink {
  commitHash: string;
  reflectionId: string;
  insights: string[];
  actionItems: string[];
}

/**
 * Git 报告配置
 */
export interface GitReportConfig {
  // 时间范围
  timeRange?: {
    start: Date;
    end: Date;
  };

  // 包含的作者
  authors?: string[];

  // 包含的文件
  files?: string[];

  // 报告类型
  reportType: 'summary' | 'detailed' | 'changelog';

  // 是否包含统计
  includeStats?: boolean;

  // 是否包含图表
  includeCharts?: boolean;
}

/**
 * Git 报告
 */
export interface GitReport {
  title: string;
  timeRange: { start: Date; end: Date };
  summary: GitReportSummary;
  commits: GitCommit[];
  authors: AuthorStats[];
  changes: FileChangeStats[];
  insights: string[];
  generatedAt: number;
}

/**
 * Git 报告摘要
 */
export interface GitReportSummary {
  totalCommits: number;
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  topContributors: { name: string; commits: number }[];
  mostChangedFiles: { path: string; changes: number }[];
}
