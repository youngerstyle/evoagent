import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface ConfigSource {
  type: 'file' | 'env' | 'cli';
  priority: number;
}

export interface ConfigOptions {
  configPath?: string;
  envPrefix?: string;
}

export class ConfigLoader {
  load(options: ConfigOptions = {}): Record<string, unknown> {
    const configs: Record<string, unknown>[] = [];
    const configPath = options.configPath || this.findConfigFile();

    // 1. 加载默认配置
    configs.push(this.getDefaultConfig());

    // 2. 加载文件配置
    if (configPath && existsSync(configPath)) {
      try {
        const fileConfig = this.loadFileConfig(configPath);
        configs.push(fileConfig);
      } catch (error) {
        console.warn(`Failed to load config file: ${configPath}`);
      }
    }

    // 3. 加载环境变量
    configs.push(this.loadEnvConfig(options.envPrefix || 'EVOAGENT'));

    // 4. 合并配置（高优先级覆盖低优先级）
    return this.mergeConfigs(configs);
  }

  private findConfigFile(): string | null {
    const candidates = [
      'evoagent.config.json',
      'evoagent.config.js',
      '.evoagentrc',
      '.evoagentrc.json'
    ];

    for (const candidate of candidates) {
      const path = resolve(process.cwd(), candidate);
      if (existsSync(path)) {
        return path;
      }
    }

    return null;
  }

  private getDefaultConfig(): Record<string, unknown> {
    return {
      server: {
        port: 18790,
        host: 'localhost'
      },
      agent: {
        maxConcurrent: 3,
        timeout: 300000,
        checkpointInterval: 30000
      },
      memory: {
        sessionDir: '~/.evoagent/sessions',
        knowledgeDir: '~/.evoagent/knowledge',
        vectorDbPath: '~/.evoagent/vectors.db',
        maxSessionEntries: 10000,
        sessionTTL: 7 * 24 * 60 * 60 * 1000 // 7 days
      },
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8192,
        temperature: 0.7,
        timeout: 60000
      },
      log: {
        level: 'info',
        format: 'json',
        output: 'stdout'
      },
      evolution: {
        enabled: true,
        reflectionSchedule: '0 2 * * *',
        minSessionsForReflection: 10
      }
    };
  }

  private loadFileConfig(path: string): Record<string, unknown> {
    const fullPath = resolve(path);
    const content = readFileSync(fullPath, 'utf-8');

    if (path.endsWith('.json')) {
      return JSON.parse(content);
    }

    // 对于 .js 或 .cjs 文件，这里简化处理
    // 实际使用动态 import
    return JSON.parse(content);
  }

  private loadEnvConfig(prefix: string): Record<string, unknown> {
    const env: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith(prefix + '_')) continue;

      const configPath = key.slice(prefix.length + 1).toLowerCase();
      this.setNestedValue(env, configPath, value);
    }

    return env;
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: string | undefined): void {
    if (value === undefined) return;

    const keys = path.split('_');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key !== undefined && !(key in current)) {
        current[key] = {};
      }
      if (key !== undefined) {
        current = current[key] as Record<string, unknown>;
      }
    }

    // 类型转换
    const finalKey = keys[keys.length - 1];
    if (finalKey !== undefined) {
      current[finalKey] = this.parseValue(value);
    }
  }

  private parseValue(value: string): unknown {
    // 尝试解析数字
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // 尝试解析布尔值
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // 尝试解析JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        // 忽略，返回原始字符串
      }
    }

    return value;
  }

  private mergeConfigs(configs: Record<string, unknown>[]): Record<string, unknown> {
    return configs.reduce((acc, config) => this.deepMerge(acc, config), {});
  }

  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        result[key] = this.deepMerge(
          (result[key] as Record<string, unknown>) || {},
          value as Record<string, unknown>
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
