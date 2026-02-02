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
}
