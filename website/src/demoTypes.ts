/**
 * Hợp đồng dữ liệu giữa Python (scripts/export_demo.py) và giao diện TypeScript.
 * Mỗi dataset chứa một cửa sổ minh họa + chỉ số toàn test, không chứa tập train.
 * Đơn vị: Retailrocket = sự kiện giao dịch; Amazon = USD.
 */
export type DemoDatasetId = 'retailrocket' | 'amazon';

export interface DemoContext {
  timestamp: string;
  /** Giá trị để vẽ: số giao dịch hoặc giá USD điều chỉnh. */
  value: number;
  /** Đặc trưng sau log/sin/cos nhưng trước chuẩn hóa; không phải toàn bộ CSV thô. */
  input: number[];
  /** Vector x_t thật, chuẩn hóa bằng trung bình/độ lệch chuẩn của tập học. */
  normalizedInput: number[];
  /** Vector h_t (32 số) lấy từ mô hình đã nạp checkpoint; không phải 32 trọng số. */
  hiddenState: number[];
  /** Phép tính cho thành phần trạng thái đầu tiên, lấy từ cùng checkpoint. */
  calculation: {
    inputTerms: number[];
    previousTerms: number[];
    biasInput: number;
    biasHidden: number;
    preactivation: number;
    stateValue: number;
  };
}

export interface DemoDataset {
  id: DemoDatasetId;
  title: string;
  question: string;
  unit: string;
  stepUnit: string;
  lookback: number;
  inputSize: number;
  hiddenSize: number;
  featureNames: string[];
  outputLayer: { weights: number[]; bias: number };
  /** Hàng đầu tiên của mỗi ma trận, để giải thích cách tính một ô trạng thái. */
  recurrentUnit: { inputWeights: number[]; previousWeights: number[] };
  normalization: { targetMean: number; targetScale: number };
  /** L quan sát liên tiếp và đều đứng TRƯỚC timestamp của target. */
  context: DemoContext[];
  target: {
    timestamp: string;
    value: number;
    /** Dự đoán sau khi hoàn nguyên về đơn vị biểu đồ. */
    prediction: number;
    /** Baseline persistence: giữ nguyên giá trị quan sát gần nhất. */
    baseline: number;
    /** Đầu ra Linear(h_L) trong không gian mục tiêu đã chuẩn hóa. */
    predictedStandardized: number;
    /** Bỏ chuẩn hóa: log1p(count) hoặc log return tùy dataset. */
    predictedTransformed: number;
    absoluteError: number;
    baselineAbsoluteError: number;
  };
  /** MAE/RMSE tính trên TOÀN tập kiểm tra, không chỉ mẫu ở context/target. */
  metrics: {
    rnnMae: number;
    baselineMae: number;
    rnnRmse: number;
    baselineRmse: number;
    testCount: number;
  };
  notes: {
    input: string;
    output: string;
    limitation: string;
    display: string;
    selection: string;
  };
  source: { url: string; clockNote: string };
  /** Bằng chứng exporter đã đối chiếu cửa sổ, checkpoint, CSV và phép truy hồi. */
  verification: {
    status: 'passed';
    targetIndex: number;
    checkpointSha256: string;
    normalizedInputsMatchSavedWindow: boolean;
    contextStrictlyBeforeTarget: boolean;
    predictionMatchesSavedCSV: boolean;
    predictionAbsoluteDifference: number;
    manualRecurrenceMaximumAbsoluteError: number;
    fullTestMetricsRecomputed: boolean;
  };
}

export interface DemoBundle {
  datasets: DemoDataset[];
}
