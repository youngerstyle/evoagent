/**
 * Embedding Cache
 *
 * 使用 LRU 缓存避免重复计算 embedding
 * 防止内存泄漏：限制缓存大小
 */

interface CacheEntry {
  embedding: number[];
  timestamp: number;
  accessCount: number;
}

export interface CacheOptions {
  maxSize?: number;      // 最大缓存条目数 (默认 1000)
  maxAge?: number;       // 最大年龄（毫秒，默认 1小时）
}

export class EmbeddingCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private maxAge: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.maxAge = options.maxAge || 60 * 60 * 1000; // 1 hour
  }

  /**
   * 生成缓存键
   */
  private generateKey(text: string, model?: string): string {
    return `${model || 'default'}:${text}`;
  }

  /**
   * 获取缓存的 embedding
   */
  get(text: string, model?: string): number[] | null {
    const key = this.generateKey(text, model);
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // 更新访问信息
    entry.accessCount++;
    entry.timestamp = now;

    // LRU: 移动到末尾（最近使用）
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hitCount++;
    return entry.embedding;
  }

  /**
   * 设置缓存
   */
  set(text: string, embedding: number[], model?: string): void {
    const key = this.generateKey(text, model);

    // 检查缓存大小，删除最旧的条目
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // 删除第一个（最久未使用）
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  /**
   * 批量设置缓存
   */
  setMany(items: Array<{ text: string; embedding: number[]; model?: string }>): void {
    for (const item of items) {
      this.set(item.text, item.embedding, item.model);
    }
  }

  /**
   * 清除缓存
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * 清除过期条目
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
  } {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0
    };
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }
}
