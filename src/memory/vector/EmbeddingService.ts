/**
 * Embedding Service
 *
 * 为文本生成向量嵌入
 * 支持 OpenAI 兼容的 API（包括本地服务如 Ollama）
 */

import { getLogger } from '../../core/logger/index.js';
import type { EmbeddingCache } from './EmbeddingCache.js';

const logger = getLogger('memory:vector:embedding');

export interface EmbeddingOptions {
  model?: string;
  dim?: number;
}

export interface EmbeddingServiceOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  dim?: number;
  cache?: EmbeddingCache;
}

export interface EmbeddingResponse {
  object: string;
  embedding: number[];
  index: number;
}

/**
 * Embedding 服务
 */
export class EmbeddingService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dim: number;
  private cache?: EmbeddingCache;

  constructor(options: EmbeddingServiceOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434/v1';
    this.apiKey = options.apiKey || 'dummy';
    this.model = options.model || 'nomic-embed-text';
    this.dim = options.dim || 768;
    this.cache = options.cache;
  }

  /**
   * 为单个文本生成 embedding
   */
  async embed(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
    const model = options.model || this.model;

    // 检查缓存
    if (this.cache) {
      const cached = this.cache.get(text, model);
      if (cached) {
        logger.debug('Embedding cache hit');
        return cached;
      }
    }

    // 调用 API 生成 embedding
    const embedding = await this.callEmbeddingAPI(text, model);

    // 存入缓存
    if (this.cache) {
      this.cache.set(text, embedding, model);
    }

    return embedding;
  }

  /**
   * 批量生成 embeddings
   */
  async embedBatch(texts: string[], options: EmbeddingOptions = {}): Promise<number[][]> {
    const model = options.model || this.model;
    const results: number[][] = [];

    // 先从缓存中获取
    const toFetch: string[] = [];
    const cachedResults: Map<number, number[]> = new Map();

    if (this.cache) {
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (!text) continue;

        const cached = this.cache.get(text, model);
        if (cached) {
          cachedResults.set(i, cached);
        } else {
          toFetch.push(text);
        }
      }
    } else {
      toFetch.push(...texts.filter(t => t));
    }

    // 批量获取未缓存的 embeddings
    if (toFetch.length > 0) {
      const fetched = await this.callEmbeddingBatchAPI(toFetch, model);

      // 存入缓存
      if (this.cache) {
        const cacheItems = toFetch.map((text, i) => ({
          text,
          embedding: fetched[i] ?? [],
          model
        }));
        this.cache.setMany(cacheItems);
      }

      let fetchIndex = 0;
      for (let i = 0; i < texts.length; i++) {
        if (!cachedResults.has(i)) {
          const embedding = fetched[fetchIndex++];
          if (embedding) {
            cachedResults.set(i, embedding);
          }
        }
      }
    }

    // 按原始顺序返回结果
    for (let i = 0; i < texts.length; i++) {
      const result = cachedResults.get(i);
      if (result) {
        results.push(result);
      } else {
        // 如果没有结果，返回空向量
        results.push([]);
      }
    }

    return results;
  }

  /**
   * 调用单个文本的 embedding API
   */
  private async callEmbeddingAPI(text: string, model: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          input: text,
          encoding_format: 'float'  // 确保返回浮点数格式
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { data: EmbeddingResponse[] };
      const embedding = data.data[0]?.embedding;

      if (!embedding) {
        throw new Error('No embedding in response');
      }

      // 验证维度
      if (embedding.length !== this.dim) {
        logger.warn(`Embedding dimension mismatch: expected ${this.dim}, got ${embedding.length}`);
      }

      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', { error });
      throw error;
    }
  }

  /**
   * 调用批量 embedding API
   */
  private async callEmbeddingBatchAPI(texts: string[], model: string): Promise<number[][]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          input: texts,
          encoding_format: 'float'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { data: EmbeddingResponse[] };

      // 按索引排序
      const sorted = data.data.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      return sorted.map(item => item.embedding ?? []);
    } catch (error) {
      logger.error('Failed to generate batch embeddings:', { error });
      throw error;
    }
  }

  /**
   * 计算余弦相似度
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const ai = a[i] ?? 0;
      const bi = b[i] ?? 0;
      dotProduct += ai * bi;
      normA += ai * ai;
      normB += bi * bi;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 计算欧几里得距离
   */
  euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = (a[i] ?? 0) - (b[i] ?? 0);
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * 获取配置的维度
   */
  getDimension(): number {
    return this.dim;
  }

  /**
   * 获取配置的模型
   */
  getModel(): string {
    return this.model;
  }
}
