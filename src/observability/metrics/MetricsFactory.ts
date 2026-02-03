/**
 * Metrics Factory - 创建和管理常用的指标
 */

import { defaultRegistry } from './MetricsRegistry.js';
import type { MetricOptions } from './MetricsTypes.js';

/**
 * 预定义的指标名称
 */
export const MetricNames = {
  // HTTP 请求
  httpRequestsTotal: 'http_requests_total',
  httpRequestDuration: 'http_request_duration_seconds',
  httpRequestSize: 'http_request_size_bytes',
  httpResponseSize: 'http_response_size_bytes',

  // Agent 执行
  agentExecutionsTotal: 'agent_executions_total',
  agentExecutionDuration: 'agent_execution_duration_seconds',
  agentExecutionsActive: 'agent_executions_active',
  agentExecutionsFailed: 'agent_executions_failed_total',

  // LLM 调用
  llmRequestsTotal: 'llm_requests_total',
  llmRequestDuration: 'llm_request_duration_seconds',
  llmTokensUsedTotal: 'llm_tokens_used_total',
  llmTokensInputTotal: 'llm_tokens_input_total',
  llmTokensOutputTotal: 'llm_tokens_output_total',

  // 记忆系统
  memoryOperationsTotal: 'memory_operations_total',
  memorySearchDuration: 'memory_search_duration_seconds',
  memorySizeBytes: 'memory_size_bytes',

  // 技能系统
  skillExecutionsTotal: 'skill_executions_total',
  skillExecutionDuration: 'skill_execution_duration_seconds',
  skillsValidated: 'skills_validated_total',
  skillsDeprecated: 'skills_deprecated_total',

  // 队列系统
  queueLength: 'queue_length',
  queueProcessingDuration: 'queue_processing_duration_seconds',
  queueTasksPending: 'queue_tasks_pending',

  // 错误和警告
  errorsTotal: 'errors_total',
  warningsTotal: 'warnings_total',

  // 系统资源
  processCpuSeconds: 'process_cpu_seconds_total',
  processResidentMemoryBytes: 'process_resident_memory_bytes',
  processOpenFds: 'process_open_fds',
  processStartTimeSeconds: 'process_start_time_seconds'
} as const;

/**
 * 指标工厂类
 */
export class MetricsFactory {
  constructor(
    private readonly registry = defaultRegistry
  ) {}

  /**
   * 创建 Counter
   */
  createCounter(options: MetricOptions<'counter'>): void {
    this.registry.register({
      name: options.name,
      help: options.help,
      type: 'counter',
      labels: options.labels ? Object.fromEntries(options.labels.map(l => [l, ''])) : undefined
    });
  }

  /**
   * 创建 Gauge
   */
  createGauge(options: MetricOptions<'gauge'>): void {
    this.registry.register({
      name: options.name,
      help: options.help,
      type: 'gauge',
      labels: options.labels ? Object.fromEntries(options.labels.map(l => [l, ''])) : undefined
    });
  }

  /**
   * 创建 Histogram
   */
  createHistogram(options: MetricOptions<'histogram'>): void {
    this.registry.register({
      name: options.name,
      help: options.help,
      type: 'histogram',
      labels: options.labels ? Object.fromEntries(options.labels.map(l => [l, ''])) : undefined
    });
  }

  /**
   * 创建 Summary
   */
  createSummary(options: MetricOptions<'summary'>): void {
    this.registry.register({
      name: options.name,
      help: options.help,
      type: 'summary',
      labels: options.labels ? Object.fromEntries(options.labels.map(l => [l, ''])) : undefined
    });
  }

