import type { DemoDataset } from '../../demoTypes';
import { formatNumber as n } from '../../types';

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Ví dụ ngay trong luồng: tách phép tính ô 1 từ checkpoint, không phải mạng chỉ có 1 ô.
 * Khi hoạt ảnh đang nhận đầu vào, giữ kết quả tanh ẩn đến pha trạng thái mới.
 */
export default function RNNCalculation({
  data,
  read,
  pending,
}: {
  data: DemoDataset;
  read: number;
  pending: boolean;
}) {
  const calculation = read ? data.context[read - 1].calculation : null;
  return (
    <div className="stage-rnn-calculation">
      <header>
        <strong>RNN</strong>
        <span>Ví dụ: tính ô 1 / {data.hiddenSize}</span>
      </header>
      <p>Nhân từng số với trọng số, rồi cộng:</p>
      <dl className="stage-rnn-terms">
        <div>
          <dt>{data.inputSize} tích từ dữ liệu mới</dt>
          <dd>{calculation ? n(sum(calculation.inputTerms), 4) : '—'}</dd>
        </div>
        <div>
          <dt>+ {data.hiddenSize} tích từ trạng thái cũ</dt>
          <dd>{calculation ? n(sum(calculation.previousTerms), 4) : '0'}</dd>
        </div>
        <div>
          <dt>+ Hai độ lệch đã học</dt>
          <dd>{calculation ? n(calculation.biasInput + calculation.biasHidden, 4) : '—'}</dd>
        </div>
      </dl>
      <div className="stage-rnn-result">
        {calculation ? (
          <>
            tanh({n(calculation.preactivation, 4)}) ≈{' '}
            <b>{pending ? '…' : n(calculation.stateValue, 4)}</b>
          </>
        ) : (
          'Cộng 3 dòng → tanh → ô 1 mới'
        )}
      </div>
      <small>
        tanh đưa tổng về khoảng −1 đến 1.
        <br />
        {data.hiddenSize - 1} ô còn lại dùng các trọng số riêng.
      </small>
    </div>
  );
}
