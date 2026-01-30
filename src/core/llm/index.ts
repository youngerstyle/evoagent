export type * from './types.js';
export { MockLLMService } from './mock.js';
export { AnthropicLLMService } from './anthropic.js';
export { OpenAILLMService } from './openai.js';

import type { LLMService, LLMServiceConfig } from './types.js';
import { MockLLMService } from './mock.js';
import { AnthropicLLMService } from './anthropic.js';
import { OpenAILLMService } from './openai.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger('llm');

/**
 * 创建LLM服务实例
 */
export function createLLMService(config: LLMServiceConfig): LLMService {
  logger.info(`Creating LLM service: ${config.provider} (${config.model})`);

  switch (config.provider) {
    case 'anthropic':
      if (!config.apiKey) {
        logger.warn('No API key provided, falling back to mock service');
        return new MockLLMService();
      }
      return new AnthropicLLMService({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        timeout: config.timeout,
        maxRetries: config.maxRetries
      });

    case 'openai':
      if (!config.apiKey) {
        logger.warn('No API key provided, falling back to mock service');
        return new MockLLMService();
      }
      return new OpenAILLMService({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        timeout: config.timeout,
        maxRetries: config.maxRetries
      });

    case 'custom':
      logger.warn('Custom provider not yet implemented, using mock');
      return new MockLLMService();

    default:
      logger.warn(`Unknown provider: ${config.provider}, using mock`);
      return new MockLLMService();
  }
}

/**
 * 从环境变量创建LLM服务
 */
export function createLLMServiceFromEnv(): LLMService {
  const provider = (process.env.EVOAGENT_LLM_PROVIDER || 'anthropic') as LLMServiceConfig['provider'];
  const model = process.env.EVOAGENT_LLM_MODEL || 'claude-3-5-sonnet-20241022';
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.EVOAGENT_LLM_API_KEY;

  return createLLMService({
    provider,
    model,
    apiKey,
    baseUrl: process.env.EVOAGENT_LLM_BASE_URL,
    timeout: parseInt(process.env.EVOAGENT_LLM_TIMEOUT || '60000'),
    maxRetries: parseInt(process.env.EVOAGENT_LLM_MAX_RETRIES || '3')
  });
}
