/**
 * Hybrid Search - 混合搜索
 *
 * 整合 Knowledge 全文搜索和 Vector 向量搜索
 */

import type { KnowledgeStorage, KnowledgeItem } from '../knowledge/index.js';
import type { VectorStore, SearchResult } from '../vector/index.js';
import { weightedRRF, deduplicateResults } from './RRF.js';
import type {
  HybridSearchOptions,
  HybridSearchResult,
  SearchResultWithSource
} from './types.js';

/**
 * 混合搜索类
 */
export class HybridSearch {
  private knowledge: KnowledgeStorage | null;
  private vector: VectorStore | null;

  constructor(options: {
    knowledge?: KnowledgeStorage;
    vector?: VectorStore;
  } = {}) {
    this.knowledge = options.knowledge ?? null;
    this.vector = options.vector ?? null;
  }

  /**
   * 设置 Knowledge 存储
   */
  setKnowledgeStorage(storage: KnowledgeStorage): void {
    this.knowledge = storage;
  }

  /**
   * 设置 Vector 存储
   */
  setVectorStore(store: VectorStore): void {
    this.vector = store;
  }

  /**
   * 混合搜索 - 同时搜索 Knowledge 和 Vector
   *
   * @param query - 搜索查询
   * @param options - 搜索选项
   * @returns 融合后的结果
   */
  async search(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult[]> {
    const {
      knowledgeWeight = 0.5,
      vectorWeight = 0.5,
      limit = 10,
      rrfK = 60
    } = options;

    const allResults: SearchResultWithSource[] = [];

    // 并行搜索两个源
    const [knowledgeResults, vectorResults] = await Promise.all([
      this.searchKnowledge(query, limit),
      this.searchVector(query, limit)
    ]);

    // 添加 Knowledge 结果
    for (let i = 0; i < knowledgeResults.length; i++) {
      const result = knowledgeResults[i];
      if (!result) continue;
      allResults.push({
        id: result.item.path,
        content: `${result.item.frontmatter.title}\n${result.item.content}`,
        score: 0,  // RRF 会重新计算
        rank: i + 1,
        source: 'knowledge'
      });
    }

    // 添加 Vector 结果
    for (let i = 0; i < vectorResults.length; i++) {
      const item = vectorResults[i];
      if (!item) continue;
      allResults.push({
        id: item.id,
        content: item.content,
        score: 0,  // RRF 会重新计算
        rank: i + 1,
        source: 'vector'
      });
    }

    // 使用加权 RRF 融合
    let fusedResults = weightedRRF(
      allResults,
      { knowledge: knowledgeWeight, vector: vectorWeight },
      { k: rrfK, limit: limit * 2 }  // 获取更多结果用于去重
    );

    // 去重
    fusedResults = deduplicateResults(fusedResults, 0.85);

    // 添加 metadata 信息
    fusedResults = await this.enrichResults(fusedResults, knowledgeResults, vectorResults);

    return fusedResults.slice(0, limit);
  }

  /**
   * 仅搜索 Knowledge
   */
  async searchKnowledge(query: string, limit = 10): Promise<Array<{ item: KnowledgeItem; score: number }>> {
    if (!this.knowledge) {
      return [];
    }
    return this.knowledge.searchByContent(query, { limit });
  }

  /**
   * 仅搜索 Vector
   */
  async searchVector(query: string, limit = 10): Promise<SearchResult[]> {
    if (!this.vector) {
      return [];
    }
    return this.vector.search(query, { limit });
  }

  /**
   * 为结果添加元数据
   */
  private async enrichResults(
    results: HybridSearchResult[],
    knowledgeResults: Array<{ item: KnowledgeItem; score: number }>,
    vectorResults: SearchResult[]
  ): Promise<HybridSearchResult[]> {
    // 创建查找映射
    const knowledgeMap = new Map(
      knowledgeResults.map(r => [r.item.path, r.item])
    );
    const vectorMap = new Map(
      vectorResults.map(item => [item.id, item])
    );

    for (const result of results) {
      // 从 Knowledge 获取元数据
      const knowledgeItem = knowledgeMap.get(result.id);
      if (knowledgeItem) {
        result.metadata = {
          category: knowledgeItem.frontmatter?.category,
          tags: knowledgeItem.frontmatter?.tags
        };
      }

      // 从 Vector 获取元数据
      const vectorItem = vectorMap.get(result.id);
      if (vectorItem) {
        result.metadata = {
          ...result.metadata,
          collection: vectorItem.metadata.category as string
        };
      }
    }

    return results;
  }

  /**
   * 获取搜索统计信息
   */
  async getStats(): Promise<{
    knowledgeAvailable: boolean;
    vectorAvailable: boolean;
    totalSources: number;
  }> {
    return {
      knowledgeAvailable: this.knowledge !== null,
      vectorAvailable: this.vector !== null,
      totalSources: (this.knowledge !== null ? 1 : 0) + (this.vector !== null ? 1 : 0)
    };
  }
}

/**
 * 创建混合搜索实例
 */
export function createHybridSearch(options: {
  knowledge?: KnowledgeStorage;
  vector?: VectorStore;
}): HybridSearch {
  return new HybridSearch(options);
}
