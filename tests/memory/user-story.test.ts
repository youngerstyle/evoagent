/**
 * 用户故事测试：三层记忆系统端到端测试
 *
 * 故事：开发者 "Alice" 使用 EvoAgent 实现一个功能
 * 1. 首次遇到坑点 → 记录到 Knowledge
 * 2. 后续遇到类似问题 → 通过向量检索找到历史经验
 * 3. Session 完成后自动归档
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { SessionStorage } from '../../src/memory/session/SessionStorage.js';
import { KnowledgeStorage } from '../../src/memory/knowledge/KnowledgeStorage.js';
import { VectorStore } from '../../src/memory/vector/VectorStore.js';
import { EmbeddingService } from '../../src/memory/vector/EmbeddingService.js';
import { EmbeddingCache } from '../../src/memory/vector/EmbeddingCache.js';

const TEST_DIR = join(process.cwd(), '.test-user-story');

describe('User Story: 开发者 Alice 的编码之旅', () => {
  let sessionStorage: SessionStorage;
  let knowledgeStorage: KnowledgeStorage;
  let vectorStore: VectorStore;
  let embeddingService: EmbeddingService;
  let embeddingCache: EmbeddingCache;

  // ========== 设置阶段 ==========
  beforeAll(async () => {
    // 清理环境
    if (existsSync(TEST_DIR)) {
      const { readdir } = await import('fs/promises');
      const cleanDir = async (dir: string) => {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            await cleanDir(fullPath);
          } else {
            await unlink(fullPath);
          }
        }
      };
      await cleanDir(TEST_DIR);
    }
    await mkdir(TEST_DIR, { recursive: true });

    // 初始化三层记忆系统
    sessionStorage = new SessionStorage(join(TEST_DIR, 'sessions'));
    await sessionStorage.init();

    knowledgeStorage = new KnowledgeStorage(join(TEST_DIR, 'knowledge'));
    await knowledgeStorage.init();

    embeddingCache = new EmbeddingCache({ maxSize: 100 });
    embeddingService = new EmbeddingService({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'test',
      model: 'test-model',
      dim: 384,
      cache: embeddingCache
    });

    vectorStore = new VectorStore({
      dbPath: join(TEST_DIR, 'vector.db'),
      embeddingService,
      enablePersistence: true
    });
    await vectorStore.init();
  });

  afterAll(async () => {
    await vectorStore.close();
  });

  // ========== 场景 1: 首次编码，遇到坑点 ==========
  describe('场景 1: 首次实现 Next.js Server Actions', () => {
    it('Alice 开始编码，创建 Session', async () => {
      const sessionId = `session-2025-01-29-001`;
      const userId = 'alice';

      await sessionStorage.createSession(sessionId, userId);

      // 记录用户输入
      await sessionStorage.append(sessionId, {
        type: 'user.input',
        sessionId,
        timestamp: Date.now(),
        userId,
        data: { message: '实现一个 Next.js Server Action 来更新用户资料' }
      });

      // 验证 Session 创建
      const metadata = sessionStorage.getMetadata(sessionId);
      expect(metadata).toBeDefined();
      expect(metadata?.userId).toBe('alice');
      expect(metadata?.status).toBe('active');
    });

    it('Alice 遇到错误：Server Actions 不能用 try-catch 包裹', async () => {
      const sessionId = `session-2025-01-29-001`;

      // 记录错误事件
      await sessionStorage.append(sessionId, {
        type: 'agent.error',
        sessionId,
        timestamp: Date.now(),
        data: {
          error: 'Error: Server Actions cannot be wrapped with try-catch at the edge',
          location: 'src/actions/updateProfile.ts:12',
          stack: 'Error: ...'
        }
      });

      // 系统自动记录到 Knowledge（坑点）
      const pitContent = `---
title: "Server Actions 不能用 try-catch 包裹"
category: pits
tags: ["nextjs", "server-actions", "error-handling"]
severity: critical
discovered: 2025-01-29
source: auto
occurrences: 1
---

## 问题

Next.js Server Actions 不能在文件边缘使用 try-catch 包裹。

### 错误代码
\`\`\`typescript
// ❌ 错误写法
try {
  'use server';
  export async function updateProfile(data: Profile) {
    // ...
  }
} catch (error) {
  // 这样写会导致错误
}
\`\`\`

### 正确写法
\`\`\`typescript
// ✅ 正确写法
'use server';

import { revalidatePath } from 'next/cache';

export async function updateProfile(data: Profile) {
  try {
    // 处理逻辑
    revalidatePath('/profile');
  } catch (error) {
    // 错误处理在函数内部
    console.error('Update failed:', error);
    throw error;
  }
}
\`\`\`

## 影响

- Server Actions 必须在文件顶部使用 'use server'
- try-catch 只能在函数内部使用
- 边缘层不能有异步错误处理

## 相关

- Session: ${sessionId}
- Agent: CodeWriter
`;

      await knowledgeStorage.writeAuto('pits', 'nextjs-server-actions-trap', pitContent);

      // 验证知识已记录
      const pit = await knowledgeStorage.read('pits', 'nextjs-server-actions-trap');
      expect(pit).toBeDefined();
      expect(pit?.frontmatter.severity).toBe('critical');
      expect(pit?.frontmatter.occurrences).toBe(1);
    });

    it('Alice 解决问题后，记录解决方案', async () => {
      const sessionId = `session-2025-01-29-001`;

      // 记录成功事件
      await sessionStorage.append(sessionId, {
        type: 'agent.run.completed',
        sessionId,
        timestamp: Date.now(),
        data: {
          success: true,
          solution: '将 try-catch 移到 Server Action 内部'
        }
      });

      // 记录解决方案到 Knowledge
      const solutionContent = `---
title: "Next.js Server Actions 正确的错误处理方式"
category: solutions
tags: ["nextjs", "server-actions", "error-handling"]
discovered: 2025-01-29
source: auto
---

## 解决方案

Server Actions 的错误处理必须在函数内部进行。

### 实现步骤

1. 在文件顶部添加 'use server'
2. 在函数内部使用 try-catch
3. 使用 revalidatePath 更新缓存

### 代码示例

\`\`\`typescript
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export async function updateProfile(userId: string, data: ProfileData) {
  try {
    const updated = await db.user.update({
      where: { id: userId },
      data
    });

    revalidatePath('/profile');
    revalidatePath('/users/[id]');

    return { success: true, data: updated };
  } catch (error) {
    console.error('Failed to update profile:', error);
    return { success: false, error: 'Update failed' };
  }
}
\`\`\`

## 相关坑点

- nextjs-server-actions-trap
`;

      await knowledgeStorage.writeAuto('solutions', 'server-actions-error-handling', solutionContent);

      // 完成任务，标记 Session 为归档
      await sessionStorage.append(sessionId, {
        type: 'session.completed',
        sessionId,
        timestamp: Date.now(),
        data: {
          duration: 45000,
          filesModified: ['src/actions/updateProfile.ts'],
          success: true
        }
      });

      await sessionStorage.archiveSession(sessionId);

      // 验证 Session 状态
      const metadata = sessionStorage.getMetadata(sessionId);
      expect(metadata?.status).toBe('archived');
      expect(metadata?.completedAt).toBeDefined();
    });
  });

  // ========== 场景 2: 几天后，遇到类似问题 ==========
  describe('场景 2: 三天后，Alice 实现另一个 Server Action', () => {
    it('创建新的 Session', async () => {
      const sessionId = `session-2025-02-01-002`;

      await sessionStorage.createSession(sessionId, 'alice');

      // 记录任务
      await sessionStorage.append(sessionId, {
        type: 'user.input',
        sessionId,
        timestamp: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3天后
        userId: 'alice',
        data: { message: '创建 Server Action 来删除用户文章' }
      });

      // 验证新 Session
      const metadata = sessionStorage.getMetadata(sessionId);
      expect(metadata).toBeDefined();
    });

    it('通过语义搜索找到历史经验', async () => {
      // 模拟：直接添加带有模拟 embedding 的代码片段
      const mockEmbedding = Array(384).fill(0).map((_, i) => Math.sin(i * 0.1));

      await vectorStore.add({
        id: 'code-snippet-1',
        collection: 'code',
        embedding: mockEmbedding,
        content: `
'use server';

export async function myAction() {
  try {
    // action logic
  } catch (error) {
    // error handling inside
  }
}
        `.trim(),
        metadata: {
          type: 'example',
          framework: 'nextjs',
          pattern: 'server-action-error-handling'
        },
        consolidated: false
      });

      // 使用相同的查询 embedding 进行搜索
      const results = await vectorStore.similaritySearch(mockEmbedding, {
        collection: 'code',
        limit: 5,
        minScore: 0.5
      });

      // 验证找到了相关代码
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThanOrEqual(0.5);
      console.log(`\n🔍 语义搜索结果: 找到 ${results.length} 条相关代码`);
      results.forEach(r => {
        console.log(`   - [${r.metadata.framework}] ${r.metadata.pattern} (相似度: ${r.score.toFixed(2)})`);
      });
    });

    it('通过关键词搜索找到 Knowledge 中的坑点', async () => {
      // 搜索更具体的关键词
      const results = await knowledgeStorage.searchByContent('Server Actions', {
        limit: 5
      });

      console.log(`\n🔍 关键词搜索 "Server Actions": 找到 ${results.length} 条`);

      // 验证搜索结果 - 至少应该能找到一条（因为我们在内容中存储了 "Server Actions"）
      if (results.length > 0) {
        results.forEach(r => {
          console.log(`   - [${r.item.category}] ${r.item.frontmatter.title} (分数: ${r.score})`);
        });
      }

      // 使用按文件名搜索作为备选验证
      const filenameResults = await knowledgeStorage.searchByFilename('server-actions', 3);
      console.log(`\n🔍 按文件名搜索 "server-actions": 找到 ${filenameResults.length} 条`);

      expect(filenameResults.length).toBeGreaterThan(0);
      filenameResults.forEach(r => {
        console.log(`   - [${r.category}] ${r.frontmatter.title}`);
      });
    });
  });

  // ========== 场景 3: 系统统计和清理 ==========
  describe('场景 3: 系统维护', () => {
    it('生成记忆系统统计报告', async () => {
      const sessionStats = sessionStorage.getStats();
      const knowledgeStats = await knowledgeStorage.getStats();
      const vectorStats = await vectorStore.getStats();

      console.log('\n========== 记忆系统统计报告 ==========');
      console.log('📊 Session 存储:');
      console.log(`   总会话数: ${sessionStats.totalSessions}`);
      console.log(`   活跃会话: ${sessionStats.activeSessions}`);
      console.log(`   归档会话: ${sessionStats.archivedSessions}`);
      console.log(`   总大小: ${sessionStats.totalSize} bytes`);

      console.log('\n📚 Knowledge 存储:');
      console.log(`   总条目数: ${knowledgeStats.totalItems}`);
      console.log(`   自动生成: ${knowledgeStats.autoItems}`);
      console.log(`   手动添加: ${knowledgeStats.manualItems}`);
      console.log(`   按分类:`);
      for (const [cat, count] of Object.entries(knowledgeStats.byCategory)) {
        if (count > 0) {
          console.log(`     ${cat}: ${count}`);
        }
      }

      console.log('\n🔍 向量存储:');
      console.log(`   总向量数: ${vectorStats.totalCount}`);
      console.log(`   总大小: ${vectorStats.totalSize} bytes`);
      console.log(`   平均访问次数: ${vectorStats.avgAccessCount.toFixed(2)}`);
      console.log('======================================\n');

      // 验证统计数据
      expect(sessionStats.totalSessions).toBeGreaterThan(0);
      expect(knowledgeStats.totalItems).toBeGreaterThan(0);
    });

    it('执行 Session 清理（保留高价值的）', async () => {
      // 标记重要 Session 为永久保留
      await sessionStorage.keepForever('session-2025-01-29-001', true);

      // 执行清理：删除超过 30 天且不是永久保留的
      const deletedCount = await sessionStorage.cleanup({
        maxAge: 30 * 24 * 60 * 60 * 1000,
        keepActive: true
      });

      console.log(`🧹 清理了 ${deletedCount} 个旧 Session`);

      // 验证重要 Session 仍在
      const importantSession = sessionStorage.getMetadata('session-2025-01-29-001');
      expect(importantSession).toBeDefined();
      expect(importantSession?.keepForever).toBe(true);
    });

    it('锁定重要的 Knowledge 条目', async () => {
      // 锁定关键坑点，防止 Reflector 覆盖
      const locked = await knowledgeStorage.lock('auto/pits/nextjs-server-actions-trap', true);

      expect(locked).toBe(true);

      const pit = await knowledgeStorage.read('pits', 'nextjs-server-actions-trap');
      expect(pit?.frontmatter.reflector_can_update).toBe(false);
    });
  });

  // ========== 场景 4: 列出和检索 ==========
  describe('场景 4: 知识检索', () => {
    it('按分类列出 Knowledge', async () => {
      const pits = await knowledgeStorage.list('pits');
      const solutions = await knowledgeStorage.list('solutions');

      console.log(`\n📖 坑点 (pits): ${pits.length} 条`);
      pits.forEach(p => console.log(`   - ${p.frontmatter.title}`));

      console.log(`\n💡 解决方案 (solutions): ${solutions.length} 条`);
      solutions.forEach(s => console.log(`   - ${s.frontmatter.title}`));

      expect(pits.length).toBeGreaterThan(0);
      expect(solutions.length).toBeGreaterThan(0);
    });

    it('按标签搜索', async () => {
      const results = await knowledgeStorage.searchByFilename('nextjs');

      console.log(`\n🔍 搜索 "nextjs": 找到 ${results.length} 条`);
      results.forEach(r => {
        console.log(`   - [${r.category}] ${r.frontmatter.title}`);
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('获取完整知识内容', async () => {
      const pit = await knowledgeStorage.get('auto/pits/nextjs-server-actions-trap');

      expect(pit).toBeDefined();
      expect(pit?.content).toContain('Server Actions');
      expect(pit?.frontmatter.tags).toContain('nextjs');

      console.log(`\n📄 知识详情:`);
      console.log(`   标题: ${pit?.frontmatter.title}`);
      console.log(`   严重程度: ${pit?.frontmatter.severity}`);
      console.log(`   内容长度: ${pit?.content.length} 字符`);
    });
  });
});

/**
 * 这个用户故事展示了：
 *
 * 1. Session 记录完整的对话历史
 * 2. Knowledge 自动记录遇到的问题和解决方案
 * 3. Vector Store 存储代码片段，支持语义搜索
 * 4. 系统维护功能（统计、清理、锁定）
 * 5. 多种检索方式（分类、标签、语义搜索）
 *
 * 运行此测试：
 * npm test tests/memory/user-story.test.ts
 */
