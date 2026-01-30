/**
 * Hybrid Search - 混合搜索模块
 *
 * 融合多种检索源（Knowledge + Vector）的结果
 */

export interface RankedResult<T = unknown> {
  item: T;
  score: number;
  rank: number;
  source: 'knowledge' | 'vector' | 'hybrid';
}

export interface HybridSearchOptions {
  knowledgeWeight?: number;  // Knowledge 搜索权重 (默认 0.5)
  vectorWeight?: number;     // Vector 搜索权重 (默认 0.5)
  limit?: number;            // 返回结果数量 (默认 10)
  rrfK?: number;             // RRF 常数 k (默认 60)
}

export interface SearchResultWithSource {
  id: string;
  content: string;
  score: number;
  rank: number;
  source: 'knowledge' | 'vector';
}

export interface HybridSearchResult {
  id: string;
  content: string;
  score: number;
  sources: ('knowledge' | 'vector')[];
  rank: number;
  metadata?: {
    category?: string;
    tags?: string[];
    collection?: string;
  };
}
