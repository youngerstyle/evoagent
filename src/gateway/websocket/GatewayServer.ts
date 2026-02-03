/**
 * Gateway WebSocket Server
 *
 * EvoAgent 的 WebSocket 网关服务器
 */

import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import { URL } from 'url';
import { getLogger } from '../../core/logger/index.js';
import type { SoulSystem } from '../../soul/index.js';
import type { LLMService } from '../../core/llm/types.js';
import { OrchestratorAgent } from '../../agent/orchestrator/OrchestratorAgent.js';
import { SessionStorage } from '../../memory/session/SessionStorage.js';
import { defaultRateLimiterManager, RateLimitPresets } from '../../resilience/rate-limiter/RateLimiter.js';
import type { AgentEventListener } from '../../agent/base/types.js';
import { v4 as uuidv4 } from 'uuid';

const logger = getLogger('gateway:websocket');

/**
 * WebSocket 消息类型
 */
export type MessageType =
  | 'request'
  | 'response'
  | 'event'
  | 'error'
  | 'ping'
  | 'pong';

/**
 * WebSocket 消息
 */
export interface WSMessage {
  type: MessageType;
  id: string;
  payload?: unknown;
  error?: string;
}

/**
 * 执行请求
 */
export interface ExecuteRequest {
  input: string;
  agentType?: string;
  sessionId?: string;
  workspace?: string;
  options?: Record<string, unknown>;
}

/**
 * 执行响应
 */
export interface ExecuteResponse {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: {
    success: boolean;
    output: string;
    artifacts?: Array<{
      type: string;
      path: string;
    }>;
  };
  error?: string;
}

/**
 * 任务状态
 */
export interface TaskState {
  taskId: string;
  requestId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  input: string;
  output?: string;
  error?: string;
  artifacts?: Array<{
    type: string;
    path: string;
  }>;
  startTime: number;
  endTime?: number;
}

/**
 * 客户端连接
 */
export interface ClientConnection {
  id: string;
  ws: WebSocket;
  sessionId?: string;
  agentType?: string;
  connectedAt: number;
  lastPing: number;
  tasks: Map<string, TaskState>;
}

/**
 * Gateway 配置
 */
export interface GatewayConfig {
  host: string;
  port: number;
  pingInterval: number;
  pingTimeout: number;
}

/**
 * Gateway WebSocket Server
 */
export class GatewayServer {
  private server?: HTTPServer;
  private wss?: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private pingInterval?: ReturnType<typeof setInterval>;
  private messageHandlers: Map<string, (conn: ClientConnection, msg: WSMessage) => Promise<void>> = new Map();
  private orchestrator: OrchestratorAgent;
  private sessionStorage: SessionStorage;
  private rateLimiter = defaultRateLimiterManager.get('wsMessage', RateLimitPresets.wsMessage);

