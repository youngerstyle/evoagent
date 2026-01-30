export interface ConfigValidationError {
  path: string[];
  message: string;
  received: unknown;
}

export class ConfigValidationException extends Error {
  public readonly errors: ConfigValidationError[];

  constructor(errors: ConfigValidationError[]) {
    const messages = errors.map(e =>
      `  - ${e.path.join('.')}: ${e.message} (received: ${JSON.stringify(e.received)})`
    ).join('\n');
    super(`Configuration validation failed:\n${messages}`);
    this.name = 'ConfigValidationException';
    this.errors = errors;
  }
}

export interface ValidationOptions {
  allowUnknown?: boolean;
  strict?: boolean;
}

export class ConfigValidator {
  private readonly schemas = new Map<string, Schema>();

  register(path: string, schema: Schema): void {
    this.schemas.set(path, schema);
  }

  validate(config: unknown): void {
    const errors: ConfigValidationError[] = [];

    if (typeof config !== 'object' || config === null) {
      throw new ConfigValidationException([{
        path: [],
        message: 'Config must be an object',
        received: config
      }]);
    }

    this.validateObject(config as Record<string, unknown>, this.getRootSchema(), [], errors, {});

    if (errors.length > 0) {
      throw new ConfigValidationException(errors);
    }
  }

  private getRootSchema(): ObjectSchema {
    return {
      type: 'object',
      required: [],
      properties: {
        server: this.getServerSchema(),
        agent: this.getAgentSchema(),
        memory: this.getMemorySchema(),
        llm: this.getLLMSchema(),
        log: this.getLogSchema(),
        evolution: this.getEvolutionSchema()
      }
    };
  }

  private getServerSchema(): ObjectSchema {
    return {
      type: 'object',
      required: [],
      properties: {
        port: { type: 'number', minimum: 1024, maximum: 65535, required: true },
        host: { type: 'string', pattern: /^[\w.-]+$/, required: false }
      }
    };
  }

  private getAgentSchema(): ObjectSchema {
    return {
      type: 'object',
      required: [],
      properties: {
        maxConcurrent: { type: 'number', minimum: 1, maximum: 10, required: false },
        timeout: { type: 'number', minimum: 1000, required: false },
        checkpointInterval: { type: 'number', minimum: 1000, required: false }
      }
    };
  }

  private getMemorySchema(): ObjectSchema {
    return {
      type: 'object',
      required: [],
      properties: {
        sessionDir: { type: 'string', required: false },
        knowledgeDir: { type: 'string', required: false },
        vectorDbPath: { type: 'string', required: false },
        maxSessionEntries: { type: 'number', minimum: 100, required: false },
        sessionTTL: { type: 'number', minimum: 0, required: false }
      }
    };
  }

