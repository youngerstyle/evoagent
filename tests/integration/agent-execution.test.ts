/**
 * 集成测试 - Agent 执行流程
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { OrchestratorAgent } from '../../src/agent/orchestrator/OrchestratorAgent.js';
import { SessionStorage } from '../../src/memory/session/SessionStorage.js';
import { createLLMServiceFromEnv } from '../../src/core/llm/index.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('Agent Execution Integration Tests', () => {
  let orchestrator: OrchestratorAgent;
  let sessionStorage: SessionStorage;
  let testDir: string;

  beforeAll(async () => {
    // 创建临时测试目录
    testDir = join(tmpdir(), `evoagent-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // 初始化组件
    const llm = createLLMServiceFromEnv();
    orchestrator = new OrchestratorAgent({
      maxRetries: 2,
      retryDelay: 500,
      timeout: 30000
    }, llm);

    sessionStorage = new SessionStorage(join(testDir, 'sessions'));
    await sessionStorage.init();
  });

  afterAll(() => {
    // 清理测试目录
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test directory:', error);
    }
  });

  it('should create and execute a simple task', async () => {
    const sessionId = `test-session-${Date.now()}`;
    await sessionStorage.createSession(sessionId);

    const result = await orchestrator.run({
      input: 'Create a simple hello world function',
      sessionId
    });

    expect(result).toBeDefined();
    expect(result.sessionId).toBe(sessionId);
    expect(result.success).toBeDefined();
  }, 60000);

  it('should track session events', async () => {
    const sessionId = `test-session-${Date.now()}`;
    await sessionStorage.createSession(sessionId);

    await sessionStorage.append(sessionId, {
      type: 'test.event',
      sessionId,
      timestamp: Date.now(),
      data: { test: 'data' }
    });

    const session = await sessionStorage.loadSession(sessionId);
    expect(session).toBeDefined();
    expect(session!.events.length).toBeGreaterThan(0);
  });

  it('should handle session metadata', async () => {
    const sessionId = `test-session-${Date.now()}`;
    await sessionStorage.createSession(sessionId);

    const metadata = sessionStorage.getMetadata(sessionId);
    expect(metadata).toBeDefined();
    expect(metadata!.sessionId).toBe(sessionId);
    expect(metadata!.status).toBe('active');
  });
});
