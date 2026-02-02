# EvoAgent 实施计划 v1.3

**创建日期**: 2025-01-28
**更新日期**: 2025-01-30
**基于设计文档**: v2.2
**预计工期**: 19周
**实施策略**: 基础设施先行 + 里程碑串行 + 接口优先

---

## 目录

1. [实施策略概述](#实施策略概述)
2. [准备阶段 (第1-2周)](#准备阶段)
3. [里程碑1: 单Agent执行 ✅ 已完成](#里程碑1-单agent执行-已完成)
4. [里程碑2: Agent记忆系统 ✅ 已完成](#里程碑2-agent记忆系统-已完成)
5. [里程碑3: 多Agent协作 ✅ 已完成](#里程碑3-多agent协作-已完成)
6. [里程碑4: 自我进化 ✅ 已完成](#里程碑4-自我进化-已完成)
7. [里程碑5: 技能进化系统 🚧 待实施](#里程碑5-技能进化系统-待实施)
8. [质量保障策略](#质量保障策略)
9. [风险与应对](#风险与应对)

---

## 实施策略概述

### 核心原则

| 原则 | 说明 | 应用方式 |
|------|------|----------|
| **基础设施先行** | 先搭建基础设施和核心接口 | Week 1-2专注基础设施，不写业务逻辑 |
| **里程碑串行** | 里程碑按顺序执行，每个完成后才进入下一个 | 4个里程碑，每个有明确的验收标准 |
| **接口优先** | 先定义接口，再实现，最后集成 | 每个模块先定义`.interface.ts` |
| **Demo驱动** | 每个里程碑结束有可演示的功能 | 每个milestone有Demo场景 |
| **测试驱动** | 核心模块必须有单元测试 | 测试覆盖率目标 70%+ |
| **每日构建** | 每天代码可编译可运行 | CI/CD自动构建 |

### 项目结构规划

```
evoagent/
├── src/
│   ├── core/              # 核心基础设施
│   │   ├── config/        # 配置管理
│   │   ├── logger/        # 日志系统
│   │   ├── llm/           # LLM服务抽象
│   │   ├── database/      # 数据库抽象
│   │   └── circuit/       # 熔断器
│   ├── agent/             # Agent实现
│   │   ├── base/          # Agent基类
│   │   ├── planner/       # Planner
│   │   ├── orchestrator/  # Orchestrator
│   │   └── specialists/   # 专项Agent
│   ├── memory/            # 记忆系统
│   │   ├── session/       # Session存储
│   │   ├── knowledge/     # Knowledge存储
│   │   ├── vector/        # 向量存储
│   │   └── search/        # 混合搜索
│   ├── evolution/         # 进化系统
│   │   ├── collector/     # 经验收集
│   │   ├── reflector/     # 反思器
│   │   └── optimizer/     # Prompt优化
│   ├── communication/     # A2A通信
│   │   ├── message/       # 消息定义
│   │   ├── transport/     # 传输层
│   │   └── retry/         # 重试机制
│   ├── queue/             # 队列系统
│   │   ├── lane/          # Lane Queue
│   │   └── priority/      # 优先级队列
│   ├── tools/             # 工具实现
│   │   ├── file/          # 文件操作
│   │   ├── code/          # 代码分析
│   │   └── terminal/      # 终端执行
│   ├── observability/     # 可观测性
│   │   ├── metrics/       # Prometheus指标
│   │   ├── tracing/       # 分布式追踪
│   │   └── health/        # 健康检查
│   └── cli/               # 命令行入口
├── tests/                 # 测试
│   ├── unit/              # 单元测试
│   ├── integration/       # 集成测试
│   └── e2e/               # 端到端测试
├── prompts/               # Prompt模板
│   ├── planner/           # Planner prompts
│   ├── codewriter/        # CodeWriter prompts
│   └── reflector/         # Reflector prompts
└── docs/                  # 文档
    ├── api/               # API文档
    └── plans/             # 计划文档
```

---

## 准备阶段

**目标**: 搭建完整的基础设施，确保后续开发可以专注于业务逻辑

**验收标准**:
- [ ] 项目可编译运行
- [ ] CI/CD流水线可用
- [ ] 核心接口定义完成
- [ ] Mock服务可用
- [ ] 测试框架可用
- [ ] 配置管理系统可用
- [ ] 日志系统可用

### Week 1: 项目初始化

#### Task 1.1: 项目结构搭建 (1天)

**文件清单**:

```
src/
├── core/
│   ├── config/
│   │   ├── index.ts
│   │   ├── loader.ts
│   │   └── validator.ts
│   └── logger/
│       ├── index.ts
│       ├── logger.ts
│       └── transport.ts
├── types/
│   └── index.ts
└── index.ts
```

**实施步骤**:

1. 创建目录结构
2. 更新 `package.json` 添加必要依赖
3. 创建 `tsconfig.json` 配置
4. 创建 `.eslintrc.js` 和 `.prettierrc`

**新增依赖**:
```json
{
  "dependencies": {
    "dotenv": "^16.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0",
    "tsx": "^4.19.0"
  }
}
```

**文件: src/core/config/loader.ts**
```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface ConfigSource {
  type: 'file' | 'env' | 'cli';
  priority: number;
}

export class ConfigLoader {
  private sources: ConfigSource[] = [
    { type: 'file', priority: 1 },
    { type: 'env', priority: 2 },
    { type: 'cli', priority: 3 }
  ];

  load(configPath: string): Record<string, unknown> {
    const configs: Record<string, unknown>[] = [];

    // 1. 加载默认配置
    configs.push(this.getDefaultConfig());

    // 2. 加载文件配置
    try {
      const fileConfig = this.loadFileConfig(configPath);
      configs.push(fileConfig);
    } catch (error) {
      console.warn(`Config file not found: ${configPath}, using defaults`);
    }

    // 3. 加载环境变量
    configs.push(this.loadEnvConfig());

    // 4. 合并配置（高优先级覆盖低优先级）
    return this.mergeConfigs(configs);
  }

  private getDefaultConfig(): Record<string, unknown> {
    return {
      server: {
        port: 18790,
        host: 'localhost'
      },
      agent: {
        maxConcurrent: 3,
        timeout: 300000
      },
      memory: {
        sessionDir: '~/.evoagent/sessions',
        knowledgeDir: '~/.evoagent/knowledge'
      },
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8192,
        temperature: 0.7
      },
      log: {
        level: 'info',
        format: 'json'
      }
    };
  }

  private loadFileConfig(path: string): Record<string, unknown> {
    const fullPath = resolve(path);
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  }

  private loadEnvConfig(): Record<string, unknown> {
    const env: Record<string, unknown> = {};

    if (process.env.EVOAGENT_PORT) {
      env.server = { port: parseInt(process.env.EVOAGENT_PORT) };
    }
    if (process.env.EVOAGENT_LOG_LEVEL) {
      env.log = { level: process.env.EVOAGENT_LOG_LEVEL };
    }
    if (process.env.ANTHROPIC_API_KEY) {
      env.llm = { apiKey: process.env.ANTHROPIC_API_KEY };
    }

    return env;
  }

  private mergeConfigs(configs: Record<string, unknown>[]): Record<string, unknown> {
    return configs.reduce((acc, config) => this.deepMerge(acc, config), {});
  }

  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepMerge(
          (result[key] as Record<string, unknown>) || {},
          value as Record<string, unknown>
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
```

**文件: src/core/config/validator.ts**
```typescript
import { z } from 'zod';

export const ServerConfigSchema = z.object({
  port: z.number().int().min(1024).max(65535),
  host: z.string().default('localhost')
});

export const AgentConfigSchema = z.object({
  maxConcurrent: z.number().int().min(1).max(10).default(3),
  timeout: z.number().int().min(1000).default(300000)
});

export const LLMConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'custom']),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  maxTokens: z.number().int().min(1).max(200000).default(8192),
  temperature: z.number().min(0).max(2).default(0.7)
});

export const LogConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  format: z.enum(['json', 'text']).default('json')
});

export const EvoAgentConfigSchema = z.object({
  server: ServerConfigSchema,
  agent: AgentConfigSchema,
  llm: LLMConfigSchema,
  log: LogConfigSchema
});

export type EvoAgentConfig = z.infer<typeof EvoAgentConfigSchema>;

export class ConfigValidator {
  validate(config: unknown): EvoAgentConfig {
    try {
      return EvoAgentConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(e =>
          `${e.path.join('.')}: ${e.message}`
        ).join('\n  ');
        throw new Error(`Config validation failed:\n  ${messages}`);
      }
      throw error;
    }
  }
}
```

**文件: src/core/config/index.ts**
```typescript
export { ConfigLoader, type ConfigSource } from './loader.js';
export { ConfigValidator, EvoAgentConfigSchema, type EvoAgentConfig } from './validator.js';

import { ConfigLoader } from './loader.js';
import { ConfigValidator } from './validator.js';

let config: EvoAgentConfig | null = null;

export function getConfig(): EvoAgentConfig {
  if (!config) {
    const loader = new ConfigLoader();
    const validator = new ConfigValidator();

    const rawConfig = loader.load('./evoagent.config.json');
    config = validator.validate(rawConfig);
  }
  return config;
}

export function reloadConfig(): EvoAgentConfig {
  const loader = new ConfigLoader();
  const validator = new ConfigValidator();

  const rawConfig = loader.load('./evoagent.config.json');
  config = validator.validate(rawConfig);
  return config;
}
```

#### Task 1.2: 日志系统 (1天)

**文件: src/core/logger/logger.ts**
```typescript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface LoggerTransport {
  write(entry: LogEntry): void | Promise<void>;
}

export class Logger {
  private transports: LoggerTransport[] = [];
  private level: LogLevel;
  private context: Record<string, unknown>;

  constructor(options: {
    level?: LogLevel;
    context?: Record<string, unknown>;
  } = {}) {
    this.level = options.level || 'info';
    this.context = options.context || {};
  }

  addTransport(transport: LoggerTransport): void {
    this.transports.push(transport);
  }

  withContext(additional: Record<string, unknown>): Logger {
    return new Logger({
      level: this.level,
      context: { ...this.context, ...additional }
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorInfo = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    } : { message: String(error) };

    this.write('error', message, { ...meta, error: errorInfo });
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...meta }
    };

    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (error) {
        console.error('Transport write failed:', error);
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}
```

**文件: src/core/logger/transport.ts**
```typescript
import { createWriteStream } from 'fs';
import { LogEntry, LoggerTransport } from './logger.js';

export class ConsoleTransport implements LoggerTransport {
  private useJson: boolean;

  constructor(options: { format?: 'json' | 'text' } = {}) {
    this.useJson = options.format === 'json';
  }

  write(entry: LogEntry): void {
    if (this.useJson) {
      console.log(JSON.stringify(entry));
    } else {
      const { level, message, timestamp, context } = entry;
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`);
    }
  }
}

export class FileTransport implements LoggerTransport {
  private stream: ReturnType<typeof createWriteStream>;

  constructor(options: { filename: string }) {
    this.stream = createWriteStream(options.filename, { flags: 'a' });
  }

  write(entry: LogEntry): void {
    this.stream.write(JSON.stringify(entry) + '\n');
  }

  close(): void {
    this.stream.end();
  }
}

export class FilterTransport implements LoggerTransport {
  constructor(
    private wrapped: LoggerTransport,
    private predicate: (entry: LogEntry) => boolean
  ) {}

  write(entry: LogEntry): void {
    if (this.predicate(entry)) {
      this.wrapped.write(entry);
    }
  }
}
```

**文件: src/core/logger/index.ts**
```typescript
export { Logger, type LogLevel, type LogEntry, type LoggerTransport } from './logger.js';
export { ConsoleTransport, FileTransport, FilterTransport } from './transport.js';

import { Logger } from './logger.js';
import { ConsoleTransport } from './transport.js';

let rootLogger: Logger | null = null;

export function getLogger(name: string): Logger {
  if (!rootLogger) {
    rootLogger = new Logger({ level: 'info' });
    rootLogger.addTransport(new ConsoleTransport({ format: 'json' }));
  }
  return rootLogger.withContext { component: name });
}
```

#### Task 1.3: CI/CD配置 (1天)

**文件: .github/workflows/ci.yml**
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npx eslint src --ext .ts

      - name: Run tests
        run: npm test -- --coverage

      - name: Build
        run: npx tsc
```

**文件: jest.config.js**
```javascript
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }]
  },
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.interface.ts',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

#### Task 1.4: TypeScript配置 (0.5天)

**文件: tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Week 2: 核心接口与Mock服务

#### Task 2.1: LLM服务接口定义 (1天)

**文件: src/core/llm/types.ts**
```typescript
export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  output: unknown;
  error?: string;
}

export interface LLMRequest {
  messages: Message[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'tool_use';
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'usage';
  delta?: string;
  toolCall?: Partial<ToolCall>;
  usage?: LLMResponse['usage'];
}

export interface LLMService {
  complete(request: LLMRequest): Promise<LLMResponse>;

  stream(request: LLMRequest): AsyncIterable<StreamChunk>;

  countTokens(text: string): number;
}
```

**文件: src/core/llm/mock.ts**
```typescript
import type { LLMService, LLMRequest, LLMResponse, StreamChunk } from './types.js';

export class MockLLMService implements LLMService {
  private latency: number;
  private errorRate: number;

  constructor(options: { latency?: number; errorRate?: number } = {}) {
    this.latency = options.latency || 100;
    this.errorRate = options.errorRate || 0;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    await this.simulateLatency();

    if (Math.random() < this.errorRate) {
      throw new Error('Mock LLM error');
    }

    const lastMessage = request.messages[request.messages.length - 1];

    return {
      content: this.generateMockResponse(lastMessage.content),
      usage: {
        inputTokens: this.countTokens(JSON.stringify(request.messages)),
        outputTokens: 50,
        totalTokens: 0
      },
      model: 'mock-model',
      finishReason: 'stop'
    };
  }

  async *stream(request: LLMRequest): AsyncIterable<StreamChunk> {
    await this.simulateLatency();

    const content = this.generateMockResponse(
      request.messages[request.messages.length - 1].content
    );

    const words = content.split(' ');
    for (const word of words) {
      yield {
        type: 'content',
        delta: word + ' '
      };
    }

    yield {
      type: 'usage',
      usage: {
        inputTokens: 100,
        outputTokens: words.length,
        totalTokens: 100 + words.length
      }
    };
  }

  countTokens(text: string): number {
    // 粗略估算：英文约4字符/token，中文约1.5字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  private generateMockResponse(input: string): string {
    return `[Mock Response] I received: "${input.substring(0, 50)}..."`;
  }

  private simulateLatency(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.latency));
  }
}
```

**文件: src/core/llm/anthropic.ts**
```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { LLMService, LLMRequest, LLMResponse, StreamChunk, Message } from './types.js';

export class AnthropicLLMService implements LLMService {
  private client: Anthropic;

  constructor(options: { apiKey: string; baseUrl?: string }) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseUrl
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const messages = this.convertMessages(request.messages);

    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 8192,
      temperature: request.temperature,
      messages,
      tools: request.tools ? this.convertTools(request.tools) : undefined
    });

    return {
      content: this.extractContent(response),
      toolCalls: this.extractToolCalls(response),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      },
      model: response.model,
      finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'length'
    };
  }

  async *stream(request: LLMRequest): AsyncIterable<StreamChunk> {
    const messages = this.convertMessages(request.messages);

    const stream = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 8192,
      temperature: request.temperature,
      messages,
      tools: request.tools ? this.convertTools(request.tools) : undefined,
      stream: true
    });

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'content_block_delta':
          if (chunk.delta.type === 'text_delta') {
            yield { type: 'content', delta: chunk.delta.text };
          }
          break;
        case 'content_block_stop':
          // Tool call completed
          break;
        case 'message_stop':
          // Message completed
          break;
      }
    }
  }

  countTokens(text: string): number {
    // Anthropic使用claude_tokenize，这里简化处理
    return Math.ceil(text.length / 4);
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));
  }

  private convertTools(tools: any[]): Anthropic.Tool[] {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema
    }));
  }

  private extractContent(response: Anthropic.Message): string {
    return response.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('\n');
  }

  private extractToolCalls(response: Anthropic.Message) {
    return response.content
      .filter(block => block.type === 'tool_use')
      .map(block => ({
        id: (block as any).id,
        name: (block as any).name,
        input: (block as any).input
      }));
  }
}
```

**文件: src/core/llm/index.ts**
```typescript
export type * from './types.js';
export { MockLLMService } from './mock.js';
export { AnthropicLLMService } from './anthropic.js';

