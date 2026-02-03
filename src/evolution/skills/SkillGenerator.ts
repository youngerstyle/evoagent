/**
 * Skill Generator - 技能生成器
 *
 * 从模式候选生成技能定义
 */

import { getLogger } from '../../core/logger/index.js';
import type { LLMService } from '../../core/llm/types.js';
import type {
  Skill,
  PatternCandidate,
  SkillGenerationParams,
  SkillMetadata
} from './SkillTypes.js';

const logger = getLogger('evolution:skills:generator');

/**
 * 技能生成器
 */
export class SkillGenerator {
  constructor(
    private readonly llm: LLMService
  ) {}

  /**
   * 从模式候选生成技能
   */
  async generateSkill(params: SkillGenerationParams): Promise<Skill> {
    logger.info(`Generating skill for pattern: ${params.patternName}`);

    // 分析候选，提取共同特征
    const analysis = this.analyzeCandidates(params.candidates);

    // 使用 LLM 生成技能定义
    const skillDefinition = await this.generateWithLLM(params.patternName, analysis, params);

    // 构建技能对象
    const skill: Skill = {
      metadata: this.buildMetadata(params.patternName, skillDefinition, params),
      content: skillDefinition.description || '',
      templates: new Map(
        Object.entries(skillDefinition.templates || {}).map(([name, content]) => [
          name,
          {
            id: name,
            name,
            content,
            parameters: this.extractTemplateParameters(content)
          }
        ])
      ),
      tests: new Map(Object.entries(skillDefinition.tests || {}))
    };

    logger.info(`Generated skill: ${skill.metadata.name}`);
    return skill;
  }

  /**
   * 批量生成技能
   */
  async generateSkillsBatch(
    patterns: Array<{ patternName: string; candidates: PatternCandidate[] }>,
    agentType: string
  ): Promise<Skill[]> {
    const skills: Skill[] = [];

    for (const { patternName, candidates } of patterns) {
      try {
        const skill = await this.generateSkill({
          patternName,
          candidates,
          agentType
        });
        skills.push(skill);
      } catch (error) {
        logger.error(`Failed to generate skill for ${patternName}`, { error });
      }
    }

    return skills;
  }

  /**
   * 分析模式候选
   */
  private analyzeCandidates(candidates: PatternCandidate[]): {
    commonSnippet: string;
    variance: number;
    uniqueSessions: number;
    agentTypes: string[];
    contextSummary: string;
  } {
    // 提取共同代码片段
    const snippets = candidates.map(c => c.snippet);
    const commonSnippet = this.findCommonPattern(snippets);

    // 计算方差（片段长度的差异）
    const lengths = snippets.map(s => s.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;

    // 唯一会话数
    const uniqueSessions = new Set(candidates.map(c => c.sessionId)).size;

    // 涉及的 Agent 类型
    const agentTypesList = candidates.map(c => c.agentType).filter(Boolean) as string[];
    const agentTypes = Array.from(new Set(agentTypesList));

    // 上下文摘要
    const contextSummary = candidates
      .filter(c => c.context)
      .map(c => c.context!)
      .join('\n')
      .slice(0, 500);

    return {
      commonSnippet,
      variance,
      uniqueSessions,
      agentTypes: agentTypes || [],
      contextSummary
    };
  }

  /**
   * 使用 LLM 生成技能定义
   */
  private async generateWithLLM(
    patternName: string,
    analysis: {
      commonSnippet: string;
      variance: number;
      uniqueSessions: number;
      agentTypes: string[];
      contextSummary: string;
    },
    params: SkillGenerationParams
  ): Promise<{
    description: string;
    scenarios: string;
    conditions: string;
    templates: Record<string, string>;
    tests: Record<string, string>;
    tags: string[];
  }> {
    const prompt = this.buildGenerationPrompt(patternName, analysis, params);

    const response = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt()
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      maxTokens: 4000
    });

