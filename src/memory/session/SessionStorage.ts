/**
 * Session 存储层设计
 *
 * Phase 0 (MVP): 简单 JSONL + 内存索引
 * Phase 1: 添加 Session 元数据 SQLite 表
 * Phase 2: 考虑完全迁移到 SQLite（可选）
 */

import { readdir, readFile, writeFile, appendFile, stat, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('memory:session');

// ========== 类型定义 ==========

export interface SessionMetadata {
  sessionId: string;
  userId?: string;
  status: 'active' | 'archived' | 'pruned';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  agentRunCount: number;
  messageCount: number;
  fileSize: number;
  valueScore?: number;
  keepForever: boolean;
}

export interface SessionEvent {
  type: string;
  sessionId: string;
  timestamp: number;
  userId?: string;
  data?: Record<string, unknown>;
}

export interface Session {
  metadata: SessionMetadata;
  events: SessionEvent[];
}

export interface SessionIndex {
  version: number;
  lastUpdated: number;
  sessions: Map<string, SessionMetadata>;
}

// ========== SessionStorage 类 ==========

export class SessionStorage {
  private sessionDir: string;
  private indexPath: string;
  private index: SessionIndex | null = null;
  private initialized = false;

  constructor(sessionDir: string) {
    this.sessionDir = sessionDir;
    this.indexPath = join(sessionDir, '.index.json');
  }

  /**
   * 确保已初始化，如果未初始化则抛出错误
   */
  private ensureInitialized(): SessionIndex {
    if (!this.index) {
      throw new Error('SessionStorage not initialized. Call init() first.');
    }
    return this.index;
  }

  /**
   * 初始化：加载或重建索引
   */
  async init(): Promise<void> {
    logger.debug(`Initializing SessionStorage at ${this.sessionDir}`);

    // 确保目录存在
    await mkdir(this.sessionDir, { recursive: true });

    // 尝试加载现有索引
    if (await this.fileExists(this.indexPath)) {
      try {
        const indexData = await readFile(this.indexPath, 'utf-8');
        const parsed = JSON.parse(indexData);

        // 转换 sessions Map
        const sessions = new Map<string, SessionMetadata>();
        if (parsed.sessions && Array.isArray(parsed.sessions)) {
          for (const item of parsed.sessions) {
            sessions.set(item.sessionId, item);
          }
        }

        this.index = {
          version: parsed.version || 1,
          lastUpdated: parsed.lastUpdated || Date.now(),
          sessions
        };

        logger.debug(`Loaded index with ${sessions.size} sessions`);
        this.initialized = true;
        return;
      } catch (error) {
        logger.warn('Failed to load index, will rebuild', { error });
      }
    }

    // 重建索引
    await this.rebuildIndex();
    this.initialized = true;
  }

  /**
   * 重建索引：扫描所有 .jsonl 文件
   */
  async rebuildIndex(): Promise<void> {
    logger.info('Rebuilding session index...');
    const sessions = new Map<string, SessionMetadata>();

    try {
      const files = await readdir(this.sessionDir);

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const sessionId = file.slice(0, -6);
        const filePath = join(this.sessionDir, file);

        try {
          const stats = await stat(filePath);
          const firstLine = await this.readFirstLine(filePath);

          if (firstLine) {
            const sessionStart = JSON.parse(firstLine);

            sessions.set(sessionId, {
              sessionId,
              userId: sessionStart.userId,
              status: 'archived',
              createdAt: sessionStart.timestamp || stats.birthtimeMs,
              updatedAt: stats.mtimeMs,
              agentRunCount: 0,
              messageCount: await this.countLines(filePath),
              fileSize: stats.size,
              keepForever: false
            });
          }
        } catch (error) {
          logger.warn(`Failed to index session ${sessionId}:`, { error });
        }
      }

      this.index = {
        version: 1,
        lastUpdated: Date.now(),
        sessions
      };

      await this.saveIndex();
      logger.info(`Index rebuilt with ${sessions.size} sessions`);
    } catch (error) {
      logger.error('Failed to rebuild index:', error);
      // 创建空索引
      this.index = {
        version: 1,
        lastUpdated: Date.now(),
        sessions: new Map()
      };
    }
  }

  /**
   * 创建新 Session
   */
  async createSession(sessionId: string, userId?: string): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    const now = Date.now();

    const metadata: SessionMetadata = {
      sessionId,
      userId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      agentRunCount: 0,
      messageCount: 0,
      fileSize: 0,
      keepForever: false
    };

    const index = this.ensureInitialized();
    index.sessions.set(sessionId, metadata);

    // 写入初始事件
    const initEvent: SessionEvent = {
      type: 'session.created',
      sessionId,
      timestamp: now,
      userId
    };

    await this.append(sessionId, initEvent);
  }

  /**
   * 追加事件到 Session
   */
  async append(sessionId: string, event: SessionEvent): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    const filePath = this.getSessionPath(sessionId);

    // 1. 追加到 JSONL
    const line = JSON.stringify(event) + '\n';
    await appendFile(filePath, line, 'utf-8');

    // 2. 更新索引
    const index = this.ensureInitialized();
    const meta = index.sessions.get(sessionId);
    if (meta) {
      meta.updatedAt = Date.now();
      meta.messageCount++;
      meta.fileSize += line.length;

      if (event.type === 'agent.run.completed') {
        meta.agentRunCount++;
      }

      // 更新状态
      if (event.type === 'session.completed') {
        meta.status = 'archived';
        meta.completedAt = Date.now();
      } else if (event.type === 'session.archived') {
        meta.status = 'archived';
      }

      await this.saveIndex();
    }
  }

  /**
   * 加载 Session（流式读取，避免 OOM）
   */
  async loadSession(sessionId: string): Promise<Session | null> {
    if (!this.initialized) {
      await this.init();
    }

    const index = this.ensureInitialized();
    const metadata = index.sessions.get(sessionId);
    if (!metadata) {
      logger.warn(`Session not found: ${sessionId}`);
      return null;
    }

    const filePath = this.getSessionPath(sessionId);

    // 检查文件是否存在
    if (!(await this.fileExists(filePath))) {
      logger.warn(`Session file not found: ${filePath}`);
      return null;
    }

    const events: SessionEvent[] = [];
    let corruptedLines = 0;

    // 逐行读取
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        events.push(JSON.parse(line));
      } catch (error) {
        corruptedLines++;
      }
    }

    if (corruptedLines > 0) {
      logger.warn(`Session ${sessionId} has ${corruptedLines} corrupted lines`);
    }

    return {
      metadata,
      events
    };
  }

  /**
   * 获取 Session 元数据
   */
  getMetadata(sessionId: string): SessionMetadata | undefined {
    return this.index?.sessions.get(sessionId);
  }

  /**
   * 列出所有 Session
   */
  listSessions(status?: 'active' | 'archived' | 'pruned'): SessionMetadata[] {
    if (!this.index) {
      return [];
    }

    const sessions = Array.from(this.index.sessions.values());

    if (status) {
      return sessions.filter(s => s.status === status);
    }

    // 按更新时间倒序
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 更新 Session 元数据
   */
  async updateMetadata(sessionId: string, updates: Partial<SessionMetadata>): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    const index = this.ensureInitialized();
    const meta = index.sessions.get(sessionId);
    if (meta) {
      Object.assign(meta, updates);
      // 只有在没有明确提供 updatedAt 时才自动更新
      if (updates.updatedAt === undefined) {
        meta.updatedAt = Date.now();
      }
      await this.saveIndex();
    }
  }

  /**
   * 标记 Session 为永久保留
   */
  async keepForever(sessionId: string, keep: boolean = true): Promise<void> {
    await this.updateMetadata(sessionId, { keepForever: keep });
  }

  /**
   * 归档 Session
   */
  async archiveSession(sessionId: string): Promise<void> {
    await this.updateMetadata(sessionId, { status: 'archived' });
  }

  /**
   * 删除 Session
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    const filePath = this.getSessionPath(sessionId);

    // 删除文件
    try {
      await unlink(filePath);
    } catch {
      // 文件可能不存在
    }

    // 从索引中移除
    const index = this.ensureInitialized();
    index.sessions.delete(sessionId);
    await this.saveIndex();

    logger.debug(`Deleted session: ${sessionId}`);
  }

  /**
   * 清理旧 Session
   */
  async cleanup(options: {
    maxAge?: number;
    maxSessions?: number;
    keepActive?: boolean;
  } = {}): Promise<number> {
    const now = Date.now();
    const toDelete: string[] = [];
    let deletedCount = 0;

    const sessions = this.listSessions();

    for (const session of sessions) {
      // 永久保留的跳过
      if (session.keepForever) continue;

      // 活跃 Session 根据配置跳过
      if (options.keepActive && session.status === 'active') continue;

      // 检查年龄
      if (options.maxAge) {
        const age = now - session.updatedAt;
        if (age < options.maxAge) continue;
      }

      toDelete.push(session.sessionId);
    }

    // 按数量限制
    if (options.maxSessions && toDelete.length > 0) {
      const keepCount = options.maxSessions;
      // 保留最新的
      const sorted = this.listSessions()
        .filter(s => !toDelete.includes(s.sessionId) && !s.keepForever);

      if (sorted.length > keepCount) {
        for (const session of sorted.slice(keepCount)) {
          if (!toDelete.includes(session.sessionId)) {
            toDelete.push(session.sessionId);
          }
        }
      }
    }

    // 删除
    for (const sessionId of toDelete) {
      await this.deleteSession(sessionId);
      deletedCount++;
    }

    logger.info(`Cleaned up ${deletedCount} sessions`);
    return deletedCount;
  }

  /**
   * 保存索引
   */
  private async saveIndex(): Promise<void> {
    const index = this.ensureInitialized();
    const data = {
      version: index.version,
      lastUpdated: index.lastUpdated,
      sessions: Array.from(index.sessions.values())
    };

    await writeFile(this.indexPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 获取 Session 文件路径
   */
  private getSessionPath(sessionId: string): string {
    return join(this.sessionDir, `${sessionId}.jsonl`);
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 读取文件第一行
   */
  private async readFirstLine(filePath: string): Promise<string> {
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity
    });

    const lines: string[] = [];
    for await (const line of rl) {
      lines.push(line);
      if (lines.length >= 1) break;
    }

    rl.close();
    return lines[0] || '';
  }

  /**
   * 计算文件行数
   */
  private async countLines(filePath: string): Promise<number> {
    let count = 0;
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity
    });

    for await (const _ of rl) {
      count++;
    }

    rl.close();
    return count;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    archivedSessions: number;
    totalSize: number;
  } {
    if (!this.index) {
      return {
        totalSessions: 0,
        activeSessions: 0,
        archivedSessions: 0,
        totalSize: 0
      };
    }

    const sessions = Array.from(this.index.sessions.values());
    const active = sessions.filter(s => s.status === 'active').length;
    const archived = sessions.filter(s => s.status === 'archived').length;
    const totalSize = sessions.reduce((sum, s) => sum + s.fileSize, 0);

    return {
      totalSessions: sessions.length,
      activeSessions: active,
      archivedSessions: archived,
      totalSize
    };
  }
}
