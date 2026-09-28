// Kiểu dữ liệu và định dạng của phụ lục phân tích; schema của demo chính nằm ở demoTypes.ts.
export type DatasetId = 'shopee' | 'fpt';
export type Point = {
  timestamp: string;
  actual: number;
  split?: string;
  [key: string]: number | string | undefined;
};
export interface Dataset {
  id: DatasetId;
  title: string;
  subtitle: string;
  source: { label: string; url: string; license?: string };
  unit: string;
  frequency: string;
  summary: {
    rows: number;
    rawRows?: number;
    period: string | string[];
    features: string[] | number;
    [key: string]: unknown;
  };
  description: string;
  cleaning: string[];
  protocol: {
    lookback: number;
    train: { n: number; start: string; end: string };
    validation: { n: number; start: string; end: string };
    test: { n: number; start: string; end: string };
    policy: string;
    target: string;
    transform: string;
  };
  metrics: { model: string; mae: number; rmse: number }[];
  series: Point[];
  overviewSeries: Point[];
  history: Record<string, { epoch: number; train: number; validation: number }[]>;
  limitations: string[];
  display: {
    fullTestPointCount: number;
    displayedTestPointCount: number;
    downsampleMethod: string;
  };
  models: Record<string, { bestEpoch: number; epochsRun: number; parameters: number }>;
}
export const modelLabels: Record<string, string> = {
  actual: 'Quan sát',
  rnn: 'RNN',
  gru: 'GRU',
  persistence: 'Giá trị trước',
  seasonal: 'Cùng thứ tuần trước',
  train_mean: 'Trung bình train',
};
export const colors: Record<string, string> = {
  actual: '#23372e',
  rnn: '#365eeb',
  gru: '#c67239',
  persistence: '#9b54a5',
  seasonal: '#718a3d',
  train_mean: '#718a3d',
};
export const formatNumber = (n: number, digits = 2) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(n);
export function formatDate(value: string, time = false) {
  // Giữ nguyên nhãn thời gian của dữ liệu; không đổi theo múi giờ của trình duyệt.
  // Với chuỗi chưa ghi múi giờ, UTC chỉ đóng vai trò quy ước hiển thị.
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value) ? `${value}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' } : { timeZone: 'UTC' }),
  }).format(date);
}
