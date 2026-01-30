/**
 * RRF (Reciprocal Rank Fusion) - 倒数排名融合
 *
 * RRF 是一种简单有效的多列表融合算法
 * 公式: score(d) = Σ 1/(k + rank_d)
 * 其中 k 是常数（通常为 60），rank_d 是文档 d 在某个列表中的排名
 */

import type { SearchResultWithSource, HybridSearchResult } from './types.js';

/**
 * RRF 融合选项
 */
export interface RRFOptions {
  k?: number;           // RRF 常数，默认 60
  limit?: number;       // 返回结果数量
}

/**
 * RRF 融合算法
 *
 * @param results - 来自多个搜索源的结果列表
 * @param options - 融合选项
 * @returns 融合后的结果列表
 */
export function reciprocalRankFusion(
  results: SearchResultWithSource[],
  options: RRFOptions = {}
): HybridSearchResult[] {
  const { k = 60, limit = 10 } = options;

  // 按文档 ID 分组，收集每个文档在各列表中的排名
  const docScores = new Map<string, {
    content: string;
    score: number;
    sources: Set<'knowledge' | 'vector'>;
    metadata: {
      category?: string;
      tags?: string[];
      collection?: string;
    };
  }>();

  // 处理每个结果
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result) continue;

    const id = result.id;

    if (!docScores.has(id)) {
      docScores.set(id, {
        content: result.content,
        score: 0,
        sources: new Set(),
        metadata: {}
      });
    }

    const doc = docScores.get(id);
    if (!doc) continue;

    // RRF 公式: 1/(k + rank)
    doc.score += 1 / (k + result.rank);
    doc.sources.add(result.source);
  }

  // 转换为数组并按分数排序
  const sortedResults = Array.from(docScores.entries())
    .map(([id, data]) => ({
      id,
      content: data.content,
      score: data.score,
      sources: Array.from(data.sources) as ('knowledge' | 'vector')[],
      rank: 0,  // 稍后设置
      metadata: data.metadata
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 设置最终排名
  sortedResults.forEach((result, index) => {
    result.rank = index + 1;
  });

  return sortedResults;
}

/**
 * 加权 RRF - 考虑不同源的权重
 *
 * @param results - 来自多个搜索源的结果列表
 * @param weights - 各源权重 { knowledge: 0.5, vector: 0.5 }
 * @param options - 融合选项
 * @returns 融合后的结果列表
 */
export function weightedRRF(
  results: SearchResultWithSource[],
  weights: { knowledge?: number; vector?: number } = {},
  options: RRFOptions = {}
): HybridSearchResult[] {
  const { k = 60, limit = 10 } = options;
  const knowledgeWeight = weights.knowledge ?? 0.5;
  const vectorWeight = weights.vector ?? 0.5;

  // 归一化权重
  const totalWeight = knowledgeWeight + vectorWeight;
  const normalizedKW = totalWeight > 0 ? knowledgeWeight / totalWeight : 0.5;
  const normalizedVW = totalWeight > 0 ? vectorWeight / totalWeight : 0.5;

  const docScores = new Map<string, {
    content: string;
    score: number;
    sources: Set<'knowledge' | 'vector'>;
    metadata: {
      category?: string;
      tags?: string[];
      collection?: string;
    };
  }>();

  for (const result of results) {
    const id = result.id;

    if (!docScores.has(id)) {
      docScores.set(id, {
        content: result.content,
        score: 0,
        sources: new Set(),
        metadata: {}
      });
    }

    const doc = docScores.get(id);
    if (!doc) continue;

    // 应用权重
    const weight = result.source === 'knowledge' ? normalizedKW : normalizedVW;
    doc.score += weight / (k + result.rank);
    doc.sources.add(result.source);
  }

  const sortedResults = Array.from(docScores.entries())
    .map(([id, data]) => ({
      id,
      content: data.content,
      score: data.score,
      sources: Array.from(data.sources) as ('knowledge' | 'vector')[],
      rank: 0,
      metadata: data.metadata
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  sortedResults.forEach((result, index) => {
    result.rank = index + 1;
  });

  return sortedResults;
}

/**
 * 计算归一化分数 (0-1)
 */
export function normalizeScore(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.min(1, Math.max(0, score / maxScore));
}

/**
 * 去重结果（基于内容相似度）
 */
export function deduplicateResults(
  results: HybridSearchResult[],
  similarityThreshold: number = 0.9
): HybridSearchResult[] {
  const deduped: HybridSearchResult[] = [];

  for (const result of results) {
    let isDuplicate = false;

    for (const existing of deduped) {
      // 简单的内容相似度检查
      const similarity = computeJaccardSimilarity(
        result.content.toLowerCase(),
        existing.content.toLowerCase()
      );

      if (similarity >= similarityThreshold) {
        // 合并来源
        for (const source of result.sources) {
          if (!existing.sources.includes(source)) {
            existing.sources.push(source);
          }
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      deduped.push(result);
    }
  }

  // 重新设置排名
  deduped.forEach((result, index) => {
    result.rank = index + 1;
  });

  return deduped;
}

/**
 * 计算 Jaccard 相似度（用于简单去重）
 */
function computeJaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));

  if (words1.size === 0 && words2.size === 0) return 1;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}
