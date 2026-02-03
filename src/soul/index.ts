/**
 * 灵魂系统
 *
 * EvoAgent 的第四条进化轨道 - 灵魂进化
 * 定义 Agent 的价值观、边界和人格，并随时间进化
 */

export * from './types.js';
export * from './SoulLoader.js';
export * from './SoulReflector.js';
export * from './SoulInjector.js';

import { FileSoulLoader, CachedSoulLoader } from './SoulLoader.js';
import { createSoulReflector } from './SoulReflector.js';
import { createSoulInjector } from './SoulInjector.js';
import type {
  Soul,
  SoulLoader,
  SoulReflector,
  SoulInjector,
  SoulEvolutionRecord,
  UserFeedback
} from './types.js';
import type { Logger } from '../core/logger/index.js';
import type { LLMService } from '../core/llm/types.js';

/**
 * 灵魂系统主类
 */
export class SoulSystem {
  private loader: SoulLoader;
  private reflector: SoulReflector;
  private injector: SoulInjector;

  constructor(
    _llm: LLMService,
    logger: Logger,
    evoagentDir: string = '.evoagent'
  ) {
    const baseLoader = new FileSoulLoader(evoagentDir);
    this.loader = new CachedSoulLoader(baseLoader);
    this.reflector = createSoulReflector(this.loader, _llm, logger, evoagentDir);
    this.injector = createSoulInjector(this.loader, logger);
  }

  /**
   * 获取全局 SOUL
   */
  async getGlobalSoul(): Promise<Soul> {
    return this.loader.loadGlobal();
  }

  /**
   * 获取 Agent SOUL
   */
  async getAgentSoul(agentType: string): Promise<Soul | null> {
    return this.loader.loadAgent(agentType);
  }

  /**
   * 获取进化历史
   */
  async getEvolutionHistory(): Promise<SoulEvolutionRecord[]> {
    return this.loader.loadEvolutionHistory();
  }

  /**
   * 注入 SOUL 到 Prompt
   */
  async injectToPrompt(agentType: string, prompt: string): Promise<string> {
    return this.injector.injectToPrompt(agentType, prompt);
  }

  /**
   * 检查边界
   */
  async checkBoundary(agentType: string, action: string): Promise<boolean> {
    const check = await this.injector.checkBoundary(agentType, action);
    return check.allowed;
  }

  /**
   * 反思并进化 SOUL
   */
  async reflect(context: {
    agentType: string;
    sessionCount: number;
    recentSuccesses: number;
    recentFailures: number;
  }): Promise<SoulEvolutionRecord[]> {
    return this.reflector.reflect({
      ...context,
      userFeedbacks: [],
      timeSinceLastReflection: 0
    });
  }

  /**
   * 记录用户反馈
   */
  async recordFeedback(feedback: UserFeedback): Promise<void> {
    return this.reflector.recordFeedback(feedback);
  }

  /**
   * 重置 SOUL 为默认值
   */
  async resetSoul(agentType?: string): Promise<void> {
    if (agentType) {
      // 删除 Agent SOUL 文件
      const { unlink } = await import('fs/promises');
      const { join } = await import('path');
      const soulPath = join('.evoagent', 'agents', agentType.toLowerCase(), 'SOUL.md');
      try {
        await unlink(soulPath);
      } catch {
        // 文件不存在，忽略
      }
    } else {
      // 保存默认全局 SOUL
      const { FileSoulLoader } = await import('./SoulLoader.js');
      const defaultLoader = new FileSoulLoader('.evoagent');
      const defaultSoul = defaultLoader['getDefaultSoul']();
      if (defaultSoul) {
        await this.loader.save(defaultSoul);
      }
    }
  }

  /**
   * 对比两个 SOUL 的差异
   */
  async diffSouls(agent1?: string, agent2?: string): Promise<string> {
    const soul1 = agent1
      ? await this.getAgentSoul(agent1)
      : await this.getGlobalSoul();
    const soul2 = agent2
      ? await this.getAgentSoul(agent2)
      : agent1
        ? await this.getGlobalSoul()
        : null;

    if (!soul1 || !soul2) {
      return '❌ 找不到要对比的 SOUL';
    }

    const name1 = agent1 || 'global';
    const name2 = agent2 || 'global';

    let output = `## SOUL 对比: ${name1} vs ${name2}\n\n`;

    // 对比核心真理
    output += `### 核心真理\n`;
    const truths1 = new Set(soul1.coreTruths.map(t => t.principle));
    const truths2 = new Set(soul2.coreTruths.map(t => t.principle));

    const onlyIn1 = [...truths1].filter(t => !truths2.has(t));
    const onlyIn2 = [...truths2].filter(t => !truths1.has(t));
    const common = [...truths1].filter(t => truths2.has(t));

    if (common.length > 0) {
      output += `\n📌 共同 (${common.length}):\n`;
      common.forEach(t => output += `  - ${t}\n`);
    }
    if (onlyIn1.length > 0) {
      output += `\n🔵 仅 ${name1} (${onlyIn1.length}):\n`;
      onlyIn1.forEach(t => output += `  - ${t}\n`);
    }
    if (onlyIn2.length > 0) {
      output += `\n🟢 仅 ${name2} (${onlyIn2.length}):\n`;
      onlyIn2.forEach(t => output += `  - ${t}\n`);
    }

    // 对比边界
    output += `\n### 边界\n`;
    const bounds1 = new Set(soul1.boundaries.map(b => b.name));
    const bounds2 = new Set(soul2.boundaries.map(b => b.name));

    const boundsOnlyIn1 = [...bounds1].filter(b => !bounds2.has(b));
    const boundsOnlyIn2 = [...bounds2].filter(b => !bounds1.has(b));
    const boundsCommon = [...bounds1].filter(b => bounds2.has(b));

    if (boundsCommon.length > 0) {
      output += `\n📌 共同 (${boundsCommon.length}):\n`;
      boundsCommon.forEach(b => output += `  - ${b}\n`);
    }
    if (boundsOnlyIn1.length > 0) {
      output += `\n🔵 仅 ${name1} (${boundsOnlyIn1.length}):\n`;
      boundsOnlyIn1.forEach(b => output += `  - ${b}\n`);
    }
    if (boundsOnlyIn2.length > 0) {
      output += `\n🟢 仅 ${name2} (${boundsOnlyIn2.length}):\n`;
      boundsOnlyIn2.forEach(b => output += `  - ${b}\n`);
    }

    // 对比特质
    output += `\n### 特质\n`;
    const traits1 = new Set(soul1.traits);
    const traits2 = new Set(soul2.traits);

    const traitsOnlyIn1 = [...traits1].filter(t => !traits2.has(t));
    const traitsOnlyIn2 = [...traits2].filter(t => !traits1.has(t));
    const traitsCommon = [...traits1].filter(t => traits2.has(t));

    if (traitsCommon.length > 0) {
      output += `\n📌 共同 (${traitsCommon.length}):\n`;
      output += `  ${traitsCommon.join(' | ')}\n`;
    }
    if (traitsOnlyIn1.length > 0) {
      output += `\n🔵 仅 ${name1} (${traitsOnlyIn1.length}):\n`;
      output += `  ${traitsOnlyIn1.join(' | ')}\n`;
    }
    if (traitsOnlyIn2.length > 0) {
      output += `\n🟢 仅 ${name2} (${traitsOnlyIn2.length}):\n`;
      output += `  ${traitsOnlyIn2.join(' | ')}\n`;
    }

    return output;
  }
}
