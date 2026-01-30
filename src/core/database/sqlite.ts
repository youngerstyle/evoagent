import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type {
  Database as DatabaseInterface,
  DatabaseConfig,
  Statement,
  RunResult
} from './types.js';

/**
 * SQLite数据库实现
 */
export class SQLiteDatabase implements DatabaseInterface {
  private db: Database.Database;

  constructor(config: DatabaseConfig | string) {
    const options = typeof config === 'string' ? { path: config } : config;
    const fullPath = resolve(options.path);

    // 确保目录存在
    if (!options.readonly) {
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(fullPath, {
      readonly: options.readonly,
      fileMustExist: options.fileMustExist,
      timeout: options.timeout || 5000,
      verbose: options.verbose ? console.log : undefined
    });

    // 启用WAL模式以提高并发性能
    if (!options.readonly) {
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('synchronous = NORMAL');
    }
  }

  get open(): boolean {
    return this.db.open;
  }

  get path(): string {
    return this.db.name;
  }

  exec(sql: string): RunResult {
    const result = this.db.exec(sql) as unknown as { changes: number; lastInsertRowid: number | bigint };
    return {
      changes: result.changes,
      lastInsertRowid: typeof result.lastInsertRowid === 'bigint' ? Number(result.lastInsertRowid) : result.lastInsertRowid
    };
  }

  prepare(sql: string): Statement {
    const stmt = this.db.prepare(sql);

    return {
      run: (params) => {
        const result = stmt.run(params);
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid
        };
      },
      get: (params) => stmt.get(params),
      all: (params) => stmt.all(params),
      finalize: () => { /* stmt is automatically finalized */ }
    };
  }

  inTransaction<T>(cb: () => T): T {
    return this.db.transaction(cb)();
  }

  close(): void {
    if (this.db.open) {
      this.db.close();
    }
  }

  /**
   * 执行带参数的查询（辅助方法）
   */
  query(sql: string, params?: unknown[]): unknown[] {
    const stmt = this.prepare(sql);
    try {
      return stmt.all(params);
    } finally {
      stmt.finalize();
    }
  }

  /**
   * 执行并获取单行（辅助方法）
   */
  queryOne(sql: string, params?: unknown[]): unknown | undefined {
    const stmt = this.prepare(sql);
    try {
      return stmt.get(params);
    } finally {
      stmt.finalize();
    }
  }

  /**
   * 执行更新（辅助方法）
   */
  execute(sql: string, params?: unknown[]): RunResult {
    const stmt = this.prepare(sql);
    try {
      return stmt.run(params);
    } finally {
      stmt.finalize();
    }
  }

  /**
   * 获取数据库统计信息
   */
  getStats(): { size: number; walSize: number; pageCount: number } {
    return {
      size: this.db.pragma('page_size', { simple: true }) as number,
      walSize: this.db.pragma('wal_checkpoint(truncate)', { simple: true }) as number,
      pageCount: this.db.pragma('page_count', { simple: true }) as number
    };
  }
}