  private getLLMSchema(): ObjectSchema {
    return {
      type: 'object',
      required: [],
      properties: {
        provider: { type: 'string', enum: ['anthropic', 'openai', 'custom'], required: true },
        model: { type: 'string', minLength: 1, required: true },
        apiKey: { type: 'string', minLength: 1, required: false },
        baseUrl: { type: 'string', pattern: /^https?:\/\//, required: false },
        maxTokens: { type: 'number', minimum: 1, maximum: 200000, required: false },
        temperature: { type: 'number', minimum: 0, maximum: 2, required: false },
        timeout: { type: 'number', minimum: 1000, required: false }
      }
    };
  }

  private getLogSchema(): ObjectSchema {
    return {
      type: 'object',
      required: [],
      properties: {
        level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'], required: false },
        format: { type: 'string', enum: ['json', 'text'], required: false },
        output: { type: 'string', enum: ['stdout', 'stderr', 'file'], required: false }
      }
    };
  }

  private getEvolutionSchema(): ObjectSchema {
    return {
      type: 'object',
      required: [],
      properties: {
        enabled: { type: 'boolean', required: false },
        reflectionSchedule: { type: 'string', required: false },
        minSessionsForReflection: { type: 'number', minimum: 1, required: false }
      }
    };
  }

  private validateObject(
    obj: Record<string, unknown>,
    schema: ObjectSchema,
    path: string[],
    errors: ConfigValidationError[],
    options: ValidationOptions
  ): void {
    const { properties = {}, required = [] } = schema;

    // 检查必需字段
    for (const key of required) {
      if (!(key in obj)) {
        errors.push({
          path: [...path, key],
          message: `Required property is missing`,
          received: undefined
        });
      }
    }

    // 验证每个属性
    for (const [key, value] of Object.entries(obj)) {
      const propSchema = properties[key];

      if (!propSchema) {
        if (options.strict && !options.allowUnknown) {
          errors.push({
            path: [...path, key],
            message: `Unknown property`,
            received: value
          });
        }
        continue;
      }

      // 检查是否是嵌套对象
      const isObjectSchema = 'type' in propSchema && propSchema.type === 'object' && 'required' in propSchema && Array.isArray((propSchema as unknown as { required: unknown }).required);
      if (isObjectSchema) {
        this.validateObject(value as Record<string, unknown>, propSchema as ObjectSchema, [...path, key], errors, options);
      } else {
        this.validateValue(value, propSchema as PropertySchema, [...path, key], errors);
      }
    }
  }

  private validateValue(
    value: unknown,
    schema: PropertySchema,
    path: string[],
    errors: ConfigValidationError[]
  ): void {
    // 类型检查
    if (schema.type !== undefined) {
      const expectedType = schema.type;
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (actualType !== expectedType) {
        errors.push({
          path,
          message: `Expected type '${expectedType}', got '${actualType}'`,
          received: value
        });
        return;
      }
    }

    // 枚举检查
    if (schema.enum) {
      if (!schema.enum.includes(value as never)) {
        errors.push({
          path,
          message: `Value must be one of: ${schema.enum.join(', ')}`,
          received: value
        });
        return;
      }
    }

    // 字符串模式检查
    if (schema.pattern && typeof value === 'string') {
      if (!schema.pattern.test(value)) {
        errors.push({
          path,
          message: `String does not match pattern`,
          received: value
        });
        return;
      }
    }

    // 数值范围检查
    if (typeof value === 'number') {
      const min = schema.minimum ?? schema.min;
      const max = schema.maximum ?? schema.max;
      if (min !== undefined && value < min) {
        errors.push({
          path,
          message: `Number must be >= ${min}`,
          received: value
        });
      }
      if (max !== undefined && value > max) {
        errors.push({
          path,
          message: `Number must be <= ${max}`,
          received: value
        });
      }
      return;
    }

    // 字符串长度检查
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({
          path,
          message: `String length must be >= ${schema.minLength}`,
          received: value
        });
      }
    }
  }
}

// 类型定义

type ValueType = 'string' | 'number' | 'boolean' | 'object';

interface PropertySchema {
  type?: ValueType;
  required?: boolean;
  enum?: unknown[];
  pattern?: RegExp;
  min?: number;
  minimum?: number;
  max?: number;
  maximum?: number;
  minLength?: number;
}

interface ObjectSchema {
  type: 'object';
  required: string[];
  properties: Record<string, PropertySchema | ObjectSchema>;
}

type Schema = ObjectSchema | PropertySchema;

// 导出配置类型

export interface ServerConfig {
  port: number;
  host?: string;
}

export interface AgentConfig {
  maxConcurrent: number;
  timeout: number;
  checkpointInterval: number;
}

export interface MemoryConfig {
  sessionDir: string;
  knowledgeDir: string;
  vectorDbPath: string;
  maxSessionEntries: number;
  sessionTTL: number;
}

export interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'custom';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  output: 'stdout' | 'stderr' | 'file';
}

export interface EvolutionConfig {
  enabled: boolean;
  reflectionSchedule: string;
  minSessionsForReflection: number;
}

export interface EvoAgentConfig {
  server: ServerConfig;
  agent: AgentConfig;
  memory: MemoryConfig;
  llm: LLMConfig;
  log: LogConfig;
  evolution: EvolutionConfig;
}
