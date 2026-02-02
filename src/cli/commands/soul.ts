/**
 * SOUL 相关 CLI 命令
 */

import { Command } from 'commander';
import { join } from 'path';
import type { SoulSystem } from '../../soul/index.js';

/**
 * 注册 SOUL 命令
 */
export function registerSoulCommands(
  program: Command,
  soulSystem: SoulSystem,
  evoagentDir: string = '.evoagent'
): void {
  const soulCmd = program.command('soul');

  // soul show [agent]
  soulCmd
    .command('show [agent]')
    .description('显示 SOUL 内容')
    .action(async (agentType) => {
      if (agentType) {
        const soul = await soulSystem.getAgentSoul(agentType);
        if (!soul) {
          console.log(`未找到 ${agentType} 的 SOUL`);
          return;
        }
        console.log(`# ${agentType} SOUL\n`);
        console.log(`版本: ${soul.version}`);
        console.log(`特质: ${soul.traits.join('、') || '无'}\n`);
        console.log('### 核心真理');
        soul.coreTruths.forEach(t => {
          console.log(`- **${t.principle}** ${t.description || ''}`);
        });
        console.log('\n### 边界');
        soul.boundaries.forEach(b => {
          console.log(`- **${b.name}**：${b.rule} (${b.enforcement})`);
        });
        console.log(`\n### 氛围`);
        console.log(soul.vibe || '无');
      } else {
        const soul = await soulSystem.getGlobalSoul();
        console.log(`# EvoAgent 全局 SOUL\n`);
        console.log(`版本: ${soul.version}`);
        console.log(`创建时间: ${soul.createdAt}`);
        console.log(`更新时间: ${soul.updatedAt}\n`);
        console.log('### 核心真理');
        soul.coreTruths.forEach(t => {
          console.log(`- **${t.principle}** ${t.description || ''}`);
        });
        console.log('\n### 边界');
        soul.boundaries.forEach(b => {
          console.log(`- **${b.name}**：${b.rule} (${b.enforcement})`);
        });
        console.log(`\n### 氛围`);
        console.log(soul.vibe);
      }
    });

  // soul list
  soulCmd
    .command('list')
    .description('列出所有 Agent 的 SOUL')
    .action(async () => {
      const agents = ['planner', 'codewriter', 'tester', 'reviewer', 'orchestrator', 'reflector'];
      console.log('可用的 SOUL：');
      console.log('  [全局] global');
      for (const agent of agents) {
        const soul = await soulSystem.getAgentSoul(agent);
        if (soul) {
          console.log(`  [✓] ${agent} - ${soul.traits.join('、')}`);
        } else {
          console.log(`  [✗] ${agent} - 未配置`);
        }
      }
    });

  // soul history [agent]
  soulCmd
    .command('history [agent]')
    .description('查看 SOUL 进化历史')
    .action(async (_agentType) => {
      const history = await soulSystem.getEvolutionHistory();
      if (history.length === 0) {
        console.log('暂无进化记录');
        return;
      }
      console.log(`# SOUL 进化历史 (${history.length} 条记录)\n`);
      for (const record of history) {
        console.log(`### ${record.timestamp} - ${record.description}`);
        console.log(`   类型: ${record.changeType} | 触发: ${record.trigger}`);
        console.log(`   原因: ${record.reason}`);
        if (record.expected) {
          console.log(`   预期: ${record.expected}`);
        }
        console.log();
      }
    });

  // soul edit [agent]
  soulCmd
    .command('edit [agent]')
    .description('编辑 SOUL（打开编辑器）')
    .option('-e, --editor <editor>', '编辑器', 'code')
    .action(async (agentType, options) => {
      const { spawn } = await import('child_process');

      if (agentType) {
        const soulPath = join(evoagentDir, 'agents', agentType.toLowerCase(), 'SOUL.md');
        console.log(`打开编辑器: ${soulPath}`);
        spawn(options.editor, [soulPath], { stdio: 'inherit' });
      } else {
        const soulPath = join(evoagentDir, 'SOUL.md');
        console.log(`打开编辑器: ${soulPath}`);
        spawn(options.editor, [soulPath], { stdio: 'inherit' });
      }
    });

  // soul reset [agent]
  soulCmd
    .command('reset [agent]')
    .description('重置 SOUL 为默认值')
    .option('-f, --force', '强制重置，不询问')
    .action(async (_agent, _options) => {
      console.warn('此操作将重置 SOUL 为默认值。');
      // TODO: 实现重置逻辑
      console.log('SOUL 重置功能待实现');
    });

  // soul diff [agent1] [agent2]
  soulCmd
    .command('diff [agent1] [agent2]')
    .description('对比两个 SOUL 的差异')
    .action(async () => {
      // TODO: 实现对比逻辑
      console.log('SOUL 对比功能待实现');
    });

  // soul feedback
  soulCmd
    .command('feedback <agent>')
    .description('记录对 Agent 的反馈')
    .requiredOption('-t, --type <type>', '反馈类型: positive | negative | neutral')
    .option('-c, --category <category>', '类别: style | accuracy | speed | communication | other')
    .option('-m, --message <message>', '反馈内容')
    .action(async (agent, options) => {
      const feedback = {
        timestamp: new Date().toISOString(),
        type: options.type as 'positive' | 'negative' | 'neutral',
        category: options.category || 'other',
        content: options.message || '',
        agentType: agent
      };

      await soulSystem.recordFeedback(feedback);
      console.log('✓ 反馈已记录');
      console.log(`  Agent: ${agent}`);
      console.log(`  类型: ${feedback.type}`);
      console.log(`  内容: ${feedback.content}`);
    });

  // soul reflect
  soulCmd
    .command('reflect <agent>')
    .description('触发 SOUL 反思和进化')
    .option('--sessions <n>', '会话数量', '10')
    .option('--success <n>', '成功次数', '0')
    .option('--failures <n>', '失败次数', '0')
    .action(async (agent, options) => {
      console.log(`触发 ${agent} 的 SOUL 反思...`);

      const records = await soulSystem.reflect({
        agentType: agent,
        sessionCount: parseInt(options.sessions),
        recentSuccesses: parseInt(options.success),
        recentFailures: parseInt(options.failures)
      });

      if (records.length === 0) {
        console.log('SOUL 无需调整');
        return;
      }

      console.log(`\n生成了 ${records.length} 条进化记录：`);
      for (const record of records) {
        console.log(`\n- ${record.description}`);
        console.log(`  原因: ${record.reason}`);
        console.log(`  类型: ${record.changeType}`);
      }

      console.log('\n✓ SOUL 反思完成');
    });
}

/**
 * 格式化 SOUL 显示
 */
export function formatSoulTable(soul: {
  version: string;
  traits: string[];
  coreTruths: { principle: string; description?: string }[];
  boundaries: { name: string; rule: string }[];
  vibe: string;
}): string {
  const lines = [
    `版本: ${soul.version}`,
    `特质: ${soul.traits.join('、') || '无'}`,
    '',
    '核心真理:',
    ...soul.coreTruths.map(t => `  - ${t.principle}: ${t.description || ''}`),
    '',
    '边界:',
    ...soul.boundaries.map(b => `  - ${b.name}: ${b.rule}`),
    '',
    `氛围: ${soul.vibe}`
  ];
  return lines.join('\n');
}