    // 解析响应
    return this.parseLLMResponse(response.content);
  }

  /**
   * 构建生成提示词
   */
  private buildGenerationPrompt(
    patternName: string,
    analysis: {
      commonSnippet: string;
      variance: number;
      uniqueSessions: number;
      agentTypes: string[];
      contextSummary: string;
    },
    params: SkillGenerationParams
  ): string {
    return `请分析以下代码模式，生成一个可重用的技能定义：

## 模式名称
${patternName}

## 代码样本
${analysis.commonSnippet}

## 分析数据
- 出现次数: ${params.candidates.length}
- 唯一会话数: ${analysis.uniqueSessions}
- 代码方差: ${analysis.variance.toFixed(2)}
- 涉及的 Agent: ${analysis.agentTypes.join(', ') || '无'}

## 上下文
${analysis.contextSummary || '无额外上下文'}

## 要求
1. 生成一个清晰的技能描述
2. 列出适用场景
3. 列出使用条件
4. 提供代码模板（如果有参数，用 {{ParameterName}} 格式）
5. 提供测试用例
6. 推荐相关标签（3-5个）

请以 JSON 格式回复：
{
  "description": "技能描述",
  "scenarios": "适用场景",
  "conditions": "使用条件",
  "templates": {
    "main.template": "主要模板代码"
  },
  "tests": {
    "basic.test.ts": "基础测试"
  },
  "tags": ["tag1", "tag2", "tag3"]
}`;
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `你是一个专业的代码技能分析专家，负责从代码模式中提取可重用的技能定义。

你的任务是：
1. 分析代码模式的本质特征
2. 提取出可重用的模板
3. 定义清晰的适用场景和条件
4. 生成实用的测试用例

输出要求：
- JSON 格式
- 简洁准确
- 模板使用 {{ParameterName}} 占位符
- 标签要具体且有分类价值`;
  }

  /**
   * 解析 LLM 响应
   */
  private parseLLMResponse(content: string): {
    description: string;
    scenarios: string;
    conditions: string;
    templates: Record<string, string>;
    tests: Record<string, string>;
    tags: string[];
  } {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // 解析失败，返回默认值
    }

    // 返回默认值
    return {
      description: '自动生成的技能',
      scenarios: '待定义',
      conditions: '待定义',
      templates: {},
      tests: {},
      tags: ['auto-generated']
    };
  }

  /**
   * 构建元数据
   */
  private buildMetadata(
    patternName: string,
    definition: {
      description: string;
      tags: string[];
    },
    params: SkillGenerationParams
  ): SkillMetadata {
    const now = new Date().toISOString();
    const sessionIds = Array.from(new Set(params.candidates.map(c => c.sessionId)));

    return {
      name: patternName,
      description: definition.description || `自动生成的技能: ${patternName}`,
      version: '1.0.0',
      created: now,
      source: 'auto',
      author: 'SkillReflector',
      occurrence: params.candidates.length,
      confidence: this.calculateConfidence(params.candidates),
      validation: {
        status: 'draft',
        score: 0.5,
        testResults: 'pending',
        lastValidated: now
      },
      tags: definition.tags || ['auto-generated'],
      dependencies: [],
      requirements: {
        bins: [],
        env: []
      },
      cautiousFactor: 0.5,
      timesUsed: 0,
      timesSucceeded: 0,
      timesFailed: 0,
      probationThreshold: 10,
      sourceSessionIds: sessionIds
    };
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(candidates: PatternCandidate[]): number {
    if (candidates.length < 3) return 0.3;
    if (candidates.length < 5) return 0.5;
    if (candidates.length < 10) return 0.7;
    return 0.9;
  }

  /**
   * 查找共同模式
   */
  private findCommonPattern(snippets: string[]): string {
    if (snippets.length === 0) return '';

    // 找出最短的片段作为基准
    const shortest = snippets.reduce((a, b) => (a.length < b.length ? a : b));

    // 找出最长公共子序列
    let common = shortest;
    for (const snippet of snippets) {
      common = this.longestCommonSubstring(common, snippet);
      if (common.length < 20) {
        // 共同部分太短，返回第一个片段的前 100 字符
        return snippets[0]?.slice(0, 100) || '';
      }
    }

    return common;
  }

  /**
   * 最长公共子串
   */
  private longestCommonSubstring(str1: string, str2: string): string {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    let maxLen = 0;
    let endIndex = 0;

    for (let i = 1; i <= m; i++) {
      const row = dp[i]!;
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          const prevRow = dp[i - 1]!;
          const prev = (prevRow[j - 1] ?? 0) as number;
          row[j] = prev + 1;
          if ((row[j] as number) > maxLen) {
            maxLen = row[j] as number;
            endIndex = i;
          }
        }
      }
    }

    return str1.slice(endIndex - maxLen, endIndex);
  }

  /**
   * 提取模板中的参数
   */
  private extractTemplateParameters(content: string): string[] {
    const paramRegex = /\{\{(\w+)\}\}/g;
    const params: string[] = [];
    let match;

    while ((match = paramRegex.exec(content)) !== null) {
      const paramName = match[1];
      if (paramName && !params.includes(paramName)) {
        params.push(paramName);
      }
    }

    return params;
  }
}
