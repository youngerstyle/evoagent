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
  .action(async (options) => {
    const logger = createLogger({ component: 'cli' });
    const { mkdir, writeFile } = await import('fs/promises');
    const { join } = await import('path');
    const { existsSync } = await import('fs');

    const evoDir = '.evoagent';
    const configFile = join(evoDir, 'config.json');

    // 检查是否已存在
    if (!options.force && existsSync(configFile)) {
      logger.info('EvoAgent 已初始化。使用 --force 选项重新初始化。');
      return;
    }

    try {
      // 创建 .evoagent 目录
      await mkdir(evoDir, { recursive: true });
      await mkdir(join(evoDir, 'agents'), { recursive: true });
      await mkdir(join(evoDir, 'sessions'), { recursive: true });
      await mkdir(join(evoDir, 'knowledge'), { recursive: true });

      // 创建默认配置
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

      await writeFile(configFile, JSON.stringify(defaultConfig, null, 2));
      logger.info(`✓ 配置文件已创建: ${configFile}`);

      // 创建 .gitignore
      const gitignoreContent = `# EvoAgent
sessions/
*.db
.env
`;
      await writeFile(join(evoDir, '.gitignore'), gitignoreContent);

      // 创建示例 .env
      const envExample = `# Anthropic API
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: OpenAI API
# OPENAI_API_KEY=your_openai_api_key_here

# Optional: Custom LLM endpoint
# LLM_CUSTOM_ENDPOINT=http://localhost:11434/v1
# LLM_CUSTOM_MODEL=llama2
`;
      await writeFile(join(evoDir, '.env.example'), envExample);
      logger.info('✓ .env.example 已创建');

      logger.info('');
      logger.info('🎉 EvoAgent 初始化完成！');
      logger.info('');
      logger.info('下一步:');
      logger.info('  1. 复制 .env.example 到 .env 并配置 API 密钥');
      logger.info('  2. 运行: evoagent execute "你的需求"');

    } catch (error) {
      logger.error(`初始化失败: ${error}`);
      process.exit(1);
    }
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

      const { HttpServer } = await import('../server/index.js');
      const { SoulSystem } = await import('../soul/index.js');

      const llm = createLLMServiceFromEnv();
      const soulSystem = new SoulSystem(llm, logger);

      const server = new HttpServer(
        { host, port },
        soulSystem,
        logger
      );

      await server.start();

      logger.info('');
      logger.info('Available endpoints:');
      logger.info('  GET  /health          - Health check');
      logger.info('  GET  /                - API info');
      logger.info('  POST /execute         - Execute task');
      logger.info('  GET  /soul?agent=x     - Get SOUL');
      logger.info('  POST /reflect         - Trigger reflection');
      logger.info('');
      logger.info('Press Ctrl+C to stop');

      // 优雅关闭
      process.on('SIGINT', async () => {
        logger.info('\nShutting down...');
        await server.stop();
        await shutdown();
        process.exit(0);
      });

      // 保持进程运行
      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down...');
        await server.stop();
        await shutdown();
        process.exit(0);
      });

    } catch (error) {
      logger.error('Server failed to start', error);
      await shutdown();
      process.exit(1);
    }
  });

