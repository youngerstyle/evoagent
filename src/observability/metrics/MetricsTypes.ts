/**
 * Prometheus Metrics 类型定义
 *
 * 支持的指标类型：Counter, Gauge, Histogram, Summary
 */

/**
 * Metric 类型
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Metric 基础接口
 */
export interface Metric {
  name: string;
  help: string;
  type: MetricType;
  labels?: Record<string, string>;
}

/**
 * Counter - 单调递增计数器
 */
export interface Counter extends Metric {
  type: 'counter';
  value: number;
}

/**
 * Gauge - 可增可减的仪表
 */
export interface Gauge extends Metric {
  type: 'gauge';
  value: number;
}

/**
 * Histogram - 分布直方图
 */
export interface Histogram extends Metric {
  type: 'histogram';
  sampleCount: number;
  sampleSum: number;
  buckets: Array<{
    upperBound: number;
    cumulativeCount: number;
  }>;
}

/**
 * Summary - 摘要统计
 */
export interface Summary extends Metric {
  type: 'summary';
  sampleCount: number;
  sampleSum: number;
  quantiles: Array<{
    quantile: number;
    value: number;
  }>;
}

/**
 * Metric 值
 */
export type MetricValue = Counter | Gauge | Histogram | Summary;

/**
 * Metric Registry
 */
export interface MetricRegistry {
  register(metric: Metric): void;
  unregister(name: string): void;
  get(name: string): MetricValue | undefined;
  getAll(): Map<string, MetricValue>;
  clear(): void;
}

/**
 * Counter 操作
 */
export interface ICounter {
  inc(amount?: number): void;
  get(): number;
  reset(): void;
}

/**
 * Gauge 操作
 */
export interface IGauge {
  inc(amount?: number): void;
  dec(amount?: number): void;
  set(value: number): void;
  get(): number;
  reset(): void;
}

/**
 * Histogram 操作
 */
export interface IHistogram {
  observe(value: number): void;
  getSampleCount(): number;
  getSampleSum(): number;
  reset(): void;
}

/**
 * Summary 操作
 */
export interface ISummary {
  observe(value: number): void;
  getSampleCount(): number;
  getSampleSum(): number;
  quantile(quantile: number): number;
  reset(): void;
}

/**
 * Prometheus 导出格式
 */
export interface PrometheusExportOptions {
  includeTimestamp?: boolean;
  includeHelp?: boolean;
  includeType?: boolean;
}

/**
 * 默认 Histogram 桶
 */
export const DEFAULT_HISTOGRAM_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10
];

/**
 * 默认 Summary 分位数
 */
export const DEFAULT_SUMMARY_OBJECTIVES = [0.01, 0.05, 0.5, 0.9, 0.95, 0.99];

/**
 * Metric 标签
 */
export interface Labels {
  [key: string]: string | number | boolean;
}

/**
 * Metric 创建选项
 */
export interface MetricOptions<T extends MetricType> {
  name: string;
  help: string;
  labels?: string[];
  buckets?: T extends 'histogram' ? number[] : never;
  objectives?: T extends 'summary' ? Array<{ quantile: number; error: number }> : never;
  maxAge?: T extends 'summary' ? number : never;
  ageBuckets?: T extends 'summary' ? number : never;
}
