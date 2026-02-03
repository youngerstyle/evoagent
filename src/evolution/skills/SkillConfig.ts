/**
 * 技能系统配置常量
 */

/**
 * 执行配置
 */
export const EXECUTION_CONFIG = {
  DEFAULT_TIMEOUT: 30000, // 30秒
  DEFAULT_MAX_MEMORY: 128 * 1024 * 1024, // 128MB
  MAX_CODE_LENGTH: 100000, // 100KB
  MAX_NESTING_DEPTH: 10,
  MAX_FILE_NAME_LENGTH: 255
} as const;

/**
 * 历史记录配置
 */
export const HISTORY_CONFIG = {
  MAX_HISTORY_SIZE: 10000,
  CACHE_TTL: 5 * 60 * 1000, // 5分钟
  STREAM_THRESHOLD: 1000, // 超过此数量使用流式读取
  RECENT_LIMIT: 100,
  DEFAULT_MAX_AGE: 30 * 24 * 60 * 60 * 1000 // 30天
} as const;

/**
 * 验证配置
 */
export const VALIDATION_CONFIG = {
  MAX_TEST_DURATION: 10000, // 10秒
  SUCCESS_RATE_THRESHOLD: 0.8,
  PROBATION_USAGE_THRESHOLD: 10
} as const;

/**
 * 依赖解析配置
 */
export const DEPENDENCY_CONFIG = {
  MAX_RECURSION_DEPTH: 100
} as const;

/**
 * 告警配置
 */
export const ALERT_CONFIG = {
  DEFAULT_COOLDOWN: 5 * 60 * 1000, // 5分钟
  WEBHOOK_TIMEOUT: 10000, // 10秒
  MAX_RETRY_ATTEMPTS: 3
} as const;

/**
 * 输入验证规则
 */
export const VALIDATION_RULES = {
  SKILL_ID: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z0-9_-]+$/
  },
  SKILL_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 200
  },
  PARAMETER_KEY: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z_][a-zA-Z0-9_]*$/
  }
} as const;
