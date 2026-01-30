/**
 * Session Storage Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { SessionStorage } from '../../../src/memory/session/SessionStorage.js';
import type { SessionEvent } from '../../../src/memory/session/index.js';

const TEST_DIR = join(process.cwd(), '.test-sessions');

describe('SessionStorage', () => {
  let storage: SessionStorage;

  beforeEach(async () => {
    // 清理测试目录
    if (existsSync(TEST_DIR)) {
      await unlink(TEST_DIR + '/.index.json').catch(() => {});
    }
    await mkdir(TEST_DIR, { recursive: true });

    storage = new SessionStorage(TEST_DIR);
    await storage.init();
  });

  afterEach(async () => {
    // 清理测试文件
    try {
      await unlink(TEST_DIR + '/.index.json').catch(() => {});
    } catch {
      // 忽略
    }
  });

  describe('init', () => {
    it('should create index file on first init', async () => {
      const indexExists = existsSync(join(TEST_DIR, '.index.json'));
      expect(indexExists).toBe(true);
    });

    it('should load existing index on subsequent init', async () => {
      await storage.createSession('test-session', 'user1');

      // 创建新实例测试索引加载
      const storage2 = new SessionStorage(TEST_DIR);
      await storage2.init();

      const metadata = storage2.getMetadata('test-session');
      expect(metadata).toBeDefined();
      expect(metadata?.userId).toBe('user1');
    });
  });

  describe('createSession', () => {
    it('should create a new session with metadata', async () => {
      await storage.createSession('test-1', 'user1');

      const metadata = storage.getMetadata('test-1');
      expect(metadata).toBeDefined();
      expect(metadata?.sessionId).toBe('test-1');
      expect(metadata?.userId).toBe('user1');
      expect(metadata?.status).toBe('active');
      expect(metadata?.messageCount).toBe(1); // session.created 事件
    });

    it('should create session without userId', async () => {
      await storage.createSession('test-2');

      const metadata = storage.getMetadata('test-2');
      expect(metadata).toBeDefined();
      expect(metadata?.userId).toBeUndefined();
    });
  });

  describe('append', () => {
    it('should append events to session', async () => {
      await storage.createSession('test-3');

      const event: SessionEvent = {
        type: 'user.input',
        sessionId: 'test-3',
        timestamp: Date.now(),
        data: { message: 'hello' }
      };

      await storage.append('test-3', event);

      const metadata = storage.getMetadata('test-3');
      expect(metadata?.messageCount).toBe(2); // session.created + user.input
    });

    it('should increment agentRunCount for agent.run.completed', async () => {
      await storage.createSession('test-4');

      const event: SessionEvent = {
        type: 'agent.run.completed',
        sessionId: 'test-4',
        timestamp: Date.now(),
        data: { success: true }
      };

      await storage.append('test-4', event);

      const metadata = storage.getMetadata('test-4');
      expect(metadata?.agentRunCount).toBe(1);
    });

    it('should update status to archived on session.completed', async () => {
      await storage.createSession('test-5');

      const event: SessionEvent = {
        type: 'session.completed',
        sessionId: 'test-5',
        timestamp: Date.now()
      };

      await storage.append('test-5', event);

      const metadata = storage.getMetadata('test-5');
      expect(metadata?.status).toBe('archived');
      expect(metadata?.completedAt).toBeDefined();
    });
  });

  describe('loadSession', () => {
    it('should load session with all events', async () => {
      await storage.createSession('test-6');

      const events: SessionEvent[] = [
        { type: 'user.input', sessionId: 'test-6', timestamp: Date.now(), data: { msg: 'hi' } },
        { type: 'assistant.response', sessionId: 'test-6', timestamp: Date.now(), data: { msg: 'hello' } }
      ];

      for (const event of events) {
        await storage.append('test-6', event);
      }

      const session = await storage.loadSession('test-6');
      expect(session).toBeDefined();
      expect(session?.events.length).toBe(3); // session.created + 2 events
    });

    it('should return null for non-existent session', async () => {
      const session = await storage.loadSession('non-existent');
      expect(session).toBeNull();
    });

    it('should handle corrupted lines gracefully', async () => {
      await storage.createSession('test-7');

      // 手动添加损坏的数据
      const { appendFile } = await import('fs/promises');
      await appendFile(join(TEST_DIR, 'test-7.jsonl'), 'invalid json\n');

      const session = await storage.loadSession('test-7');
      expect(session).toBeDefined();
      // 应该跳过损坏的行
      expect(session?.events.length).toBeGreaterThan(0);
    });
  });

  describe('listSessions', () => {
    beforeEach(async () => {
      // 清理现有数据
      const sessions = storage.listSessions();
      for (const s of sessions) {
        await storage.deleteSession(s.sessionId);
      }

      await storage.createSession('active-1');
      await storage.createSession('active-2');
      await storage.createSession('archived-1');
      await storage.archiveSession('archived-1');
    });

    it('should list all sessions', () => {
      const sessions = storage.listSessions();
      expect(sessions.length).toBe(3);
    });

    it('should filter by status', () => {
      const active = storage.listSessions('active');
      expect(active.length).toBe(2);

      const archived = storage.listSessions('archived');
      expect(archived.length).toBe(1);
    });

    it('should sort by updatedAt descending', () => {
      const sessions = storage.listSessions();
      // 第一个应该是最新创建的
      expect(sessions[0].sessionId).toBe('archived-1');
    });
  });

  describe('updateMetadata', () => {
    it('should update metadata fields', async () => {
      await storage.createSession('test-8');

      await storage.updateMetadata('test-8', {
        valueScore: 100,
        keepForever: true
      });

      const metadata = storage.getMetadata('test-8');
      expect(metadata?.valueScore).toBe(100);
      expect(metadata?.keepForever).toBe(true);
    });
  });

  describe('keepForever', () => {
    it('should mark session to keep forever', async () => {
      await storage.createSession('test-9');
      await storage.keepForever('test-9', true);

      const metadata = storage.getMetadata('test-9');
      expect(metadata?.keepForever).toBe(true);

      await storage.keepForever('test-9', false);
      expect(storage.getMetadata('test-9')?.keepForever).toBe(false);
    });
  });

  describe('archiveSession', () => {
    it('should archive session', async () => {
      await storage.createSession('test-10');
      await storage.archiveSession('test-10');

      const metadata = storage.getMetadata('test-10');
      expect(metadata?.status).toBe('archived');
    });
  });

  describe('deleteSession', () => {
    it('should delete session file and metadata', async () => {
      await storage.createSession('test-11');

      // 文件应该存在
      expect(existsSync(join(TEST_DIR, 'test-11.jsonl'))).toBe(true);

      await storage.deleteSession('test-11');

      // 元数据应该被删除
      expect(storage.getMetadata('test-11')).toBeUndefined();
    });

    it('should handle deleting non-existent session', async () => {
      // 不应该抛出错误
      await expect(storage.deleteSession('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      // 清理现有数据
      const sessions = storage.listSessions();
      for (const s of sessions) {
        await storage.deleteSession(s.sessionId);
      }

      // 创建旧会话
      await storage.createSession('old-1');
      await storage.updateMetadata('old-1', {
        updatedAt: Date.now() - 100 * 24 * 60 * 60 * 1000 // 100天前
      });

      // 创建新会话
      await storage.createSession('new-1');

      // 创建永久保留的会话
      await storage.createSession('keep-1');
      await storage.keepForever('keep-1', true);
      await storage.updateMetadata('keep-1', {
        updatedAt: Date.now() - 100 * 24 * 60 * 60 * 1000
      });
    });

    it('should delete sessions older than maxAge', async () => {
      const deleted = await storage.cleanup({ maxAge: 30 * 24 * 60 * 60 * 1000 });

      expect(deleted).toBe(1);
      expect(storage.getMetadata('old-1')).toBeUndefined();
      expect(storage.getMetadata('new-1')).toBeDefined();
      expect(storage.getMetadata('keep-1')).toBeDefined(); // 永久保留
    });

    it('should keep active sessions when keepActive is true', async () => {
      await storage.updateMetadata('old-1', { status: 'active' });

      const deleted = await storage.cleanup({
        maxAge: 30 * 24 * 60 * 60 * 1000,
        keepActive: true
      });

      expect(deleted).toBe(0);
      expect(storage.getMetadata('old-1')).toBeDefined();
    });

    it('should limit by maxSessions', async () => {
      const deleted = await storage.cleanup({ maxSessions: 2 });

      // 应该保留最新的2个会话
      const remaining = storage.listSessions();
      expect(remaining.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      // 清理现有数据
      const sessions = storage.listSessions();
      for (const s of sessions) {
        await storage.deleteSession(s.sessionId);
      }
    });

    it('should return statistics', async () => {
      await storage.createSession('test-12');
      await storage.createSession('test-13');
      await storage.archiveSession('test-13');

      const stats = storage.getStats();

      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(1);
      expect(stats.archivedSessions).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should return zeros when not initialized', () => {
      const newStorage = new SessionStorage(TEST_DIR);
      const stats = newStorage.getStats();

      expect(stats.totalSessions).toBe(0);
      expect(stats.activeSessions).toBe(0);
      expect(stats.archivedSessions).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('rebuildIndex', () => {
    it('should rebuild index from existing files', async () => {
      await storage.createSession('test-14');
      await storage.append('test-14', {
        type: 'user.input',
        sessionId: 'test-14',
        timestamp: Date.now(),
        data: { msg: 'test' }
      });

      // 删除索引
      await unlink(join(TEST_DIR, '.index.json'));

      // 创建新实例，应该重建索引
      const newStorage = new SessionStorage(TEST_DIR);
      await newStorage.init();

      const metadata = newStorage.getMetadata('test-14');
      expect(metadata).toBeDefined();
      expect(metadata?.messageCount).toBeGreaterThan(0);
    });
  });
});
