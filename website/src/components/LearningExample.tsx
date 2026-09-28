// Điều khiển ví dụ học một trạng thái. Công thức thuần nằm ở domain/learning/scalarRnn.ts.
import { useEffect, useId, useState } from 'react';
import { ArrowRight, ChevronDown, RotateCcw } from 'lucide-react';
import {
  EXAMPLE_INPUT,
  EXAMPLE_TARGET,
  INITIAL_WEIGHTS,
  LEARNING_RATE,
  scalarForward,
  scalarGradient,
  scalarUpdate,
  type ScalarWeights,
} from './learningMath';
import './LearningExample.css';

const before = scalarGradient(EXAMPLE_INPUT, EXAMPLE_TARGET);
const updatedWeights = scalarUpdate(INITIAL_WEIGHTS, before.gradient);
const after = scalarGradient(EXAMPLE_INPUT, EXAMPLE_TARGET, updatedWeights);
const number = (value: number, digits = 3) =>
  value.toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const parameters: [keyof ScalarWeights, string][] = [
  ['wx', 'wₓ'],
  ['wh', 'wₕ'],
  ['b', 'b'],
  ['wy', 'wᵧ'],
  ['by', 'bᵧ'],
];
const phaseCopy = [
  'Cùng một chuỗi đầu vào, cùng đáp án 0,300. Lần này ta sẽ thay đổi trọng số.',
  'Dự đoán 0,470 lớn hơn đáp án 0,300. Ta tính sai số và gradient.',
  'Gradient cho biết loss thay đổi thế nào khi từng tham số thay đổi.',
  'Cập nhật các tham số, rồi chạy lại cùng chuỗi đầu vào từ trạng thái ban đầu bằng 0.',
  'Dự đoán mới là 0,351, gần đáp án 0,300 hơn. Trong lần cập nhật này, loss giảm.',
];

