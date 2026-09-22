import type { DemoDataset } from '../../demoTypes';
import { formatNumber as n } from '../../types';

/** Chỉ hiện sau khi đọc hết cửa sổ; Linear không xuất trực tiếp USD hay số sự kiện. */
export default function PredictionReadout({ data }: { data: DemoDataset }) {
  return (
    <div className="stage-prediction-readout" aria-label="Từ trạng thái cuối đến dự đoán">
      <div className="stage-linear-result">
        <span>1. Linear: {data.hiddenSize} tích + độ lệch</span>
        <strong>{n(data.target.predictedStandardized, 4)}</strong>
      </div>
      <p>z: số chuẩn hóa, chưa mang đơn vị {data.unit}.</p>
      <div className="stage-conversion-step">
        <span>2. z × độ lệch chuẩn + trung bình (tập học)</span>
        <p>
          ({n(data.target.predictedStandardized, 4)}) × {n(data.normalization.targetScale, 4)} +{' '}
          {n(data.normalization.targetMean, 6)} ≈{' '}
          <b>{n(data.target.predictedTransformed, data.id === 'amazon' ? 8 : 4)}</b>
        </p>
      </div>
      <div className="stage-conversion-step">
        <span>
          {data.id === 'amazon'
            ? '3. Giá phiên cuối × exp(lợi suất log)'
            : '3. Hoàn tác log1p, chặn kết quả âm về 0'}
        </span>
        <p>
          {data.id === 'amazon'
            ? `${n(data.target.baseline, 4)} × exp(${n(data.target.predictedTransformed, 8)})`
            : `max(0; exp(${n(data.target.predictedTransformed, 4)}) − 1)`}
        </p>
        <strong className="stage-converted-result">
          ≈ {n(data.target.prediction, 2)} <small>{data.unit}</small>
        </strong>
      </div>
      <p className="stage-rounding-note">exp(a) = eᵃ. Các số hiển thị được làm tròn.</p>
    </div>
  );
}