import { AnthropicLLMService } from './anthropic.js';
import { MockLLMService } from './mock.js';
import type { LLMService } from './types.js';

export function createLLMService(config: { provider: string; apiKey?: string }): LLMService {
  if (config.provider === 'anthropic' && config.apiKey) {
    return new AnthropicLLMService({ apiKey: config.apiKey });
  }
  return new MockLLMService();
}
```

#### Task 2.2: 数据库接口定义 (1天)

**文件: src/core/database/types.ts**
```typescript
export interface Database {
  exec(sql: string, params?: unknown[]): RunResult;
  prepare(sql: string): Statement;
  close(): void;
  inTransaction(cb: () => void): void;
}

export interface Statement {
  run(params?: unknown[]): RunResult;
  get(params?: unknown[]): unknown | undefined;
  all(params?: unknown[]): unknown[];
  finalize(): void;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface SessionRecord {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived';
  metadata: Record<string, unknown>;
}

export interface KnowledgeRecord {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  occurrences: number;
  createdAt: number;
  updatedAt: number;
}

export interface VectorRecord {
  id: string;
  collection: string;
  embedding: number[];
  content: string;
  metadata: Record<string, unknown>;
  consolidated: boolean;
  createdAt: number;
  accessCount: number;
}
```

**文件: src/core/database/sqlite.ts**
```typescript
import Database from 'better-sqlite3';
import { resolve } from 'path';
import { ensureDirSync } from 'fs';
import type { Database as DatabaseInterface } from './types.js';

export class SQLiteDatabase implements DatabaseInterface {
  private db: Database.Database;

