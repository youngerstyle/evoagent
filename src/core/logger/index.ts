export { Logger } from './logger.js';
export type * from './logger.js';
export {
  ConsoleTransport,
  FileTransport,
  FilterTransport,
  LevelFilter,
  BufferedTransport
} from './transport.js';

import { Logger, type LoggerOptions, type LogLevel, DEFAULT_LOG_LEVEL } from './logger.js';
import { ConsoleTransport } from './transport.js';

// 组件级别的logger缓存
const loggers = new Map<string, Logger>();

// 根logger
let rootLogger: Logger | null = null;

/**
 * 获取根logger
 */
function getRootLogger(): Logger {
  if (!rootLogger) {
    rootLogger = new Logger({
      level: DEFAULT_LOG_LEVEL
    });
    rootLogger.addTransport(new ConsoleTransport({ format: 'json' }));
  }
  return rootLogger;
}

/**
 * 获取命名logger
 */
export function getLogger(name: string): Logger {
  let logger = loggers.get(name);

  if (!logger) {
    logger = getRootLogger().withComponent(name);
    loggers.set(name, logger);
  }

  return logger;
}

/**
 * 创建logger（带选项）
 */
export function createLogger(options: LoggerOptions): Logger {
  const logger = new Logger(options);

  // 如果没有transport，添加默认的console
  if (options.level === undefined) {
    logger.addTransport(new ConsoleTransport({ format: 'json' }));
  }

  return logger;
}

/**
 * 设置全局日志级别
 */
export function setLogLevel(level: string): void {
  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(level)) {
    throw new Error(`Invalid log level: ${level}`);
  }

  rootLogger = new Logger({ level: level as LogLevel });
  rootLogger.addTransport(new ConsoleTransport({ format: 'json' }));

  // 清除缓存的loggers
  loggers.clear();
}

/**
 * 刷新所有logger
 */
export async function flushAllLoggers(): Promise<void> {
  if (rootLogger) {
    await rootLogger.flush();
  }
}
