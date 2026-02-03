/**
 * EvoAgent HTTP Server
 *
 * 提供 HTTP API 接口访问 EvoAgent 功能
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createServer } from 'http';
import type { Logger } from '../core/logger/index.js';
import type { SoulSystem } from '../soul/index.js';

interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  body?: unknown;
}

interface RouteHandler {
  (ctx: RequestContext): Promise<void>;
}

/**
 * HTTP 服务器
 */
export class HttpServer {
  private server: ReturnType<typeof createServer> | null = null;
  private routes: Map<string, Map<string, RouteHandler>> = new Map();
  private middlewares: Array<(ctx: RequestContext) => Promise<boolean>> = [];

  constructor(
    private readonly config: {
      host: string;
      port: number;
    },
    private readonly soulSystem: SoulSystem,
    private readonly logger: Logger
  ) {
    this.setupRoutes();
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (error) {
          this.logger.error('Request error', { error });
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });

      this.server.on('error', (error) => {
        reject(error);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        this.logger.info(`Server listening on http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        this.logger.info('Server stopped');
        resolve();
      });
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 健康检查
    this.addRoute('GET', '/health', async ({ res }) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
    });

    // 根路径
    this.addRoute('GET', '/', async ({ res }) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: 'EvoAgent API',
        version: '1.0.0',
        endpoints: {
          health: 'GET /health',
          execute: 'POST /execute',
          soul: 'GET /soul',
          reflect: 'POST /reflect'
        }
      }));
    });

    // 执行任务
    this.addRoute('POST', '/execute', async (ctx) => {
      const { res, body } = ctx;
      const input = body as { input?: string; agentType?: string };

      if (!input.input) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing input' }));
        return;
      }

      this.logger.info(`Execute request: ${input.input.slice(50)}...`);

      // TODO: 实际执行任务
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Execution queued (not yet implemented)'
      }));
    });

    // 获取 SOUL
    this.addRoute('GET', '/soul', async ({ res, url }) => {
      const agent = url.searchParams.get('agent');

      const soul = agent
        ? await this.soulSystem.getAgentSoul(agent)
        : await this.soulSystem.getGlobalSoul();

      if (!soul) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'SOUL not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(soul));
    });

    // 反思
    this.addRoute('POST', '/reflect', async ({ res, body }) => {
      const params = body as { agentType?: string; sessionCount?: number };

      if (!params.agentType) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing agentType' }));
        return;
      }

      const records = await this.soulSystem.reflect({
        agentType: params.agentType,
        sessionCount: params.sessionCount || 10,
        recentSuccesses: 0,
        recentFailures: 0
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ records }));
    });

    // CORS 预检
    this.addRoute('OPTIONS', '*', async ({ res }) => {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end();
    });
  }

  /**
   * 添加路由
   */
  private addRoute(method: string, path: string, handler: RouteHandler): void {
    if (!this.routes.has(path)) {
      this.routes.set(path, new Map());
    }
    this.routes.get(path)!.set(method, handler);
  }

  /**
   * 处理请求
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 解析 URL
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    // 解析请求体
    let body: unknown = undefined;
    if (req.method === 'POST' || req.method === 'PUT') {
      body = await this.parseBody(req);
    }

    const ctx: RequestContext = { req, res, url, body };

    // 执行中间件
    for (const middleware of this.middlewares) {
      const shouldContinue = await middleware(ctx);
      if (!shouldContinue) return;
    }

    // 路由匹配
    const path = url.pathname;

    const handlers = this.routes.get(path);
    if (handlers && handlers.has(req.method || '')) {
      await handlers.get(req.method!)!(ctx);
      return;
    }

    // 处理通配符路由
    for (const [routePath, methods] of this.routes) {
      if (routePath === '*' && methods.has(req.method || '')) {
        await methods.get(req.method!)!(ctx);
        return;
      }
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * 解析请求体
   */
  private parseBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : undefined);
        } catch {
          resolve(undefined);
        }
      });
    });
  }
}