  constructor(options: { path: string }) {
    const fullPath = resolve(options.path);
    ensureDirSync(fullPath, { recursive: true });

    this.db = new Database(fullPath);
    this.db.pragma('journal_mode = WAL');
  }

  exec(sql: string): RunResult {
    return this.db.exec(sql);
  }

  prepare(sql: string): Statement {
    const stmt = this.db.prepare(sql);
    return {
      run: (params) => stmt.run(params),
      get: (params) => stmt.get(params),
      all: (params) => stmt.all(params),
      finalize: () => stmt.finalize()
    };
  }

  close(): void {
    this.db.close();
  }

  inTransaction(cb: () => void): void {
    this.db.transaction(cb)();
  }
}
```

**文件: src/core/database/index.ts**
```typescript
export type * from './types.js';
export { SQLiteDatabase } from './sqlite.js';
```

#### Task 2.3: Agent基类接口 (1天)

**文件: src/agent/base/types.ts**
```typescript
import type { LLMService } from '../../core/llm/types.js';
import type { AgentConfig, AgentContext, AgentResult, ToolDefinition } from '../../types/agent.js';

export interface AgentRunOptions {
  input: string;
  sessionId: string;
  parentRunId?: string;
  onProgress?: (progress: number) => void;
  onToolCall?: (tool: string, params: unknown) => void;
}

export interface AgentRunResult extends AgentResult {
  runId: string;
  sessionId: string;
  startTime: string;
  endTime: string;
  duration: number;
}

export interface AgentInterface {
  readonly config: AgentConfig;

