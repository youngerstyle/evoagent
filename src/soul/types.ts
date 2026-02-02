/**
 * 灵魂系统类型定义
 *
 * SOUL.md 定义了 Agent 的"自我"——不是"做什么"的指令，而是"成为谁"的指导
 */

/**
 * 核心真理 - Agent 的价值观
 */
export interface CoreTruth {
  principle: string;    // 原则陈述
  description?: string; // 详细说明
}

/**
 * 边界 - Agent 的行为限制
 */
export interface Boundary {
  name: string;         // 边界名称
  rule: string;         // 具体规则
  enforcement: 'strict' | 'soft'; // 执行强度
}

/**
 * SOUL 结构
 */
export interface Soul {
  version: string;          // 版本号
  global: boolean;          // 是否为全局 SOUL
  agentType?: string;       // Agent 类型（全局 SOUL 为 null）
  coreTruths: CoreTruth[];  // 核心真理
  boundaries: Boundary[];    // 边界
  vibe: string;             // 氛围描述
  traits: string[];         // 人格特质标签
  createdAt: string;        // 创建时间
  updatedAt: string;        // 更新时间
}

/**
 * SOUL 进化记录
 */
export interface SoulEvolutionRecord {
  timestamp: string;
  version: string;
  changeType: 'reinforce' | 'adjust' | 'add' | 'refactor';
  description: string;
  reason: string;
  trigger: 'user_feedback' | 'failure' | 'success' | 'reflection';
  expected?: string;       // 预期效果
}

/**
 * SOUL 加载器接口
 */
export interface SoulLoader {
  loadGlobal(): Promise<Soul>;
  loadAgent(agentType: string): Promise<Soul | null>;
  loadEvolutionHistory(): Promise<SoulEvolutionRecord[]>;
  save(soul: Soul): Promise<Soul>;
}

/**
 * SOUL 反射器接口
 */
export interface SoulReflector {
  /**
   * 反思并更新 SOUL
   */
  reflect(context: SoulReflectionContext): Promise<SoulEvolutionRecord[]>;

  /**
   * 记录用户反馈
   */
  recordFeedback(feedback: UserFeedback): Promise<void>;

  /**
   * 分析行为模式，建议 SOUL 调整
   */
  analyzePatterns(history: ActionHistory[]): Promise<SoulAdjustment[]>;
}

/**
 * 反思上下文
 */
export interface SoulReflectionContext {
  agentType: string;
  sessionCount: number;
  recentSuccesses: number;
  recentFailures: number;
  userFeedbacks: UserFeedback[];
  timeSinceLastReflection: number; // 天数
}

/**
 * 用户反馈
 */
export interface UserFeedback {
  timestamp: string;
  type: 'positive' | 'negative' | 'neutral';
  category: 'style' | 'accuracy' | 'speed' | 'communication' | 'other';
  content: string;
  agentType?: string;
}

/**
 * 行为历史
 */
export interface ActionHistory {
  timestamp: string;
  agentType: string;
  action: string;
  result: 'success' | 'failure' | 'partial';
  duration: number;
  context?: Record<string, unknown>;
}

/**
 * SOUL 调整建议
 */
export interface SoulAdjustment {
  changeType: 'reinforce' | 'adjust' | 'add' | 'refactor';
  target: string;          // 目标：truth/boundary/trait
  currentValue?: string;   // 当前值
  suggestedValue: string;  // 建议值
  reason: string;          // 原因说明
  confidence: number;      // 置信度 0-1
}

/**
 * SOUL 注入器接口
 */
export interface SoulInjector {
  /**
   * 将 SOUL 注入到 System Prompt
   */
  injectToPrompt(agentType: string, basePrompt: string): Promise<string>;

  /**
   * 检查操作是否符合 SOUL 边界
   */
  checkBoundary(agentType: string, action: string): Promise<BoundaryCheck>;

  /**
   * 根据 SOUL 调整输出风格
   */
  adjustOutput(agentType: string, output: string): Promise<string>;
}

/**
 * 边界检查结果
 */
export interface BoundaryCheck {
  allowed: boolean;
  boundary?: Boundary;
  reason?: string;
  requiresConfirmation?: boolean;
}
