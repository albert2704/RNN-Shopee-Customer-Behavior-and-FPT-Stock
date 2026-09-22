// Phòng thí nghiệm minh họa phép truy hồi trên số nhỏ; không huấn luyện lại checkpoint của hai dataset.
import { useEffect, useId, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import './RNNLab.css';

export interface RNNConfig {
  inputs: [number, number, number];
  wx: number;
  wh: number;
  b: number;
  wy: number;
  by: number;
  target: number;
  learningRate: number;
}

export const DEFAULT_RNN_CONFIG: RNNConfig = {
  inputs: [0.2, -0.1, 0.4],
  wx: 0.5,
  wh: 0.8,
  b: 0.1,
  wy: 1.2,
  by: -0.05,
  target: 0.3,
  learningRate: 0.1,
};

type Parameter = 'wx' | 'wh' | 'b' | 'wy' | 'by';
const PARAMETERS: Parameter[] = ['wx', 'wh', 'b', 'wy', 'by'];
const PARAMETER_LABELS: Record<Parameter, string> = {
  wx: 'wₓ',
  wh: 'wₕ',
  b: 'b',
  wy: 'wᵧ',
  by: 'bᵧ',
};

/** Scalar tanh RNN; half-squared-error loss, with exact BPTT derivatives. */
export function computeRNN(overrides: Partial<RNNConfig> = {}) {
  const config: RNNConfig = { ...DEFAULT_RNN_CONFIG, ...overrides };
  const hidden = [0];
  const preActivation: number[] = [];
  const inputContributions: number[] = [];
  const memoryContributions: number[] = [];
  config.inputs.forEach((input, t) => {
    inputContributions.push(config.wx * input);
    memoryContributions.push(config.wh * hidden[t]);
    const z = inputContributions[t] + memoryContributions[t] + config.b;
    preActivation.push(z);
    hidden.push(Math.tanh(z));
  });
  const prediction = config.wy * hidden[3] + config.by;
  const error = prediction - config.target;
  const loss = 0.5 * error ** 2;
  const gradients: Record<Parameter, number> = {
    wx: 0,
    wh: 0,
    b: 0,
    wy: error * hidden[3],
    by: error,
  };
  const hiddenGradients = [0, 0, 0];
  const preActivationGradients = [0, 0, 0];
  let dh = error * config.wy;
  for (let t = 2; t >= 0; t -= 1) {
    hiddenGradients[t] = dh;
    const dz = dh * (1 - hidden[t + 1] ** 2);
    preActivationGradients[t] = dz;
    gradients.wx += dz * config.inputs[t];
    gradients.wh += dz * hidden[t];
    gradients.b += dz;
    dh = dz * config.wh;
  }
  const updated: RNNConfig = { ...config, inputs: [...config.inputs] };
  PARAMETERS.forEach((key) => {
    updated[key] -= config.learningRate * gradients[key];
  });
  return {
    config,
    hidden,
    preActivation,
    inputContributions,
    memoryContributions,
    prediction,
    error,
    loss,
    gradients,
    hiddenGradients,
    preActivationGradients,
    updated,
  };
}

const STEPS = [
  {
    label: 'Đọc chuỗi',
    heading: 'Đọc lần lượt từng giá trị',
    description:
      'Sau mỗi lần đọc, RNN cập nhật trạng thái ẩn: phần thông tin được giữ lại để xử lý giá trị tiếp theo.',
  },
  {
    label: 'Tính tổng',
    heading: 'Tính trạng thái mới',
    description:
      'RNN nhân đầu vào và trạng thái trước với trọng số tương ứng, rồi cộng thêm hệ số b.',
  },
  {
    label: 'Ghi nhớ',
    heading: 'Cập nhật trạng thái sau mỗi lần đọc',
    description:
      'Hàm tanh biến đổi tổng thành trạng thái mới trong khoảng −1 đến 1. Cả ba thời điểm đều dùng cùng bộ trọng số.',
  },
  {
    label: 'Dự đoán',
    heading: 'Tạo dự báo',
    description:
      'Lớp đầu ra dùng trạng thái cuối h₃ để tính dự báo. So sánh dự báo với giá trị thực tế để tính sai số.',
  },
  {
    label: 'Truyền ngược',
    heading: 'Tính gradient',
    description:
      'Lan truyền ngược theo thời gian (BPTT) tính gradient cho từng tham số. Gradient cho biết loss thay đổi thế nào khi tham số thay đổi.',
  },
  {
    label: 'Cập nhật',
    heading: 'Điều chỉnh trọng số',
    description:
      'SGD cập nhật tham số theo gradient và tốc độ học. Bấm cập nhật để xem dự báo và loss thay đổi.',
  },
];

function number(value: number, digits = 4) {
  if (Math.abs(value) < 0.5 * 10 ** -digits) return (0).toFixed(digits);
  return value.toFixed(digits).replace('-', '−');
}

function pythonNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step = 0.05, onChange }: SliderProps) {
  const id = useId();
  return (
    <div className="rnn-slider">
      <label htmlFor={id}>
        {label}
        <output htmlFor={id}>{number(value, 2)}</output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function RNNLab() {
  const [config, setConfig] = useState<RNNConfig>(() => ({
    ...DEFAULT_RNN_CONFIG,
    inputs: [...DEFAULT_RNN_CONFIG.inputs],
  }));
  const [step, setStep] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [detailTab, setDetailTab] = useState<'math' | 'code'>('math');
  const [updateCount, setUpdateCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<{ before: number; after: number } | null>(null);
  const result = useMemo(() => computeRNN(config), [config]);
  const id = useId().replace(/:/g, '');
  const diagramTitleId = `${id}-diagram-title`;
  const diagramDescriptionId = `${id}-diagram-description`;
  const detailId = `${id}-detail`;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (time < 2) setTime((current) => current + 1);
      else setPlaying(false);
    }, 1300);
    return () => window.clearTimeout(timer);
  }, [playing, time]);

  const selectStep = (next: number) => {
    setPlaying(false);
    setStep(next);
    setTime(next >= 3 ? 2 : 0);
  };

  const updateConfig = (next: Partial<RNNConfig>) => {
    setPlaying(false);
    setConfig((current) => ({ ...current, ...next }));
    setLastUpdate(null);
    setUpdateCount(0);
  };

  const reset = () => {
    setPlaying(false);
    setConfig({ ...DEFAULT_RNN_CONFIG, inputs: [...DEFAULT_RNN_CONFIG.inputs] });
    setStep(0);
    setTime(0);
    setUpdateCount(0);
    setLastUpdate(null);
  };

  const play = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step !== 2) setStep(2);
    setTime(0);
    setPlaying(true);
  };

  const applyUpdate = () => {
    const after = computeRNN(result.updated);
    setLastUpdate({ before: result.loss, after: after.loss });
    setConfig(result.updated);
    setUpdateCount((count) => count + 1);
  };

  const code = `import torch

x = torch.tensor([${config.inputs.map(pythonNumber).join(', ')}])
y = torch.tensor(${pythonNumber(config.target)})
wx = torch.tensor(${pythonNumber(config.wx)}, requires_grad=True)
wh = torch.tensor(${pythonNumber(config.wh)}, requires_grad=True)
b  = torch.tensor(${pythonNumber(config.b)}, requires_grad=True)
wy = torch.tensor(${pythonNumber(config.wy)}, requires_grad=True)
by = torch.tensor(${pythonNumber(config.by)}, requires_grad=True)

h = torch.tensor(0.0)
for xt in x:
    h = torch.tanh(wx * xt + wh * h + b)

prediction = wy * h + by
loss = 0.5 * (prediction - y).pow(2)
loss.backward()  # BPTT: PyTorch tính gradient

with torch.no_grad():
    for parameter in [wx, wh, b, wy, by]:
        parameter -= ${pythonNumber(config.learningRate)} * parameter.grad
        parameter.grad.zero_()`;

  const allVisible = step >= 3;
  const visibleTime = step === 0 ? -1 : step === 1 ? 0 : time;

  return (
    <section className="rnn-lab" aria-label="Khám phá RNN từng bước">
      <div className="rnn-lab-topline">
        <span className="rnn-eyebrow">
          <span className="rnn-status-dot" />
          Ví dụ với một nút ẩn
        </span>
        <button className="rnn-text-button" onClick={reset}>
          <RotateCcw size={14} aria-hidden="true" />
          Đặt lại
        </button>
      </div>

      <div className="rnn-workspace">
        <nav className="rnn-step-rail" aria-label="Các bước tìm hiểu RNN">
          <ol>
            {STEPS.map((item, index) => (
              <li key={item.label}>
                <button
                  className={`rnn-step-button ${step === index ? 'rnn-step-current' : ''} ${step > index ? 'rnn-step-past' : ''}`}
                  aria-current={step === index ? 'step' : undefined}
                  onClick={() => selectStep(index)}
                >
                  <span className="rnn-step-number">
                    {step > index ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>
                  <span>{item.label}</span>
                  {step === index && (
                    <ArrowRight className="rnn-step-arrow" size={15} aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="rnn-main">
          <div className="rnn-step-intro" aria-live="polite" aria-atomic="true">
            <span className="rnn-step-counter">
              BƯỚC {String(step + 1).padStart(2, '0')} <span>/ 06</span>
            </span>
            <h3>{STEPS[step].heading}</h3>
            <p>{STEPS[step].description}</p>
          </div>

          <div className={`rnn-diagram-panel ${step === 4 ? 'rnn-backward' : ''}`}>
            <div className="rnn-diagram-topline">
              <span>{step === 4 ? 'LAN TRUYỀN NGƯỢC THEO THỜI GIAN' : 'RNN QUA BA THỜI ĐIỂM'}</span>
              <span className="rnn-shared-badge">Trọng số dùng chung</span>
            </div>
            <svg
              className="rnn-network"
              viewBox="0 0 660 220"
              role="img"
              aria-labelledby={`${diagramTitleId} ${diagramDescriptionId}`}
            >
              <title id={diagramTitleId}>RNN với ba thời điểm và một nút ẩn</title>
              <desc id={diagramDescriptionId}>
                Các đầu vào {config.inputs.join(', ')} được đọc lần lượt, dùng chung một bộ trọng
                số. Trạng thái ban đầu bằng 0.{' '}
                {step >= 3
                  ? `Dự đoán cuối cùng là ${result.prediction.toFixed(4)}.`
                  : `Đang xem thời điểm ${time + 1}.`}
              </desc>
              <defs>
                <marker
                  id={`${id}-arrow`}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 7 4 L 0 7" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </marker>
                <marker
                  id={`${id}-blue-arrow`}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M 0 1 L 7 4 L 0 7"
                    fill="none"
                    stroke="var(--accent, #365eeb)"
                    strokeWidth="1.5"
                  />
                </marker>
              </defs>
              <text className="rnn-svg-small" x="28" y="106" textAnchor="middle">
                h₀
              </text>
              <text className="rnn-svg-small rnn-svg-mono" x="28" y="124" textAnchor="middle">
                0
              </text>
              {[130, 280, 430].map((x, t) => {
                const active = step !== 0 && (allVisible || t <= visibleTime);
                const focused = (step === 1 || step === 2) && time === t;
                const start = t === 0 ? 48 : x - 112;
                return (
                  <g
                    key={t}
                    className={`${active ? 'rnn-node-seen' : ''} ${focused ? 'rnn-node-focused' : ''}`}
                  >
                    <path
                      className={`rnn-memory-edge ${focused && playing ? 'rnn-edge-animated' : ''}`}
                      d={`M${start} 114 H${x - 43}`}
                      markerEnd={`url(#${id}-${active ? 'blue-' : ''}arrow)`}
                    />
                    {t > 0 && (
                      <text className="rnn-svg-tiny" x={x - 76} y="103" textAnchor="middle">
                        wₕ
                      </text>
                    )}
                    <rect
                      className="rnn-input-box"
                      x={x - 43}
                      y="15"
                      width="86"
                      height="35"
                      rx="8"
                    />
                    <text className="rnn-svg-input" x={x} y="37" textAnchor="middle">
                      x{['₁', '₂', '₃'][t]} = {number(config.inputs[t], 2)}
                    </text>
                    <path
                      className="rnn-input-edge"
                      d={`M${x} 52 V72`}
                      markerEnd={`url(#${id}-arrow)`}
                    />
                    <circle className="rnn-node-ring" cx={x} cy="114" r="41" />
                    <circle className="rnn-node-core" cx={x} cy="114" r="34" />
                    <text className="rnn-svg-node-label" x={x} y="107" textAnchor="middle">
                      tanh
                    </text>
                    <text className="rnn-svg-node-value" x={x} y="126" textAnchor="middle">
                      {active ? number(result.hidden[t + 1], 3) : '· · ·'}
                    </text>
                    <text className="rnn-svg-time" x={x} y="175" textAnchor="middle">
                      h{['₁', '₂', '₃'][t]}
                    </text>
                    <text className="rnn-svg-tiny" x={x} y="196" textAnchor="middle">
                      Thời điểm {t + 1}
                    </text>
                  </g>
                );
              })}
              <path
                className={`rnn-output-edge ${allVisible ? 'rnn-output-active' : ''}`}
                d="M473 114 H546"
                markerEnd={`url(#${id}-${allVisible ? 'blue-' : ''}arrow)`}
              />
              <text className="rnn-svg-tiny" x="510" y="101" textAnchor="middle">
                wᵧ, bᵧ
              </text>
              <rect
                className={`rnn-output-box ${allVisible ? 'rnn-output-active' : ''}`}
                x="552"
                y="88"
                width="92"
                height="53"
                rx="10"
              />
              <text className="rnn-svg-node-label" x="598" y="107" textAnchor="middle">
                Dự đoán ŷ
              </text>
              <text className="rnn-svg-node-value" x="598" y="126" textAnchor="middle">
                {allVisible ? number(result.prediction, 3) : '?'}
              </text>
              {step === 4 && (
                <g>
                  <path
                    className="rnn-gradient-edge"
                    d="M598 149 V209 H130 V160"
                    markerEnd={`url(#${id}-blue-arrow)`}
                  />
                  <text className="rnn-svg-gradient-label" x="542" y="203" textAnchor="middle">
                    gradient ←
                  </text>
                </g>
              )}
            </svg>
            <svg
              className="rnn-network-mobile"
              viewBox="0 0 320 405"
              role="img"
              aria-label={`RNN đọc lần lượt ba đầu vào ${config.inputs.join(', ')}. Trạng thái ẩn được truyền từ trên xuống dưới.`}
            >
              <defs>
                <marker
                  id={`${id}-mobile-arrow`}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 7 4 L 0 7" fill="none" stroke="#a5b3a7" strokeWidth="1.5" />
                </marker>
              </defs>
              <text className="rnn-svg-small" x="180" y="20" textAnchor="middle">
                h₀ = 0
              </text>
              {[80, 178, 276].map((y, t) => {
                const active = step !== 0 && (allVisible || t <= visibleTime);
                const focused = (step === 1 || step === 2) && time === t;
                return (
                  <g
                    key={t}
                    className={`${active ? 'rnn-node-seen' : ''} ${focused ? 'rnn-node-focused' : ''}`}
                  >
                    <path
                      className={`rnn-memory-edge ${focused && playing ? 'rnn-edge-animated' : ''}`}
                      d={`M180 ${t === 0 ? 29 : y - 61} V${y - 42}`}
                      markerEnd={`url(#${id}-mobile-arrow)`}
                    />
                    {t > 0 && (
                      <text className="rnn-svg-tiny" x="200" y={y - 48}>
                        wₕ
                      </text>
                    )}
                    <rect
                      className="rnn-input-box"
                      x="10"
                      y={y - 18}
                      width="94"
                      height="36"
                      rx="8"
                    />
                    <text className="rnn-svg-input" x="57" y={y + 4} textAnchor="middle">
                      x{['₁', '₂', '₃'][t]} = {number(config.inputs[t], 2)}
                    </text>
                    <path
                      className="rnn-input-edge"
                      d={`M106 ${y} H137`}
                      markerEnd={`url(#${id}-mobile-arrow)`}
                    />
                    <circle className="rnn-node-ring" cx="180" cy={y} r="41" />
                    <circle className="rnn-node-core" cx="180" cy={y} r="34" />
                    <text className="rnn-svg-node-label" x="180" y={y - 7} textAnchor="middle">
                      tanh
                    </text>
                    <text className="rnn-svg-node-value" x="180" y={y + 12} textAnchor="middle">
                      {active ? number(result.hidden[t + 1], 3) : '· · ·'}
                    </text>
                    <text className="rnn-svg-time" x="236" y={y - 3}>
                      h{['₁', '₂', '₃'][t]}
                    </text>
                    <text className="rnn-svg-tiny" x="236" y={y + 15}>
                      Thời điểm {t + 1}
                    </text>
                  </g>
                );
              })}
              <path
                className={`rnn-output-edge ${allVisible ? 'rnn-output-active' : ''}`}
                d="M180 318 V347"
                markerEnd={`url(#${id}-mobile-arrow)`}
              />
              <text className="rnn-svg-tiny" x="198" y="335">
                wᵧ, bᵧ
              </text>
              <rect
                className={`rnn-output-box ${allVisible ? 'rnn-output-active' : ''}`}
                x="127"
                y="352"
                width="106"
                height="48"
                rx="9"
              />
              <text className="rnn-svg-node-label" x="180" y="369" textAnchor="middle">
                Dự đoán ŷ
              </text>
              <text className="rnn-svg-node-value" x="180" y="389" textAnchor="middle">
                {allVisible ? number(result.prediction, 3) : '?'}
              </text>
              {step === 4 && (
                <>
                  <path
                    className="rnn-gradient-edge"
                    d="M238 376 H311 V80 H224"
                    markerEnd={`url(#${id}-mobile-arrow)`}
                  />
                  <text
                    className="rnn-svg-gradient-label"
                    x="301"
                    y="245"
                    transform="rotate(-90 301 245)"
                  >
                    gradient đi ngược
                  </text>
                </>
              )}
            </svg>
            {(step === 1 || step === 2) && (
              <div className="rnn-time-controls">
                <div className="rnn-time-select" role="group" aria-label="Chọn thời điểm">
                  {[0, 1, 2].map((t) => (
                    <button
                      key={t}
                      className={time === t ? 'rnn-time-current' : ''}
                      aria-pressed={time === t}
                      onClick={() => {
                        setPlaying(false);
                        setTime(t);
                        if (step === 1 && t > 0) setStep(2);
                      }}
                    >
                      t = {t + 1}
                    </button>
                  ))}
                </div>
                <button className="rnn-text-button" onClick={play}>
                  {playing ? (
                    <Pause size={14} aria-hidden="true" />
                  ) : (
                    <Play size={14} aria-hidden="true" />
                  )}
                  {playing ? 'Tạm dừng' : 'Chạy mô phỏng'}
                </button>
              </div>
            )}
          </div>

          <div className="rnn-insight" aria-live="polite" aria-atomic="true">
            {step === 0 && (
              <div className="rnn-start-insight">
                <p>
                  Đọc theo thứ tự <strong>x₁ → x₂ → x₃</strong>. Trong ví dụ này, trạng thái ban đầu{' '}
                  <strong>h₀ = 0</strong>.
                </p>
                <span className="rnn-small-note">
                  Các số này dùng để minh họa phép tính, không lấy từ hai tập dữ liệu trên.
                </span>
              </div>
            )}
            {step === 1 && (
              <>
                <div className="rnn-equation-head">
                  <span>TỔNG TRƯỚC HÀM KÍCH HOẠT</span>
                  <strong>z₁ = {number(result.preActivation[0])}</strong>
                </div>
                <div className="rnn-contribution-grid">
                  <div>
                    <span>Đầu vào · wₓx₁</span>
                    <strong>{number(result.inputContributions[0])}</strong>
                    <small>
                      {number(config.wx, 2)} × {number(config.inputs[0], 2)}
                    </small>
                  </div>
                  <div>
                    <span>Trạng thái trước · wₕh₀</span>
                    <strong>{number(result.memoryContributions[0])}</strong>
                    <small>{number(config.wh, 2)} × 0</small>
                  </div>
                  <div>
                    <span>Hệ số b</span>
                    <strong>{number(config.b)}</strong>
                    <small>Tham số được học khi huấn luyện</small>
                  </div>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div className="rnn-memory-insight">
                  <div>
                    <span className="rnn-insight-tag">TRẠNG THÁI ẨN TẠI t = {time + 1}</span>
                    <p>
                      h{['₁', '₂', '₃'][time]} = tanh({number(result.preActivation[time])})
                    </p>
                  </div>
                  <strong>{number(result.hidden[time + 1])}</strong>
                </div>
                <p className="rnn-small-note">
                  {time === 0
                    ? 'Sau khi đọc giá trị đầu tiên, trạng thái h₁ được dùng để xử lý đầu vào tiếp theo.'
                    : `Trạng thái trước đóng góp ${number(result.memoryContributions[time])}; dữ liệu mới đóng góp ${number(result.inputContributions[time])}; cộng thêm b = ${number(config.b)}.`}{' '}
                  {time === 2 ? 'h₃ được tính từ cả ba đầu vào.' : ''}
                </p>
              </>
            )}
            {step === 3 && (
              <>
                <div className="rnn-metric-grid">
                  <div>
                    <span>Dự đoán ŷ</span>
                    <strong>{number(result.prediction)}</strong>
                    <small>wᵧh₃ + bᵧ</small>
                  </div>
                  <div>
                    <span>Giá trị thực tế y</span>
                    <strong>{number(config.target)}</strong>
                    <small>Giá trị cần dự đoán</small>
                  </div>
                  <div className="rnn-loss-metric">
                    <span>Loss L</span>
                    <strong>{number(result.loss, 6)}</strong>
                    <small>½(ŷ − y)²</small>
                  </div>
                </div>
                <p className="rnn-small-note">
                  Loss đo mức sai lệch; càng thấp càng tốt trên ví dụ này. Hệ số ½ giúp đơn giản hóa
                  đạo hàm.
                </p>
              </>
            )}
            {step === 4 && (
              <>
                <div className="rnn-equation-head">
                  <span>GRADIENT QUA CÁC THỜI ĐIỂM</span>
                  <strong>∂L/∂ŷ = {number(result.error)}</strong>
                </div>
                <div className="rnn-gradient-grid">
                  {[2, 1, 0].map((t) => (
                    <div key={t}>
                      <span>Thời điểm {t + 1}</span>
                      <strong>{number(result.preActivationGradients[t])}</strong>
                      <small>
                        δ{['₁', '₂', '₃'][t]} = ∂L/∂z{['₁', '₂', '₃'][t]}
                      </small>
                    </div>
                  ))}
                </div>
                <p className="rnn-small-note">
                  Vì wₓ, wₕ và b được dùng lại, gradient của chúng là{' '}
                  <strong>tổng đóng góp từ cả 3 thời điểm</strong>. Ví dụ, ∂L/∂wₓ ={' '}
                  {number(result.gradients.wx)}.
                </p>
              </>
            )}
            {step === 5 && (
              <>
                <div className="rnn-update-topline">
                  <div>
                    <span className="rnn-insight-tag">CÔNG THỨC SGD</span>
                    <p>trọng số mới = trọng số − η × gradient</p>
                  </div>
                  <span className="rnn-update-count">{updateCount} lần cập nhật</span>
                </div>
                <table className="rnn-update-table">
                  <caption>Giá trị trước và sau cập nhật</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tham số</th>
                      <th scope="col">Hiện tại</th>
                      <th scope="col">Gradient</th>
                      <th scope="col">Sau SGD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PARAMETERS.map((key) => (
                      <tr key={key}>
                        <th scope="row">{PARAMETER_LABELS[key]}</th>
                        <td>{number(config[key])}</td>
                        <td>{number(result.gradients[key])}</td>
                        <td>{number(result.updated[key])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="rnn-update-actions">
                  <Slider
                    label="Tốc độ học η"
                    value={config.learningRate}
                    min={0.01}
                    max={0.3}
                    step={0.01}
                    onChange={(learningRate) => updateConfig({ learningRate })}
                  />
                  <button className="rnn-primary-button" onClick={applyUpdate}>
                    Cập nhật một lần
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
                {lastUpdate && (
                  <p className="rnn-update-feedback">
                    <Check size={15} aria-hidden="true" />
                    Loss: {number(lastUpdate.before, 6)} → {number(lastUpdate.after, 6)}.{' '}
                    {lastUpdate.after < lastUpdate.before
                      ? ''
                      : 'Thử giảm tốc độ học để điều chỉnh nhẹ hơn.'}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="rnn-navigation">
            <button
              className="rnn-secondary-button"
              disabled={step === 0}
              onClick={() => selectStep(step - 1)}
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Quay lại
            </button>
            <span className="rnn-navigation-hint">
              {step + 1} / {STEPS.length}
            </span>
            {step < 5 ? (
              <button className="rnn-primary-button" onClick={() => selectStep(step + 1)}>
                Tiếp theo
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            ) : (
              <button className="rnn-secondary-button" onClick={() => selectStep(0)}>
                <RotateCcw size={15} aria-hidden="true" />
                Xem lại từ đầu
              </button>
            )}
          </div>

          <div className="rnn-disclosures">
            <details className="rnn-disclosure">
              <summary>
                <span>
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Đổi đầu vào và tham số
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className="rnn-playground">
                <p className="rnn-small-note">Kéo thanh trượt để thay đổi giá trị.</p>
                <div className="rnn-slider-section">
                  <h4>Đầu vào và giá trị cần dự đoán</h4>
                  <div className="rnn-slider-grid">
                    {config.inputs.map((value, t) => (
                      <Slider
                        key={t}
                        label={`Đầu vào x${['₁', '₂', '₃'][t]}`}
                        value={value}
                        min={-1}
                        max={1}
                        onChange={(next) => {
                          const inputs = [...config.inputs] as RNNConfig['inputs'];
                          inputs[t] = next;
                          updateConfig({ inputs });
                        }}
                      />
                    ))}
                    <Slider
                      label="Giá trị thực tế y"
                      value={config.target}
                      min={-1}
                      max={1}
                      onChange={(target) => updateConfig({ target })}
                    />
                  </div>
                </div>
                <div className="rnn-slider-section">
                  <h4>Trọng số và hệ số b</h4>
                  <div className="rnn-slider-grid">
                    {PARAMETERS.map((key) => (
                      <Slider
                        key={key}
                        label={PARAMETER_LABELS[key]}
                        value={config[key]}
                        min={key === 'b' || key === 'by' ? -1 : -2}
                        max={key === 'b' || key === 'by' ? 1 : 2}
                        step={0.01}
                        onChange={(value) => updateConfig({ [key]: value })}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </details>
            <details className="rnn-disclosure">
              <summary>
                <span>
                  <Code2 size={16} aria-hidden="true" />
                  Công thức và mã PyTorch
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className="rnn-detail-content">
                <div className="rnn-detail-tabs" role="group" aria-label="Cách xem chi tiết">
                  <button
                    aria-pressed={detailTab === 'math'}
                    className={detailTab === 'math' ? 'rnn-tab-current' : ''}
                    aria-controls={detailId}
                    onClick={() => setDetailTab('math')}
                  >
                    Công thức
                  </button>
                  <button
                    aria-pressed={detailTab === 'code'}
                    className={detailTab === 'code' ? 'rnn-tab-current' : ''}
                    aria-controls={detailId}
                    onClick={() => setDetailTab('code')}
                  >
                    PyTorch
                  </button>
                </div>
                <div id={detailId}>
                  {detailTab === 'math' ? (
                    <div className="rnn-math-sheet">
                      <div>
                        <span>01 · Lan truyền thuận</span>
                        <p>
                          zₜ = wₓxₜ + wₕhₜ₋₁ + b<br />
                          hₜ = tanh(zₜ), h₀ = 0<br />ŷ = wᵧh₃ + bᵧ
                          <br />L = ½(ŷ − y)²
                        </p>
                      </div>
                      <div>
                        <span>02 · Lan truyền ngược</span>
                        <p>
                          δ₃ = (ŷ − y)wᵧ(1 − h₃²)
                          <br />
                          δₜ = δₜ₊₁wₕ(1 − hₜ²)
                          <br />
                          ∂L/∂wₓ = Σₜ δₜxₜ
                          <br />
                          ∂L/∂wₕ = Σₜ δₜhₜ₋₁
                          <br />
                          ∂L/∂b = Σₜ δₜ
                          <br />
                          ∂L/∂wᵧ = (ŷ − y)h₃
                          <br />
                          ∂L/∂bᵧ = ŷ − y
                        </p>
                      </div>
                      <div>
                        <span>03 · Cập nhật</span>
                        <p>θ ← θ − η ∂L/∂θ</p>
                      </div>
                      <p className="rnn-small-note">
                        t chạy từ 1 đến 3; δₜ là gradient theo zₜ; θ là một tham số bất kỳ. Các giá
                        trị hiển thị đã được làm tròn.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="rnn-small-note rnn-code-note">
                        Mã dùng các giá trị đang hiển thị. PyTorch tính gradient bằng autograd. Ví
                        dụ chỉ cập nhật một lần trên một chuỗi, chưa phải quy trình huấn luyện đầy
                        đủ.
                      </p>
                      <pre
                        className="rnn-code"
                        tabIndex={0}
                        aria-label="Mã PyTorch cho một bước huấn luyện RNN"
                      >
                        <code>{code}</code>
                      </pre>
                    </>
                  )}
                </div>
              </div>
            </details>
          </div>
          <p className="rnn-model-note">
            Ví dụ dùng một nút ẩn để dễ theo dõi. Các mô hình trong thí nghiệm dùng trạng thái ẩn
            nhiều chiều.
          </p>
        </div>
      </div>
    </section>
  );
}

export default RNNLab;