  run(options: AgentRunOptions): Promise<AgentRunResult>;

  pause(runId: string): Promise<void>;

  resume(runId: string): Promise<void>;

  cancel(runId: string): Promise<void>;

  getStatus(runId: string): AgentRunStatus;
}

export interface AgentRunStatus {
  runId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
}
```

**文件: src/agent/base/Agent.ts**
```typescript
import type { AgentInterface, AgentRunOptions, AgentRunResult, AgentRunStatus } from './types.js';
import type { AgentConfig } from '../../types/agent.js';
import type { LLMService } from '../../core/llm/types.js';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseAgent implements AgentInterface {
  protected llm: LLMService;
  protected activeRuns: Map<string, AgentRunStatus>;

  constructor(
    protected readonly config: AgentConfig,
    llm: LLMService
  ) {
    this.llm = llm;
    this.activeRuns = new Map();
  }

  get config(): AgentConfig {
    return this.config;
  }

  abstract run(options: AgentRunOptions): Promise<AgentRunResult>;

  async pause(runId: string): Promise<void> {
    const status = this.activeRuns.get(runId);
    if (status && status.status === 'running') {
      status.status = 'paused';
    }
  }

  async resume(runId: string): Promise<void> {
    const status = this.activeRuns.get(runId);
    if (status && status.status === 'paused') {
      status.status = 'running';
    }
  }

  async cancel(runId: string): Promise<void> {
    const status = this.activeRuns.get(runId);
    if (status) {
      status.status = 'cancelled';
    }
  }

  getStatus(runId: string): AgentRunStatus {
    return this.activeRuns.get(runId) || {
      runId,
      status: 'idle',
      progress: 0
    };
  }

  protected createRunId(): string {
    return uuidv4();
  }

  protected updateProgress(runId: string, progress: number): void {
    const status = this.activeRuns.get(runId);
    if (status) {
      status.progress = progress;
    }
  }
}
```

#### Task 2.4: 测试框架与示例测试 (1天)

**文件: tests/core/logger.test.ts**
```typescript
import { Logger, ConsoleTransport } from '../../src/core/logger/index.js';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ level: 'debug' });
    logger.addTransport(new ConsoleTransport({ format: 'json' }));
  });

  it('should log debug messages', () => {
    const spy = jest.spyOn(console, 'log');
    logger.debug('test message');
    expect(spy).toHaveBeenCalled();
  });

  it('should respect log level', () => {
    const infoLogger = new Logger({ level: 'info' });
    const spy = jest.spyOn(console, 'log');

    infoLogger.debug('should not log');
    expect(spy).not.toHaveBeenCalled();
  });

  it('should add context to logger', () => {
    const contextualLogger = logger.withContext({ userId: '123' });
    expect(contextualLogger).toBeInstanceOf(Logger);
  });
});
```

---

## 里程碑1: 单Agent执行 ✅ 已完成

**目标**: 实现单个Agent的完整执行流程

**验收标准**:
- [x] Agent可以接收用户输入并执行 ✅
- [x] Agent可以调用工具 ✅ (file_read, file_write, file_list, terminal_execute)
- [x] Agent可以返回结果 ✅
- [x] 有完整的单元测试 ✅ (41个测试通过)
- [x] 有可演示的CLI命令 ✅

**完成日期**: 2025-01-29

**实际工期**: 约2周

**成果**:
- CodeWriter/Tester/ReviewerAgent 实现
- 文件工具系统
- CLI execute 命令
- DeepSeek API 集成
- 单元测试覆盖

### Task 1.1: 工具系统实现 (3天)

**文件清单**:
```
src/tools/
├── base.ts
├── file/
│   ├── read.ts
│   ├── write.ts
│   └── list.ts
├── code/
│   ├── analyze.ts
│   └── search.ts
└── terminal/
    └── execute.ts
```

**文件: src/tools/base.ts**
```typescript
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(params: unknown, context: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  workspace: string;
  sessionId: string;
  runId: string;
}

export interface ToolResult {
  success: boolean;
  output: unknown;
  error?: string;
}

export abstract class BaseTool implements Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: Record<string, unknown>;

  abstract execute(params: unknown, context: ToolContext): Promise<ToolResult>;

  protected validateParams(params: unknown): void {
    // 使用zod验证
  }
}
```

**文件: src/tools/file/read.ts**
```typescript
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { BaseTool } from '../base.js';

export class FileReadTool extends BaseTool {
  readonly name = 'file_read';
  readonly description = 'Read the contents of a file';

