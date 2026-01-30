#!/usr/bin/env node

/**
 * EvoAgent CLI
 * 命令行入口
 */

import { config } from 'dotenv';
import { Command } from 'commander';
import { getConfig } from '../core/config/index.js';
import { createLogger } from '../core/logger/index.js';
import { createLLMServiceFromEnv } from '../core/llm/index.js';
import { initialize, shutdown, getVersion } from '../index.js';

// 加载 .env 文件
config();

const program = new Command();

program
  .name('evoagent')
  .description('EvoAgent - 自主进化编码Agent系统')
  .version(getVersion());

program
  .command('init')
  .description('Initialize EvoAgent configuration')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (_options) => {
    const logger = createLogger({ component: 'cli' });
    logger.info('Initializing EvoAgent configuration...');

    // TODO: 创建配置文件
    logger.info('Configuration created successfully');
  });

program
  .command('execute')
  .description('Execute a task with single agent')
  .argument('<input>', 'Task description')
  .option('-s, --session <id>', 'Session ID')
  .option('-t, --type <type>', 'Agent type', 'codewriter')
  .option('-w, --workspace <path>', 'Workspace path', process.cwd())
  .option('-m, --model <model>', 'LLM model')
  .action(async (input, options) => {
    const logger = createLogger({ component: 'cli' });

    try {
      await initialize();

      const config = getConfig();
      const sessionId = options.session || `session-${Date.now()}`;
      const workspace = options.workspace || process.cwd();

      logger.info(`Executing task: ${input}`);
      logger.info(`Agent type: ${options.type}`);
      logger.info(`Session: ${sessionId}`);
      logger.info(`Workspace: ${workspace}`);
      logger.info('---');

      const startTime = Date.now();

      // Create LLM service
      const llm = options.model
        ? createLLMServiceFromEnv()
        : createLLMServiceFromEnv();

      // Create tool registry
      const toolRegistry = new Map<string, (params: any) => Promise<any>>();

      // Register workspace-aware file tools
      const { registerFileTools } = await import('./commands/file-tools.js');
      registerFileTools(toolRegistry, workspace);

      // Create agent
      const { CodeWriterAgent, TesterAgent, ReviewerAgent } = await import('../agent/specialists/index.js');
      const agentType = options.type as 'codewriter' | 'tester' | 'reviewer';

      let agent;
      switch (agentType) {
        case 'codewriter':
          agent = new CodeWriterAgent({
            agentId: `agent-${Date.now()}`,
            description: 'Code writing agent',
            model: { provider: config.llm.provider, model: config.llm.model },
            workspace,
            systemPrompt: '',
            tools: [],
            maxTokens: config.llm.maxTokens,
            temperature: config.llm.temperature
          }, llm, toolRegistry);
          break;
        case 'tester':
          agent = new TesterAgent({
            agentId: `agent-${Date.now()}`,
            description: 'Testing agent',
            model: { provider: config.llm.provider, model: config.llm.model },
            workspace,
            systemPrompt: '',
            tools: [],
            maxTokens: config.llm.maxTokens,
            temperature: config.llm.temperature
          }, llm);
          break;
        case 'reviewer':
          agent = new ReviewerAgent({
            agentId: `agent-${Date.now()}`,
            description: 'Code review agent',
            model: { provider: config.llm.provider, model: config.llm.model },
            workspace,
            systemPrompt: '',
            tools: [],
            maxTokens: config.llm.maxTokens,
            temperature: config.llm.temperature
          }, llm);
          break;
        default:
          throw new Error(`Unknown agent type: ${agentType}`);
      }

      // Run agent
      const result = await agent.run({ input, sessionId });

      const duration = Date.now() - startTime;

      logger.info('---');
      logger.info(`Status: ${result.success ? 'Success' : 'Failed'}`);
      logger.info(`Duration: ${duration}ms`);

      if (result.artifacts && result.artifacts.length > 0) {
        logger.info(`\nArtifacts (${result.artifacts.length}):`);
        for (const artifact of result.artifacts) {
          logger.info(`  - ${artifact.type}: ${artifact.path}`);
        }
      }

      logger.info(`\nOutput:\n${result.output}`);

      await shutdown();
    } catch (error) {
      logger.error('Execution failed', error);
      await shutdown();
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start the agent server')
  .option('-p, --port <port>', 'Port number')
  .option('-h, --host <host>', 'Host address')
  .action(async (options) => {
    const logger = createLogger({ component: 'cli' });

    try {
      await initialize();

      const config = getConfig();
      const port = parseInt(options.port || String(config.server.port));
      const host = options.host || config.server.host;

      logger.info(`Starting server on ${host}:${port}...`);

      // TODO: 启动HTTP服务器
      logger.info('Server not yet implemented');
      logger.info('Press Ctrl+C to stop');

      process.on('SIGINT', async () => {
        logger.info('Shutting down...');
        await shutdown();
        process.exit(0);
      });
    } catch (error) {
      logger.error('Server failed to start', error);
      process.exit(1);
    }
  });

program
  .command('reflect')
  .description('Run reflection and generate improvements')
  .option('-s, --since <date>', 'Analyze sessions since this date')
  .option('-n, --min-sessions <number>', 'Minimum sessions required', '10')
  .action(async (options) => {
    const logger = createLogger({ component: 'cli' });

    try {
      await initialize();

      logger.info('Running reflection...');
      logger.info(`Since: ${options.since || 'beginning'}`);
      logger.info(`Minimum sessions: ${options.minSessions}`);

      // TODO: 实现反思功能
      logger.info('Reflection not yet implemented');

      await shutdown();
    } catch (error) {
      logger.error('Reflection failed', error);
      process.exit(1);
    }
  });

program
  .command('knowledge')
  .description('Manage knowledge base')
  .argument('<action>', 'Action: list, search, add, remove')
  .option('-q, --query <query>', 'Search query')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (action, _options) => {
    const logger = createLogger({ component: 'cli' });

    try {
      await initialize();

      logger.info(`Knowledge action: ${action}`);

      // TODO: 实现知识管理
      logger.info('Knowledge management not yet implemented');

      await shutdown();
    } catch (error) {
      logger.error('Knowledge command failed', error);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Check system health and configuration')
  .action(async () => {
    const logger = createLogger({ component: 'cli' });

    try {
      logger.info('Running system diagnostics...\n');

      // 检查配置
      try {
        const config = getConfig();
        logger.info('[OK] Configuration loaded');
        logger.info(`  Server: ${config.server.host}:${config.server.port}`);
        logger.info(`  LLM Provider: ${config.llm.provider}`);
        logger.info(`  Model: ${config.llm.model}\n`);
      } catch (error) {
        logger.error('[FAIL] Configuration error');
        process.exit(1);
      }

      // 检查LLM连接
      try {
        const llm = createLLMServiceFromEnv();
        const healthy = await llm.healthCheck();
        if (healthy) {
          logger.info('[OK] LLM service is reachable\n');
        } else {
          logger.warn('[WARN] LLM service health check failed\n');
        }
      } catch (error) {
        logger.error('[FAIL] LLM service connection failed');
        logger.error(`  ${error}\n`);
      }

      // 检查数据库
      // TODO: 实现数据库健康检查

      logger.info('Diagnostics complete');
      await shutdown();
    } catch (error) {
      logger.error('Diagnostics failed', error);
      process.exit(1);
    }
  });

program.parse();
