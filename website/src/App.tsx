// Trang phụ lục phân tích dữ liệu; màn hình trình diễn chính bắt đầu ở components/DemoStage.tsx.
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  Code2,
  Download,
  ExternalLink,
  Layers3,
  Menu,
  MoveRight,
  ShoppingBag,
  TrendingUp,
  RotateCcw,
  X,
} from 'lucide-react';
import RNNLab from './components/RNNLab';
import SignalChart from './components/SignalChart';
import {
  colors,
  modelLabels,
  formatDate,
  formatNumber,
  type Dataset,
  type DatasetId,
} from './types';

const datasetChoices = [
  {
    id: 'shopee' as DatasetId,
    name: 'Shopee Thailand',
    type: 'Hành vi khách hàng · mô phỏng',
    Icon: ShoppingBag,
    question: 'Ngày mai có bao nhiêu đơn hàng?',
  },
  {
    id: 'fpt' as DatasetId,
    name: 'FPT',
    type: 'Giá cổ phiếu',
    Icon: TrendingUp,
    question: 'Giá đóng cửa phiên sau là bao nhiêu?',
  },
];
type DataMap = Partial<Record<DatasetId, Dataset>>;
type ErrorMap = Partial<Record<DatasetId, boolean>>;
function Logo() {
  return (
    <a className="wordmark" href="#top" aria-label="Sequence, về đầu trang">
      <svg viewBox="0 0 34 34" width="34" height="34" aria-hidden="true">
        <rect width="34" height="34" rx="10" fill="currentColor" />
        <path
          d="M8 21V13h9v8h9V13"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        sequence<span className="logo-dot">.</span>
      </span>
    </a>
  );
}

function HeroDemo() {
  const [step, setStep] = useState(1);
  const inputs = [0.2, -0.1, 0.4];
  let previous = 0;
  const states = inputs.map((x) => {
    previous = Math.tanh(0.5 * x + 0.8 * previous + 0.1);
    return previous;
  });
  return (
    <div className="hero-demo">
      <div className="demo-top">
        <span>
          <span className="live-dot" /> Bên trong một RNN
        </span>
        <span>t = {step + 1}</span>
      </div>
      <div className="demo-equation">
        h<sub>t</sub> = tanh(
        <span>
          w<sub>x</sub>x<sub>t</sub>
        </span>{' '}
        +{' '}
        <span>
          w<sub>h</sub>h<sub>t−1</sub>
        </span>{' '}
        + b)
      </div>
      <div className="demo-network" aria-label="Chọn một trong ba bước thời gian">
        {inputs.map((x, i) => (
          <div className="demo-unit" key={i}>
            <span className="demo-input">
              x<sub>{i + 1}</sub> <b>{x.toFixed(1)}</b>
            </span>
            <div className="input-stem" />
            <button
              onClick={() => setStep(i)}
              className={`state-node ${step === i ? 'active' : ''} ${step > i ? 'visited' : ''}`}
              aria-pressed={step === i}
              aria-label={`Xem trạng thái ở bước ${i + 1}`}
            >
              <span>
                h<sub>{i + 1}</sub>
              </span>
              <small>{states[i].toFixed(3)}</small>
            </button>
            {i < 2 && <MoveRight className="node-arrow" size={24} strokeWidth={1.3} />}
            <span className="demo-time">Bước {i + 1}</span>
          </div>
        ))}
      </div>
      <div className="demo-bottom">
        <div>
          <span>Trạng thái hiện tại</span>
          <strong>{states[step].toFixed(4)}</strong>
        </div>
        <p>
          Trạng thái mới phụ thuộc vào
          <br />
          đầu vào và trạng thái trước.
        </p>
      </div>
      <div className="demo-note">Ví dụ với một nút ẩn</div>
    </div>
  );
}