  readonly inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read'
      }
    },
    required: ['path']
  };

  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const { path } = params as { path: string };

    try {
      const fullPath = resolve(context.workspace, path);
      const content = await readFile(fullPath, 'utf-8');

      return {
        success: true,
        output: content
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
```

### Task 1.2: CodeWriter Agent实现 (4天)

**文件: src/agent/specialists/CodeWriterAgent.ts**
```typescript
import { BaseAgent } from '../base/Agent.js';
import type { AgentRunOptions, AgentRunResult } from '../base/types.js';
import type { AgentConfig } from '../../types/agent.js';
import type { LLMService, LLMRequest } from '../../core/llm/types.js';

export class CodeWriterAgent extends BaseAgent {
  constructor(config: AgentConfig, llm: LLMService) {
    super(config, llm);
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const runId = this.createRunId();
    const startTime = new Date().toISOString();

    this.activeRuns.set(runId, {
      runId,
      status: 'running',
      progress: 0
    });

    try {
      const systemPrompt = this.buildSystemPrompt();
      const request: LLMRequest = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: options.input }
        ],
        tools: this.getToolDefinitions(),
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature
      };

      this.updateProgress(runId, 20);

      const response = await this.llm.complete(request);

      this.updateProgress(runId, 80);

      // 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          await this.executeToolCall(toolCall, options);
          this.updateProgress(runId, 80 + (20 * response.toolCalls.indexOf(toolCall) / response.toolCalls.length));
        }
      }

      this.activeRuns.set(runId, {
        runId,
        status: 'completed',
        progress: 100
      });

      const endTime = new Date().toISOString();

      return {
        runId,
        sessionId: options.sessionId,
        startTime,
        endTime,
        duration: new Date(endTime).getTime() - new Date(startTime).getTime(),
        success: true,
        output: response.content
      };
    } catch (error) {
      this.activeRuns.set(runId, {
        runId,
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  private buildSystemPrompt(): string {
    return this.config.systemPrompt || `You are a CodeWriter agent. Your job is to write code based on user requirements.

Guidelines:
- Write clean, maintainable code
- Follow the project's existing patterns
- Add comments for complex logic
- Handle errors appropriately`;
  }

  private getToolDefinitions() {
    return this.config.tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.parameters || {}
    }));
  }

  private async executeToolCall(toolCall: any, options: AgentRunOptions): Promise<void> {
    // 实现工具调用逻辑
  }
}
```

### Task 1.3: CLI入口实现 (3天)

**文件: src/cli/index.ts**
```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { getConfig } from '../core/config/index.js';
import { createLLMService } from '../core/llm/index.js';
import { CodeWriterAgent } from '../agent/specialists/CodeWriterAgent.js';

const program = new Command();

program
  .name('evoagent')
  .description('EvoAgent - 自主进化编码Agent系统')
  .version('1.0.0');

program
  .command('execute')
  .description('Execute a task with single agent')
  .argument('<input>', 'Task description')
  .option('-s, --session <id>', 'Session ID')
  .option('-t, --type <type>', 'Agent type', 'codewriter')
  .action(async (input, options) => {
    const config = getConfig();

    const llm = createLLMService({
      provider: config.llm.provider,
      apiKey: config.llm.apiKey
    });

    const agentConfig = {
      agentId: `agent-${Date.now()}`,
      description: 'Code writing agent',
      model: config.llm,
      workspace: process.cwd(),
      systemPrompt: '',
      tools: []
    };

    const agent = new CodeWriterAgent(agentConfig, llm);

    const sessionId = options.session || `session-${Date.now()}`;

    console.log(`Executing task: ${input}`);
    console.log(`Session: ${sessionId}`);
    console.log('---');

    const result = await agent.run({
      input,
      sessionId
    });

    console.log('---');
    console.log(`Result: ${result.output}`);
    console.log(`Duration: ${result.duration}ms`);
  });

program
  .command('serve')
  .description('Start the agent server')
  .option('-p, --port <port>', 'Port number', '18790')
  .action(async (options) => {
    console.log(`Starting server on port ${options.port}...`);
    // TODO: 实现服务器
  });

program.parse();
```

---

## 里程碑2: Agent记忆系统 ✅ 已完成

**目标**: 实现三层记忆系统（Session + Knowledge + Memory）

**验收标准**:
- [x] Session可以持久化和恢复 ✅
- [x] Knowledge可以存储和查询 ✅
- [x] 向量搜索可用 ✅
- [x] 混合搜索（RRF）可用 ✅

**完成日期**: 2025-01-30

**实际工期**: 约2周

**成果**:
- SessionStorage.ts (持久化、压缩、恢复)
- KnowledgeStorage.ts (存储、查询、搜索)
- VectorStore.ts (向量存储、相似度搜索)
- EmbeddingService.ts (嵌入服务、缓存)
- HybridSearch.ts (混合搜索、RRF融合)
- RRF.ts (倒数排名融合算法)
- Planner历史检索 (learnFromHistory, savePlanToHistory)

### Task 2.1: Session存储 (4天)

**文件清单**:
```
src/memory/session/
├── SessionStorage.ts
├── SessionCompressor.ts
└── index.ts
```

### Task 2.2: Knowledge存储 (4天)

**文件清单**:
```
src/memory/knowledge/
├── KnowledgeStorage.ts
├── KnowledgeIndex.ts
└── index.ts
```

### Task 2.3: 向量存储 (5天)

**文件清单**:
```
src/memory/vector/
├── VectorStore.ts
├── EmbeddingService.ts
├── EmbeddingCache.ts
└── index.ts
```

### Task 2.4: 混合搜索 (4天)

**文件清单**:
```
src/memory/search/
├── HybridSearch.ts
├── RRF.ts
└── index.ts
```

---

## 里程碑3: 多Agent协作 ✅ 已完成

**目标**: 实现Planner、Orchestrator和A2A通信

**验收标准**:
- [x] Planner可以生成执行计划 ✅
- [x] Orchestrator可以协调多个Agent ✅
- [x] A2A通信可用 ✅
- [x] Lane Queue工作正常 ✅

**完成日期**: 2025-01-30

**实际工期**: 约2周

**成果**:
- PlannerAgent.ts (需求分析、模式选择、计划生成)
- PlanGenerator.ts (任务分解、依赖管理、风险评估)
- OrchestratorAgent.ts (Agent编排、执行协调)
- MessageBus.ts (A2A通信、发布订阅)
- LaneQueue.ts (优先级队列、限流)

### Task 3.1: Planner实现 (5天)

**文件清单**:
```
src/agent/planner/
├── PlannerAgent.ts
├── PlanGenerator.ts
└── index.ts
```

### Task 3.2: Orchestrator实现 (6天)

**文件清单**:
```
src/agent/orchestrator/
├── OrchestratorAgent.ts
├── AgentSpawner.ts
├── ExecutionCoordinator.ts
└── index.ts
```

### Task 3.3: A2A通信 (6天)

**文件清单**:
```
src/communication/
├── message/
│   ├── types.ts
│   └── MessageBus.ts
├── transport/
│   ├── WebSocketTransport.ts
│   └── InProcessTransport.ts
└── retry/
    └── RetryPolicy.ts
