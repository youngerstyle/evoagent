/**
 * Prompt 优化器
 *
 * 负责 Prompt 的版本管理、性能跟踪、A/B 测试和自动优化
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import { getLogger } from '../../core/logger/index.js';
import type { LLMService } from '../../core/llm/types.js';
import type {
  PromptVersion,
  PromptMetrics,
  ABTestConfig,
  PromptAnalysis,
  PromptOptimizationSuggestion,
  PromptOptimizerConfig,
  PromptIndex
} from './PromptTypes.js';

const logger = getLogger('evolution:prompts:optimizer');

/**
 * Prompt 优化器
 */
export class PromptOptimizer {
  private config: PromptOptimizerConfig;
  private index: PromptIndex | null = null;
  private metrics: Map<string, PromptMetrics> = new Map();
  private abTests: Map<string, ABTestConfig> = new Map();

  constructor(
    private readonly llm: LLMService,
    config: Partial<PromptOptimizerConfig> = {}
  ) {
    this.config = {
      storageDir: config.storageDir || '.evoagent/prompts',
      enableABTesting: config.enableABTesting ?? true,
      minSamplesForOptimization: config.minSamplesForOptimization || 10,
      optimizationInterval: config.optimizationInterval || 86400000, // 24小时
      autoApplyThreshold: config.autoApplyThreshold || 0.15 // 15%提升
    };
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    await fs.mkdir(this.config.storageDir, { recursive: true });
    await fs.mkdir(join(this.config.storageDir, 'versions'), { recursive: true });
    await fs.mkdir(join(this.config.storageDir, 'metrics'), { recursive: true });
    await fs.mkdir(join(this.config.storageDir, 'abtests'), { recursive: true });

    await this.loadIndex();
    logger.info('PromptOptimizer initialized');
  }

  /**
   * 保存 Prompt 版本
   */
  async savePromptVersion(version: PromptVersion): Promise<void> {
    const versionPath = join(
      this.config.storageDir,
      'versions',
      `${version.agentType}-v${version.version}.json`
    );

    await fs.writeFile(versionPath, JSON.stringify(version, null, 2), 'utf-8');

    // 更新索引
    await this.updateIndex(version.agentType, version.version);

    logger.info(`Saved prompt version: ${version.agentType} v${version.version}`);
  }

