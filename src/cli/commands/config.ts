/**
 * Config 相关 CLI 命令
 */

import { Command } from 'commander';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * 注册 Config 命令
 */
export function registerConfigCommands(
  program: Command,
  evoagentDir: string = '.evoagent'
): void {
  const configCmd = program.command('config');

  // config list
  configCmd
    .command('list')
    .description('列出所有配置项')
    .action(async () => {
      const configPath = join(evoagentDir, 'config.json');

      if (!existsSync(configPath)) {
        console.error('❌ 配置文件不存在');
        console.log('运行 `evoagent init` 初始化配置');
        process.exit(1);
      }

      const configData = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      console.log('# 配置\n');
      printConfig(config, '');
    });

  // config get <key>
  configCmd
    .command('get <key>')
    .description('获取配置项的值')
    .action(async (key) => {
      const configPath = join(evoagentDir, 'config.json');

      if (!existsSync(configPath)) {
        console.error('❌ 配置文件不存在');
        process.exit(1);
      }

      const configData = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      const value = getNestedValue(config, key);

      if (value === undefined) {
        console.error(`❌ 配置项不存在: ${key}`);
        process.exit(1);
      }

      if (typeof value === 'object') {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(value);
      }
    });

  // config set <key> <value>
  configCmd
    .command('set <key> <value>')
    .description('设置配置项的值')
    .option('--json', '将值解析为 JSON')
    .action(async (key, value, options) => {
      const configPath = join(evoagentDir, 'config.json');

      if (!existsSync(configPath)) {
        console.error('❌ 配置文件不存在');
        console.log('运行 `evoagent init` 初始化配置');
        process.exit(1);
      }

      const configData = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      let parsedValue: any = value;
      if (options.json) {
        try {
          parsedValue = JSON.parse(value);
        } catch (error) {
          console.error('❌ 无效的 JSON 值');
          process.exit(1);
        }
      } else {
        // 自动类型转换
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (value === 'null') parsedValue = null;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
      }

      setNestedValue(config, key, parsedValue);

      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`✓ 配置已更新: ${key} = ${JSON.stringify(parsedValue)}`);
    });

  // config reset
  configCmd
    .command('reset')
    .description('重置配置为默认值')
    .option('-f, --force', '强制重置，不询问')
    .action(async (options) => {
      if (!options.force) {
        console.warn('⚠️  此操作将重置所有配置为默认值');
        console.warn('这个操作不可撤销。');
        console.log('');
        console.log('使用 --force 选项确认操作。');
        return;
      }

      const configPath = join(evoagentDir, 'config.json');

      const defaultConfig = {
        version: '1.0.0',
        server: {
          host: '127.0.0.1',
          port: 18790
        },
        llm: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 8192,
          temperature: 0.3
        },
        memory: {
          sessionDir: '.evoagent/sessions',
          knowledgeDir: '.evoagent/knowledge',
          maxSessions: 100
        },
        evolution: {
          enabled: true,
          reflectAfterSessions: 10,
          autoOptimize: false
        }
      };

      await writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      console.log('✓ 配置已重置为默认值');
    });

  // config validate
  configCmd
    .command('validate')
    .description('验证配置文件')
    .action(async () => {
      const configPath = join(evoagentDir, 'config.json');

      if (!existsSync(configPath)) {
        console.error('❌ 配置文件不存在');
        process.exit(1);
      }

      try {
        const configData = await readFile(configPath, 'utf-8');
        const config = JSON.parse(configData);

        const errors: string[] = [];

        // 验证必需字段
        if (!config.version) errors.push('缺少 version 字段');
        if (!config.server) errors.push('缺少 server 配置');
        if (!config.llm) errors.push('缺少 llm 配置');
        if (!config.memory) errors.push('缺少 memory 配置');

        // 验证 server
        if (config.server) {
          if (!config.server.host) errors.push('缺少 server.host');
          if (!config.server.port) errors.push('缺少 server.port');
          if (config.server.port < 1 || config.server.port > 65535) {
            errors.push('server.port 必须在 1-65535 之间');
          }
        }

        // 验证 llm
        if (config.llm) {
          if (!config.llm.provider) errors.push('缺少 llm.provider');
          if (!config.llm.model) errors.push('缺少 llm.model');
          const validProviders = ['anthropic', 'openai', 'custom'];
          if (config.llm.provider && !validProviders.includes(config.llm.provider)) {
            errors.push(`llm.provider 必须是: ${validProviders.join(', ')}`);
          }
        }

        // 验证 memory
        if (config.memory) {
          if (!config.memory.sessionDir) errors.push('缺少 memory.sessionDir');
          if (!config.memory.knowledgeDir) errors.push('缺少 memory.knowledgeDir');
        }

        if (errors.length > 0) {
          console.error('❌ 配置验证失败:\n');
          for (const error of errors) {
            console.error(`  - ${error}`);
          }
          process.exit(1);
        }

        console.log('✓ 配置验证通过');
      } catch (error) {
        console.error('❌ 配置文件格式错误');
        console.error(error);
        process.exit(1);
      }
    });

  // config edit
  configCmd
    .command('edit')
    .description('在编辑器中打开配置文件')
    .option('-e, --editor <editor>', '编辑器', 'code')
    .action(async (options) => {
      const { spawn } = await import('child_process');
      const configPath = join(evoagentDir, 'config.json');

      if (!existsSync(configPath)) {
        console.error('❌ 配置文件不存在');
        console.log('运行 `evoagent init` 初始化配置');
        process.exit(1);
      }

      console.log(`打开编辑器: ${configPath}`);
      spawn(options.editor, [configPath], { stdio: 'inherit' });
    });
}

/**
 * 递归打印配置
 */
function printConfig(obj: any, prefix: string): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      console.log(`${fullKey}:`);
      printConfig(value, fullKey);
    } else {
      const valueStr = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
      console.log(`  ${fullKey} = ${valueStr}`);
    }
  }
}

/**
 * 获取嵌套值
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * 设置嵌套值
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop();

  if (!lastKey) return;

  let current = obj;
  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
}