```

### Task 3.4: Lane Queue (5天)

**文件清单**:
```
src/queue/
├── LaneQueue.ts
├── PrioritizedTask.ts
└── RateLimiter.ts
```

---

## 里程碑4: 自我进化 ✅ 已完成

**目标**: 实现经验收集、反思和Prompt优化

**验收标准**:
- [x] 经验可以自动收集 ✅
- [x] 反思可以生成改进报告 ✅
- [x] Prompt可以自动优化 ✅
- [x] Git集成可用 ✅

**完成日期**: 2025-01-30

**实际工期**: 约2周

**成果**:
- ExperienceCollector.ts (经验收集、提取)
- Reflector.ts (反思、改进报告生成)
- PromptOptimizer.ts (Prompt优化、A/B测试)
- GitIntegration.ts (变更提取、提交分析)

### Task 4.1: ExperienceCollector (5天)

### Task 4.2: Reflector (6天)

### Task 4.3: PromptOptimizer (6天)

### Task 4.4: Git集成 (5天)

---

## 里程碑5: 技能进化系统 🚧 待实施

**目标**: 实现技能自动生成、验证和使用系统

**验收标准**:
- [ ] 模式候选可以收集和存储
- [ ] 技能可以从模式自动生成
- [ ] 技能可以经过验证进入试用期
- [ ] 技能可以在试用期后转正
- [ ] 技能可以通过 CLI 管理和查看
- [ ] 技能可以由 Orchestrator 发现和调用

**预计工期**: 约4周

### Task 5.1: 模式候选收集 (4天)

**文件清单**:
```
src/evolution/
├── skills/
│   ├── SkillCollector.ts
│   ├── PatternCandidate.ts
│   └── types.ts
.evoagent/
└── pattern-candidates.jsonl
```

**文件: src/evolution/skills/PatternCandidate.ts**
```typescript
export interface PatternCandidate {
  timestamp: string;
  pattern: string;
  occurrence: number;
  sessionId: string;
  snippet: string;
  context?: {
    agentType: string;
    task: string;
  };
}

export class PatternStorage {
  private readonly CANDIDATES_FILE = '.evoagent/pattern-candidates.jsonl';
  private readonly ARCHIVE_FILE = '.evoagent/pattern-candidates.archived.jsonl';

  async append(candidate: PatternCandidate): Promise<void> {
    const line = JSON.stringify(candidate) + '\n';
    await fs.appendFile(this.CANDIDATES_FILE, line, 'utf-8');
  }

