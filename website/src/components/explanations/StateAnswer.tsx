import { ArrowRight, RotateCcw } from 'lucide-react';
import type { DemoDataset } from '../../demoTypes';
import { formatAnswerNumber as number } from './formatNumber';

interface StateValuesProps {
  values: number[];
  label: string;
}

/** Màu chỉ mã hóa giá trị số, không gán ý nghĩa “xu hướng” cho từng phần tử. */
function StateValues({ values, label }: StateValuesProps) {
  return (
    <div
      className="quick-state-values"
      role="img"
      aria-label={`${label}: ${values.map((value) => number(value)).join('; ')}`}
    >
      {values.map((value, index) => (
        <i
          key={index}
          title={`h[${index}]: ${number(value, 4)}`}
          style={{
            background:
              value === 0
                ? '#e3e9df'
                : value > 0
                  ? `rgba(54,94,235,${0.2 + Math.abs(value) * 0.8})`
                  : `rgba(170,114,67,${0.2 + Math.abs(value) * 0.8})`,
          }}
        />
      ))}
    </div>
  );
}

interface StateAnswerProps {
  data: DemoDataset;
  read: number;
}

/** Đọc hai trạng thái liên tiếp đã lưu từ checkpoint; không tính RNN mới. */
export default function StateAnswer({ data, read }: StateAnswerProps) {
  const step = Math.max(0, Math.min(read, data.lookback));
  const zero = Array<number>(data.hiddenSize).fill(0);

  // context[0] là trạng thái SAU quan sát đầu tiên. Vì vậy tại bước t,
  // hₜ nằm ở [t - 1], còn hₜ₋₁ nằm ở [t - 2]; bước đầu dùng h₀ = 0.
  const previous = step > 1 ? data.context[step - 2].hiddenState : zero;
  const current = step ? data.context[step - 1].hiddenState : zero;

  return (
    <>
      <h3>Thông tin được mang sang bước tiếp theo</h3>
      <p className="quick-lead">
        Trạng thái ẩn (hidden state) là một nhóm số do mạng tính ra. RNN kết hợp trạng thái trước
        với dữ liệu mới để cập nhật nhóm số này.
      </p>
      <p>
        Nhóm chọn <code>hidden_size={data.hiddenSize}</code> khi tạo mô hình. Đây là số giá trị
        trong trạng thái, khác với {data.inputSize} đặc trưng đầu vào và {data.lookback}{' '}
        {data.stepUnit} của chuỗi. Cả {data.hiddenSize} giá trị được tính lại sau mỗi bước; nhóm
        chưa chứng minh kích thước này là tối ưu.
      </p>

      <div className="quick-state-flow">
        <div className="quick-state-card">
          <span>Trạng thái trước · hₜ₋₁</span>
          <StateValues values={previous} label="Trạng thái trước" />
          <p>
            {step > 1 ? `Sau ${step - 1} ${data.stepUnit}` : `Ban đầu: ${data.hiddenSize} số 0`}
          </p>
        </div>

        <ArrowRight className="quick-flow-arrow" aria-hidden="true" />

        <div className="quick-state-cell">
          <span>Dữ liệu bước {step || 1} · xₜ</span>
          <strong>RNN</strong>
          <span>Cùng bộ trọng số</span>
        </div>

        <ArrowRight className="quick-flow-arrow" aria-hidden="true" />

        <div className="quick-state-card quick-current-state">
          <span>Trạng thái mới · hₜ</span>
          <StateValues values={current} label="Trạng thái mới" />
          <p>{step ? `Sau ${step} ${data.stepUnit}` : 'Chưa bắt đầu đọc chuỗi'}</p>
        </div>
      </div>

      <p className="quick-carry">
        <RotateCcw size={19} aria-hidden="true" />
        Sang bước kế tiếp, trạng thái mới trở thành trạng thái trước.
      </p>
      <p className="quick-note">
        Mỗi ô là một trong {data.hiddenSize} giá trị thật của mô hình. Không gán sẵn ý nghĩa như “xu
        hướng” cho từng ô. Trong thí nghiệm này, mỗi cửa sổ mới bắt đầu từ trạng thái 0.
      </p>
    </>
  );
}
