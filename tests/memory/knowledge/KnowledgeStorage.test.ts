/**
 * Knowledge Storage Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readdir, unlink, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { KnowledgeStorage } from '../../../src/memory/knowledge/KnowledgeStorage.js';

const TEST_DIR = join(process.cwd(), '.test-knowledge');

describe('KnowledgeStorage', () => {
  let storage: KnowledgeStorage;

  beforeEach(async () => {
    // 清理测试目录
    if (existsSync(TEST_DIR)) {
      await cleanupDir(TEST_DIR);
    }

    storage = new KnowledgeStorage(TEST_DIR);
    await storage.init();
  });

  afterEach(async () => {
    // 清理测试文件
    if (existsSync(TEST_DIR)) {
      await cleanupDir(TEST_DIR);
    }
  });

  async function cleanupDir(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await cleanupDir(fullPath);
        await rmdir(fullPath);
      } else {
        await unlink(fullPath);
      }
    }
  }

  describe('init', () => {
    it('should create directory structure', async () => {
      // 验证 auto 和 manual 目录存在
      const categories = ['pits', 'patterns', 'decisions', 'solutions'];

      for (const source of ['auto', 'manual']) {
        for (const category of categories) {
          const dirPath = join(TEST_DIR, source, category);
          expect(existsSync(dirPath)).toBe(true);
        }
      }
    });
  });

  describe('writeAuto and writeManual', () => {
    it('should write auto knowledge', async () => {
      const content = `---
title: "Test Pit"
category: pits
tags: ["test", "example"]
discovered: 2025-01-29
source: auto
---

This is a test pit content.`;

      await storage.writeAuto('pits', 'test-pit', content);

      const item = await storage.read('pits', 'test-pit');
      expect(item).toBeDefined();
      expect(item?.source).toBe('auto');
      expect(item?.category).toBe('pits');
      expect(item?.slug).toBe('test-pit');
    });

    it('should write manual knowledge', async () => {
      const content = '# Manual Knowledge\n\nThis is manual knowledge.';
      await storage.writeManual('patterns', 'test-pattern', content);

      const item = await storage.read('patterns', 'test-pattern');
      expect(item).toBeDefined();
      expect(item?.source).toBe('manual');
    });

    it('should not overwrite manual file when writing auto', async () => {
      const manualContent = '# Manual Content';
      await storage.writeManual('pits', 'same-name', manualContent);

      const autoContent = '# Auto Content';
      await storage.writeAuto('pits', 'same-name', autoContent);

      // 应该仍然读取到 manual 内容
      const item = await storage.read('pits', 'same-name');
      expect(item?.source).toBe('manual');
      expect(item?.content).toContain('Manual Content');
    });

    it('should add source field to content without frontmatter', async () => {
      const content = 'Simple content without frontmatter';
      await storage.writeAuto('pits', 'simple', content);

      const item = await storage.read('pits', 'simple');
      expect(item?.frontmatter.source).toBe('auto');
    });

    it('should throw on invalid category', async () => {
      await expect(storage.writeAuto('invalid', 'test', 'content'))
        .rejects.toThrow('Invalid category');
    });
  });

  describe('read', () => {
    it('should prioritize manual over auto', async () => {
      const manualContent = '# Manual';
      const autoContent = '# Auto';

      await storage.writeManual('pits', 'priority', manualContent);
      await storage.writeAuto('pits', 'priority', autoContent);

      const item = await storage.read('pits', 'priority');
      expect(item?.source).toBe('manual');
    });

    it('should return null for non-existent item', async () => {
      const item = await storage.read('pits', 'non-existent');
      expect(item).toBeNull();
    });

    it('should parse frontmatter correctly', async () => {
      const content = `---
title: "Test Title"
category: pits
tags: ["tag1", "tag2"]
severity: critical
discovered: 2025-01-29
occurrences: 5
source: auto
---

Test content here.`;

      await storage.writeAuto('pits', 'fm-test', content);

      const item = await storage.read('pits', 'fm-test');
      expect(item?.frontmatter.title).toBe('Test Title');
      expect(item?.frontmatter.tags).toEqual(['tag1', 'tag2']);
      expect(item?.frontmatter.severity).toBe('critical');
      expect(item?.frontmatter.occurrences).toBe(5);
      expect(item?.content).toBe('Test content here.');
    });
  });

  describe('get', () => {
    it('should get by full path', async () => {
      await storage.writeAuto('pits', 'path-test', 'content');

      const item = await storage.get('auto/pits/path-test');
      expect(item).toBeDefined();
      expect(item?.slug).toBe('path-test');
    });

    it('should return null for invalid path', async () => {
      const item = await storage.get('invalid/path');
      expect(item).toBeNull();
    });

    it('should return null for invalid source', async () => {
      const item = await storage.get('invalid/pits/test');
      expect(item).toBeNull();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // 清理之前测试创建的数据
      const existing = await storage.list();
      for (const item of existing) {
        await storage.delete(item.path);
      }

      await storage.writeAuto('pits', 'pit1', 'content1');
      await storage.writeAuto('pits', 'pit2', 'content2');
      await storage.writeManual('patterns', 'pattern1', 'content3');
    });

    it('should list all items', async () => {
      const items = await storage.list();
      expect(items.length).toBe(3);
    });

    it('should filter by category', async () => {
      const pits = await storage.list('pits');
      expect(pits.length).toBe(2);
      expect(pits.every(p => p.category === 'pits')).toBe(true);
    });

    it('should filter by source', async () => {
      const autoItems = await storage.list(undefined, 'auto');
      expect(autoItems.length).toBe(2);
      expect(autoItems.every(i => i.source === 'auto')).toBe(true);
    });

    it('should filter by both category and source', async () => {
      const items = await storage.list('pits', 'auto');
      // beforeEach creates pit1 and pit2, both in pits category and auto source
      expect(items.length).toBe(2);
      expect(items[0].category).toBe('pits');
      expect(items[0].source).toBe('auto');
    });

    it('should sort by discovered date descending', async () => {
      // 清理之前测试创建的数据
      const existing = await storage.list();
      for (const item of existing) {
        await storage.delete(item.path);
      }

      // Create items with different dates
      const oldContent = `---
discovered: "2025-01-01"
source: auto
---
old`;

      const newContent = `---
discovered: "2025-01-29"
source: auto
---
new`;

      await storage.writeAuto('pits', 'old-pit', oldContent);
      await storage.writeAuto('pits', 'new-pit', newContent);

      const items = await storage.list('pits');
      expect(items[0].slug).toBe('new-pit'); // Newer first
    });
  });

  describe('searchByFilename', () => {
    beforeEach(async () => {
      const content1 = `---
title: "Next.js Server Actions"
tags: ["nextjs", "server-actions"]
source: auto
---
content1`;

      const content2 = `---
title: "React Hooks Pattern"
tags: ["react", "hooks"]
source: auto
---
content2`;

      await storage.writeAuto('pits', 'nextjs-server-actions', content1);
      await storage.writeAuto('patterns', 'react-hooks-pattern', content2);
    });

    it('should search by slug', async () => {
      const results = await storage.searchByFilename('nextjs');
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('nextjs-server-actions');
    });

    it('should search by title', async () => {
      const results = await storage.searchByFilename('React Hooks');
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('react-hooks-pattern');
    });

    it('should respect limit', async () => {
      const results = await storage.searchByFilename('pattern', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('searchByContent', () => {
    beforeEach(async () => {
      const content1 = `---
title: "Error Handling"
tags: ["error"]
source: auto
---
This is about error handling in TypeScript.`;

      const content2 = `---
title: "Data Validation"
tags: ["validation"]
source: auto
---
This is about data validation.`;

      await storage.writeAuto('pits', 'error-handling', content1);
      await storage.writeAuto('patterns', 'data-validation', content2);
    });

    it('should search content and score matches', async () => {
      const results = await storage.searchByContent('TypeScript');
      expect(results.length).toBe(1);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].item.slug).toBe('error-handling');
    });

    it('should score title matches higher', async () => {
      const results = await storage.searchByContent('Error');
      const titleMatch = results.find(r => r.item.slug === 'error-handling');
      expect(titleMatch?.score).toBeGreaterThan(5); // 10 for title + content matches
    });

    it('should score tag matches', async () => {
      const results = await storage.searchByContent('error');
      const tagMatch = results.find(r => r.item.slug === 'error-handling');
      expect(tagMatch?.score).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const results = await storage.searchByContent('handling', { category: 'pits' });
      expect(results.length).toBe(1);
      expect(results[0].item.category).toBe('pits');
    });
  });

  describe('delete', () => {
    it('should delete knowledge item', async () => {
      await storage.writeAuto('pits', 'to-delete', 'content');

      const before = await storage.list();
      const beforeCount = before.length;

      const success = await storage.delete('auto/pits/to-delete');
      expect(success).toBe(true);

      const after = await storage.list();
      expect(after.length).toBe(beforeCount - 1);
    });

    it('should return false for non-existent item', async () => {
      const success = await storage.delete('auto/pits/non-existent');
      expect(success).toBe(false);
    });

    it('should return false for invalid path', async () => {
      const success = await storage.delete('invalid');
      expect(success).toBe(false);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await storage.writeAuto('pits', 'pit1', 'content1');
      await storage.writeAuto('pits', 'pit2', 'content2');
      await storage.writeManual('patterns', 'pattern1', 'content3');
      await storage.writeManual('decisions', 'decision1', 'content4');
    });

    it('should return correct statistics', async () => {
      const stats = await storage.getStats();

      expect(stats.totalItems).toBe(4);
      expect(stats.autoItems).toBe(2);
      expect(stats.manualItems).toBe(2);
      expect(stats.byCategory.pits).toBe(2);
      expect(stats.byCategory.patterns).toBe(1);
      expect(stats.byCategory.decisions).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('lock', () => {
    it('should lock auto knowledge', async () => {
      await storage.writeAuto('pits', 'lockable', 'content');

      const success = await storage.lock('auto/pits/lockable', true);
      expect(success).toBe(true);

      const item = await storage.read('pits', 'lockable');
      expect(item?.frontmatter.reflector_can_update).toBe(false);
    });

    it('should unlock knowledge', async () => {
      await storage.writeAuto('pits', 'unlockable', 'content');
      await storage.lock('auto/pits/unlockable', true);

      const success = await storage.lock('auto/pits/unlockable', false);
      expect(success).toBe(true);

      const item = await storage.read('pits', 'unlockable');
      expect(item?.frontmatter.reflector_can_update).toBe(true);
    });

    it('should return false for manual knowledge', async () => {
      await storage.writeManual('pits', 'manual-lock', 'content');

      const success = await storage.lock('manual/pits/manual-lock', true);
      expect(success).toBe(false);
    });

    it('should return false for non-existent item', async () => {
      const success = await storage.lock('auto/pits/non-existent', true);
      expect(success).toBe(false);
    });
  });

  describe('promoteToManual', () => {
    it('should promote auto to manual', async () => {
      await storage.writeAuto('pits', 'promote-me', 'auto content');

      const success = await storage.promoteToManual('auto/pits/promote-me');
      expect(success).toBe(true);

      const item = await storage.read('pits', 'promote-me');
      expect(item?.source).toBe('manual');

      // Auto file should be deleted - check by listing only auto items
      const autoItems = await storage.list('pits', 'auto');
      const autoFileExists = autoItems.some(i => i.slug === 'promote-me');
      expect(autoFileExists).toBe(false);
    });

    it('should return false for manual item', async () => {
      await storage.writeManual('pits', 'already-manual', 'content');

      const success = await storage.promoteToManual('manual/pits/already-manual');
      expect(success).toBe(false);
    });

    it('should return false for non-existent item', async () => {
      const success = await storage.promoteToManual('auto/pits/non-existent');
      expect(success).toBe(false);
    });
  });
});
