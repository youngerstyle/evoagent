/**
 * Tester Agent
 *
 * 专项Agent：负责编写测试代码
 */

import { BaseAgent } from '../base/Agent.js';
import type {
  AgentRunOptions,
  AgentRunResult,
  AgentContext
} from '../base/types.js';
import type { AgentConfig, Artifact } from '../../types/agent.js';
import type { LLMService, LLMRequest, Message } from '../../core/llm/types.js';
import type { ToolHandler } from './types.js';

/**
 * Tester Agent - Specialized in writing and running tests
 */
export class TesterAgent extends BaseAgent {
  constructor(
    config: AgentConfig,
    llm: LLMService,
    tools?: Map<string, ToolHandler>
  ) {
    super(config, 'tester', llm);

    // 注册测试工具的 JSON Schema
    const testToolSchemas: Record<string, { description: string; inputSchema: Record<string, unknown> }> = {
      test_run: {
        description: 'Run tests and get results',
        inputSchema: {
          type: 'object',
          properties: {
            framework: {
              type: 'string',
              description: 'Test framework (vitest, jest, mocha, etc.)',
              enum: ['vitest', 'jest', 'mocha', 'pytest', 'go test']
            },
            path: {
              type: 'string',
              description: 'Path to the test directory or specific test file'
            }
          },
          required: ['framework']
        }
      },
      test_list: {
        description: 'List available test files',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to search for test files'
            }
          }
        }
      },
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
      }
    };

    // 注册提供的工具
    if (tools) {
      for (const [name, handler] of tools) {
        const schema = testToolSchemas[name];
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
              agentType: 'tester',
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

      // Extract test file artifacts
      const extractedArtifacts = this.extractTestArtifacts(finalContent);
      artifacts.push(...extractedArtifacts);

      this.updateProgress(runId, 100);

      const endTime = new Date().toISOString();
      const result: AgentRunResult = {
        runId,
        sessionId: options.sessionId,
        agentType: 'tester',
        startTime,
        endTime,
        duration: new Date(endTime).getTime() - new Date(startTime).getTime(),
        success: true,
        output: finalContent,
        artifacts,
        metadata: {
          turns: messages.length,
          testFrameworks: this.detectTestFrameworks(finalContent)
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
    return this.config.systemPrompt || `You are a Tester agent specializing in writing comprehensive tests.

Your role:
- Write unit tests, integration tests, and end-to-end tests
- Ensure test coverage for critical paths
- Test edge cases and error conditions
- Follow testing best practices

Testing guidelines:
- Use Arrange-Act-Assert (AAA) pattern
- Write descriptive test names that explain what and why
- Mock external dependencies appropriately
- Test both success and failure scenarios
- Aim for high code coverage
- Keep tests independent and isolated
- Use fixtures and test data factories

Test structure:
1. Group related tests in describe blocks
2. Use beforeEach/afterEach for setup/teardown
3. Keep test logic simple and readable
4. Avoid testing implementation details

When writing tests:
1. Understand the code being tested
2. Identify test scenarios (happy path, edge cases, errors)
3. Write clear assertions
4. Add necessary mocks and fixtures
5. Ensure tests are maintainable

Supported test frameworks:
- Vitest (TypeScript/JavaScript)
- Jest (TypeScript/JavaScript)
- Pytest (Python)
- Go testing (Go)`;
  }

  private extractTestArtifacts(content: string): Artifact[] {
    const artifacts: Artifact[] = [];

    // Extract test file patterns like: ```typescript:test/to/file.test.ts ...```
    const testFileRegex = /```(?:\w+)?:(.+?\.test\.(?:ts|js|py|go))\n([\s\S]+?)```/g;
    const matches = content.matchAll(testFileRegex);

    for (const match of matches) {
      const path = match[1];
      const testContent = match[2];
      if (path && testContent) {
        artifacts.push({
          type: 'test',
          path,
          content: testContent
        });
      }
    }

    return artifacts;
  }

  private detectTestFrameworks(content: string): string[] {
    const frameworks: string[] = [];

    if (content.includes('vitest') || content.includes('describe.from(\'vitest\')')) {
      frameworks.push('vitest');
    }
    if (content.includes('jest') || content.includes('@testing-library')) {
      frameworks.push('jest');
    }
    if (content.includes('pytest') || content.includes('import pytest')) {
      frameworks.push('pytest');
    }
    if (content.includes('testing.') || content.includes('import testing')) {
      frameworks.push('go test');
    }

    return frameworks;
  }

  /**
   * 分析代码覆盖率缺口
   */
  async analyzeCoverage(codeContent: string, testContent: string): Promise<{
    covered: string[];
    uncovered: string[];
    suggestions: string[];
  }> {
    const prompt = `Analyze the test coverage gap between this code and its tests.

Code to test:
\`\`
${codeContent}
\`\`

Tests:
\`\`
${testContent}
\`\`

Provide a JSON response with:
{
  "covered": ["list of covered functions/features"],
  "uncovered": ["list of uncovered functions/features"],
  "suggestions": ["list of suggestions to improve coverage"]
}`;

    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: 'You are a test coverage analyst. Respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      maxTokens: 4096
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        covered: [],
        uncovered: [],
        suggestions: ['Unable to parse coverage analysis']
      };
    }
  }

  /**
   * 生成测试用例
   */
  async generateTestCases(functionSignature: string, functionCode: string): Promise<string[]> {
    const prompt = `Generate comprehensive test cases for this function.

Function signature:
${functionSignature}

Function code:
\`\`
${functionCode}
\`\`

Generate test cases following the AAA pattern. Include:
1. Happy path tests
2. Edge case tests
3. Error handling tests
4. Boundary condition tests

Format each test case as a separate code block.`;

    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: 'You are a test generation expert.' },
        { role: 'user', content: prompt }
      ],
      maxTokens: 4096
    });

    // Split by code blocks
    const testBlocks: string[] = [];
    const regex = /```(?:\w+)?\n([\s\S]+?)```/g;
    let match;
    while ((match = regex.exec(response.content)) !== null) {
      if (match[1]) {
        testBlocks.push(match[1].trim());
      }
    }

    return testBlocks;
  }
}
