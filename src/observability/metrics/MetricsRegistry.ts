/**
 * Prometheus Metrics Registry
 *
 * 线程安全的指标注册表
 */

import { getLogger } from '../../core/logger/index.js';
import type {
  Metric,
  MetricValue,
  MetricRegistry,
  Counter,
  Gauge,
  Histogram,
  Summary
} from './MetricsTypes.js';

const logger = getLogger('observability:metrics');

/**
 * 默认 Histogram 桶
 */
const DEFAULT_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10
];

/**
 * 默认 Summary 分位数
 */
const DEFAULT_OBJECTIVES = [0.01, 0.05, 0.5, 0.9, 0.95, 0.99];

/**
 * Prometheus 指标注册表
 */
export class PrometheusRegistry implements MetricRegistry {
  private readonly metrics: Map<string, MetricValue> = new Map();
  private readonly labelValues: Map<string, Map<string, string>> = new Map();

  register(metric: Metric): void {
    if (this.metrics.has(metric.name)) {
      throw new Error(`Metric already registered: ${metric.name}`);
    }

    let metricValue: MetricValue;

    switch (metric.type) {
      case 'counter':
        metricValue = {
          ...metric,
          type: 'counter',
          value: 0
        } as Counter;
        break;

      case 'gauge':
        metricValue = {
          ...metric,
          type: 'gauge',
          value: 0
        } as Gauge;
        break;

      case 'histogram':
        const customBuckets = (metric as Histogram).buckets;
        metricValue = {
          ...metric,
          type: 'histogram',
          sampleCount: 0,
          sampleSum: 0,
          buckets: [
            ...(customBuckets || DEFAULT_BUCKETS).map(upperBound => ({
              upperBound,
              cumulativeCount: 0
            })),
            { upperBound: Infinity, cumulativeCount: 0 }
          ]
        } as Histogram;
        break;

      case 'summary':
        metricValue = {
          ...metric,
          type: 'summary',
          sampleCount: 0,
          sampleSum: 0,
          quantiles: DEFAULT_OBJECTIVES.map(quantile => ({
            quantile,
            value: 0
          }))
        } as Summary;
        break;

      default:
        throw new Error(`Unknown metric type: ${(metric as Metric).type}`);
    }

    this.metrics.set(metric.name, metricValue);

    if (metric.labels) {
      this.labelValues.set(metric.name, new Map(Object.entries(metric.labels)));
    }

    logger.debug(`Registered metric: ${metric.name} (${metric.type})`);
  }

  unregister(name: string): void {
    const deleted = this.metrics.delete(name);
    this.labelValues.delete(name);
    if (deleted) {
      logger.debug(`Unregistered metric: ${name}`);
    }
  }

  get(name: string): MetricValue | undefined {
    return this.metrics.get(name);
  }

  getAll(): Map<string, MetricValue> {
    return new Map(this.metrics);
  }

  clear(): void {
    this.metrics.clear();
    this.labelValues.clear();
  }

  /**
   * Counter: 增加计数
   */
  counterInc(name: string, amount: number = 1, labels?: Record<string, string>): void {
    const metric = this.getOrCreateLabeled(name, labels);
    if (metric.type !== 'counter') {
      throw new Error(`Metric ${name} is not a counter`);
    }
    if (amount < 0) {
      throw new Error('Counter can only be incremented');
    }
    (metric as Counter).value += amount;
  }

  /**
   * Gauge: 设置值
   */
  gaugeSet(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.getOrCreateLabeled(name, labels);
    if (metric.type !== 'gauge') {
      throw new Error(`Metric ${name} is not a gauge`);
    }
    (metric as Gauge).value = value;
  }

  /**
   * Gauge: 增加
   */
  gaugeInc(name: string, amount: number = 1, labels?: Record<string, string>): void {
    const metric = this.getOrCreateLabeled(name, labels);
    if (metric.type !== 'gauge') {
      throw new Error(`Metric ${name} is not a gauge`);
    }
    (metric as Gauge).value += amount;
  }