  /**
   * 注册所有默认指标
   */
  registerDefaultMetrics(): void {
    // HTTP 指标
    this.createCounter({
      name: MetricNames.httpRequestsTotal,
      help: 'Total number of HTTP requests',
      labels: ['method', 'path', 'status']
    });
    this.createHistogram({
      name: MetricNames.httpRequestDuration,
      help: 'HTTP request duration in seconds',
      labels: ['method', 'path'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    });

    // Agent 执行指标
    this.createCounter({
      name: MetricNames.agentExecutionsTotal,
      help: 'Total number of agent executions',
      labels: ['agent_type', 'status']
    });
    this.createHistogram({
      name: MetricNames.agentExecutionDuration,
      help: 'Agent execution duration in seconds',
      labels: ['agent_type'],
      buckets: [1, 5, 10, 30, 60, 120, 300, 600]
    });
    this.createGauge({
      name: MetricNames.agentExecutionsActive,
      help: 'Number of active agent executions',
      labels: ['agent_type']
    });
    this.createCounter({
      name: MetricNames.agentExecutionsFailed,
      help: 'Total number of failed agent executions',
      labels: ['agent_type', 'error_type']
    });

    // LLM 调用指标
    this.createCounter({
      name: MetricNames.llmRequestsTotal,
      help: 'Total number of LLM requests',
      labels: ['provider', 'model', 'status']
    });
    this.createHistogram({
      name: MetricNames.llmRequestDuration,
      help: 'LLM request duration in seconds',
      labels: ['provider', 'model']
    });
    this.createCounter({
      name: MetricNames.llmTokensUsedTotal,
      help: 'Total number of LLM tokens used',
      labels: ['provider', 'model']
    });
    this.createCounter({
      name: MetricNames.llmTokensInputTotal,
      help: 'Total number of LLM input tokens',
      labels: ['provider', 'model']
    });
    this.createCounter({
      name: MetricNames.llmTokensOutputTotal,
      help: 'Total number of LLM output tokens',
      labels: ['provider', 'model']
    });

    // 记忆系统指标
    this.createCounter({
      name: MetricNames.memoryOperationsTotal,
      help: 'Total number of memory operations',
      labels: ['operation', 'store_type']
    });
    this.createHistogram({
      name: MetricNames.memorySearchDuration,
      help: 'Memory search duration in seconds',
      labels: ['search_type']
    });
    this.createGauge({
      name: MetricNames.memorySizeBytes,
      help: 'Memory size in bytes',
      labels: ['store_type']
    });

    // 技能系统指标
    this.createCounter({
      name: MetricNames.skillExecutionsTotal,
      help: 'Total number of skill executions',
      labels: ['skill_id', 'status']
    });
    this.createHistogram({
      name: MetricNames.skillExecutionDuration,
      help: 'Skill execution duration in seconds',
      labels: ['skill_id']
    });
    this.createCounter({
      name: MetricNames.skillsValidated,
      help: 'Total number of skills validated',
      labels: ['status']
    });
    this.createCounter({
      name: MetricNames.skillsDeprecated,
      help: 'Total number of skills deprecated'
    });

    // 队列指标
    this.createGauge({
      name: MetricNames.queueLength,
      help: 'Current queue length',
      labels: ['queue_name']
    });
    this.createHistogram({
      name: MetricNames.queueProcessingDuration,
      help: 'Queue processing duration in seconds',
      labels: ['queue_name']
    });
    this.createGauge({
      name: MetricNames.queueTasksPending,
      help: 'Number of pending tasks in queue',
      labels: ['queue_name']
    });

    // 错误和警告
    this.createCounter({
      name: MetricNames.errorsTotal,
      help: 'Total number of errors',
      labels: ['component', 'error_type']
    });
    this.createCounter({
      name: MetricNames.warningsTotal,
      help: 'Total number of warnings',
      labels: ['component']
    });

    // 系统资源指标
    this.createCounter({
      name: MetricNames.processCpuSeconds,
      help: 'Total user and system CPU time spent in seconds'
    });
    this.createGauge({
      name: MetricNames.processResidentMemoryBytes,
      help: 'Resident memory size in bytes'
    });
    this.createGauge({
      name: MetricNames.processOpenFds,
      help: 'Number of open file descriptors'
    });
    this.createGauge({
      name: MetricNames.processStartTimeSeconds,
      help: 'Start time of the process since unix epoch in seconds'
    });
  }

  /**
   * 获取指标值辅助方法
   */
  incCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.registry.counterInc(name, value, labels);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.registry.gaugeSet(name, value, labels);
  }

  incGauge(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.registry.gaugeInc(name, value, labels);
  }

  decGauge(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.registry.gaugeDec(name, value, labels);
  }

  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.registry.histogramObserve(name, value, labels);
  }

  observeSummary(name: string, value: number, labels?: Record<string, string>): void {
    this.registry.summaryObserve(name, value, labels);
  }
}

/**
 * 默认工厂实例
 */
export const defaultMetricsFactory = new MetricsFactory();
