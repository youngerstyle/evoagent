export { ConfigLoader, type ConfigSource, type ConfigOptions } from './loader.js';
export {
  ConfigValidator,
  ConfigValidationException,
  type ServerConfig,
  type AgentConfig,
  type MemoryConfig,
  type LLMConfig,
  type LogConfig,
  type EvolutionConfig,
  type EvoAgentConfig
} from './validator.js';

import { ConfigLoader, type ConfigOptions } from './loader.js';
import { ConfigValidator, type EvoAgentConfig } from './validator.js';

let currentConfig: EvoAgentConfig | null = null;

/**
 * 获取当前配置
 */
export function getConfig(): EvoAgentConfig {
  if (!currentConfig) {
    loadConfig();
  }
  return currentConfig!;
}

/**
 * 重新加载配置
 */
export function loadConfig(options?: ConfigOptions): EvoAgentConfig {
  const loader = new ConfigLoader();
  const validator = new ConfigValidator();

  const rawConfig = loader.load(options);
  validator.validate(rawConfig);

  // Validate之后类型安全
  currentConfig = rawConfig as unknown as EvoAgentConfig;
  return currentConfig;
}

/**
 * 重置配置（主要用于测试）
 */
export function resetConfig(): void {
  currentConfig = null;
}
