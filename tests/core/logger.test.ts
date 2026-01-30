import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, ConsoleTransport } from '../../src/core/logger/index.js';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ level: 'debug' });
    logger.addTransport(new ConsoleTransport({ format: 'text', colors: false }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create logger with default level', () => {
    const infoLogger = new Logger();
    expect(infoLogger).toBeInstanceOf(Logger);
  });

  it('should log debug messages when level is debug', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('test message');
    expect(spy).toHaveBeenCalled();
  });

  it('should not log debug messages when level is info', () => {
    const infoLogger = new Logger({ level: 'info' });
    infoLogger.addTransport(new ConsoleTransport({ format: 'text', colors: false }));

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    infoLogger.debug('should not log');
    expect(spy).not.toHaveBeenCalled();
  });

  it('should add context to logger', () => {
    const contextualLogger = logger.withContext({ userId: '123' });
    expect(contextualLogger).toBeInstanceOf(Logger);
  });

  it('should create component-specific logger', () => {
    const componentLogger = logger.withComponent('test-component');
    expect(componentLogger).toBeInstanceOf(Logger);
  });

  it('should log error with error object', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = new Error('Test error');
    logger.error('something went wrong', error);
    expect(spy).toHaveBeenCalled();
  });
});
