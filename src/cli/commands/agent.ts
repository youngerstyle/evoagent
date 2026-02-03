/**
 * Agent 相关 CLI 命令
 */

import { Command } from 'commander';
import type { LLMService } from '../../core/llm/types.js';

/**
 * 注册 Agent 命令
 */
export function registerAgentCommands(
  program: Command,
  llm: LLMService,
  evoagentDir: string = '.evoagent'
): void {
  const agentCmd = program.command('agent');

  // agent list
  agentCmd
    .command('list')
    .description('列出所有可用的 Agent 类型')
    .action(async () => {
      const agents = [
        { type: 'planner', description: '任务规划器，分析需求并生成执行计划' },
        { type: 'orchestrator', description: '编排器，协调多个专业 Agent 执行任务' },
        { type: 'codewriter', description: '代码编写器，编写和修改代码' },
        { type: 'tester', description: '测试器，编写和执行测试' },
        { type: 'reviewer', description: '审查器，进行代码审查' },
        { type: 'reflector', description: '反思器，分析执行结果并生成改进建议' }
      ];

      console.log('# 可用的 Agent 类型\n');

      for (const agent of agents) {
        console.log(`📦 ${agent.type}`);
        console.log(`   ${agent.description}`);
        console.log();
      }
    });

  // agent run <type> <input>
  agentCmd
    .command('run <type> <input>')
    .description('运行指定类型的 Agent')
    .option('-s, --session <id>', '会话 ID')
    .option('-w, --workspace <path>', '工作空间路径', process.cwd())
    .option('-m, --model <model>', 'LLM 模型')
    .option('--stream', '流式输出')
    .action(async (type, input, options) => {
      const { SessionStorage } = await import('../../memory/session/SessionStorage.js');
      const { v4: uuidv4 } = await import('uuid');

      const sessionId = options.session || uuidv4();
      const workspace = options.workspace || process.cwd();

      console.log(`运行 Agent: ${type}`);
      console.log(`会话: ${sessionId}`);
      console.log(`工作空间: ${workspace}`);
      console.log(`输入: ${input}`);
      console.log('---\n');

      try {
        // 初始化 SessionStorage
        const sessionStorage = new SessionStorage(`${evoagentDir}/sessions`);
        await sessionStorage.init();

        // 创建会话
        const existingSession = await sessionStorage.loadSession(sessionId);
        if (!existingSession) {
          await sessionStorage.createSession(sessionId);
        }

        // 记录任务开始
        await sessionStorage.append(sessionId, {
          type: 'agent.run.started',
          sessionId,
          timestamp: Date.now(),
          data: {
            agentType: type,
            input
          }
        });

        // 创建 Agent
        let agent;
        const agentConfig = {
          agentId: `agent-${Date.now()}`,
          description: `${type} agent`,
          model: {
            provider: 'anthropic' as const,
            model: options.model || 'claude-3-5-sonnet-20241022'
          },
          workspace,
          systemPrompt: '',
          tools: [],
          maxTokens: 8192,
          temperature: 0.3
        };

        switch (type) {
          case 'planner': {
            const { PlannerAgent } = await import('../../agent/planner/PlannerAgent.js');
            agent = new PlannerAgent(agentConfig, llm);
            break;
          }
          case 'orchestrator': {
            const { OrchestratorAgent } = await import('../../agent/orchestrator/OrchestratorAgent.js');
            agent = new OrchestratorAgent({
              systemPrompt: undefined,
              maxRetries: 3,
              retryDelay: 1000,
              enableParallel: false,
              timeout: 300000
            }, llm);
            break;
          }
          case 'codewriter': {
            const { CodeWriterAgent } = await import('../../agent/specialists/CodeWriterAgent.js');
            agent = new CodeWriterAgent(agentConfig, llm, new Map());
            break;
          }
          case 'tester': {
            const { TesterAgent } = await import('../../agent/specialists/TesterAgent.js');
            agent = new TesterAgent(agentConfig, llm);
            break;
          }
          case 'reviewer': {
            const { ReviewerAgent } = await import('../../agent/specialists/ReviewerAgent.js');
            agent = new ReviewerAgent(agentConfig, llm);
            break;
          }
          default:
            console.error(`❌ 未知的 Agent 类型: ${type}`);
            console.log('可用类型: planner, orchestrator, codewriter, tester, reviewer');
            process.exit(1);
        }

        // 添加事件监听器
        if (options.stream) {
          agent.addEventListener((event) => {
            if (event.type === 'progress') {
              console.log(`[进度] ${event.progress}%`);
            } else if (event.type === 'tool_call') {
              console.log(`[工具调用] ${event.tool}`);
            }
          });
        }

        // 运行 Agent
        const startTime = Date.now();
        const result = await agent.run({
          input,
          sessionId,
          metadata: { workspace }
        });
        const duration = Date.now() - startTime;

        // 记录任务完成
        await sessionStorage.append(sessionId, {
          type: result.success ? 'agent.run.completed' : 'agent.run.failed',
          sessionId,
          timestamp: Date.now(),
          data: {
            agentType: type,
            success: result.success,
            duration,
            output: result.output,
            error: result.error
          }
        });

        console.log('\n---');
        console.log(`状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
        console.log(`耗时: ${duration}ms`);

        if (result.artifacts && result.artifacts.length > 0) {
          console.log(`\n产物 (${result.artifacts.length}):`);
          for (const artifact of result.artifacts) {
            console.log(`  - ${artifact.type}: ${artifact.path}`);
          }
        }

        if (result.error) {
          console.error(`\n错误: ${result.error}`);
        }

        console.log(`\n输出:\n${result.output}`);

      } catch (error) {
        console.error('❌ Agent 运行失败:', error);
        process.exit(1);
      }
    });

  // agent status <runId>
  agentCmd
    .command('status <runId>')
    .description('查询 Agent 运行状态')
    .action(async (runId) => {
      // TODO: 实现运行状态查询
      // 需要一个全局的运行状态管理器
      console.log(`查询运行状态: ${runId}`);
      console.log('此功能尚未实现');
    });

  // agent cancel <runId>
  agentCmd
    .command('cancel <runId>')
    .description('取消正在运行的 Agent')
    .action(async (runId) => {
      // TODO: 实现运行取消
      console.log(`取消运行: ${runId}`);
      console.log('此功能尚未实现');
    });

  // agent history
  agentCmd
    .command('history')
    .description('查看 Agent 运行历史')
    .option('-t, --type <type>', '按 Agent 类型筛选')
    .option('-l, --limit <n>', '限制数量', '10')
    .action(async (options) => {
      const { SessionStorage } = await import('../../memory/session/SessionStorage.js');

      try {
        const sessionStorage = new SessionStorage(`${evoagentDir}/sessions`);
        await sessionStorage.init();

        const sessions = sessionStorage.listSessions();
        const limit = parseInt(options.limit);

        console.log(`# Agent 运行历史 (最近 ${limit} 条)\n`);

        let count = 0;
        for (const sessionMeta of sessions) {
          if (count >= limit) break;

          const session = await sessionStorage.loadSession(sessionMeta.sessionId);
          if (!session) continue;

          // 查找 agent.run 事件
          const runEvents = session.events.filter(e =>
            e.type.startsWith('agent.run.')
          );

          if (runEvents.length === 0) continue;

          for (const event of runEvents) {
            if (count >= limit) break;

            const agentType = event.data?.agentType as string;
            if (options.type && agentType !== options.type) continue;

            const timestamp = new Date(event.timestamp).toLocaleString('zh-CN');
            const statusIcon = event.type === 'agent.run.completed' ? '✅' : '❌';

            console.log(`${statusIcon} [${timestamp}] ${agentType}`);
            console.log(`   会话: ${sessionMeta.sessionId}`);

            if (event.data?.input) {
              const input = String(event.data.input);
              const preview = input.length > 50 ? input.slice(0, 50) + '...' : input;
              console.log(`   输入: ${preview}`);
            }

            if (event.data?.duration) {
              console.log(`   耗时: ${event.data.duration}ms`);
            }

            if (event.data?.error) {
              console.log(`   错误: ${event.data.error}`);
            }

            console.log();
            count++;
          }
        }

        if (count === 0) {
          console.log('没有找到运行历史');
        }

      } catch (error) {
        console.error('❌ 查询历史失败:', error);
        process.exit(1);
      }
    });
}
