/**
 * Reviewer Agent
 *
 * 专项Agent：负责代码审查和质量检查
 */

import { BaseAgent } from '../base/Agent.js';
import type {
  AgentRunOptions,
  AgentRunResult,
  AgentContext
} from '../base/types.js';
import type { AgentConfig, Artifact, ReviewComment } from '../../types/agent.js';
import type { LLMService, LLMRequest, Message } from '../../core/llm/types.js';
import type { ToolHandler } from './types.js';

/**
 * Reviewer Agent - Specialized in reviewing code quality
 */
export class ReviewerAgent extends BaseAgent {
  constructor(
    config: AgentConfig,
    llm: LLMService,
    tools?: Map<string, ToolHandler>
  ) {
    super(config, 'reviewer', llm);

    // 注册代码审查工具的 JSON Schema
    const reviewToolSchemas: Record<string, { description: string; inputSchema: Record<string, unknown> }> = {
      file_read: {
        description: 'Read the contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        }
      },
      git_diff: {
        description: 'Get git diff for changes',
        inputSchema: {
          type: 'object',
          properties: {
            from: {
              type: 'string',
              description: 'Git revision (default: HEAD^)'
            },
            to: {
              type: 'string',
              description: 'Git revision (default: HEAD)'
            }
          }
        }
      },
      lint: {
        description: 'Run linter and get results',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to lint'
            },
            linter: {
              type: 'string',
              description: 'Linter to use (eslint, flake8, etc.)'
            }
          },
          required: ['path']
        }
      }
    };

    // 注册提供的工具
    if (tools) {
      for (const [name, handler] of tools) {
        const schema = reviewToolSchemas[name];
        this.registerTool({
          name,
          description: schema?.description || `Tool: ${name}`,
          inputSchema: schema?.inputSchema || {
            type: 'object',
            properties: {},
            required: []
          },
          execute: async (params: unknown) => {
            // 验证参数是对象类型
            const validatedParams = typeof params === 'object' && params !== null
              ? params as Record<string, unknown>
              : {};
            return handler(validatedParams);
          }
        });
      }
    }
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const startTime = new Date().toISOString();
    const runId = this.initRun(options.input, options.sessionId, options.parentRunId);

    try {
      const systemPrompt = this.buildSystemPrompt();
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.input }
      ];

      const toolDefinitions = this.getToolDefinitions();
      this.updateProgress(runId, 20);

      let finalContent = '';
      const artifacts: Artifact[] = [];

      // Multi-turn loop for tool use
      const maxTurns = 10;
      for (let turn = 0; turn < maxTurns; turn++) {
        const request: LLMRequest = {
          messages,
          tools: toolDefinitions,
          maxTokens: this.config.maxTokens || 8192,
          temperature: this.config.temperature || 0.3
        };

        const response = await this.llm.complete(request);
        finalContent = response.content;

        this.updateProgress(runId, 20 + (60 * (turn + 1) / maxTurns));

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
            const context: AgentContext = {
              agentId: this.config.agentId,
              agentType: 'reviewer',
              sessionId: options.sessionId,
              runId,
              input: options.input,
              workspace: this.config.workspace,
              tools: {},
              metadata: {}
            };

            const toolResult = await this.executeToolCall(toolCall.name, toolCall.input, context);

            messages.push({
              role: 'assistant',
              content: finalContent
            });

            messages.push({
              role: 'user',
              content: JSON.stringify({
                tool_result_id: toolCall.id,
                ...toolResult
              })
            });
          }
        } else {
          // No more tool calls, we're done
          break;
        }
      }

      // Extract review comments
      const reviewComments = this.extractReviewComments(finalContent);
      const reviewArtifact: Artifact = {
        type: 'review',
        path: 'review.json',
        content: JSON.stringify(reviewComments, null, 2)
      };
      artifacts.push(reviewArtifact);

      this.updateProgress(runId, 100);

      const endTime = new Date().toISOString();
      const result: AgentRunResult = {
        runId,
        sessionId: options.sessionId,
        agentType: 'reviewer',
        startTime,
        endTime,
        duration: new Date(endTime).getTime() - new Date(startTime).getTime(),
        success: true,
        output: finalContent,
        artifacts,
        metadata: {
          turns: messages.length,
          reviewSummary: this.summarizeReview(reviewComments)
        }
      };

      this.completeRun(runId, result);
      return result;
    } catch (error) {
      this.failRun(runId, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  protected buildSystemPrompt(): string {
    return this.config.systemPrompt || `You are a Reviewer agent specializing in comprehensive code review.

Your role:
- Review code for correctness, quality, and maintainability
- Identify potential bugs and security issues
- Suggest improvements following best practices
- Check adherence to coding standards

Review criteria:
1. **Correctness**: Logic errors, off-by-one bugs, null/undefined handling
2. **Performance**: Inefficient algorithms, unnecessary computations, memory leaks
3. **Security**: Injection vulnerabilities, weak cryptography, authorization issues
4. **Readability**: Naming conventions, code organization, comments
5. **Maintainability**: Code duplication, coupling, cohesion, testability
6. **Best Practices**: SOLID principles, design patterns, idiomatic code

Review format:
For each issue found:
- **Severity**: critical/major/minor/info
- **Location**: file:line or description
- **Issue**: Clear description of the problem
- **Suggestion**: How to fix it
- **Code Example**: (optional) Show corrected code

When reviewing:
1. Understand the purpose of the code
2. Check for common bugs and anti-patterns
3. Verify error handling and edge cases
4. Assess naming and organization
5. Look for security vulnerabilities
6. Suggest refactoring opportunities
7. Provide actionable feedback

Output format:
\`\`\`markdown
# Code Review Summary

## Overall Assessment
[✅ Approve / ⚠️ Request Changes / ❌ Needs Major Work]

## Issues Found
[List of issues with severity]

## Strengths
[What the code does well]

## Recommendations
[Specific actionable suggestions]
\`\`\``;
  }

  private extractReviewComments(content: string): ReviewComment[] {
    const comments: ReviewComment[] = [];

    // Try to parse structured review output
    if (content.includes('## Issues Found')) {
      const issuesSection = content.split('## Issues Found')[1]?.split('##')[0];
      if (issuesSection) {
        const issueRegex = /-\s*\*\*(Critical|Major|Minor|Info)\*\*:\s*\n(?:Location:\s*([^\n]+)\n)?(?:Issue:\s*([^\n]+)\n(?:Suggestion:\s*([^\n]+)\n)?)/gi;
        const matches = issuesSection.matchAll(issueRegex);

        for (const match of matches) {
          const severity = match[1]?.toLowerCase() || 'info';
          comments.push({
            severity: severity as ReviewComment['severity'],
            location: match[2]?.trim() || '',
            issue: match[3]?.trim() || '',
            suggestion: match[4]?.trim() || ''
          });
        }
      }
    }

    return comments;
  }

  private summarizeReview(comments: ReviewComment[]): {
    critical: number;
    major: number;
    minor: number;
    info: number;
    summary: string;
  } {
    const summary = {
      critical: 0,
      major: 0,
      minor: 0,
      info: 0,
      summary: ''
    };

    for (const comment of comments) {
      summary[comment.severity]++;
    }

    if (summary.critical > 0) {
      summary.summary = `Found ${summary.critical} critical issue(s)`;
    } else if (summary.major > 0) {
      summary.summary = `Found ${summary.major} major issue(s)`;
    } else if (summary.minor > 0) {
      summary.summary = `Found ${summary.minor} minor issue(s)`;
    } else {
      summary.summary = 'No significant issues found';
    }

    return summary;
  }

  /**
   * 深度审查单个文件
   */
  async reviewFile(filePath: string, content?: string): Promise<{
    file: string;
    issues: ReviewComment[];
    score: number;
    summary: string;
  }> {
    let fileContent = content;

    if (!fileContent) {
      // Try to read the file using file_read tool if available
      const toolResult = await this.executeToolCall('file_read', { path: filePath }, {} as AgentContext);
      if (toolResult.success && typeof toolResult.output === 'string') {
        fileContent = toolResult.output;
      }
    }

    if (!fileContent) {
      return {
        file: filePath,
        issues: [{
          severity: 'critical',
          location: filePath,
          issue: 'Could not read file content',
          suggestion: 'Ensure the file exists and is readable'
        }],
        score: 0,
        summary: 'Unable to review file'
      };
    }

    const prompt = `Review this code file comprehensively.

File: ${filePath}

Code:
\`\`
${fileContent}
\`\`

Provide a detailed code review with:
1. Overall assessment (score 0-100)
2. List of issues found with severity
3. Specific suggestions for improvement

Format as JSON:
{
  "score": <number>,
  "issues": [
    {
      "severity": "critical|major|minor|info",
      "location": "<file:line or description>",
      "issue": "<description>",
      "suggestion": "<how to fix>"
    }
  ],
  "summary": "<overall summary>"
}`;

    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: 'You are an expert code reviewer. Respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      maxTokens: 4096
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        file: filePath,
        issues: [],
        score: 70,
        summary: 'Review completed but unable to parse structured output'
      };
    }
  }

  /**
   * 比较两个版本的代码
   */
  async compareVersions(originalPath: string, modifiedPath: string): Promise<{
    added: string[];
    removed: string[];
    modified: string[];
    riskAssessment: string;
  }> {
    const originalResult = await this.executeToolCall('file_read', { path: originalPath }, {} as AgentContext);
    const modifiedResult = await this.executeToolCall('file_read', { path: modifiedPath }, {} as AgentContext);

    const originalContent = typeof originalResult.output === 'string' ? originalResult.output : '';
    const modifiedContent = typeof modifiedResult.output === 'string' ? modifiedResult.output : '';

    const prompt = `Compare these two versions of code and identify changes.

Original (${originalPath}):
\`\`
${originalContent}
\`\`

Modified (${modifiedPath}):
\`\`
${modifiedContent}
\`\`

Provide a JSON response:
{
  "added": ["list of added features/functions"],
  "removed": ["list of removed features/functions"],
  "modified": ["list of modified functions"],
  "riskAssessment": "<assessment of change risk>"
}`;

    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: 'You are a code comparison expert. Respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      maxTokens: 4096
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        added: [],
        removed: [],
        modified: [],
        riskAssessment: 'Could not perform comparison'
      };
    }
  }

  /**
   * 检查代码风格一致性
   */
  async checkStyleConsistency(files: string[]): Promise<{
    consistent: boolean;
    issues: Array<{ file: string; issue: string }>;
  }> {
    const prompt = `Check the code style consistency across these files:

${files.map(f => `- ${f}`).join('\n')}

Look for:
1. Inconsistent naming conventions
2. Inconsistent import ordering
3. Mixed indentation styles
4. Inconsistent quote usage
5. Varying comment styles

Provide a JSON response:
{
  "consistent": true/false,
  "issues": [{"file": "path/to/file", "issue": "description"}]
}`;

    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: 'You are a code style checker. Respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      maxTokens: 2048
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        consistent: true,
        issues: []
      };
    }
  }

  /**
   * 生成重构建议
   */
  async suggestRefactoring(codeContent: string): Promise<{
    suggestions: Array<{
      type: 'extract' | 'rename' | 'restructure' | 'optimize';
      description: string;
      benefit: string;
      effort: 'low' | 'medium' | 'high';
    }>;
  }> {
    const prompt = `Analyze this code and suggest refactoring opportunities:

\`\`
${codeContent}
\`\`

For each suggestion, provide:
- type: extract|rename|restructure|optimize
- description: what to refactor
- benefit: why it's beneficial
- effort: low|medium|high

Focus on:
- Extracting complex logic into separate functions
- Improving naming clarity
- Reducing code duplication
- Optimizing performance
- Simplifying complex conditions

Respond with JSON only.`;

    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: 'You are a refactoring expert. Respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      maxTokens: 4096
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        suggestions: []
      };
    }
  }
}
