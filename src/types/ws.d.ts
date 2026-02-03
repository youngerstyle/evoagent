/**
 * 类型声明文件 - WebSocket 相关
 *
 * 用于解决 ws 模块的类型声明问题
 * 完整类型应该通过 npm install --save-dev @types/ws 安装
 */

declare module 'ws' {
  import { EventEmitter } from 'events';

  export interface WebSocket extends EventEmitter {
    readonly readyState: number;
    send(data: string | Buffer, cb?: (err?: Error) => void): void;
    ping(): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
    on(event: 'message', listener: (data: Buffer) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: 'pong', listener: () => void): this;
  }

  export interface WebSocketServer extends EventEmitter {
    clients: Set<WebSocket>;
    close(cb?: (err?: Error) => void): void;
    on(event: 'connection', listener: (ws: WebSocket, req: any) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
  }

  export interface ServerOptions {
    server?: any;
    path?: string;
    port?: number;
    host?: string;
  }

  export class WebSocketServer {
    constructor(options?: ServerOptions);
  }
}
