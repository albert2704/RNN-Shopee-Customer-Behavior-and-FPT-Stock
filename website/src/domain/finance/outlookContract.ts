export type Score = { MAE: number; RMSE?: number; direction_accuracy: number; count?: number };
export type OutlookHorizon = {
  months: 1 | 3 | 6;
  sessions: number;
  label: string;
  predicted_close: number;
  predicted_return_pct: number;
  direction: 'up' | 'down' | 'flat';
  target_date: null;
  test: { rnn: Score; persistence: Score; train_mean_return: Score };
  non_overlapping: {
    count: number;
    rnn_mae: number;
    persistence_mae: number;
    direction_accuracy: number;
  };
  test_period: {
    count: number;
    first_origin: string;
    last_origin: string;
    first_target: string;
    last_target: string;
  };
  lookback: number;
  hidden_size: number;
  best_epoch: number;
  epochs_run: number;
  support: {
    status: 'experimental';
    beats_persistence: boolean;
    non_overlapping_count: number;
    reason: string;
  };
};
export type Outlook = {
  schema_version: 1;
  symbol: 'FPT';
  run_id: string;
  observed_through: string;
  last_close: number;
  generated_at: string;
  source: {
    closes_sha256: string;
    provider?: string;
    source_url?: string;
    price_basis?: string;
    adjustment_note?: string;
  };
  horizons: OutlookHorizon[];
  company_documents?: {
    citation_id: string;
    title: string;
    published_at: string;
    period: string;
    source_url: string;
    text: string;
    category: string;
  }[];
};

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isScore(value: unknown): value is Score {
  if (!value || typeof value !== 'object') return false;
  const score = value as Record<string, unknown>;
  return (
    Number.isFinite(score.MAE) &&
    Number.isFinite(score.direction_accuracy) &&
    (score.RMSE === undefined || Number.isFinite(score.RMSE))
  );
}

function isHorizon(value: unknown): value is OutlookHorizon {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, any>;
  return (
    [1, 3, 6].includes(item.months) &&
    Number.isInteger(item.sessions) &&
    typeof item.label === 'string' &&
    Number.isFinite(item.predicted_close) &&
    item.predicted_close > 0 &&
    Number.isFinite(item.predicted_return_pct) &&
    ['up', 'down', 'flat'].includes(item.direction) &&
    item.target_date === null &&
    isScore(item.test?.rnn) &&
    isScore(item.test?.persistence) &&
    isScore(item.test?.train_mean_return) &&
    Number.isInteger(item.non_overlapping?.count) &&
    Number.isFinite(item.non_overlapping?.rnn_mae) &&
    Number.isFinite(item.non_overlapping?.persistence_mae) &&
    Number.isFinite(item.non_overlapping?.direction_accuracy) &&
    Number.isInteger(item.test_period?.count) &&
    isDate(item.test_period?.first_origin) &&
    isDate(item.test_period?.last_origin) &&
    isDate(item.test_period?.first_target) &&
    isDate(item.test_period?.last_target) &&
    Number.isInteger(item.lookback) &&
    Number.isInteger(item.hidden_size) &&
    Number.isInteger(item.best_epoch) &&
    Number.isInteger(item.epochs_run) &&
    item.support?.status === 'experimental' &&
    typeof item.support?.beats_persistence === 'boolean' &&
    Number.isInteger(item.support?.non_overlapping_count) &&
    typeof item.support?.reason === 'string'
  );
}

export function isOutlook(value: unknown): value is Outlook {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, any>;
  return (
    item.schema_version === 1 &&
    item.symbol === 'FPT' &&
    typeof item.run_id === 'string' &&
    isDate(item.observed_through) &&
    Number.isFinite(item.last_close) &&
    item.last_close > 0 &&
    typeof item.generated_at === 'string' &&
    typeof item.source?.closes_sha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(item.source.closes_sha256) &&
    Array.isArray(item.horizons) &&
    [1, 3, 6].every((months) =>
      item.horizons.some((h: unknown) => isHorizon(h) && h.months === months),
    ) &&
    (item.company_documents === undefined ||
      (Array.isArray(item.company_documents) &&
        item.company_documents.every(
          (document: unknown) =>
            !!document &&
            typeof document === 'object' &&
            typeof (document as Record<string, unknown>).citation_id === 'string' &&
            typeof (document as Record<string, unknown>).title === 'string' &&
            typeof (document as Record<string, unknown>).published_at === 'string' &&
            typeof (document as Record<string, unknown>).period === 'string' &&
            typeof (document as Record<string, unknown>).source_url === 'string' &&
            typeof (document as Record<string, unknown>).text === 'string' &&
            typeof (document as Record<string, unknown>).category === 'string',
        )))
  );
}

export function matchesDaily(
  outlook: Outlook,
  observedThrough: string,
  lastClose: number,
  closesSha256: string,
) {
  return (
    outlook.observed_through === observedThrough &&
    Math.abs(outlook.last_close - lastClose) <= Math.max(0.01, Math.abs(lastClose) * 1e-8) &&
    outlook.source.closes_sha256 === closesSha256
  );
}
