export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: ErrorInfo;
  component?: string;
  sessionId?: string;
  runId?: string;
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  code?: string;
  name?: string;
}

export interface LoggerTransport {
  name: string;
  write(entry: LogEntry): void | Promise<void>;
  flush?(): void | Promise<void>;
}

export interface LoggerOptions {
  level?: LogLevel;
  context?: Record<string, unknown>;
  component?: string;
}

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

export function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[minLevel];
}

export class Logger {
  private readonly transports: LoggerTransport[] = [];
  private readonly level: LogLevel;
  private readonly context: Record<string, unknown>;
  private readonly component?: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info';
    this.context = options.context || {};
    this.component = options.component;
  }

  addTransport(transport: LoggerTransport): void {
    this.transports.push(transport);
  }

  removeTransport(name: string): void {
    const index = this.transports.findIndex(t => t.name === name);
    if (index >= 0) {
      this.transports.splice(index, 1);
    }
  }

  withContext(additional: Record<string, unknown>): Logger {
    return new Logger({
      level: this.level,
      context: { ...this.context, ...additional },
      component: this.component
    });
  }

  withComponent(component: string): Logger {
    return new Logger({
      level: this.level,
      context: this.context,
      component
    });
  }

  withSession(sessionId: string): Logger {
    return this.withContext({ sessionId });
  }

  withRun(runId: string): Logger {
    return this.withContext({ runId });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorInfo = this.extractErrorInfo(error);
    this.write('error', message, { ...meta, error: errorInfo });
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog(level, this.level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      component: this.component,
      context: { ...this.context, ...meta }
    };

    // 从context中提取特殊字段
    if (entry.context?.sessionId && typeof entry.context.sessionId === 'string') {
      entry.sessionId = entry.context.sessionId;
      delete entry.context.sessionId;
    }
    if (entry.context?.runId && typeof entry.context.runId === 'string') {
      entry.runId = entry.context.runId;
      delete entry.context.runId;
    }

    // 从meta中提取error
    if (entry.context?.error) {
      const errorValue = entry.context.error;
      if (errorValue instanceof Error) {
        entry.error = {
          name: errorValue.name,
          message: errorValue.message,
          stack: errorValue.stack,
          code: (errorValue as { code?: string }).code
        };
      } else if (typeof errorValue === 'object' && errorValue !== null) {
        entry.error = errorValue as ErrorInfo;
      }
      delete entry.context.error;
    }

    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (err) {
        // 防止日志系统本身出错导致循环
        console.error(`Transport ${transport.name} write failed:`, err);
      }
    }
  }

  private extractErrorInfo(error?: Error | unknown): ErrorInfo | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    return {
      name: 'Unknown',
      message: String(error)
    };
  }

  async flush(): Promise<void> {
    for (const transport of this.transports) {
      if (transport.flush) {
        await transport.flush();
      }
    }
  }
}

// 默认日志级别（可通过环境变量覆盖）
export const DEFAULT_LOG_LEVEL =
  (process.env.EVOAGENT_LOG_LEVEL as LogLevel) || 'info';
