import { ArrowRight } from 'lucide-react';
import { useRef } from 'react';
import { getHandoverPhase } from '../../domain/demo/stateHandover';
import StateHandover from './StateHandover';
import CodeLink from './CodeLink';
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
  onCalculate,
  onCode,
}: {
  data: DemoDataset;
  read: number;
  predicted: boolean;
  progress: number;
  snapshot: boolean;
  evaluated: boolean;
  onCalculate: () => void;
  onCode: () => void;
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
  const phaseMessage = predicted
    ? `Đã đọc đủ ${data.lookback} ${data.stepUnit}. Dự báo dùng trọng số RNN đã học.`
    : read === 0
      ? 'Bắt đầu: nhận dữ liệu đầu tiên cùng trạng thái bằng 0.'
      : transferring
        ? `Dùng lại ${data.hiddenSize} số vừa tạo làm trạng thái trước của bước ${read + 1}.`
        : pending
          ? phase === 'input'
            ? `Bước ${read}: nhận dữ liệu mới và trạng thái từ bước trước.`
            : `Bước ${read}: RNN kết hợp hai đầu vào để cập nhật trạng thái.`
          : `Bước ${read}: đã cập nhật ${data.hiddenSize} số trạng thái. Trọng số giữ nguyên.`;
  return (
    <div
      className={`stage-mechanism ${evaluated ? 'is-context' : ''} ${predicted ? 'is-result' : ''}`}
      data-handover={phase}
      aria-label="Đầu vào và trạng thái trước đi qua RNN để cập nhật trạng thái; trạng thái mới được dùng ở bước tiếp theo"
    >
      <div ref={root} className="stage-mechanism-grid">
        <div className="stage-inputs">
          <div className="stage-input-block">
            <span>
              <b className="stage-flow-number">1</b> Dữ liệu mới · {data.inputSize} số
            </span>
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
          <strong>
            <b className="stage-flow-number">2</b> RNN
          </strong>
          <span>Dữ liệu mới + trạng thái trước</span>
          <small>{phase === 'update' ? 'Đang cập nhật…' : 'Cùng trọng số đã học'}</small>
        </div>
        <ArrowRight className="stage-arrow" size={24} aria-hidden="true" />
        <div
          className={`stage-memory ${pending ? 'is-pending' : ''} ${transferring ? 'is-transferring' : ''}`}
        >
          <span>
            <b className="stage-flow-number">3</b>{' '}
            {read === data.lookback ? 'Trạng thái cuối · hₜ' : 'Trạng thái mới · hₜ'}
          </span>
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
          <small className="stage-hidden-definition">
            {data.hiddenSize} số tóm tắt chuỗi đã đọc.
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
          <span>
            <b className="stage-flow-number">4</b> Tạo 1 dự báo
          </span>
          <small>Trạng thái cuối → Linear</small>
          <small className="stage-output-conversion">{OUTPUT_COPY[data.id].conversion}</small>
          <strong>
            {predicted
              ? amount(data, data.target.prediction)
              : `Chờ đủ ${data.lookback} ${data.stepUnit}`}
          </strong>
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
      <div className="stage-feedback">
        <p>{phaseMessage}</p>
        <div className="stage-mechanism-actions">
          <button
            className="stage-calculation-trigger"
            onClick={onCalculate}
            aria-haspopup="dialog"
          >
            Xem phép tính
          </button>
          {!predicted && <CodeLink source="data" onOpen={onCode} />}
          <CodeLink source="model" onOpen={onCode} />
          <CodeLink source="training" onOpen={onCode} />
        </div>
      </div>
    </div>
  );
}
