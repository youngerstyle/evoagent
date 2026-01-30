/**
 * Vector Store
 *
 * 向量存储和相似度搜索
 * 注意：完整的向量搜索需要 sqlite-vec 扩展
 * 当前实现使用内存中的向量计算 + SQLite 元数据存储
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { getLogger } from '../../core/logger/index.js';
import type { EmbeddingService } from './EmbeddingService.js';

const logger = getLogger('memory:vector:store');

// ========== 类型定义 ==========

export interface VectorMetadata {
  [key: string]: string | number | boolean | undefined;
}

export interface VectorEntry {
  id: string;
  collection: string;
  embedding: number[];
  content: string;
  metadata: VectorMetadata;
  createdAt: number;
  accessCount: number;
  consolidated: boolean;
}

/**
 * SQLite 数据库行数据类型
 */
interface VectorRow {
  id: string;
  collection: string;
  content: string;
  metadata: string;
  created_at: number;
  access_count: number;
  consolidated: number;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: VectorMetadata;
  score: number;  // 相似度分数 (0-1, 越高越相似)
  distance: number;
}

export interface SimilaritySearchOptions {
  collection?: string;
  limit?: number;
  minScore?: number;
  filter?: (metadata: VectorMetadata) => boolean;
}

export interface VectorStoreOptions {
  dbPath?: string;
  embeddingService: EmbeddingService;
  enablePersistence?: boolean;
}

/**
 * Vector Store 类
 */
export class VectorStore {
  private db?: Database.Database;
  private dbPath: string;
  private _embeddingService: EmbeddingService;
  private enablePersistence: boolean;
  private memoryVectors: Map<string, VectorEntry>;
  private initialized = false;

  constructor(options: VectorStoreOptions) {
    this.dbPath = options.dbPath || join(process.cwd(), '.evoagent', 'vector.db');
    this._embeddingService = options.embeddingService;
    this.enablePersistence = options.enablePersistence ?? true;
    this.memoryVectors = new Map();
  }

  /**
   * 获取嵌入服务（用于生成向量）
   */
  getEmbeddingService(): EmbeddingService {
    return this._embeddingService;
  }

  /**
   * 初始化向量存储
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.debug(`Initializing VectorStore at ${this.dbPath}`);

    // 确保目录存在
    await mkdir(join(this.dbPath, '..'), { recursive: true });

    if (this.enablePersistence) {
      try {
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');

        // 创建向量表
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS vectors (
            id TEXT PRIMARY KEY,
            collection TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            created_at INTEGER NOT NULL,
            access_count INTEGER DEFAULT 0,
            consolidated INTEGER DEFAULT 0
          );
        `);

        // 创建索引
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_vectors_collection ON vectors(collection);
          CREATE INDEX IF NOT EXISTS idx_vectors_created_at ON vectors(created_at);
        `);

        logger.debug('VectorStore database initialized');
      } catch (error) {
        logger.warn('Failed to initialize database, using memory-only mode:', { error });
        this.enablePersistence = false;
      }
    }

    this.initialized = true;
  }

  /**
   * 添加向量
   */
  async add(entry: Omit<VectorEntry, 'createdAt' | 'accessCount'>): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    const vectorEntry: VectorEntry = {
      ...entry,
      createdAt: Date.now(),
      accessCount: 0
    };

    // 存储到内存
    this.memoryVectors.set(entry.id, vectorEntry);

