import { ArrowRight, Play, RotateCcw } from 'lucide-react';
import {
  EXAMPLE_INPUT,
  EXAMPLE_TARGET,
  INITIAL_WEIGHTS,
  LEARNING_RATE,
  scalarGradient,
  scalarUpdate,
} from '../../domain/learning/scalarRnn';
import { formatAnswerNumber as number } from './formatNumber';

// Tính bằng hàm toán thật, không điền tay các kết quả trên giao diện.
// Cả ba phép tính độc lập với dữ liệu và checkpoint của demo chính.
const before = scalarGradient(EXAMPLE_INPUT, EXAMPLE_TARGET);
const updatedWeights = scalarUpdate(INITIAL_WEIGHTS, before.gradient);
const after = scalarGradient(EXAMPLE_INPUT, EXAMPLE_TARGET, updatedWeights);

const trainingCopy = [
  'Dùng cùng một chuỗi và đáp án để theo dõi một lần cập nhật.',
  'Dự đoán lớn hơn đáp án. Loss đo mức sai; gradient cho biết loss thay đổi theo từng tham số.',
  'SGD cập nhật cả 5 tham số theo hướng ngược gradient. Phép tính dưới minh họa riêng wₓ; kết quả mới dùng tất cả tham số đã đổi.',
  'Chạy lại cùng chuỗi từ h₀ = 0 với trọng số mới. Dự đoán gần đáp án hơn; loss giảm trong lần cập nhật này.',
];

interface TrainingAnswerProps {
  phase: number;
  running: boolean;
  onTrain: () => void;
}

/** Chỉ hiển thị từng giai đoạn; useTrainingReplay quản lý đồng hồ phát. */
export default function TrainingAnswer({ phase, running, onTrain }: TrainingAnswerProps) {
  return (
    <>
      <h3>Một lần học, với các số cụ thể</h3>
      <p className="quick-lead">
        Chuỗi [{EXAMPLE_INPUT.map((value) => number(value, 2)).join('; ')}], đáp án{' '}
        {number(EXAMPLE_TARGET)}. Ví dụ chỉ có một giá trị trạng thái, độc lập với hai mô hình thật.
      </p>

      <div className="quick-training-flow">
        <article className={phase === 1 ? 'is-active' : ''}>
          <span>1. Dự đoán</span>
          <strong>{number(before.prediction)}</strong>
          <p>Loss = {number(before.loss, 6)}</p>
        </article>

        <ArrowRight className="quick-flow-arrow" aria-hidden="true" />

        <article className={phase === 2 ? 'is-active' : ''}>
          <span>2. Cập nhật</span>
          <strong>wₓ = {number(updatedWeights.wx, 6)}</strong>
          <p>
            {number(INITIAL_WEIGHTS.wx, 1)} − {number(LEARNING_RATE, 1)} ×{' '}
            {number(before.gradient.wx, 6)}
          </p>
        </article>

        <ArrowRight className="quick-flow-arrow" aria-hidden="true" />

        <article className={`quick-training-result ${phase === 3 ? 'is-active' : ''}`}>
          <span>3. Dự đoán lại</span>
          <strong>{phase === 3 ? number(after.prediction) : '—'}</strong>
          <p>Loss = {phase === 3 ? number(after.loss, 6) : '…'}</p>
        </article>
      </div>

      <div className="quick-training-action">
        <button type="button" onClick={onTrain} disabled={running}>
          {phase === 3 ? <RotateCcw size={18} /> : <Play size={18} />}
          <span>
            {running ? 'Đang minh họa…' : phase === 3 ? 'Phát lại lần học' : 'Xem một lần học'}
          </span>
        </button>
        <p role="status">{trainingCopy[phase]}</p>
      </div>

      <p className="quick-note">
        Cả 5 tham số đều được cập nhật; ở trên chỉ minh họa wₓ. Loss = ½(dự đoán − đáp án)².
        Gradient là đạo hàm của loss theo tham số. SGD dùng gradient để cập nhật; ở đây tốc độ học
        là {number(LEARNING_RATE, 1)}.
      </p>
    </>
  );
}
