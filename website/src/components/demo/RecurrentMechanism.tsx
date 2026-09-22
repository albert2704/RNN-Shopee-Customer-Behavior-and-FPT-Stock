import { ArrowRight } from 'lucide-react';
import { useRef } from 'react';
import { getHandoverPhase } from '../../domain/demo/stateHandover';
import StateHandover from './StateHandover';
import RNNCalculation from './RNNCalculation';
import type { DemoDataset } from '../../demoTypes';
import { formatNumber as n } from '../../types';
import { formatAmount as amount, stateColor, OUTPUT_COPY } from '../../domain/demo/demoCopy';

/** Minh họa h_t = tanh(W_x x_t + b_x + W_h h_(t-1) + b_h) bằng trạng thái thật đã xuất. */
export default function RecurrentMechanism({
  data,
  read,
  predicted,
  progress,
  snapshot,
  evaluated,
}: {
  data: DemoDataset;
  read: number;
  predicted: boolean;
  progress: number;
  snapshot: boolean;
  evaluated: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const destination = useRef<HTMLDivElement>(null);
  const phase = getHandoverPhase(
    predicted ? data.lookback + 1 : read,
    data.lookback,
    progress,
    snapshot,
  );
  const pending = phase === 'input' || phase === 'update';
  const transferring = phase === 'transfer';
  // read đếm từ 1, mảng đếm từ 0: hiện tại = read-1; trước đó = read-2.
  const point = read ? data.context[read - 1] : null;
  const hidden = point?.hiddenState ?? Array<number>(data.hiddenSize).fill(0);
  // Bước đầu dùng h_0 = 0. Trạng thái mới lấy nguyên từ checkpoint, không suy bằng màu.
  const previous =
    read > 1 ? data.context[read - 2].hiddenState : Array<number>(data.hiddenSize).fill(0);
  // Tên nhóm đầu vào; số liệu trước biến đổi nằm trong CurrentInputs bên cạnh.
  const input = data.id === 'amazon' ? 'Lợi suất log' : 'Hành vi + thời gian';
  return (
    <div
      ref={root}
      className={`stage-mechanism ${evaluated ? 'is-context' : ''}`}
      data-handover={phase}
      aria-label="Đầu vào và trạng thái trước đi qua RNN để cập nhật trạng thái; trạng thái mới được dùng ở bước tiếp theo"
    >
      <div className="stage-mechanism-grid">
        <div className="stage-inputs">
          <div className="stage-input-block">
            <span>Dữ liệu mới · {data.inputSize} số</span>
            <strong>{input}</strong>
            <small>Đã chuẩn hóa · xₜ</small>
          </div>
          <div className="stage-previous">
            <span>Trạng thái trước · {data.hiddenSize} số</span>
            <small>
              {read > 1 ? `Từ ${data.stepUnit} ${read - 1} · hₜ₋₁` : 'Ban đầu: tất cả bằng 0'}
            </small>
            <div
              ref={destination}
              className="stage-previous-values stage-vector"
              role="img"
              aria-label={`Trạng thái trước: ${read > 1 ? read - 1 : 0} ${data.stepUnit} đã đọc`}
            >
              {previous.map((v, i) => (
                <i
                  key={i}
                  title={`h trước[${i}]: ${n(v, 4)}`}
                  style={{ background: stateColor(v) }}
                />
              ))}
            </div>
          </div>
        </div>
        <svg className="stage-join" viewBox="0 0 32 100" aria-hidden="true">
          <path d="M1 24 H10 V50 H28 M1 76 H10 V50 M23 45 L28 50 L23 55" />
        </svg>
        <div className="stage-cell">
          <RNNCalculation data={data} read={read} pending={pending} />
        </div>
        <ArrowRight className="stage-arrow" size={24} aria-hidden="true" />
        <div
          className={`stage-memory ${pending ? 'is-pending' : ''} ${transferring ? 'is-transferring' : ''}`}
        >
          <span>{read === data.lookback ? 'Trạng thái cuối · hₜ' : 'Trạng thái mới · hₜ'}</span>
          <div
            ref={source}
            className="stage-state-grid stage-vector"
            role="img"
            aria-label={`${data.hiddenSize} giá trị trạng thái sau ${read} ${data.stepUnit}`}
          >
            {hidden.map((v, i) => (
              <i key={i} title={`h[${i}]: ${n(v, 4)}`} style={{ background: stateColor(v) }} />
            ))}
          </div>
          <small>Mỗi ô = 1 giá trị trạng thái</small>
          <small className="stage-hidden-definition">
            {data.hiddenSize} số tóm tắt chuỗi đã đọc.
            <br />
            Nhóm đặt hidden_size = {data.hiddenSize}.
          </small>
          <small className="stage-state-sample">
            {pending ? 'Đang tính…' : `Ô 1: ${n(hidden[0], 3)} · Ô 2: ${n(hidden[1], 3)}`}
          </small>
          <div
            className="stage-state-legend"
            aria-label="Màu biểu diễn giá trị âm, bằng 0 hoặc dương"
          >
            <span>
              <i style={{ background: stateColor(-0.7) }} />
              Âm
            </span>
            <span>
              <i style={{ background: stateColor(0) }} />0
            </span>
            <span>
              <i style={{ background: stateColor(0.7) }} />
              Dương
            </span>
          </div>
        </div>
        <ArrowRight
          className={`stage-arrow ${!predicted ? 'waiting' : ''}`}
          size={24}
          aria-hidden="true"
        />
        <div className={`stage-output-block ${predicted ? 'has-output' : ''}`}>
          <span>Tạo 1 dự báo</span>
          <small>Linear: {data.hiddenSize} giá trị trạng thái cuối</small>
          <small className="stage-output-operation">
            × {data.hiddenSize} trọng số, cộng các tích
            <br />+ 1 độ lệch → 1 số chuẩn hóa.
          </small>
          <small className="stage-output-conversion">{OUTPUT_COPY[data.id].conversion}</small>
          <strong>
            {predicted
              ? amount(data, data.target.prediction)
              : `Chờ đủ ${data.lookback} ${data.stepUnit}`}
          </strong>
        </div>
      </div>
      <div className="stage-feedback">
        <p>
          {transferring
            ? `Chuyển cả ${data.hiddenSize} số này sang làm trạng thái trước của bước ${read + 1}.`
            : 'Trọng số = hệ số nhân; độ lệch = số cộng thêm. Cả hai được học khi huấn luyện và giữ nguyên khi dự đoán.'}
        </p>
      </div>
      <StateHandover
        root={root}
        source={source}
        destination={destination}
        values={hidden}
        progress={(progress - 0.58) / 0.42}
        transferring={transferring}
        visible={read > 0 && read <= 2 && read < data.lookback && !predicted}
        layoutKey={`${data.id}:${read}`}
      />
    </div>
  );
}
