export type * from './types.js';
export { SQLiteDatabase } from './sqlite.js';

import type { DatabaseConfig } from './types.js';
import { SQLiteDatabase } from './sqlite.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger('database');

/**
 * 数据库连接池/管理器
 */
class DatabaseManager {
  private connections = new Map<string, SQLiteDatabase>();

  /**
   * 获取或创建数据库连接
   */
  getConnection(name: string, config?: DatabaseConfig): SQLiteDatabase {
    let db = this.connections.get(name);

    if (!db && config) {
      logger.info(`Creating new database connection: ${name} at ${config.path}`);
      db = new SQLiteDatabase(config);
      this.connections.set(name, db);
    }

    if (!db) {
      throw new Error(`Database connection '${name}' not found`);
    }

    return db;
  }

  /**
   * 关闭指定连接
   */
  closeConnection(name: string): void {
    const db = this.connections.get(name);
    if (db) {
      db.close();
      this.connections.delete(name);
      logger.info(`Closed database connection: ${name}`);
    }
  }

  /**
   * 关闭所有连接
   */
  closeAll(): void {
    for (const [name, db] of this.connections) {
      db.close();
      logger.info(`Closed database connection: ${name}`);
    }
    this.connections.clear();
  }

  /**
   * 检查连接是否存在
   */
  hasConnection(name: string): boolean {
    const db = this.connections.get(name);
    return db ? db.open : false;
  }
}

// 全局数据库管理器实例
const dbManager = new DatabaseManager();

export { dbManager as databaseManager };

/**
 * 获取数据库连接的便捷函数
 */
export function getDatabase(
  name: string,
  config?: DatabaseConfig
): SQLiteDatabase {
  return dbManager.getConnection(name, config);
}

/**
 * 关闭数据库连接的便捷函数
 */
export function closeDatabase(name: string): void {
  dbManager.closeConnection(name);
}

/**
 * 关闭所有数据库连接
 */
export function closeAllDatabases(): void {
  dbManager.closeAll();
}