  /**
   * Gauge: 减少
   */
  gaugeDec(name: string, amount: number = 1, labels?: Record<string, string>): void {
    const metric = this.getOrCreateLabeled(name, labels);
    if (metric.type !== 'gauge') {
      throw new Error(`Metric ${name} is not a gauge`);
    }
    (metric as Gauge).value -= amount;
  }

  /**
   * Histogram: 观察值
   */
  histogramObserve(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.getOrCreateLabeled(name, labels);
    if (metric.type !== 'histogram') {
      throw new Error(`Metric ${name} is not a histogram`);
    }

    const histogram = metric as Histogram;
    histogram.sampleCount++;
    histogram.sampleSum += value;

    // 更新桶
    for (const bucket of histogram.buckets) {
      if (value <= bucket.upperBound) {
        bucket.cumulativeCount++;
      }
    }
  }

  /**
   * Summary: 观察值
   */
  summaryObserve(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.getOrCreateLabeled(name, labels);
    if (metric.type !== 'summary') {
      throw new Error(`Metric ${name} is not a summary`);
    }

    const summary = metric as Summary;
    summary.sampleCount++;
    summary.sampleSum += value;

    // 简单的近似分位数计算
    // 实际生产环境应该使用更精确的算法
    for (const q of summary.quantiles) {
      // 使用滑动平均近似
      q.value = q.value * 0.9 + value * 0.1;
    }
  }

  /**
   * 导出 Prometheus 格式
   */
  export(options: { includeTimestamp?: boolean; includeHelp?: boolean; includeType?: boolean } = {}): string {
    const lines: string[] = [];

    for (const [name, metric] of this.metrics) {
      // HELP
      if (options.includeHelp !== false) {
        lines.push(`# HELP ${name} ${metric.help}`);
      }

      // TYPE
      if (options.includeType !== false) {
        lines.push(`# TYPE ${name} ${metric.type}`);
      }

      // 根据类型导出
      switch (metric.type) {
        case 'counter':
        case 'gauge':
          lines.push(`${name} ${metric.value}`);
          break;

        case 'histogram':
          const hist = metric as Histogram;
          lines.push(`${name}_count ${hist.sampleCount}`);
          lines.push(`${name}_sum ${hist.sampleSum}`);
          for (const bucket of hist.buckets) {
            const label = bucket.upperBound === Infinity ? '+Inf' : bucket.upperBound;
            lines.push(`${name}_bucket{le="${label}"} ${bucket.cumulativeCount}`);
          }
          break;

        case 'summary':
          const sum = metric as Summary;
          lines.push(`${name}_count ${sum.sampleCount}`);
          lines.push(`${name}_sum ${sum.sampleSum}`);
          for (const q of sum.quantiles) {
            lines.push(`${name}{quantile="${q.quantile}"} ${q.value.toFixed(6)}`);
          }
          break;
      }

      lines.push(''); // 空行分隔
    }

    return lines.join('\n');
  }

  /**
   * 获取或创建带标签的指标
   */
  private getOrCreateLabeled(name: string, labels?: Record<string, string>): MetricValue {
    if (!labels || Object.keys(labels).length === 0) {
      const metric = this.metrics.get(name);
      if (!metric) {
        throw new Error(`Metric not found: ${name}`);
      }
      return metric;
    }

    // 为带标签的指标创建复合名称
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    const fullName = `${name}{${labelStr}}`;

    let metric = this.metrics.get(fullName);
    if (!metric) {
      // 复制原始指标
      const original = this.metrics.get(name);
      if (!original) {
        throw new Error(`Metric not found: ${name}`);
      }

      const newMetric = JSON.parse(JSON.stringify(original)) as MetricValue;
      this.metrics.set(fullName, newMetric);
      return newMetric;
    }

    return metric;
  }
}

/**
 * 全局默认注册表
 */
export const defaultRegistry = new PrometheusRegistry();
