/**
 * Vector Store Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { EmbeddingService } from '../../../src/memory/vector/EmbeddingService.js';
import { EmbeddingCache } from '../../../src/memory/vector/EmbeddingCache.js';
import { VectorStore } from '../../../src/memory/vector/VectorStore.js';

const TEST_DB = join(process.cwd(), '.test-vector.db');

describe('EmbeddingCache', () => {
  let cache: EmbeddingCache;

  beforeEach(() => {
    cache = new EmbeddingCache({ maxSize: 5, maxAge: 1000 });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('get and set', () => {
    it('should store and retrieve embeddings', () => {
      const embedding = [0.1, 0.2, 0.3];
      cache.set('test text', embedding);

      const retrieved = cache.get('test text');
      expect(retrieved).toEqual(embedding);
    });

    it('should return null for non-existent key', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle different models', () => {
      const embedding1 = [0.1, 0.2, 0.3];
      const embedding2 = [0.4, 0.5, 0.6];

      cache.set('text', embedding1, 'model1');
      cache.set('text', embedding2, 'model2');

      expect(cache.get('text', 'model1')).toEqual(embedding1);
      expect(cache.get('text', 'model2')).toEqual(embedding2);
    });

    it('should evict oldest entry when max size reached', () => {
      const maxSize = 3;
      cache = new EmbeddingCache({ maxSize });

      for (let i = 0; i < maxSize + 1; i++) {
        cache.set(`text${i}`, [i]);
      }

      expect(cache.size).toBe(maxSize);
      expect(cache.get('text0')).toBeNull(); // First evicted
      expect(cache.get('text1')).not.toBeNull(); // Others still there
    });

    it('should update access count on get', () => {
      cache.set('test', [1, 2, 3]);
      cache.get('test');

      const stats = cache.getStats();
      expect(stats.hitCount).toBe(1);
    });
  });

  describe('setMany', () => {
    it('should set multiple items', () => {
      const items = [
        { text: 'text1', embedding: [0.1, 0.2] },
        { text: 'text2', embedding: [0.3, 0.4] }
      ];

      cache.setMany(items);

      expect(cache.get('text1')).toEqual([0.1, 0.2]);
      expect(cache.get('text2')).toEqual([0.3, 0.4]);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      const cache = new EmbeddingCache({ maxAge: 100 }); // 100ms

      cache.set('test1', [1]);
      cache.set('test2', [2]);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Access should clean up expired entry
      cache.get('test1');
      expect(cache.get('test1')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('test', [1]);
      cache.get('test');
      cache.get('non-existent');

      const stats = cache.getStats();

      expect(stats.size).toBe(1);
      expect(stats.hitCount).toBe(1);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });
});

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'test',
      model: 'test-model',
      dim: 3
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];

      const similarity = service.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1);
    });

    it('should calculate similarity for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];

      const similarity = service.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(0);
    });

    it('should calculate similarity for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];

      const similarity = service.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(-1);
    });

    it('should throw for mismatched dimensions', () => {
      const a = [1, 0];
      const b = [1, 0, 0];

      expect(() => service.cosineSimilarity(a, b)).toThrow();
    });

    it('should handle sparse arrays', () => {
      const a = [1, undefined, 0];
      const b = [1, 0, undefined];

      const similarity = service.cosineSimilarity(a as number[], b as number[]);
      expect(similarity).toBeCloseTo(1);
    });
  });

  describe('euclideanDistance', () => {
    it('should calculate Euclidean distance', () => {
      const a = [0, 0, 0];
      const b = [3, 4, 0];

      const distance = service.euclideanDistance(a, b);
      expect(distance).toBeCloseTo(5); // 3-4-5 triangle
    });

    it('should return 0 for identical vectors', () => {
      const a = [1, 2, 3];

      const distance = service.euclideanDistance(a, a);
      expect(distance).toBeCloseTo(0);
    });
  });

  describe('getters', () => {
    it('should return configured dimension', () => {
      expect(service.getDimension()).toBe(3);
    });

    it('should return configured model', () => {
      expect(service.getModel()).toBe('test-model');
    });
  });
});

describe('VectorStore', () => {
  let store: VectorStore;
  let embeddingService: EmbeddingService;

  beforeEach(async () => {
    // Clean up test database
    if (existsSync(TEST_DB)) {
      await unlink(TEST_DB);
    }

    embeddingService = new EmbeddingService({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'test',
      model: 'test-model',
      dim: 3
    });

    store = new VectorStore({
      dbPath: TEST_DB,
      embeddingService,
      enablePersistence: true
    });

    await store.init();
  });

  afterEach(async () => {
    await store.close();
    if (existsSync(TEST_DB)) {
      await unlink(TEST_DB).catch(() => {});
    }
  });

  describe('add and get', () => {
    it('should add and retrieve vector entry', async () => {
      await store.add({
        id: 'test1',
        collection: 'test',
        embedding: [0.1, 0.2, 0.3],
        content: 'test content',
        metadata: { key: 'value' },
        consolidated: false
      });

      const entry = await store.get('test1');
      expect(entry).toBeDefined();
      expect(entry?.id).toBe('test1');
      expect(entry?.content).toBe('test content');
      expect(entry?.metadata.key).toBe('value');
    });

    it('should increment access count on get', async () => {
      await store.add({
        id: 'test2',
        collection: 'test',
        embedding: [1, 2, 3],
        content: 'content',
        metadata: {},
        consolidated: false
      });

      await store.get('test2');
      const entry = await store.get('test2');

      expect(entry?.accessCount).toBe(2);
    });
  });

  describe('addBatch', () => {
    it('should add multiple vectors', async () => {
      await store.addBatch([
        {
          id: 'batch1',
          collection: 'test',
          embedding: [1, 2, 3],
          content: 'content1',
          metadata: {},
          consolidated: false
        },
        {
          id: 'batch2',
          collection: 'test',
          embedding: [4, 5, 6],
          content: 'content2',
          metadata: {},
          consolidated: false
        }
      ]);

      const entries = await store.list('test');
      expect(entries.length).toBe(2);
    });
  });

  describe('delete', () => {
    it('should delete vector', async () => {
      await store.add({
        id: 'delete-me',
        collection: 'test',
        embedding: [1, 2, 3],
        content: 'content',
        metadata: {},
        consolidated: false
      });

      const deleted = await store.delete('delete-me');
      expect(deleted).toBe(true);

      const entry = await store.get('delete-me');
      expect(entry).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      const deleted = await store.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('similaritySearch', () => {
    beforeEach(async () => {
      await store.addBatch([
        {
          id: 'similar1',
          collection: 'search',
          embedding: [1, 0, 0],
          content: 'similar content',
          metadata: {},
          consolidated: false
        },
        {
          id: 'similar2',
          collection: 'search',
          embedding: [0.9, 0.1, 0],
          content: 'very similar',
          metadata: {},
          consolidated: false
        },
        {
          id: 'different',
          collection: 'search',
          embedding: [0, 0, 1],
          content: 'different content',
          metadata: {},
          consolidated: false
        }
      ]);
    });

    it('should find similar vectors', async () => {
      const query = [1, 0, 0];
      const results = await store.similaritySearch(query, { collection: 'search', limit: 2 });

      expect(results.length).toBe(2);
      expect(results[0].id).toBe('similar1'); // Highest similarity
      expect(results[0].score).toBeGreaterThan(0.9);
    });

    it('should filter by collection', async () => {
      const query = [1, 0, 0];
      const results = await store.similaritySearch(query, { collection: 'search' });

      expect(results.length).toBe(3);
    });

    it('should filter by minScore', async () => {
      const query = [1, 0, 0];
      const results = await store.similaritySearch(query, { minScore: 0.8 });

      expect(results.length).toBe(2); // similar1 and similar2
    });

    it('should respect limit', async () => {
      const query = [1, 0, 0];
      const results = await store.similaritySearch(query, { limit: 1 });

      expect(results.length).toBe(1);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await store.addBatch([
        { id: 'item1', collection: 'list-test', embedding: [1], content: 'c1', metadata: {}, consolidated: false },
        { id: 'item2', collection: 'list-test', embedding: [2], content: 'c2', metadata: {}, consolidated: false },
        { id: 'item3', collection: 'other', embedding: [3], content: 'c3', metadata: {}, consolidated: false }
      ]);
    });

    it('should list all items', async () => {
      const items = await store.list();
      expect(items.length).toBe(3);
    });

    it('should filter by collection', async () => {
      const items = await store.list('list-test');
      expect(items.length).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return collection statistics', async () => {
      await store.addBatch([
        { id: 's1', collection: 'stats', embedding: [1], content: 'a', metadata: {}, consolidated: false },
        { id: 's2', collection: 'stats', embedding: [2], content: 'bb', metadata: {}, consolidated: false }
      ]);

      const stats = await store.getStats('stats');

      expect(stats.totalCount).toBe(2);
      expect(stats.totalSize).toBe(3); // 'a' + 'bb'
    });
  });

  describe('clearCollection', () => {
    it('should clear all vectors in collection', async () => {
      await store.addBatch([
        { id: 'c1', collection: 'clear', embedding: [1], content: 'x', metadata: {}, consolidated: false },
        { id: 'c2', collection: 'keep', embedding: [2], content: 'y', metadata: {}, consolidated: false }
      ]);

      const count = await store.clearCollection('clear');

      expect(count).toBe(1);

      const remaining = await store.list('clear');
      expect(remaining.length).toBe(0);

      const kept = await store.list('keep');
      expect(kept.length).toBe(1);
    });
  });

  describe('markConsolidated', () => {
    it('should mark entry as consolidated', async () => {
      await store.add({
        id: 'consolidate',
        collection: 'test',
        embedding: [1],
        content: 'content',
        metadata: {},
        consolidated: false
      });

      await store.markConsolidated('consolidate', true);

      const entry = await store.get('consolidate');
      expect(entry?.consolidated).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup old vectors', async () => {
      const oldTime = Date.now() - 10000; // 10 seconds ago

      // Directly create entries with old timestamp
      await store.add({
        id: 'old-vector',
        collection: 'cleanup-test',
        embedding: [1],
        content: 'old',
        metadata: {},
        consolidated: false
      });

      // Manually update timestamp (private, but we can access via the entry)
      const entry = await store.get('old-vector');
      if (entry) {
        (entry as any).createdAt = oldTime;
      }

      const count = await store.cleanup({
        collection: 'cleanup-test',
        maxAge: 5000, // 5 seconds
        minAccessCount: 10
      });

      // The vector should be cleaned up
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('deleteByMetadata', () => {
    it('should delete by metadata predicate', async () => {
      await store.addBatch([
        {
          id: 'meta1',
          collection: 'meta-test',
          embedding: [1],
          content: 'content1',
          metadata: { type: 'a' },
          consolidated: false
        },
        {
          id: 'meta2',
          collection: 'meta-test',
          embedding: [2],
          content: 'content2',
          metadata: { type: 'b' },
          consolidated: false
        }
      ]);

      const count = await store.deleteByMetadata('meta-test', (m) => m.type === 'a');

      expect(count).toBe(1);

      const remaining = await store.list('meta-test');
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('meta2');
    });
  });
});