  async load(): Promise<PatternCandidate[]> {
    try {
      const content = await fs.readFile(this.CANDIDATES_FILE, 'utf-8');
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async archive(processed: PatternCandidate[]): Promise<void> {
    const remaining = new Set(processed.map(p => `${p.timestamp}:${p.pattern}`));
    const current = await this.load();

    const toArchive = current.filter(c =>
      remaining.has(`${c.timestamp}:${c.pattern}`)
    );
    const toKeep = current.filter(c =>
      !remaining.has(`${c.timestamp}:${c.pattern}`)
    );

    // 追加到归档
    const archiveLines = toArchive.map(c => JSON.stringify(c)).join('\n') + '\n';
    await fs.appendFile(this.ARCHIVE_FILE, archiveLines, 'utf-8');

    // 重写当前文件
    const keepLines = toKeep.map(c => JSON.stringify(c)).join('\n');
    await fs.writeFile(this.CANDIDATES_FILE, keepLines + '\n', 'utf-8');
  }
}
```

### Task 5.2: SkillReflector 实现 (6天)

**文件清单**:
```
src/evolution/skills/
├── SkillReflector.ts
├── SkillGenerator.ts
└── prompts/
    └── generate-skill.md
```

**文件: src/evolution/skills/SkillReflector.ts**
```typescript
import { PatternStorage, PatternCandidate } from './PatternCandidate.js';
import { SkillGenerator } from './SkillGenerator.js';
import { SkillStore } from './SkillStore.js';

export class SkillReflector {
  constructor(
    private patternStorage: PatternStorage,
    private skillGenerator: SkillGenerator,
    private skillStore: SkillStore
  ) {}

  async run(options: {
    minCandidates: number;
    minOccurrence: number;
  }): Promise<SkillReflectorResult> {
    // 1. 加载模式候选
    const candidates = await this.patternStorage.load();

    // 2. 按模式分组
    const grouped = this.groupByPattern(candidates);

    // 3. 过滤满足条件的模式
    const eligible = Array.from(grouped.entries()).filter(([_, group]) =>
      group.length >= options.minCandidates &&
      group.reduce((sum, c) => sum + c.occurrence, 0) >= options.minOccurrence
    );

    // 4. 为每个模式生成技能
    const results: SkillReflectorResult = {
      generated: [],
      rejected: [],
      failed: []
    };

    for (const [pattern, group] of eligible) {
      try {
        const skill = await this.skillGenerator.generate({
          pattern,
          samples: group
        });

        // 检查是否已存在相似技能
        const existing = await this.skillStore.findSimilar(pattern);
        if (existing && this.similarity(pattern, existing.name) > 0.85) {
          results.rejected.push({
            pattern,
            reason: 'Similar skill exists',
            existing: existing.name
          });
          continue;
        }

        skill.validation.status = 'draft';
        skill.cautiousFactor = 0.8;
        await this.skillStore.save(skill);
        results.generated.push(skill);
      } catch (error) {
        results.failed.push({
          pattern,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 5. 归档已处理的候选
    const processed = eligible.flatMap(([_, group]) => group);
    await this.patternStorage.archive(processed);

    return results;
  }

  private groupByPattern(candidates: PatternCandidate[]): Map<string, PatternCandidate[]> {
    const groups = new Map<string, PatternCandidate[]>();
    for (const c of candidates) {
      if (!groups.has(c.pattern)) {
        groups.set(c.pattern, []);
      }
      groups.get(c.pattern)!.push(c);
    }
    return groups;
  }

  private similarity(a: string, b: string): number {
    // 简单的 Jaccard 相似度
    const setA = new Set(a.toLowerCase().split(/[-\s]/));
    const setB = new Set(b.toLowerCase().split(/[-\s]/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }
}
```

### Task 5.3: SkillReviewer 实现 (5天)

**文件清单**:
```
src/evolution/skills/
├── SkillReviewer.ts
├── SkillValidator.ts
└── SkillTester.ts
```

**文件: src/evolution/skills/SkillReviewer.ts**
```typescript
export class SkillReviewer {
  async validate(skill: Skill): Promise<SkillValidation> {
    const validation: SkillValidation = {
      skillId: skill.id,
      status: 'draft',
      score: 0,
      issues: [],
      warnings: []
    };

    // 1. 语法检查
    const syntaxCheck = await this.checkSyntax(skill);
    if (!syntaxCheck.passed) {
      validation.issues.push(...syntaxCheck.errors);
      return validation;
    }

    // 2. 逻辑验证
    const logicCheck = await this.checkLogic(skill);
    validation.warnings.push(...logicCheck.warnings);

    // 3. 模板验证
    const templateCheck = await this.checkTemplates(skill);
    validation.warnings.push(...templateCheck.warnings);

    // 4. 生成测试用例
    const tests = skill.tests || await this.generateTests(skill);

    // 5. 运行测试
    const testResults = await this.runTests(tests);
    validation.testResults = testResults;

    // 6. 计算质量评分
    validation.score = this.calculateScore({
      syntax: syntaxCheck.score,
      logic: logicCheck.score,
      template: templateCheck.score,
      tests: testResults.passed ? 1 : 0
    });

    // 7. 确定状态
    if (validation.score >= 0.8 && testResults.passed) {
      validation.status = 'probation';  // 试用期
    } else if (validation.score >= 0.5) {
      validation.status = 'draft';
    } else {
      validation.status = 'rejected';
    }

    return validation;
  }
}
```

### Task 5.4: SkillStore 和索引 (4天)

**文件清单**:
```
src/evolution/skills/
└── SkillStore.ts
.evoagent/
└── skills/
    ├── auto/
    ├── manual/
    ├── deprecated/
    ├── .backup/
    └── index.json
```

**文件: src/evolution/skills/SkillStore.ts**
```typescript
export class SkillStore {
  private index: SkillIndex = {};
  private readonly INDEX_FILE = '.evoagent/skills/index.json';
  private readonly BACKUP_DIR = '.evoagent/skills/.backup';

  async save(skill: Skill): Promise<void> {
    // 1. 备份现有版本
    await this.backup(skill.name);

    // 2. 验证格式
    this.validate(skill);

    // 3. 原子写入
    const skillDir = this.getSkillDir(skill);
    await fs.mkdir(skillDir, { recursive: true });

    const skillPath = path.join(skillDir, 'SKILL.md');
    const tempPath = skillPath + '.tmp';
    await fs.writeFile(tempPath, skill.content, 'utf-8');
    await fs.rename(tempPath, skillPath);

    // 4. 原子更新索引
    await this.updateIndex(skill);
  }

  async load(name: string): Promise<Skill | null> {
    const skillPath = path.join(this.getSkillDirByName(name), 'SKILL.md');
    try {
      const content = await fs.readFile(skillPath, 'utf-8');
      return this.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async updateIndex(skill: Skill): Promise<void> {
    this.index[skill.name] = {
      name: skill.name,
      status: skill.validation.status,
      score: skill.validation.score,
      tags: skill.tags,
      updatedAt: new Date().toISOString()
    };

    const tempPath = this.INDEX_FILE + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(this.index, null, 2), 'utf-8');
    await fs.rename(tempPath, this.INDEX_FILE);
  }

  async list(filter?: { status?: SkillStatus; tags?: string[] }): Promise<Skill[]> {
    const skills: Skill[] = [];
    for (const name of Object.keys(this.index)) {
      const skill = await this.load(name);
      if (skill) {
        if (filter?.status && skill.validation.status !== filter.status) continue;
        if (filter?.tags && !filter.tags.some(t => skill.tags.includes(t))) continue;
        skills.push(skill);
      }
    }
    return skills;
  }
}
```

### Task 5.5: CLI 命令扩展 (4天)

**文件清单**:
```
src/cli/
└── commands/
    └── skill.ts
```

**文件: src/cli/commands/skill.ts**
```typescript
import { Command } from 'commander';
import { SkillStore } from '../../evolution/skills/SkillStore.js';

export function registerSkillCommands(program: Command, skillStore: SkillStore): void {
  const skillCmd = program.command('skill');

  skillCmd
    .command('list')
    .option('-s, --status <status>', 'Filter by status')
    .action(async (options) => {
      const skills = await skillStore.list({
        status: options.status
      });
      console.table(skills.map(s => ({
        Name: s.name,
        Status: s.validation.status,
        Score: s.validation.score.toFixed(2),
        Used: s.timesUsed
      })));
    });

  skillCmd
    .command('show <name>')
    .action(async (name) => {
      const skill = await skillStore.load(name);
      if (!skill) {
        console.error(`Skill not found: ${name}`);
        return;
      }
      console.log(skill.content);
    });

  skillCmd
    .command('feedback <name>')
    .option('-p, --positive', 'Positive feedback')
    .option('-n, --negative', 'Negative feedback')
    .option('-c, --comment <text>', 'Comment')
    .action(async (name, options) => {
      await skillStore.recordFeedback(name, {
        positive: options.positive,
        negative: options.negative,
        comment: options.comment
      });
      console.log('Feedback recorded');
    });

  skillCmd
    .command('stats <name>')
    .action(async (name) => {
      const stats = await skillStore.getStats(name);
      console.log(JSON.stringify(stats, null, 2));
    });

  skillCmd
    .command('generate')
    .option('--min-candidates <n>', 'Minimum candidates', '3')
    .action(async (options) => {
      const reflector = new SkillReflector(/* ... */);
      const result = await reflector.run({
        minCandidates: parseInt(options.minCandidates),
        minOccurrence: 3
      });
      console.log(`Generated: ${result.generated.length}`);
      console.log(`Rejected: ${result.rejected.length}`);
      console.log(`Failed: ${result.failed.length}`);
    });
}
```

### Task 5.6: Orchestrator 技能发现 (5天)

**文件清单**:
```
src/agent/orchestrator/
└── SkillDiscovery.ts
```

**文件: src/agent/orchestrator/SkillDiscovery.ts**
```typescript
export class SkillDiscovery {
  constructor(
    private skillStore: SkillStore,
    private vectorStore: VectorStore
  ) {}

  async discover(requirements: string): Promise<Skill[]> {
    // 1. 向量搜索
    const embedding = await this.vectorStore.embed(requirements);
    const results = await this.vectorStore.similaritySearch(embedding, {
      collection: 'skills',
      limit: 10
    });

    // 2. 过滤和评分
    const skills = await Promise.all(
      results
        .filter(r => r.metadata.status !== 'deprecated')
        .map(async (r) => {
          const skill = await this.skillStore.load(r.metadata.skillName);
          if (!skill) return null;

          // 综合评分 = 语义相似度 × 技能质量 × 成功率权重
          const successRate = skill.timesUsed > 0
            ? skill.timesSucceeded / skill.timesUsed
            : 0.5;

          return {
            skill,
            relevance: r.score * skill.validation.score * successRate
          };
        })
    );

    // 3. 排序并返回
    return skills
      .filter((s): s is { skill: Skill; relevance: number } => s !== null)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5)
      .map(s => s.skill);
  }

  async shouldUseSkill(skill: Skill): Promise<boolean> {
    // 根据 cautiousFactor 决定是否需要确认
    if (skill.cautiousFactor > 0.5) {
      return false;  // 需要人工确认
    }
    return true;
  }
}
```

### Task 5.7: Metrics 和健康检查 (3天)

**文件清单**:
```
src/observability/
├── SkillMetrics.ts
└── HealthCheck.ts
```

**文件: src/observability/SkillMetrics.ts**
```typescript
export class SkillMetrics {
  private metrics: Map<string, SkillMetric> = new Map();

  recordGeneration(duration: number, success: boolean): void {
    const key = 'skill_generation';
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0
      });
    }
    const m = this.metrics.get(key)!;
    m.count++;
    m.totalDuration += duration;
    if (success) m.successCount++;
    else m.failureCount++;
  }

  recordUsage(skillName: string, success: boolean, duration: number): void {
    const key = `skill_usage_${skillName}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0
      });
    }
    const m = this.metrics.get(key)!;
    m.count++;
    m.totalDuration += duration;
    if (success) m.successCount++;
    else m.failureCount++;
  }

  exportPrometheus(): string {
    const lines: string[] = [];

    // 技能生成指标
    const gen = this.metrics.get('skill_generation');
    if (gen) {
      lines.push(`skill_generation_duration_seconds ${gen.totalDuration / gen.count}`);
      lines.push(`skill_generation_success_total ${gen.successCount}`);
      lines.push(`skill_generation_failure_total ${gen.failureCount}`);
    }

    // 技能使用指标
    for (const [key, m] of this.metrics) {
      if (key.startsWith('skill_usage_')) {
        const skillName = key.substring('skill_usage_'.length);
        lines.push(`skill_usage_total{skill="${skillName}"} ${m.count}`);
        lines.push(`skill_success_total{skill="${skillName}"} ${m.successCount}`);
      }
    }

    return lines.join('\n');
  }
}
```

### Task 5.8: 生命周期管理 (4天)

**文件清单**:
```
src/evolution/skills/
└── SkillLifecycle.ts
```

**文件: src/evolution/skills/SkillLifecycle.ts**
```typescript
export class SkillLifecycle {
  async onUsage(skill: Skill, result: AgentResult): Promise<void> {
    // 更新统计
    skill.timesUsed++;
    if (result.success) {
      skill.timesSucceeded++;
    } else {
      skill.timesFailed++;
    }

    // 检查是否需要转正
    if (skill.validation.status === 'probation') {
      if (skill.timesUsed >= 10) {
        const successRate = skill.timesSucceeded / skill.timesUsed;
        if (successRate >= 0.8) {
          skill.validation.status = 'validated';
          skill.cautiousFactor = 0.1;
        }
      }
    }

    // 检查是否需要降级
    if (skill.validation.status === 'validated') {
      if (this.getConsecutiveFailures(skill) >= 3) {
        skill.validation.status = 'probation';
        skill.cautiousFactor = 0.5;
      }
    }

    if (skill.validation.status === 'probation') {
      if (this.getConsecutiveFailures(skill) >= 5) {
        skill.validation.status = 'draft';
        skill.cautiousFactor = 0.8;
      }
    }

    await this.skillStore.save(skill);
  }

  async checkDeprecated(): Promise<void> {
    const skills = await this.skillStore.list();
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    for (const skill of skills) {
      if (skill.validation.status === 'deprecated') continue;

      const lastUsed = new Date(skill.lastUsed || skill.created).getTime();
      if (now - lastUsed > thirtyDays) {
        skill.validation.status = 'deprecated';
        await this.skillStore.save(skill);
      }
    }
  }
}
```

---

## 质量保障策略

### 测试策略

| 测试类型 | 覆盖率目标 | 工具 |
|----------|------------|------|
| 单元测试 | 70%+ | Jest |
| 集成测试 | 核心流程100% | Jest |
| E2E测试 | 主要场景 | Playwright |

### 代码审查

1. 每个PR必须通过CI
2. 至少一人审查批准
3. 代码必须符合ESLint规则
4. 复杂度检查（圈复杂度 < 10）

### 发布流程

1. 更新版本号
2. 生成CHANGELOG
3. 创建git tag
4. 发布到npm

---

## 风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| LLM API限流 | 中 | 高 | 实现限流和队列 |
| 向量数据库性能问题 | 中 | 中 | 实现缓存和降级 |
| 多Agent死锁 | 低 | 高 | 实现超时和检测 |
| 内存泄漏 | 中 | 中 | 定期profiling |

---

**文档版本**: v1.3
**创建时间**: 2025-01-28
**更新时间**: 2025-01-30
**维护者**: EvoAgent Team
