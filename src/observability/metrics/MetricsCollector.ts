/**
 * Prometheus 指标收集器
 */

export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export class MetricsCollector {
  private metrics: Map<string, Metric>;

  constructor() {
    this.metrics = new Map();
  }

  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const metric = this.metrics.get(key);
    if (metric) {
      metric.value++;
      metric.timestamp = Date.now();
    } else {
      this.metrics.set(key, {
        name,
        type: 'counter',
        value: 1,
        labels,
        timestamp: Date.now()
      });
    }
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.metrics.set(key, {
      name,
      type: 'gauge',
      value,
      labels,
      timestamp: Date.now()
    });
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.metrics.set(key, {
      name,
      type: 'histogram',
      value,
      labels,
      timestamp: Date.now()
    });
  }

  exportPrometheus(): string {
    const lines: string[] = [];
    for (const metric of this.metrics.values()) {
      const labelsStr = metric.labels
        ? '{' + Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}'
        : '';
      lines.push(`${metric.name}${labelsStr} ${metric.value} ${metric.timestamp}`);
    }
    return lines.join('\n');
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    const labelsKey = labels ? Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`).join(',') : '';
    return `${name}:${labelsKey}`;
  }
}

export const globalMetricsCollector = new MetricsCollector();
