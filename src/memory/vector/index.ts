/**
 * Vector Memory Module
 *
 * 提供向量化存储和语义搜索功能
 * - EmbeddingService: 生成文本嵌入
 * - EmbeddingCache: LRU 缓存
 * - VectorStore: 向量存储和搜索
 */

export { EmbeddingCache, type CacheOptions } from './EmbeddingCache.js';
export {
  EmbeddingService,
  type EmbeddingOptions,
  type EmbeddingServiceOptions
} from './EmbeddingService.js';
export {
  VectorStore,
  type VectorEntry,
  type VectorMetadata,
  type SearchResult,
  type SimilaritySearchOptions,
  type VectorStoreOptions
} from './VectorStore.js';
