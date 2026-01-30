import { ConfigLoader, ConfigValidator } from '../../src/core/config/index.js';

describe('Config', () => {
  describe('ConfigLoader', () => {
    let loader: ConfigLoader;

    beforeEach(() => {
      loader = new ConfigLoader();
    });

    it('should load default config', () => {
      const config = loader.load({ configPath: '/nonexistent' });
      expect(config).toHaveProperty('server');
      expect(config).toHaveProperty('agent');
      expect(config).toHaveProperty('llm');
    });

    it('should merge configs correctly', () => {
      const config = loader.load();
      expect(config.server).toHaveProperty('port');
      expect(config.server.port).toBe(18790);
    });
  });

  describe('ConfigValidator', () => {
    let validator: ConfigValidator;

    beforeEach(() => {
      validator = new ConfigValidator();
    });

    it('should validate valid config', () => {
      const validConfig = {
        server: { port: 3000, host: 'localhost' },
        agent: { maxConcurrent: 3, timeout: 300000, checkpointInterval: 30000 },
        memory: {
          sessionDir: '~/.evoagent/sessions',
          knowledgeDir: '~/.evoagent/knowledge',
          vectorDbPath: '~/.evoagent/vectors.db',
          maxSessionEntries: 10000,
          sessionTTL: 604800000
        },
        llm: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 8192,
          temperature: 0.7,
          timeout: 60000
        },
        log: { level: 'info', format: 'json', output: 'stdout' },
        evolution: { enabled: true, reflectionSchedule: '0 2 * * *', minSessionsForReflection: 10 }
      };

      expect(() => validator.validate(validConfig)).not.toThrow();
    });

    it('should reject invalid port', () => {
      const invalidConfig = {
        server: { port: 100 },  // < 1024
        agent: { maxConcurrent: 3, timeout: 300000, checkpointInterval: 30000 },
        memory: {
          sessionDir: '~/.evoagent/sessions',
          knowledgeDir: '~/.evoagent/knowledge',
          vectorDbPath: '~/.evoagent/vectors.db',
          maxSessionEntries: 10000,
          sessionTTL: 604800000
        },
        llm: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 8192,
          temperature: 0.7,
          timeout: 60000
        },
        log: { level: 'info', format: 'json', output: 'stdout' },
        evolution: { enabled: true, reflectionSchedule: '0 2 * * *', minSessionsForReflection: 10 }
      };

      expect(() => validator.validate(invalidConfig)).toThrow();
    });

    it('should reject invalid log level', () => {
      const invalidConfig = {
        server: { port: 3000 },
        agent: { maxConcurrent: 3, timeout: 300000, checkpointInterval: 30000 },
        memory: {
          sessionDir: '~/.evoagent/sessions',
          knowledgeDir: '~/.evoagent/knowledge',
          vectorDbPath: '~/.evoagent/vectors.db',
          maxSessionEntries: 10000,
          sessionTTL: 604800000
        },
        llm: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 8192,
          temperature: 0.7,
          timeout: 60000
        },
        log: { level: 'invalid', format: 'json', output: 'stdout' },
        evolution: { enabled: true, reflectionSchedule: '0 2 * * *', minSessionsForReflection: 10 }
      };

      expect(() => validator.validate(invalidConfig)).toThrow();
    });
  });
});
