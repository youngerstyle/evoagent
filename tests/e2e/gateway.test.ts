/**
 * 端到端测试 - WebSocket Gateway
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { GatewayServer } from '../../src/gateway/websocket/GatewayServer.js';
import { createLLMServiceFromEnv } from '../../src/core/llm/index.js';
import { SoulSystem } from '../../src/soul/index.js';
import { createLogger } from '../../src/core/logger/index.js';
import WebSocket from 'ws';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('WebSocket Gateway E2E Tests', () => {
  let gateway: GatewayServer;
  let testDir: string;
  const port = 18791; // 使用不同端口避免冲突

  beforeAll(async () => {
    testDir = join(tmpdir(), `evoagent-gateway-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    const llm = createLLMServiceFromEnv();
    const logger = createLogger({ component: 'test' });
    const soulSystem = new SoulSystem(llm, logger);

    gateway = new GatewayServer(
      {
        host: '127.0.0.1',
        port,
        pingInterval: 30000,
        pingTimeout: 60000
      },
      llm,
      soulSystem,
      join(testDir, 'sessions')
    );

    await gateway.start();
  });

  afterAll(async () => {
    await gateway.stop();
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test directory:', error);
    }
  });

  it('should accept WebSocket connections', (done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    ws.on('open', () => {
      ws.close();
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  }, 10000);

  it('should receive welcome message on connection', (done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      expect(message.type).toBe('event');
      expect(message.payload.event).toBe('connected');
      ws.close();
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  }, 10000);

  it('should respond to ping messages', (done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'ping',
        id: 'test-ping-1'
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'pong') {
        expect(message.id).toBe('test-ping-1');
        ws.close();
        done();
      }
    });

    ws.on('error', (error) => {
      done(error);
    });
  }, 10000);
});