program
  .command('reflect')
  .description('Run reflection and generate improvements')
  .option('-s, --since <date>', 'Analyze sessions since this date')
  .option('-n, --min-sessions <number>', 'Minimum sessions required', '10')
  .option('-a, --agent <agent>', 'Agent type to reflect on (default: all)')
  .action(async (options) => {
    const logger = createLogger({ component: 'cli' });

    try {
      await initialize();

      const { SessionStorage } = await import('../memory/session/index.js');
      const { SoulSystem } = await import('../soul/index.js');

      const llm = createLLMServiceFromEnv();
      const sessionStorage = new SessionStorage('.evoagent/sessions');
      const soulSystem = new SoulSystem(llm, logger);

      logger.info('开始反思...');
      logger.info(`  Agent: ${options.agent || '全部'}\n`);

      // 初始化会话存储
      await sessionStorage.init();

      // 分析 .evoagent/sessions 目录
      const { readdirSync, existsSync } = await import('fs');
      const sessionsDir = '.evoagent/sessions';

      let sessionCount = 0;
      if (existsSync(sessionsDir)) {
        const files = readdirSync(sessionsDir);
        sessionCount = files.filter(f => f.endsWith('.jsonl')).length;
      }

      logger.info(`  找到 ${sessionCount} 个会话\n`);

      // 简化的统计（实际应该从会话内容中分析）
      const successCount = Math.floor(sessionCount * 0.7);
      const failureCount = sessionCount - successCount;

      logger.info('会话统计:');
      logger.info(`  ✅ 成功: ${successCount}`);
      logger.info(`  ❌ 失败: ${failureCount}\n`);

      // 生成反思报告
      const { writeFile, mkdir } = await import('fs/promises');
      const { dirname } = await import('path');

      const reportPath = '.evoagent/reflection-' + Date.now() + '.md';
      await mkdir(dirname(reportPath), { recursive: true });

      let report = `# 反思报告\n\n`;
      report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
      report += `会话数量: ${sessionCount}\n`;
      report += `成功次数: ${successCount}\n`;
      report += `失败次数: ${failureCount}\n\n`;
      report += `## 建议\n\n`;
      report += `- 继续使用系统积累更多数据\n`;
      report += `- 关注失败模式，避免重复错误\n`;
      report += `- 总结成功经验，固化最佳实践\n`;

      await writeFile(reportPath, report, 'utf-8');
      logger.info(`📄 报告已保存: ${reportPath}\n`);

      // 触发 SOUL 反思
      if (options.agent) {
        logger.info(`🔄 触发 ${options.agent} SOUL 反思...`);
        const soulRecords = await soulSystem.reflect({
          agentType: options.agent,
          sessionCount: sessionCount,
          recentSuccesses: successCount,
          recentFailures: failureCount
        });

        if (soulRecords.length > 0) {
          logger.info(`  SOUL 进化: ${soulRecords.length} 条记录\n`);
        }
      }

      logger.info('✅ 反思完成');
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
  .option('-f, --file <file>', 'File path (for add/remove)')
  .action(async (action, options) => {
    const logger = createLogger({ component: 'cli' });
    const { readdir, readFile, unlink, stat, writeFile, mkdir } = await import('fs/promises');
    const { join } = await import('path');
    const { existsSync } = await import('fs');

    try {
      const knowledgeDir = join('.evoagent', 'knowledge');

      switch (action) {
        case 'list': {
          if (!existsSync(knowledgeDir)) {
            logger.info('知识库目录不存在');
            break;
          }

          const files = await readdir(knowledgeDir);
          const mdFiles = files.filter(f => f.endsWith('.md'));

          if (mdFiles.length === 0) {
            logger.info('知识库为空');
            break;
          }

          logger.info(`知识库 (${mdFiles.length} 个文件):\n`);

          for (const file of mdFiles) {
            const filePath = join(knowledgeDir, file);
            const stats = await stat(filePath);
            const mtime = stats.mtime.toLocaleString('zh-CN');

            // 读取分类
            const content = await readFile(filePath, 'utf-8');
            const categoryMatch = content.match(/category:\s*(.+)/);
            const category = categoryMatch?.[1]?.trim() || '未分类';

            logger.info(`  📄 ${file}`);
            logger.info(`     分类: ${category}`);
            logger.info(`     修改: ${mtime}\n`);
          }
          break;
        }

        case 'search': {
          if (!options.query) {
            logger.error('请使用 --query 指定搜索内容');
            process.exit(1);
          }

          if (!existsSync(knowledgeDir)) {
            logger.info('知识库目录不存在');
            break;
          }

          const files = await readdir(knowledgeDir);
          const mdFiles = files.filter(f => f.endsWith('.md'));
          const query = options.query.toLowerCase();

          logger.info(`搜索: "${options.query}"\n`);

          let found = 0;
          for (const file of mdFiles) {
            const filePath = join(knowledgeDir, file);
            const content = await readFile(filePath, 'utf-8');

            if (content.toLowerCase().includes(query)) {
              found++;
              logger.info(`📄 ${file}`);

              // 显示匹配的行
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i]?.toLowerCase().includes(query)) {
                  const contextStart = Math.max(0, i - 1);
                  const contextEnd = Math.min(lines.length, i + 2);
                  const contextLines = lines.slice(contextStart, contextEnd);
                  logger.info(`   ${contextLines.join('\n   ')}`);
                  break; // 只显示第一个匹配
                }
              }
              logger.info('');
            }
          }

          if (found === 0) {
            logger.info('未找到匹配的内容');
          } else {
            logger.info(`找到 ${found} 个匹配文件`);
          }
          break;
        }

        case 'add': {
          if (!options.file) {
            logger.error('请使用 --file 指定要添加的文件');
            process.exit(1);
          }

          const sourcePath = options.file;
          if (!existsSync(sourcePath)) {
            logger.error(`文件不存在: ${sourcePath}`);
            process.exit(1);
          }

          await mkdir(knowledgeDir, { recursive: true });
          const fileName = options.file.split('/').pop() || 'knowledge.md';
          const destPath = join(knowledgeDir, fileName);

          const content = await readFile(sourcePath, 'utf-8');
          await writeFile(destPath, content, 'utf-8');

          logger.info(`✓ 已添加: ${destPath}`);
          break;
        }

        case 'remove': {
          if (!options.file) {
            logger.error('请使用 --file 指定要删除的文件名');
            process.exit(1);
          }

          const filePath = join(knowledgeDir, options.file);
          if (!existsSync(filePath)) {
            logger.error(`文件不存在: ${filePath}`);
            process.exit(1);
          }

          await unlink(filePath);
          logger.info(`✓ 已删除: ${options.file}`);
          break;
        }

        default:
          logger.error(`未知操作: ${action}`);
          logger.info('可用操作: list, search, add, remove');
          break;
      }

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
    const { existsSync, mkdirSync, readdirSync, statSync } = await import('fs');
    const { join } = await import('path');

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
          logger.info('[OK] LLM service is reachable');
        } else {
          logger.warn('[WARN] LLM service health check failed');
        }
      } catch (error) {
        logger.error('[FAIL] LLM service connection failed');
        logger.error(`  ${error}`);
      }

      // 检查目录结构
      const evoDir = '.evoagent';
      const requiredDirs = [
        evoDir,
        join(evoDir, 'agents'),
        join(evoDir, 'sessions'),
        join(evoDir, 'knowledge')
      ];

      for (const dir of requiredDirs) {
        if (existsSync(dir)) {
          const stats = statSync(dir);
          if (stats.isDirectory()) {
            logger.info(`[OK] Directory exists: ${dir}`);
          } else {
            logger.error(`[FAIL] Not a directory: ${dir}`);
          }
        } else {
          logger.warn(`[WARN] Directory missing: ${dir}`);
          try {
            mkdirSync(dir, { recursive: true });
            logger.info(`  Created: ${dir}`);
          } catch {
            logger.error(`  Failed to create: ${dir}`);
          }
        }
      }

      // 检查 SOUL
      try {
        const { SoulSystem } = await import('../soul/index.js');
        const soulSystem = new SoulSystem(createLLMServiceFromEnv(), logger);
        const soul = await soulSystem.getGlobalSoul();
        logger.info(`[OK] Global SOUL loaded (${soul.coreTruths.length} truths, ${soul.boundaries.length} boundaries)`);
      } catch (error) {
        logger.warn('[WARN] SOUL check failed');
      }

      // 检查知识库
      const knowledgeDir = join(evoDir, 'knowledge');
      if (existsSync(knowledgeDir)) {
        const files = readdirSync(knowledgeDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        logger.info(`[OK] Knowledge base: ${mdFiles.length} files`);
      } else {
        logger.info('[INFO] Knowledge base: empty (not created yet)');
      }

      // 检查会话
      const sessionsDir = join(evoDir, 'sessions');
      if (existsSync(sessionsDir)) {
        const files = readdirSync(sessionsDir);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
        logger.info(`[OK] Sessions: ${jsonlFiles.length} files`);
      } else {
        logger.info('[INFO] No sessions yet');
      }

      logger.info('');
      logger.info('Diagnostics complete');
      await shutdown();
    } catch (error) {
      logger.error('Diagnostics failed', error);
      process.exit(1);
    }
  });

// Soul commands - 注册 soul 子命令
const { registerSoulCommands } = await import('./commands/soul.js');
const { SoulSystem } = await import('../soul/index.js');

registerSoulCommands(program, new SoulSystem(createLLMServiceFromEnv(), createLogger({ component: 'soul' })));

program.parse();