function DatasetExplorer({
  data,
  selected,
  setSelected,
  errors,
  retry,
}: {
  data: DataMap;
  selected: DatasetId;
  setSelected: (v: DatasetId) => void;
  errors: ErrorMap;
  retry: () => void;
}) {
  const [mode, setMode] = useState<'overview' | 'forecast'>('overview');
  const [range, setRange] = useState<'all' | 'recent'>('all');
  const [visible, setVisible] = useState(['actual', 'rnn', 'gru']);
  const [showTable, setShowTable] = useState(false);
  const d = data[selected];
  useEffect(() => {
    setVisible(['actual', 'rnn', 'gru']);
    setRange('all');
    setShowTable(false);
  }, [selected]);
  const chartPoints = d
    ? mode === 'overview'
      ? d.overviewSeries
      : range === 'recent'
        ? d.series.slice(-80)
        : d.series
    : [];
  const splitNames = { train: 'Huấn luyện', validation: 'Chọn mô hình', test: 'Kiểm tra' };
  return (
    <section id="datasets" className="section explorer-section">
      <div className="section-heading">
        <div>
          <h2>Hai tập dữ liệu</h2>
          <p>Xem dữ liệu và dự báo về giao dịch và giá cổ phiếu.</p>
        </div>
        <a className="text-link" href="#results">
          Xem kết quả mô hình <ArrowDown size={17} />
        </a>
      </div>
      <div className="dataset-tabs" role="tablist" aria-label="Chọn tập dữ liệu">
        {datasetChoices.map(({ id, name, type, Icon }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-controls="dataset-panel"
            aria-selected={selected === id}
            onClick={() => setSelected(id)}
            className={selected === id ? 'selected' : ''}
          >
            <span className="dataset-icon">
              <Icon size={21} strokeWidth={1.7} />
            </span>
            <span>
              <strong>{name}</strong>
              <small>{type}</small>
            </span>
            <ArrowUpRight size={19} className="tab-arrow" />
          </button>
        ))}
      </div>
      {!d ? (
        <div className="data-placeholder" role="status">
          {errors[selected] ? (
            <>
              <h3>Chưa tải được dữ liệu</h3>
              <p>Kiểm tra kết nối rồi thử lại.</p>
              <button className="secondary-button" onClick={retry}>
                <RotateCcw size={16} /> Tải lại
              </button>
            </>
          ) : (
            <>
              <div className="skeleton-line" />
              <div className="skeleton-chart" />
              <span>Đang tải dữ liệu…</span>
            </>
          )}
        </div>
      ) : (
        <div
          id="dataset-panel"
          role="tabpanel"
          aria-labelledby={`tab-${selected}`}
          className="dataset-panel"
        >
          <div className="dataset-overview">
            <div className="dataset-description">
              <h3>{datasetChoices.find((c) => c.id === selected)?.question}</h3>
              <p>{d.description}</p>
              <a href={d.source.url} target="_blank" rel="noreferrer" className="source-link">
                {d.source.label} <ExternalLink size={13} />
              </a>
            </div>
            <dl className="dataset-facts">
              <div>
                <dt>Số mốc dữ liệu</dt>
                <dd>{formatNumber(d.summary.rows, 0)}</dd>
              </div>
              <div>
                <dt>Tần suất</dt>
                <dd>{selected === 'fpt' ? 'Mỗi phiên' : 'Mỗi ngày'}</dd>
              </div>
              <div>
                <dt>Lịch sử dùng để dự báo</dt>
                <dd>
                  {d.protocol.lookback} <span>{selected === 'fpt' ? 'phiên' : 'ngày'}</span>
                </dd>
              </div>
            </dl>
          </div>
          <div className="chart-toolbar">
            <div className="segmented" role="group" aria-label="Nội dung biểu đồ">
              <button
                aria-pressed={mode === 'overview'}
                className={mode === 'overview' ? 'active' : ''}
                onClick={() => setMode('overview')}
              >
                Dữ liệu
              </button>
              <button
                aria-pressed={mode === 'forecast'}
                className={mode === 'forecast' ? 'active' : ''}
                onClick={() => setMode('forecast')}
              >
                Dự báo
              </button>
            </div>
            {mode === 'forecast' ? (
              <label className="range-select">
                <span className="sr-only">Khoảng thời gian dự báo</span>
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value as 'all' | 'recent')}
                >
                  <option value="all">Toàn bộ tập kiểm tra</option>
                  <option value="recent">80 mốc cuối</option>
                </select>
                <ChevronDown size={14} />
              </label>
            ) : (
              <span className="chart-status">
                <span className="live-dot" />
                Dữ liệu thực tế
              </span>
            )}
          </div>
          {mode === 'forecast' && (
            <div className="model-toggles" aria-label="Các đường dự báo">
              {['actual', ...d.metrics.map((m) => m.model)].map((key) => (
                <button
                  key={key}
                  aria-pressed={visible.includes(key)}
                  onClick={() =>
                    setVisible((v) =>
                      v.includes(key)
                        ? v.length > 1
                          ? v.filter((k) => k !== key)
                          : v
                        : [...v, key],
                    )
                  }
                  className={visible.includes(key) ? 'on' : ''}
                >
                  <span
                    className="legend-box"
                    style={
                      visible.includes(key)
                        ? { background: colors[key], borderColor: colors[key] }
                        : {}
                    }
                  >
                    {visible.includes(key) && <Check size={10} />}
                  </span>
                  {modelLabels[key] || key}
                </button>
              ))}
            </div>
          )}
          <SignalChart
            points={chartPoints}
            models={mode === 'overview' ? ['actual'] : visible}
            unit={d.unit}
            label={`${d.title}: ${mode === 'overview' ? 'quan sát theo thời gian' : 'dự báo trên tập test'}`}
            time={selected !== 'fpt'}
          />
          <div className="chart-footnote">
            <span>
              {mode === 'overview'
                ? 'Biểu đồ chỉ hiển thị một phần số mốc dữ liệu.'
                : `Mỗi dự báo chỉ dùng dữ liệu đã có trước đó. ${formatNumber(chartPoints.length, 0)} / ${formatNumber(d.display.fullTestPointCount, 0)} mốc kiểm tra được hiển thị.`}
            </span>
            <button onClick={() => setShowTable(!showTable)} aria-expanded={showTable}>
              {showTable ? 'Ẩn' : 'Xem'} 8 dòng dữ liệu{' '}
              <ChevronDown className={showTable ? 'rotated' : ''} size={14} />
            </button>
          </div>
          {showTable && (
            <div className="data-table-wrap">
              <table className="data-table">
                <caption>8 mốc hiển thị gần nhất — {d.unit}</caption>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    {(mode === 'overview' ? ['actual'] : visible).map((k) => (
                      <th key={k}>{modelLabels[k] || k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chartPoints.slice(-8).map((p) => (
                    <tr key={p.timestamp}>
                      <td>{formatDate(p.timestamp, selected !== 'fpt')}</td>
                      {(mode === 'overview' ? ['actual'] : visible).map((k) => (
                        <td key={k}>
                          {typeof p[k] === 'number' ? formatNumber(p[k] as number, 3) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="split-section">
            <div>
              <h4>Chia dữ liệu theo thời gian</h4>
              <p>
                Huấn luyện bằng phần dữ liệu đầu, kiểm tra trên phần sau. Các giá trị chuẩn hóa chỉ
                được tính từ tập huấn luyện.
              </p>
            </div>
            <div className="split-visual">
              <div
                className="split-bar"
                aria-label="70 phần trăm train, 15 phần trăm validation, khoảng 15 phần trăm test"
              >
                <span className="train">70%</span>
                <span className="validation">15%</span>
                <span className="test">15%</span>
              </div>
              <div className="split-labels">
                {(['train', 'validation', 'test'] as const).map((s) => (
                  <div key={s}>
                    <strong>{splitNames[s]}</strong>
                    <small>{formatNumber(d.protocol[s].n, 0)} mẫu</small>
                    <span>
                      {formatDate(d.protocol[s].start)}
                      <br />→ {formatDate(d.protocol[s].end)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <details className="data-details">
            <summary>
              Cách chuẩn bị dữ liệu <ChevronDown size={16} />
            </summary>
            <div className="detail-columns">
              <div>
                <h4>Tiền xử lý</h4>
                <ul>
                  {d.cleaning.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Lưu ý</h4>
                <ul>
                  {d.limitations.slice(0, 3).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <a href={`/data/${selected}.json`} download className="text-link">
                  Tải dữ liệu biểu đồ <Download size={15} />
                </a>
              </div>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

function Results({
  data,
  selected,
  setSelected,
}: {
  data: DataMap;
  selected: DatasetId;
  setSelected: (v: DatasetId) => void;
}) {
  const [metric, setMetric] = useState<'mae' | 'rmse'>('mae');
  const d = data[selected];
  const [historyModel, setHistoryModel] = useState('rnn');
  if (!d) return null;
  const max = Math.max(...d.metrics.map((m) => m[metric]));
  const best = Math.min(...d.metrics.map((m) => m[metric]));
  const history = d.history[historyModel] || [];
  return (
    <section id="results" className="section results-section">
      <div className="section-heading">
        <div>
          <h2>Kết quả dự báo</h2>
          <p>So sánh RNN, GRU và các cách dự báo đơn giản trên cùng tập kiểm tra.</p>
        </div>
        <div className="verified-label">
          <CheckCheck size={19} />
          Kết quả thực nghiệm
        </div>
      </div>
      <div className="results-layout">
        <div className="results-main">
          <div className="results-controls">
            <label className="plain-select">
              <span className="sr-only">Chọn dữ liệu so sánh</span>
              <select value={selected} onChange={(e) => setSelected(e.target.value as DatasetId)}>
                {datasetChoices.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented" aria-label="Chọn chỉ số">
              <button
                className={metric === 'mae' ? 'active' : ''}
                aria-pressed={metric === 'mae'}
                onClick={() => setMetric('mae')}
              >
                MAE
              </button>
              <button
                className={metric === 'rmse' ? 'active' : ''}
                aria-pressed={metric === 'rmse'}
                onClick={() => setMetric('rmse')}
              >
                RMSE
              </button>
            </div>
          </div>
          <div className="metric-subtitle">
            <span>
              {metric === 'mae'
                ? 'Sai số tuyệt đối trung bình'
                : 'Căn bậc hai của sai số bình phương trung bình'}
            </span>
            <span>Càng thấp càng tốt</span>
          </div>
          <div className="metric-bars">
            {d.metrics.map((m) => (
              <div className="metric-row" key={m.model}>
                <div className="metric-row-label">
                  <span>{modelLabels[m.model] || m.model}</span>
                  <strong>
                    {formatNumber(m[metric], 4)}
                    {m[metric] === best && <span className="best-label">Thấp nhất</span>}
                  </strong>
                </div>
                <div className="metric-track">
                  <div
                    style={{
                      width: `${(m[metric] / max) * 100}%`,
                      background: colors[m.model] || '#365eeb',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <span className="unit-note">
            Đơn vị: {d.unit} · {formatNumber(d.protocol.test.n, 0)} mẫu kiểm tra
          </span>
        </div>
        <aside className="result-interpretation">
          <span className="insight-icon">
            <BookOpen size={23} strokeWidth={1.6} />
          </span>
          <h3>
            {selected === 'fpt'
              ? 'FPT: chưa có cải thiện rõ ràng'
              : 'Shopee Thailand: cần so với cách đoán đơn giản'}
          </h3>
          <p>
            {selected === 'fpt'
              ? 'RNN và GRU đều có MAE và RMSE cao hơn cách dùng giá phiên trước trên 389 phiên kiểm tra. Kết quả này chưa cho thấy lợi thế so với cách đơn giản đó.'
              : 'Trên 216 ngày test, RNN và GRU có MAE cao hơn cách lặp lại số đơn hôm trước, dù RMSE thấp hơn một chút. Kết quả chỉ mô tả dữ liệu mô phỏng này.'}
          </p>
          <div className="metric-explanation">
            <strong>{metric.toUpperCase()} là gì?</strong>
            <p>
              {metric === 'mae'
                ? 'Mức chênh lệch tuyệt đối trung bình giữa dự báo và giá trị thực tế.'
                : 'Nhạy hơn MAE với những lần dự báo lệch nhiều. Sai số lớn làm chỉ số này tăng mạnh.'}
            </p>
          </div>
          <small>
            Thí nghiệm dùng một lần khởi tạo và một cách chia dữ liệu. Kết quả có thể thay đổi ở
            giai đoạn khác.
          </small>
        </aside>
      </div>
      <details className="learning-curves">
        <summary>
          Quá trình huấn luyện{' '}
          <span>
            Loss và mô hình được chọn <ChevronDown size={16} />
          </span>
        </summary>
        <div className="learning-inner">
          <div>
            <h3>Chọn mô hình sau huấn luyện</h3>
            <p>
              Lưu mô hình có loss thấp nhất trên tập validation, rồi đánh giá trên tập kiểm tra.
              Loss được tính sau khi biến đổi và chuẩn hóa dữ liệu, nên khác đơn vị với MAE ở trên.
            </p>
            <div className="segmented">
              <button
                className={historyModel === 'rnn' ? 'active' : ''}
                onClick={() => setHistoryModel('rnn')}
              >
                RNN
              </button>
              <button
                className={historyModel === 'gru' ? 'active' : ''}
                onClick={() => setHistoryModel('gru')}
              >
                GRU
              </button>
            </div>
            <p className="checkpoint-note">
              Vòng huấn luyện được chọn <strong>{d.models[historyModel]?.bestEpoch}</strong> /{' '}
              {d.models[historyModel]?.epochsRun}
              <br />
              {formatNumber(d.models[historyModel]?.parameters || 0, 0)} tham số
            </p>
          </div>
          <div className="loss-table">
            <table>
              <caption>Loss qua các vòng huấn luyện · {historyModel.toUpperCase()}</caption>
              <thead>
                <tr>
                  <th>Epoch</th>
                  <th>Train</th>
                  <th>Validation</th>
                  <th>Checkpoint</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr
                    key={h.epoch}
                    className={h.epoch === d.models[historyModel]?.bestEpoch ? 'best-epoch' : ''}
                  >
                    <td>{h.epoch}</td>
                    <td>{formatNumber(h.train, 5)}</td>
                    <td>{formatNumber(h.validation, 5)}</td>
                    <td>
                      {h.epoch === d.models[historyModel]?.bestEpoch ? (
                        <Check size={16} aria-label="Được chọn" />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </section>
  );
}

export default function App({ initialDataset = 'shopee' }: { initialDataset?: DatasetId }) {
  const [data, setData] = useState<DataMap>({});
  const [errors, setErrors] = useState<ErrorMap>({});
  const [selected, setSelected] = useState<DatasetId>(
    datasetChoices.some(({ id }) => id === initialDataset) ? initialDataset : 'shopee',
  );
  const [menu, setMenu] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setErrors({});
    datasetChoices.forEach(async ({ id }) => {
      try {
        const r = await fetch(`/data/${id}.json`);
        if (!r.ok) throw new Error('data unavailable');
        const json = (await r.json()) as Dataset;
        if (!Array.isArray(json.series) || !json.protocol) throw new Error('invalid dataset');
        if (!cancelled) setData((d) => ({ ...d, [id]: json }));
      } catch {
        if (!cancelled) setErrors((d) => ({ ...d, [id]: true }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  return (
    <>
      <a href="#main" className="skip-link">
        Bỏ qua điều hướng
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <nav className={menu ? 'open' : ''} aria-label="Điều hướng chính">
            <a href="#datasets" onClick={() => setMenu(false)}>
              Dữ liệu
            </a>
            <a href="#rnn-lab" onClick={() => setMenu(false)}>
              Cách RNN hoạt động
            </a>
            <a href="#results" onClick={() => setMenu(false)}>
              Kết quả
            </a>
          </nav>
          <a className="header-code" href="#resources">
            <Code2 size={16} /> Mã nguồn <ArrowUpRight size={14} />
          </a>
          <button
            className="mobile-menu"
            aria-label={menu ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <section id="top" className="hero section">
          <div className="hero-copy">
            <h1>
              RNN dự báo
              <br />
              <span>từ dữ liệu quá khứ</span>
            </h1>
            <p>Xem cách tính của RNN, thay đổi đầu vào và so sánh dự báo trên hai tập dữ liệu.</p>
            <div className="hero-actions">
              <a className="primary-button" href="#rnn-lab">
                Thử RNN <ArrowRight size={18} />
              </a>
              <a className="quiet-button" href="#datasets">
                Xem dữ liệu <ArrowDown size={16} />
              </a>
            </div>
            <div className="hero-context">
              <span className="context-mark">
                <Layers3 size={17} />
              </span>
              <span>
                Mạng nơ-ron hồi tiếp
                <br />
                <strong>Recurrent Neural Networks</strong>
              </span>
            </div>
          </div>
          <HeroDemo />
        </section>
        <div className="learning-strip">
          <div>
            <span>Dữ liệu có thứ tự</span>
            <ArrowRight />
            <span>Cập nhật trạng thái</span>
            <ArrowRight />
            <span>Tạo dự báo</span>
          </div>
          <span className="strip-tail">Công thức và mã PyTorch</span>
        </div>
        <DatasetExplorer
          data={data}
          selected={selected}
          setSelected={setSelected}
          errors={errors}
          retry={() => setRetry((r) => r + 1)}
        />
        <div className="lab-section-wrap">
          <section id="rnn-lab" className="section lab-section">
            <div className="section-heading">
              <div>
                <h2>Cách tính của RNN</h2>
                <p>
                  Ví dụ gồm ba đầu vào và một nút ẩn. Thay đổi các giá trị để xem trạng thái và dự
                  báo thay đổi thế nào.
                </p>
              </div>
              <span className="lesson-length">
                <BookOpen size={17} /> Ví dụ minh họa
              </span>
            </div>
            <RNNLab />
          </section>
        </div>
        <Results data={data} selected={selected} setSelected={setSelected} />
        <section id="resources" className="section resources-section">
          <div>
            <Code2 size={29} strokeWidth={1.5} />
            <h2>Mã nguồn và tài liệu</h2>
            <p>Tải mã Python để chạy lại thí nghiệm hoặc xem cách dùng RNN và GRU trong PyTorch.</p>
          </div>
          <div className="resource-links">
            <a href="/downloads/a6-rnn-source.zip" download>
              <span>
                <strong>Mã thí nghiệm và hướng dẫn</strong>
                <small>RNN, GRU, tiền xử lý và kiểm chứng · Python / ZIP</small>
              </span>
              <Download size={20} />
            </a>
            <a
              href="https://docs.pytorch.org/docs/stable/generated/torch.nn.RNN.html"
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <strong>RNN trong PyTorch</strong>
                <small>Công thức, đầu vào và tham số</small>
              </span>
              <ArrowUpRight size={20} />
            </a>
            <a
              href="https://docs.pytorch.org/docs/stable/generated/torch.nn.GRU.html"
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <strong>GRU trong PyTorch</strong>
                <small>Cơ chế reset gate và update gate</small>
              </span>
              <ArrowUpRight size={20} />
            </a>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div>
          <Logo />
          <span>RNN và dự báo chuỗi thời gian</span>
        </div>
        <div>
          <span>A6 · RNN Learning Lab</span>
          <small>Dữ liệu công khai từ Kaggle · Thực nghiệm có thể tái lập</small>
        </div>
      </footer>
    </>
  );
}
