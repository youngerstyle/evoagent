/**
 * Mock Logger for testing
 */

import type { Logger, LogLevel, LogEntry } from '../../src/core/logger/types.js';

export class MockLogger implements Logger {
  public entries: LogEntry[] = [];
  public level: LogLevel = 'debug';

  constructor(options?: { level?: LogLevel }) {
    if (options?.level) {
      this.level = options.level;
    }
  }

  addTransport(): void {
    // No-op for mock
  }

  withContext(): Logger {
    return this;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorInfo = error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : { message: String(error) };
    this.log('error', message, { ...meta, error: errorInfo });
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    this.entries.push({
      level,
      message,
      timestamp: new Date().toISOString(),
      context: meta || {}
    });
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  clear(): void {
    this.entries = [];
  }

  getLastEntry(): LogEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  hasMessage(message: string): boolean {
    return this.entries.some(e => e.message === message);
  }
}
