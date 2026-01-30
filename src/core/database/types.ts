/**
 * 数据库抽象层类型定义
 */

export interface Database {
  /**
   * 执行SQL语句
   */
  exec(sql: string): RunResult;

  /**
   * 准备语句
   */
  prepare(sql: string): Statement;

  /**
   * 在事务中执行
   */
  inTransaction<T>(cb: () => T): T;

  /**
   * 关闭数据库连接
   */
  close(): void;

  /**
   * 检查数据库是否打开
   */
  readonly open: boolean;

  /**
   * 获取数据库路径
   */
  readonly path: string;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  /**
   * 执行并返回结果
   */
  run(params?: unknown[]): RunResult;

  /**
   * 获取单行结果
   */
  get(params?: unknown[]): unknown | undefined;

  /**
   * 获取所有结果
   */
  all(params?: unknown[]): unknown[];

  /**
   * 释放语句
   */
  finalize(): void;
}

/**
 * 会话记录
 */
export interface SessionRecord {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived';
  metadata: Record<string, unknown>;
}

/**
 * 知识记录
 */
export interface KnowledgeRecord {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  occurrences: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 向量记录
 */
export interface VectorRecord {
  id: string;
  collection: string;
  embedding: number[];
  content: string;
  metadata: Record<string, unknown>;
  consolidated: boolean;
  createdAt: number;
  accessCount: number;
}

/**
 * 数据库配置
 */
export interface DatabaseConfig {
  path: string;
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  verbose?: boolean;
}

/**
 * 查询选项
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
}