export default function LearningExample({ onFocus }: { onFocus?: () => void }) {
  const sliderId = useId();
  const [firstInput, setFirstInput] = useState(0.2);
  const [phase, setPhase] = useState(0);
  const [running, setRunning] = useState(false);
  const current = scalarForward([firstInput, -0.1, 0.4]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setPhase((value) => Math.min(4, value + 1)), 1100);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (phase === 4) setRunning(false);
  }, [phase]);

  function learn() {
    onFocus?.();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase(4);
      return;
    }
    setPhase(1);
    setRunning(true);
  }

  return (
    <div className="learning-example" onFocusCapture={onFocus} onPointerDown={onFocus}>
      <div className="learning-example-intro">
        <h3>Hai thay đổi khác nhau: đầu vào và trọng số</h3>
        <p>
          Để nhìn rõ cách tính, ví dụ này dùng chuỗi 3 bước, mỗi bước có 1 giá trị đầu vào và 1 giá
          trị trạng thái. Các số dưới đây là số minh họa, không có đơn vị.
        </p>
      </div>

      <div className="learning-input-panel">
        <div className="learning-input-heading">
          <div>
            <h4>Đổi đầu vào, xem dự đoán thay đổi</h4>
            <p>Kéo x₁. Các trọng số giữ nguyên; ảnh hưởng của x₁ đi qua h₁, h₂, h₃ đến dự đoán.</p>
          </div>
          <span>Trọng số ban đầu · cố định</span>
        </div>
        <div className="learning-input-control">
          <label htmlFor={sliderId}>
            Đầu vào đầu tiên x₁ <output htmlFor={sliderId}>{number(firstInput, 2)}</output>
          </label>
          <input
            id={sliderId}
            aria-label="Thay đổi đầu vào x₁"
            type="range"
            min="-0.8"
            max="0.8"
            step="0.01"
            value={firstInput}
            onChange={(event) => setFirstInput(Number(event.target.value))}
          />
          <button
            className="learning-quiet-button"
            onClick={() => setFirstInput(0.2)}
            disabled={Math.abs(firstInput - 0.2) < 1e-9}
          >
            Đặt lại x₁ = 0,20
          </button>
        </div>
        <div
          className="learning-state-flow"
          aria-label="Trạng thái được tính lại sau khi đầu vào thay đổi"
        >
          <div className="learning-initial-state">
            <span>Ban đầu</span>
            <strong>h₀ = 0</strong>
          </div>
          {[firstInput, -0.1, 0.4].map((value, index) => (
            <div className="learning-state-cell" key={index}>
              <ArrowRight aria-hidden="true" size={18} />
              <div>
                <span>
                  x{['₁', '₂', '₃'][index]} = {number(value, 2)}
                </span>
                <strong>
                  h{['₁', '₂', '₃'][index]} = {number(current.states[index])}
                </strong>
                <small>Trạng thái sau bước {index + 1}</small>
              </div>
            </div>
          ))}
          <div className="learning-state-cell learning-live-result">
            <ArrowRight aria-hidden="true" size={18} />
            <div>
              <span>Dự đoán</span>
              <output>{number(current.prediction)}</output>
              <small>Ban đầu: {number(before.prediction)}</small>
            </div>
          </div>
        </div>
        <p className="learning-caption">
          h (hidden state) là trạng thái được truyền từ bước trước sang bước sau. Khi kéo thanh, mô
          hình tính lại chuỗi từ h₀ = 0. Thanh kéo luôn dùng bộ trọng số ban đầu, độc lập với lần
          học minh họa bên dưới.
        </p>
      </div>

      <div className="learning-update-panel">
        <div className="learning-input-heading">
          <div>
            <h4>Giữ đầu vào, cho mô hình học một lần</h4>
            <p>
              Chuỗi cố định: [0,20; −0,10; 0,40]. Đáp án cần học: <b>0,300</b>.
            </p>
          </div>
          <span>Một lần cập nhật bằng SGD</span>
        </div>
        <div className="learning-update-flow">
          <div className={`learning-update-step ${phase === 1 ? 'is-active' : ''}`}>
            <span>1. Dự đoán ban đầu</span>
            <strong>{number(before.prediction)}</strong>
            <small>Loss = {number(before.loss, 6)}</small>
          </div>
          <div className={`learning-update-step ${phase === 2 ? 'is-active' : ''}`}>
            <span>2. Sai số → gradient</span>
            <strong>+{number(before.error)}</strong>
            <small>
              Dự đoán − đáp án
              <br />
              ∂L/∂wₓ = {number(before.gradient.wx, 6)}
            </small>
          </div>
          <div className={`learning-update-step ${phase === 3 ? 'is-active' : ''}`}>
            <span>3. Cập nhật trọng số</span>
            <strong>wₓ = {number(updatedWeights.wx, 6)}</strong>
            <small>
              0,5 − 0,1 × {number(before.gradient.wx, 6)}
              <br />
              Các tham số còn lại cũng được cập nhật.
            </small>
          </div>
          <div className={`learning-update-step learning-after ${phase === 4 ? 'is-active' : ''}`}>
            <span>4. Dự đoán lại</span>
            <strong>{phase === 4 ? number(after.prediction) : '—'}</strong>
            <small>
              {phase === 4 ? `Loss = ${number(after.loss, 6)}` : 'Sau khi cập nhật trọng số'}
            </small>
          </div>
        </div>
        <div className="learning-action-row">
          <button
            className="flow-button learning-run"
            onClick={learn}
            disabled={running || phase === 4}
          >
            {running ? 'Đang học…' : phase === 4 ? 'Đã học một lần' : 'Học một lần'}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button
            className="learning-quiet-button"
            onClick={() => {
              setRunning(false);
              setPhase(0);
            }}
            disabled={phase === 0}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Đặt lại trọng số
          </button>
          <p role="status" aria-live="polite">
            {phaseCopy[phase]}
          </p>
        </div>
        <p className="learning-caption">
          <b>Loss</b> là giá trị đo mức sai của dự đoán. <b>Gradient</b> là đạo hàm của loss theo
          từng tham số. <b>SGD</b> cập nhật tham số theo hướng ngược gradient; 0,1 là tốc độ học
          (learning rate).
        </p>
      </div>

      <details className="learning-math">
        <summary>
          Xem phép tính và các tham số <ChevronDown size={17} />
        </summary>
        <div className="learning-math-body">
          <p>
            Ở mỗi bước: <code>hₜ = tanh(wₓxₜ + wₕhₜ₋₁ + b)</code>. Dự đoán sau bước cuối:{' '}
            <code>ŷ = wᵧh₃ + bᵧ</code>. tanh đưa kết quả vào khoảng (−1, 1).
          </p>
          <p>
            Ví dụ dùng <code>L = ½(ŷ − y)²</code>. Đạo hàm theo dự đoán là{' '}
            <code>∂L/∂ŷ = ŷ − y</code>. Lan truyền ngược qua thời gian (BPTT, Backpropagation
            Through Time) tính gradient của các tham số dùng chung ở cả 3 bước.
          </p>
          <p>
            Với <code>δₜ = ∂L/∂aₜ</code> và <code>aₜ = wₓxₜ + wₕhₜ₋₁ + b</code>:{' '}
            <code>δ₃ = (ŷ − y)wᵧ(1 − h₃²)</code>, <code>δₜ = wₕδₜ₊₁(1 − hₜ²)</code>;{' '}
            <code>∂L/∂wₓ = Σₜ δₜxₜ</code>.
          </p>
          <p>
            SGD (Stochastic Gradient Descent, hạ gradient ngẫu nhiên) dùng quy tắc:{' '}
            <code>θ mới = θ cũ − {number(LEARNING_RATE, 1)} × ∂L/∂θ</code> cho mỗi tham số θ. Ở đây
            gradient được tính từ một chuỗi; mọi gradient dùng bộ tham số ban đầu, trước khi cập
            nhật.
          </p>
          <div className="learning-parameter-table">
            <table>
              <caption>Các giá trị của lần học minh họa</caption>
              <thead>
                <tr>
                  <th>Tham số</th>
                  <th>Ban đầu</th>
                  <th>Gradient</th>
                  <th>Sau cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {parameters.map(([key, symbol]) => (
                  <tr key={key}>
                    <th scope="row">{symbol}</th>
                    <td>{number(INITIAL_WEIGHTS[key], 6)}</td>
                    <td>{number(before.gradient[key], 6)}</td>
                    <td>{number(updatedWeights[key], 6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            wₓ: hệ số của đầu vào; wₕ: hệ số của trạng thái trước; wᵧ: hệ số tạo đầu ra. b và bᵧ là
            độ lệch (bias).
          </p>
          <p>
            <b>Liên hệ với thực nghiệm:</b> hai mô hình RNN có 32 giá trị trạng thái, dùng Adam và
            MSE để học. Ví dụ một trạng thái với SGD và hệ số ½ ở đây chỉ giúp nhìn rõ một lần cập
            nhật; kết quả của nó không phải dự báo trên Shopee Thailand hay FPT.
          </p>
        </div>
      </details>
    </div>
  );
}