  /**
   * 获取 Prompt 版本
   */
  async getPromptVersion(agentType: string, version?: number): Promise<PromptVersion | null> {
    if (!this.index) {
      await this.loadIndex();
    }

    const agentPrompts = this.index?.prompts[agentType];
    if (!agentPrompts) {
      return null;
    }

    const targetVersion = version ?? agentPrompts.currentVersion;
    const versionPath = join(
      this.config.storageDir,
      'versions',
      `${agentType}-v${targetVersion}.json`
    );

    if (!existsSync(versionPath)) {
      return null;
    }

    const content = await fs.readFile(versionPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 获取当前 Prompt
   */
  async getCurrentPrompt(agentType: string): Promise<string | null> {
    const version = await this.getPromptVersion(agentType);
    return version?.content || null;
  }

  /**
   * 记录 Prompt 使用
   */
  async recordUsage(
    agentType: string,
    version: number,
    success: boolean,
    latency: number,
    tokens: number
  ): Promise<void> {
    const key = `${agentType}-v${version}`;
    let metrics = this.metrics.get(key);

    if (!metrics) {
      metrics = {
        promptId: agentType,
        version,
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        averageLatency: 0,
        averageTokens: 0,
        successRate: 0,
        lastUsed: new Date().toISOString()
      };
    }

    // 更新指标
    metrics.usageCount++;
    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }

    // 计算移动平均
    metrics.averageLatency = (metrics.averageLatency * (metrics.usageCount - 1) + latency) / metrics.usageCount;
    metrics.averageTokens = (metrics.averageTokens * (metrics.usageCount - 1) + tokens) / metrics.usageCount;
    metrics.successRate = metrics.successCount / metrics.usageCount;
    metrics.lastUsed = new Date().toISOString();

    this.metrics.set(key, metrics);

    // 定期保存指标
    if (metrics.usageCount % 10 === 0) {
      await this.saveMetrics(key, metrics);
    }
  }

  /**
   * 分析 Prompt
   */
  async analyzePrompt(agentType: string, version?: number): Promise<PromptAnalysis> {
    const promptVersion = await this.getPromptVersion(agentType, version);
    if (!promptVersion) {
      throw new Error(`Prompt not found: ${agentType} v${version}`);
    }

    const content = promptVersion.content;

    // 基础复杂度分析
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const tokenCount = words.length; // 简化估算

    const complexity = {
      tokenCount,
      sentenceCount: sentences.length,
      avgSentenceLength: words.length / Math.max(sentences.length, 1),
      readabilityScore: this.calculateReadability(content)
    };

    // 使用 LLM 分析 Prompt 质量
    const suggestions = await this.generateSuggestions(content);

    // 计算总分
    const score = this.calculatePromptScore(complexity, suggestions);

    return {
      promptId: agentType,
      version: promptVersion.version,
      score,
      strengths: this.identifyStrengths(content),
      weaknesses: suggestions.filter(s => s.severity === 'high').map(s => s.description),
      suggestions,
      complexity
    };
  }

  /**
   * 优化 Prompt
   */
  async optimizePrompt(agentType: string): Promise<PromptVersion | null> {
    const currentVersion = await this.getPromptVersion(agentType);
    if (!currentVersion) {
      logger.warn(`No current prompt found for ${agentType}`);
      return null;
    }

    // 检查是否有足够的样本
    const key = `${agentType}-v${currentVersion.version}`;
    const metrics = this.metrics.get(key);
    if (!metrics || metrics.usageCount < this.config.minSamplesForOptimization) {
      logger.info(`Not enough samples for optimization: ${metrics?.usageCount || 0}/${this.config.minSamplesForOptimization}`);
      return null;
    }

    // 分析当前 Prompt
    const analysis = await this.analyzePrompt(agentType);

    // 如果分数已经很高，不需要优化
    if (analysis.score >= 85) {
      logger.info(`Prompt already optimized: score ${analysis.score}`);
      return null;
    }

    // 使用 LLM 生成优化版本
    const optimizedContent = await this.generateOptimizedPrompt(
      currentVersion.content,
      analysis.suggestions
    );

    // 创建新版本
    const newVersion: PromptVersion = {
      id: `${agentType}-v${currentVersion.version + 1}`,
      agentType,
      version: currentVersion.version + 1,
      content: optimizedContent,
      createdAt: new Date().toISOString(),
      createdBy: 'evolution',
      metadata: {
        description: 'Auto-optimized version',
        parentVersion: currentVersion.id,
        changeReason: `Applied ${analysis.suggestions.length} optimization suggestions`,
        tags: ['optimized', 'auto-generated']
      }
    };

    await this.savePromptVersion(newVersion);

    logger.info(`Created optimized prompt: ${agentType} v${newVersion.version}`);
    return newVersion;
  }

  /**
   * 创建 A/B 测试
   */
  async createABTest(config: Omit<ABTestConfig, 'id' | 'status' | 'metrics'>): Promise<ABTestConfig> {
    const abTest: ABTestConfig = {
      ...config,
      id: `ab-${Date.now()}`,
      status: 'draft',
      metrics: {}
    };

    // 初始化每个变体的指标
    for (const variant of abTest.variants) {
      abTest.metrics[variant.id] = {
        promptId: abTest.agentType,
        version: variant.promptVersion,
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        averageLatency: 0,
        averageTokens: 0,
        successRate: 0,
        lastUsed: new Date().toISOString()
      };
    }

    this.abTests.set(abTest.id, abTest);
    await this.saveABTest(abTest);

    logger.info(`Created A/B test: ${abTest.id} for ${abTest.agentType}`);
    return abTest;
  }

  /**
   * 启动 A/B 测试
   */
  async startABTest(testId: string): Promise<void> {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    test.status = 'running';
    test.startTime = new Date().toISOString();

    await this.saveABTest(test);
    logger.info(`Started A/B test: ${testId}`);
  }

  /**
   * 选择 A/B 测试变体
   */
  selectABTestVariant(testId: string): number | null {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'running') {
      return null;
    }

    // 根据权重随机选择
    const random = Math.random();
    let cumulative = 0;

    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant.promptVersion;
      }
    }

    return test.variants[0]?.promptVersion || null;
  }

  /**
   * 生成优化建议
   */
  private async generateSuggestions(content: string): Promise<PromptOptimizationSuggestion[]> {
    try {
      const response = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: 'You are a prompt engineering expert. Analyze the given prompt and provide specific optimization suggestions.'
          },
          {
            role: 'user',
            content: `Analyze this prompt and provide 3-5 specific optimization suggestions:\n\n${content}`
          }
        ],
        temperature: 0.3,
        maxTokens: 1000
      });

      // 解析 LLM 响应为建议列表
      return this.parseSuggestions(response.content);
    } catch (error) {
      logger.error('Failed to generate suggestions:', error);
      return [];
    }
  }

  /**
   * 生成优化后的 Prompt
   */
  private async generateOptimizedPrompt(
    original: string,
    suggestions: PromptOptimizationSuggestion[]
  ): Promise<string> {
    const suggestionsText = suggestions
      .map((s, i) => `${i + 1}. [${s.type}] ${s.description}`)
      .join('\n');

    const response = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: 'You are a prompt engineering expert. Optimize the given prompt based on the suggestions provided.'
        },
        {
          role: 'user',
          content: `Original prompt:\n${original}\n\nSuggestions:\n${suggestionsText}\n\nProvide an optimized version:`
        }
      ],
      temperature: 0.3,
      maxTokens: 2000
    });

    return response.content;
  }

  /**
   * 解析建议
   */
  private parseSuggestions(content: string): PromptOptimizationSuggestion[] {
    // 简化实现：从文本中提取建议
    const suggestions: PromptOptimizationSuggestion[] = [];
    const lines = content.split('\n').filter(l => l.trim().length > 0);

    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        suggestions.push({
          type: 'clarity',
          severity: 'medium',
          description: line.replace(/^\d+\.\s*/, ''),
          reasoning: 'LLM suggestion'
        });
      }
    }

    return suggestions;
  }

  /**
   * 计算可读性分数
   */
  private calculateReadability(content: string): number {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);

    // Flesch Reading Ease
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const avgSyllablesPerWord = syllables / Math.max(words.length, 1);

    const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 计算音节数（简化）
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    const vowels = word.match(/[aeiouy]+/g);
    return vowels ? vowels.length : 1;
  }

  /**
   * 计算 Prompt 分数
   */
  private calculatePromptScore(
    complexity: PromptAnalysis['complexity'],
    suggestions: PromptOptimizationSuggestion[]
  ): number {
    let score = 100;

    // 根据建议严重程度扣分
    for (const suggestion of suggestions) {
      if (suggestion.severity === 'high') score -= 15;
      else if (suggestion.severity === 'medium') score -= 10;
      else score -= 5;
    }

    // 根据复杂度调整
    if (complexity.avgSentenceLength > 30) score -= 10;
    if (complexity.readabilityScore < 50) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 识别优势
   */
  private identifyStrengths(content: string): string[] {
    const strengths: string[] = [];

    if (content.includes('step by step') || content.includes('步骤')) {
      strengths.push('Clear step-by-step instructions');
    }
    if (content.includes('example') || content.includes('示例')) {
      strengths.push('Includes examples');
    }
    if (content.length > 500) {
      strengths.push('Comprehensive and detailed');
    }

    return strengths;
  }

  /**
   * 保存指标
   */
  private async saveMetrics(key: string, metrics: PromptMetrics): Promise<void> {
    const metricsPath = join(this.config.storageDir, 'metrics', `${key}.json`);
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');
  }

  /**
   * 保存 A/B 测试
   */
  private async saveABTest(test: ABTestConfig): Promise<void> {
    const testPath = join(this.config.storageDir, 'abtests', `${test.id}.json`);
    await fs.writeFile(testPath, JSON.stringify(test, null, 2), 'utf-8');
  }

  /**
   * 加载索引
   */
  private async loadIndex(): Promise<void> {
    const indexPath = join(this.config.storageDir, 'index.json');

    if (existsSync(indexPath)) {
      const content = await fs.readFile(indexPath, 'utf-8');
      this.index = JSON.parse(content);
    } else {
      this.index = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        prompts: {}
      };
      await this.saveIndex();
    }
  }

  /**
   * 保存索引
   */
  private async saveIndex(): Promise<void> {
    if (!this.index) return;

    const indexPath = join(this.config.storageDir, 'index.json');
    this.index.lastUpdated = new Date().toISOString();
    await fs.writeFile(indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
  }

  /**
   * 更新索引
   */
  private async updateIndex(agentType: string, version: number): Promise<void> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index!.prompts[agentType]) {
      this.index!.prompts[agentType] = {
        currentVersion: version,
        versions: [version],
        abTests: []
      };
    } else {
      const agentPrompts = this.index!.prompts[agentType];
      if (!agentPrompts.versions.includes(version)) {
        agentPrompts.versions.push(version);
      }
      agentPrompts.currentVersion = version;
    }

    await this.saveIndex();
  }
}