  constructor(
    private readonly config: GatewayConfig,
    llm: LLMService,
    _soulSystem: SoulSystem,
    sessionDir: string
  ) {
    this.orchestrator = new OrchestratorAgent(
      {
        systemPrompt: undefined,
        maxRetries: 3,
        retryDelay: 1000,
        enableParallel: false,
        timeout: 300000
      },
      llm
    );
    this.sessionStorage = new SessionStorage(sessionDir);
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    // 初始化 SessionStorage
    await this.sessionStorage.init();

    return new Promise((resolve, reject) => {
      // 创建 HTTP 服务器
      this.server = createHttpServer(async (req, res) => {
        await this.handleHttpRequest(req, res);
      });

      // 创建 WebSocket 服务器
      this.wss = new WebSocketServer({
        server: this.server,
        path: '/ws'
      });

      this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        this.handleConnection(ws, req);
      });

      this.wss.on('error', (_error: Error) => {
        logger.error('WebSocket server error', { error: _error });
      });

      // 启动 HTTP 服务器
      this.server.listen(this.config.port, this.config.host, () => {
        const addr = 'ws://' + this.config.host + ':' + this.config.port;
        logger.info('Gateway WebSocket server listening on ' + addr);
        resolve();
      });

      this.server.on('error', reject);

      // 启动心跳
      this.startPing();
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    // 停止心跳
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // 关闭所有客户端连接
    for (const client of this.clients.values()) {
      client.ws.close(1000, 'Server shutting down');
    }
    this.clients.clear();

    // 关闭 WebSocket 服务器
    if (this.wss) {
      this.wss.close();
    }

    // 关闭 HTTP 服务器
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Gateway server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 处理 HTTP 请求
   */
  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const host = req.headers.host || 'localhost:80';
    const url = new URL(req.url || '', 'http://' + host);

    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 处理健康检查
    if (url.pathname === '/healthz' || url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        connections: this.clients.size
      }));
      return;
    }

    // 处理 metrics
    if (url.pathname === '/metrics') {
      // TODO: 导出 Prometheus metrics
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('# Metrics endpoint\n');
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * 处理 WebSocket 连接
   */
  private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
    const clientId = this.generateClientId();

    const client: ClientConnection = {
      id: clientId,
      ws,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      tasks: new Map()
    };

    this.clients.set(clientId, client);
    const totalStr = this.clients.size.toString();
    logger.info('Client connected: ' + clientId + ' (total: ' + totalStr + ')');

    // 发送欢迎消息
    this.sendMessage(client, {
      type: 'event',
      id: this.generateMessageId(),
      payload: {
        event: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      }
    });

    // 处理消息
    ws.on('message', async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        await this.handleMessage(client, message);
      } catch (error) {
        logger.error('Failed to parse message', { error, clientId });
        this.sendMessage(client, {
          type: 'error',
          id: this.generateMessageId(),
          error: 'Invalid message format: ' + String(error)
        });
      }
    });

    // 处理关闭
    ws.on('close', () => {
      this.clients.delete(clientId);
      const totalStr = this.clients.size.toString();
      logger.info('Client disconnected: ' + clientId + ' (total: ' + totalStr + ')');
    });

    // 处理错误
    ws.on('error', (_error: Error) => {
      logger.error('WebSocket error for client ' + clientId, { error: _error });
    });

    // 处理 pong
    ws.on('pong', () => {
      client.lastPing = Date.now();
    });
  }

  /**
   * 处理消息
   */
  private async handleMessage(client: ClientConnection, message: WSMessage): Promise<void> {
    const msgType = message.type;
    logger.debug('Received message: ' + msgType + ' from ' + client.id);

    // 处理 ping
    if (msgType === 'ping') {
      this.sendMessage(client, {
        type: 'pong',
        id: message.id
      });
      return;
    }

    // 查找处理器
    const handler = this.messageHandlers.get(msgType);
    if (handler) {
      try {
        await handler(client, message);
      } catch (error) {
        logger.error('Handler error for ' + msgType, { error });
        this.sendMessage(client, {
          type: 'error',
          id: message.id,
          error: 'Handler error: ' + String(error)
        });
      }
    } else {
      // 处理内置消息类型
      switch (msgType) {
        case 'request':
          await this.handleRequest(client, message);
          break;

        default:
          this.sendMessage(client, {
            type: 'error',
            id: message.id,
            error: 'Unknown message type: ' + msgType
          });
      }
    }
  }

  /**
   * 处理请求消息
   */
  private async handleRequest(client: ClientConnection, message: WSMessage): Promise<void> {
    const request = message.payload as ExecuteRequest;

    if (!request?.input) {
      this.sendMessage(client, {
        type: 'error',
        id: message.id,
        error: 'Missing input in request'
      });
      return;
    }

    // 检查速率限制
    const rateLimitResult = this.rateLimiter.tryAcquire();
    if (!rateLimitResult.allowed) {
      this.sendMessage(client, {
        type: 'error',
        id: message.id,
        error: `Rate limit exceeded. Retry after ${Math.ceil((rateLimitResult.retryAfter || 0) / 1000)}s`
      });
      return;
    }

    // 创建任务
    const taskId = uuidv4();
    const sessionId = request.sessionId || client.sessionId || uuidv4();

    // 如果客户端没有 sessionId，设置它
    if (!client.sessionId) {
      client.sessionId = sessionId;
    }

    const taskState: TaskState = {
      taskId,
      requestId: message.id,
      status: 'pending',
      progress: 0,
      input: request.input,
      startTime: Date.now()
    };

    client.tasks.set(taskId, taskState);

    // 发送任务已排队响应
    this.sendMessage(client, {
      type: 'response',
      id: message.id,
      payload: {
        id: taskId,
        status: 'pending',
        message: 'Task queued'
      }
    });

    const inputPreview = request.input.length > 50 ? request.input.slice(0, 50) + '...' : request.input;
    logger.info(`Task ${taskId} execution requested: ${inputPreview}`);

    // 异步执行任务
    this.executeTask(client, taskState, sessionId, request).catch(error => {
      logger.error(`Task ${taskId} execution failed:`, { error });
      taskState.status = 'failed';
      taskState.error = error instanceof Error ? error.message : String(error);
      taskState.endTime = Date.now();

      this.sendMessage(client, {
        type: 'response',
        id: message.id,
        payload: {
          id: taskId,
          status: 'failed',
          error: taskState.error
        }
      });
    });
  }

  /**
   * 执行任务
   */
  private async executeTask(
    client: ClientConnection,
    taskState: TaskState,
    sessionId: string,
    request: ExecuteRequest
  ): Promise<void> {
    try {
      // 创建或加载 Session
      const existingSession = await this.sessionStorage.loadSession(sessionId);
      if (!existingSession) {
        await this.sessionStorage.createSession(sessionId, request.options?.userId as string | undefined);
      }

      // 记录任务开始事件
      await this.sessionStorage.append(sessionId, {
        type: 'task.started',
        sessionId,
        timestamp: Date.now(),
        data: {
          taskId: taskState.taskId,
          input: request.input,
          agentType: request.agentType
        }
      });

      // 更新任务状态为运行中
      taskState.status = 'running';
      this.sendMessage(client, {
        type: 'response',
        id: taskState.requestId,
        payload: {
          id: taskState.taskId,
          status: 'running',
          progress: 0
        }
      });

      // 设置事件监听器以流式传输进度
      const eventListener: AgentEventListener = (event) => {
        if (event.type === 'progress') {
          taskState.progress = event.progress;
          this.sendMessage(client, {
            type: 'event',
            id: this.generateMessageId(),
            payload: {
              event: 'progress',
              taskId: taskState.taskId,
              progress: event.progress
            }
          });
        } else if (event.type === 'tool_call') {
          this.sendMessage(client, {
            type: 'event',
            id: this.generateMessageId(),
            payload: {
              event: 'tool_call',
              taskId: taskState.taskId,
              tool: event.tool,
              params: event.params
            }
          });
        } else if (event.type === 'tool_result') {
          this.sendMessage(client, {
            type: 'event',
            id: this.generateMessageId(),
            payload: {
              event: 'tool_result',
              taskId: taskState.taskId,
              tool: event.tool,
              result: event.result
            }
          });
        }
      };

      this.orchestrator.addEventListener(eventListener);

      try {
        // 执行 Orchestrator
        const result = await this.orchestrator.run({
          input: request.input,
          sessionId,
          metadata: {
            taskId: taskState.taskId,
            workspace: request.workspace,
            ...request.options
          }
        });

        // 更新任务状态
        taskState.status = result.success ? 'completed' : 'failed';
        taskState.progress = 100;
        taskState.output = result.output;
        taskState.error = result.error;
        taskState.artifacts = result.artifacts?.map(a => ({
          type: a.type || 'file',
          path: a.path || ''
        }));
        taskState.endTime = Date.now();

        // 记录任务完成事件
        await this.sessionStorage.append(sessionId, {
          type: result.success ? 'task.completed' : 'task.failed',
          sessionId,
          timestamp: Date.now(),
          data: {
            taskId: taskState.taskId,
            output: result.output,
            error: result.error,
            duration: result.duration
          }
        });

        // 发送最终响应
        this.sendMessage(client, {
          type: 'response',
          id: taskState.requestId,
          payload: {
            id: taskState.taskId,
            status: taskState.status,
            result: {
              success: result.success,
              output: result.output,
              artifacts: taskState.artifacts || []
            },
            error: taskState.error
          }
        });

        logger.info(`Task ${taskState.taskId} ${taskState.status} in ${result.duration}ms`);

      } finally {
        this.orchestrator.removeEventListener(eventListener);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Task ${taskState.taskId} execution error:`, { error });

      taskState.status = 'failed';
      taskState.error = errorMsg;
      taskState.endTime = Date.now();

      // 记录错误事件
      await this.sessionStorage.append(sessionId, {
        type: 'task.failed',
        sessionId,
        timestamp: Date.now(),
        data: {
          taskId: taskState.taskId,
          error: errorMsg
        }
      });

      throw error;
    }
  }

  /**
   * 发送消息到客户端
   */
  sendMessage(client: ClientConnection, message: WSMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 广播消息到所有客户端
   */
  broadcast(message: WSMessage): void {
    for (const client of this.clients.values()) {
      this.sendMessage(client, message);
    }
  }

  /**
   * 注册消息处理器
   */
  registerHandler(type: string, handler: (conn: ClientConnection, msg: WSMessage) => Promise<void>): void {
    this.messageHandlers.set(type, handler);
    logger.debug('Registered handler for message type: ' + type);
  }

  /**
   * 启动心跳
   */
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();

      for (const [clientId, client] of this.clients.entries()) {
        // 检查超时
        if (now - client.lastPing > this.config.pingTimeout) {
          logger.info('Client timeout: ' + clientId);
          client.ws.terminate();
          this.clients.delete(clientId);
          continue;
        }

        // 发送 ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, this.config.pingInterval);
  }

  /**
   * 生成客户端 ID
   */
  private generateClientId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return 'client_' + timestamp + '_' + random;
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return 'msg_' + timestamp + '_' + random;
  }

  /**
   * 获取连接统计
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    uptime: number;
  } {
    return {
      totalConnections: this.clients.size,
      activeConnections: Array.from(this.clients.values()).filter(
        c => c.ws.readyState === WebSocket.OPEN
      ).length,
      uptime: process.uptime()
    };
  }
}
