/** Reject high-cardinality / sensitive metric labels. */
const FORBIDDEN_LABEL_KEYS = /(email|documentId|userId|noticeBody|token|secret|signedUrl)/i;

export function assertSafeMetricLabels(labels: Record<string, string>): void {
  for (const [key, value] of Object.entries(labels)) {
    if (FORBIDDEN_LABEL_KEYS.test(key)) {
      throw new Error(`Metric label key "${key}" is forbidden`);
    }
    if (value.length > 64) {
      throw new Error(`Metric label value for "${key}" exceeds 64 characters`);
    }
    if (value.includes('@') || value.includes('http')) {
      throw new Error(`Metric label value for "${key}" looks sensitive`);
    }
  }
}

export type CounterSample = {
  name: string;
  value: number;
  labels?: Record<string, string>;
};

/** In-memory counter registry for tests and local aggregation. */
export class MetricsRegistry {
  private counters = new Map<string, number>();

  increment(name: string, labels?: Record<string, string>, by = 1): void {
    if (labels) assertSafeMetricLabels(labels);
    const key = labels ? `${name}|${JSON.stringify(labels)}` : name;
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  get(name: string, labels?: Record<string, string>): number {
    const key = labels ? `${name}|${JSON.stringify(labels)}` : name;
    return this.counters.get(key) ?? 0;
  }

  snapshot(): CounterSample[] {
    return [...this.counters.entries()].map(([key, value]) => {
      const [name, labelsJson] = key.split('|');
      return {
        name: name!,
        value,
        labels: labelsJson ? (JSON.parse(labelsJson) as Record<string, string>) : undefined,
      };
    });
  }
}