    // 存储到数据库
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO vectors (id, collection, content, metadata, created_at, access_count, consolidated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        entry.id,
        entry.collection,
        entry.content,
        JSON.stringify(entry.metadata),
        vectorEntry.createdAt,
        0,
        entry.consolidated ? 1 : 0
      );
    }

    logger.debug(`Added vector ${entry.id} to collection ${entry.collection}`);
  }

  /**
   * 批量添加向量
   */
  async addBatch(entries: Omit<VectorEntry, 'createdAt' | 'accessCount'>[]): Promise<void> {
    for (const entry of entries) {
      await this.add(entry);
    }
  }

  /**
   * 获取向量
   */
  async get(id: string): Promise<VectorEntry | null> {
    if (!this.initialized) {
      await this.init();
    }

    // 先从内存中获取
    if (this.memoryVectors.has(id)) {
      const entry = this.memoryVectors.get(id)!;
      entry.accessCount++;
      return entry;
    }

    // 从数据库获取
    if (this.db) {
      const stmt = this.db.prepare('SELECT * FROM vectors WHERE id = ?');
      const row = stmt.get(id) as VectorRow | undefined;

      if (row) {
        const entry: VectorEntry = {
          id: row.id,
          collection: row.collection,
          embedding: [], // 向量数据需要单独管理
          content: row.content,
          metadata: JSON.parse(row.metadata || '{}'),
          createdAt: row.created_at,
          accessCount: (row.access_count || 0) + 1,
          consolidated: row.consolidated === 1
        };

        // 更新访问计数
        const updateStmt = this.db.prepare('UPDATE vectors SET access_count = access_count + 1 WHERE id = ?');
        updateStmt.run(id);

        return entry;
      }
    }

    return null;
  }

  /**
   * 删除向量
   */
  async delete(id: string): Promise<boolean> {
    if (!this.initialized) {
      await this.init();
    }

    const deleted = this.memoryVectors.delete(id);

    if (this.db) {
      const stmt = this.db.prepare('DELETE FROM vectors WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0 || deleted;
    }

    return deleted;
  }

  /**
   * 批量删除
   */
  async deleteBatch(ids: string[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      if (await this.delete(id)) {
        count++;
      }
    }
    return count;
  }

  /**
   * 按元数据删除
   */
  async deleteByMetadata(collection: string, predicate: (metadata: VectorMetadata) => boolean): Promise<number> {
    if (!this.initialized) {
      await this.init();
    }

    let count = 0;
    const toDelete: string[] = [];

    // 收集要删除的 ID
    for (const [id, entry] of this.memoryVectors.entries()) {
      if (entry.collection === collection && predicate(entry.metadata)) {
        toDelete.push(id);
      }
    }

    // 删除
    for (const id of toDelete) {
      if (await this.delete(id)) {
        count++;
      }
    }

    return count;
  }

  /**
   * 相似度搜索
   */
  async similaritySearch(
    queryEmbedding: number[],
    options: SimilaritySearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.init();
    }

    const {
      collection,
      limit = 10,
      minScore = 0,
      filter
    } = options;

    const results: Array<{ entry: VectorEntry; score: number; distance: number }> = [];

    // 计算与所有向量的相似度
    for (const entry of this.memoryVectors.values()) {
      // 过滤集合
      if (collection && entry.collection !== collection) {
        continue;
      }

      // 过滤元数据
      if (filter && !filter(entry.metadata)) {
        continue;
      }

      // 计算相似度
      const similarity = this._embeddingService.cosineSimilarity(queryEmbedding, entry.embedding);
      const distance = 1 - similarity; // 余弦距离

      if (similarity >= minScore) {
        results.push({
          entry,
          score: similarity,
          distance
        });
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.score - a.score);

    // 返回前 N 个结果
    return results.slice(0, limit).map(r => ({
      id: r.entry.id,
      content: r.entry.content,
      metadata: r.entry.metadata,
      score: r.score,
      distance: r.distance
    }));
  }

  /**
   * 通过文本进行搜索（自动生成 embedding）
   */
  async search(
    query: string,
    options: SimilaritySearchOptions = {}
  ): Promise<SearchResult[]> {
    // 生成查询向量
    const embedding = await this._embeddingService.embed(query);
    return this.similaritySearch(embedding, options);
  }

  /**
   * 列出集合中的所有向量
   */
  async list(collection?: string): Promise<VectorEntry[]> {
    if (!this.initialized) {
      await this.init();
    }

    const results: VectorEntry[] = [];

    for (const entry of this.memoryVectors.values()) {
      if (!collection || entry.collection === collection) {
        results.push(entry);
      }
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 获取集合统计信息
   */
  async getStats(collection?: string): Promise<{
    totalCount: number;
    totalSize: number;
    avgAccessCount: number;
  }> {
    if (!this.initialized) {
      await this.init();
    }

    const entries = await this.list(collection);

    return {
      totalCount: entries.length,
      totalSize: entries.reduce((sum, e) => sum + e.content.length, 0),
      avgAccessCount: entries.length > 0
        ? entries.reduce((sum, e) => sum + e.accessCount, 0) / entries.length
        : 0
    };
  }

  /**
   * 清空集合
   */
  async clearCollection(collection: string): Promise<number> {
    if (!this.initialized) {
      await this.init();
    }

    let count = 0;

    for (const [id, entry] of this.memoryVectors.entries()) {
      if (entry.collection === collection) {
        this.memoryVectors.delete(id);
        count++;
      }
    }

    if (this.db) {
      const stmt = this.db.prepare('DELETE FROM vectors WHERE collection = ?');
      const result = stmt.run(collection);
      count = Math.max(count, result.changes);
    }

    logger.debug(`Cleared ${count} vectors from collection ${collection}`);
    return count;
  }

  /**
   * 标记为已巩固（记忆巩固后调用）
   */
  async markConsolidated(id: string, consolidated = true): Promise<void> {
    const entry = this.memoryVectors.get(id);
    if (entry) {
      entry.consolidated = consolidated;
    }

    if (this.db) {
      const stmt = this.db.prepare('UPDATE vectors SET consolidated = ? WHERE id = ?');
      stmt.run(consolidated ? 1 : 0, id);
    }
  }

  /**
   * 获取访问计数
   */
  async getAccessCount(id: string): Promise<number> {
    const entry = await this.get(id);
    return entry?.accessCount || 0;
  }

  /**
   * 清理低访问量的向量
   */
  async cleanup(options: {
    collection?: string;
    maxAge?: number;
    minAccessCount?: number;
  } = {}): Promise<number> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, entry] of this.memoryVectors.entries()) {
      // 过滤集合
      if (options.collection && entry.collection !== options.collection) {
        continue;
      }

      // 检查年龄
      if (options.maxAge) {
        const age = now - entry.createdAt;
        if (age < options.maxAge) {
          continue;
        }
      }

      // 检查访问计数
      if (options.minAccessCount !== undefined && entry.accessCount >= options.minAccessCount) {
        continue;
      }

      // 检查是否已巩固
      if (entry.consolidated) {
        continue;
      }

      toDelete.push(id);
    }

    // 删除
    for (const id of toDelete) {
      await this.delete(id);
    }

    logger.debug(`Cleaned up ${toDelete.length} vectors`);
    return toDelete.length;
  }

  /**
   * 关闭存储
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
    this.initialized = false;
    logger.debug('VectorStore closed');
  }
}
