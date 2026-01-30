import { createWriteStream, WriteStream } from 'fs';
import type { LogEntry, LoggerTransport } from './logger.js';

/**
 * 控制台输出传输
 */
export class ConsoleTransport implements LoggerTransport {
  readonly name = 'console';
  private readonly useJson: boolean;
  private readonly useColors: boolean;

  constructor(options: { format?: 'json' | 'text'; colors?: boolean } = {}) {
    this.useJson = options.format === 'json';
    this.useColors = options.colors ?? !this.useJson;
  }

  write(entry: LogEntry): void {
    if (this.useJson) {
      console.log(JSON.stringify(entry));
    } else {
      this.writeText(entry);
    }
  }

  private writeText(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = this.colorizeLevel(entry.level);
    const component = entry.component ? `[${entry.component}] ` : '';
    const session = entry.sessionId ? ` (${entry.sessionId.slice(0, 8)})` : '';

    let message = `${timestamp} ${level} ${component}${entry.message}${session}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      message += `\n  Context: ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n${entry.error.stack.split('\n').map(l => '    ' + l).join('\n')}`;
      }
    }

    console.log(message);
  }

  private colorizeLevel(level: string): string {
    if (!this.useColors) return level.toUpperCase().padEnd(5);

    const colors: Record<string, string> = {
      debug: '\x1b[36m',  // cyan
      info: '\x1b[32m',   // green
      warn: '\x1b[33m',   // yellow
      error: '\x1b[31m'   // red
    };
    const reset = '\x1b[0m';
    return `${colors[level] || ''}${level.toUpperCase().padEnd(5)}${reset}`;
  }
}

/**
 * 文件输出传输
 */
export class FileTransport implements LoggerTransport {
  readonly name = 'file';
  private stream?: WriteStream;
  private readonly filename: string;
  private readonly maxSize?: number;
  private currentSize = 0;

  constructor(options: {
    filename: string;
    maxSize?: number;  // 字节，达到后轮转
  }) {
    this.filename = options.filename;
    this.maxSize = options.maxSize;
    this.initStream();
  }

  private initStream(): void {
    this.stream = createWriteStream(this.filename, { flags: 'a' });
  }

  write(entry: LogEntry): void {
    if (!this.stream) return;

    const line = JSON.stringify(entry) + '\n';
    this.currentSize += line.length;

    // 检查是否需要轮转
    if (this.maxSize && this.currentSize > this.maxSize) {
      this.rotate();
    }

    this.stream.write(line);
  }

  private rotate(): void {
    this.stream?.close();

    // 重命名当前文件
    this.parsePath(this.filename);

    // 这里简化处理，实际应该使用rename
    this.currentSize = 0;
    this.initStream();
  }

  private parsePath(path: string): { dir: string; name: string; ext: string } {
    const parts = path.split('/');
    const filename = parts[parts.length - 1] || '';
    const _dir = parts.slice(0, -1).join('/');

    const lastDot = filename.lastIndexOf('.');
    const ext = lastDot >= 0 ? filename.slice(lastDot) : '';
    const _name = lastDot >= 0 ? filename.slice(0, lastDot) : filename;

    return { dir: _dir, name: _name, ext };
  }

  flush(): void {
    // WriteStream doesn't have a flush method in all versions
    // The stream is auto-flushed on write
  }

  close(): void {
    this.stream?.close();
    this.stream = undefined;
  }
}

/**
 * 过滤传输
 */
export class FilterTransport implements LoggerTransport {
  readonly name = 'filter';

  constructor(
    private readonly wrapped: LoggerTransport,
    private readonly predicate: (entry: LogEntry) => boolean
  ) {}

  write(entry: LogEntry): void {
    if (this.predicate(entry)) {
      this.wrapped.write(entry);
    }
  }

  flush?(): void {
    if (this.wrapped.flush) {
      this.wrapped.flush();
    }
  }
}

/**
 * 按级别过滤
 */
export class LevelFilter extends FilterTransport {
  constructor(wrapped: LoggerTransport, minLevel: string) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(minLevel);

    super(wrapped, (entry) => {
      return levels.indexOf(entry.level) >= minIndex;
    });
  }
}

/**
 * 缓冲传输（批量写入）
 */
export class BufferedTransport implements LoggerTransport {
  readonly name = 'buffered';
  private buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private readonly wrapped: LoggerTransport,
    options: {
      flushInterval?: number;  // ms
      bufferSize?: number;
    } = {}
  ) {
    const flushInterval = options.flushInterval || 5000;
    const bufferSize = options.bufferSize || 100;

    // 定时刷新
    this.flushTimer = setInterval(() => {
      this.flush();
    }, flushInterval);

    // 达到buffer大小后刷新
    if (bufferSize > 0) {
      setInterval(() => {
        if (this.buffer.length >= bufferSize) {
          this.flush();
        }
      }, 1000);
    }
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);

    // error级别立即刷新
    if (entry.level === 'error') {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const entries = this.buffer;
    this.buffer = [];

    for (const entry of entries) {
      this.wrapped.write(entry);
    }

    if (this.wrapped.flush) {
      this.wrapped.flush();
    }
  }

  close(): void {
    this.flush();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
  }
}
