import { useEffect, useState } from 'react';
import { Clock3, RefreshCw } from 'lucide-react';
import './DailyForecast.css';
import InvestmentOutlook from './InvestmentOutlook';

type Metrics = {
  MAE: number;
  RMSE: number;
  direction_accuracy: number;
  changed_direction_accuracy: number | null;
  count: number;
  unchanged_count: number;
};
type ForecastRecord = {
  id: string;
  created_at: string;
  observed_through: string;
  last_close: number;
  predicted_close: number;
  predicted_return_pct: number;
  direction: 'up' | 'down' | 'flat';
  actual: number | null;
  actual_date?: string;
  absolute_error?: number;
  prospective?: boolean;
  comparable?: boolean;
};
type DailyData = {
  schema_version: number;
  symbol: string;
  generated_at: string;
  delivery: string;
  source: {
    provider: string;
    source_url: string;
    retrieved_at: string;
    first_date: string;
    last_date: string;
    rows: number;
    price_basis: string;
    adjustment_note: string;
    closes_sha256: string;
  };
  forecast: ForecastRecord;
  model: {
    run_id: string;
    hidden_size: number;
    lookback: number;
    epochs_run: number;
    best_epoch: number;
    beats_persistence_mae: boolean;
    splits: Record<'train' | 'validation' | 'test', { count: number; first: string; last: string }>;
    test: Record<string, Metrics>;
  };
  history: { date: string; close: number }[];
  ledger: ForecastRecord[];
};
const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
const pct = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
const day = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00+07:00`).toLocaleDateString('vi-VN');
const moment = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });

async function loadData(url: string, signal: AbortSignal, method = 'GET'): Promise<DailyData> {
  const response = await fetch(url, {
    method,
    signal,
    cache: 'no-store',
    ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.detail === 'string' ? error.detail : 'Chưa tải được dự báo.');
  }
  const data = await response.json();
  if (
    data?.schema_version !== 1 ||
    data.symbol !== 'FPT' ||
    !Number.isFinite(data.forecast?.predicted_close) ||
    !data.history?.length ||
    !data.model?.test?.rnn ||
    !data.source?.last_date
  )
    throw new Error('Dữ liệu dự báo không hợp lệ.');
  return data;
}

function PriceChart({ data }: { data: DailyData }) {
  const history = data.history;
  const prediction = data.forecast.predicted_close;
  const values = [...history.map((point) => point.close), prediction];
  const low = Math.min(...values),
    high = Math.max(...values);
  const padding = Math.max((high - low) * 0.15, high * 0.005);
  const min = low - padding,
    max = high + padding;
  const x = (i: number) => 76 + (i / history.length) * 914;
  const y = (value: number) => 220 - ((value - min) / (max - min)) * 194;
  const points = history.map((point, i) => `${x(i)},${y(point.close)}`).join(' ');
  const last = history.at(-1)!;
  return (
    <svg
      className="daily-chart"
      viewBox="0 0 1040 250"
      role="img"
      aria-label={`Giá FPT qua ${history.length} phiên. Giá cuối ${money(last.close)} VND, dự báo ${money(prediction)} VND.`}
    >
      {[0, 1, 2, 3].map((i) => {
        const value = min + ((max - min) * i) / 3;
        return (
          <g key={i}>
            <line x1="76" x2="1000" y1={y(value)} y2={y(value)} stroke="#D9D4C8" />
            <text x="62" y={y(value) + 4} textAnchor="end">
              {money(value)}
            </text>
          </g>
        );
      })}
      <polyline points={points} fill="none" stroke="#161512" strokeWidth="2.5" />
      <line
        x1={x(history.length - 1)}
        y1={y(last.close)}
        x2={x(history.length)}
        y2={y(prediction)}
        stroke="#D2462A"
        strokeWidth="2.5"
        strokeDasharray="5 4"
      />
      <circle cx={x(history.length - 1)} cy={y(last.close)} r="4" fill="#161512" />
      <circle
        cx={x(history.length)}
        cy={y(prediction)}
        r="6"
        fill="#D2462A"
        stroke="#F6F4EF"
        strokeWidth="2"
      />
      <text x="76" y="244">
        {day(history[0].date)}
      </text>
      <text x={x(history.length - 1) - 12} y="244" textAnchor="end">
        {day(last.date)}
      </text>
      <text x="998" y="18" textAnchor="end" fill="#D2462A">
        Phiên kế tiếp
      </text>
    </svg>
  );
}

export default function DailyForecast() {
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      try {
        let value: DailyData;
        try {
          value = await loadData(
            '/api/fpt/daily',
            AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
          );
        } catch {
          value = await loadData('/data/fpt-daily.json', controller.signal);
          if (!cancelled) setOffline(true);
        }
        if (!cancelled) setData(value);
      } catch {
        if (!cancelled)
          setNotice(
            'Chưa có bản dự báo. Khởi động dịch vụ dự báo và huấn luyện mô hình trước khi cập nhật.',
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    setNotice('');
    try {
      const updated = await loadData('/api/fpt/daily/refresh', AbortSignal.timeout(100000), 'POST');
      setNotice(
        data?.forecast.observed_through === updated.forecast.observed_through
          ? 'Nguồn chưa có phiên đóng cửa mới. Mốc dữ liệu được giữ nguyên.'
          : 'Đã lấy dữ liệu và tạo dự báo bằng mô hình đã lưu.',
      );
      setData(updated);
      setOffline(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Chưa cập nhật được dữ liệu.');
    } finally {
      setRefreshing(false);
    }
  }

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const age = data
    ? Math.floor((Date.parse(today) - Date.parse(data.forecast.observed_through)) / 86400000)
    : 0;
  const direction = data
    ? { up: 'Tăng', down: 'Giảm', flat: 'Không đổi' }[data.forecast.direction]
    : '';
  return (
    <main className="daily-main" id="daily-forecast">
      <div className="daily-title">
        <div>
          <span className="editorial-eyebrow">04 — GIÁ ĐÓNG CỬA · MỖI PHIÊN</span>
          <h1>FPT sẽ đóng cửa ở mức nào?</h1>
        </div>
        <div className="daily-title-meta">
          <button className="daily-refresh" onClick={refresh} disabled={loading || refreshing}>
            <RefreshCw size={18} />
            {refreshing ? 'Đang lấy dữ liệu…' : 'Cập nhật & dự báo'}
          </button>
          {data && (
            <p className="daily-dateline">
              <Clock3 size={15} /> Dữ liệu đến {day(data.forecast.observed_through)} ·{' '}
              {offline
                ? 'Bản đã lưu, chưa kết nối cập nhật'
                : `Lấy dữ liệu lúc ${moment(data.source.retrieved_at)}`}
            </p>
          )}
        </div>
      </div>
      {loading && (
        <p className="daily-message" role="status">
          Đang tải bản dự báo gần nhất…
        </p>
      )}
      {notice && (
        <p className="daily-message" role="status">
          {notice}
        </p>
      )}
      {!loading && !data && <button onClick={() => location.reload()}>Thử lại</button>}
      {data && (
        <>
          {age >= 7 && (
            <p className="daily-warning" role="status">
              Dữ liệu đã cách hiện tại {age} ngày. Dự báo gắn với phiên sau{' '}
              {day(data.forecast.observed_through)}, không phải giá dự báo cho ngày mai.
            </p>
          )}
          <section className="daily-overview" aria-label="Dự báo FPT">
            <div className="daily-chart-panel">
              <div className="daily-panel-heading">
                <p>{data.model.lookback} mức thay đổi giá gần nhất → RNN → dự báo phiên kế tiếp.</p>
                <span>VND / cổ phiếu</span>
              </div>
              <PriceChart data={data} />
            </div>
            <aside className="daily-readout">
              <span>PHIÊN GIAO DỊCH KẾ TIẾP</span>
              <strong>
                {money(data.forecast.predicted_close)} <small>VND</small>
              </strong>
              <p className="daily-direction">
                {direction} {pct(Math.abs(data.forecast.predicted_return_pct))}% so với phiên cuối
              </p>
              <dl>
                <div>
                  <dt>Giá đóng cửa {day(data.forecast.observed_through)}</dt>
                  <dd>{money(data.forecast.last_close)} VND</dd>
                </div>
                <div>
                  <dt>Thực tế phiên kế tiếp</dt>
                  <dd>
                    {data.forecast.actual === null
                      ? 'Chưa có trong dữ liệu'
                      : `${money(data.forecast.actual)} VND`}
                  </dd>
                </div>
              </dl>
              <p>
                Đây là dự báo một phiên. Chiều tăng hoặc giảm không phải xác suất chắc chắn hay
                khuyến nghị mua bán.
              </p>
            </aside>
          </section>
          <div className="daily-lower">
            <InvestmentOutlook
              compact
              observedThrough={data.forecast.observed_through}
              lastClose={data.forecast.last_close}
              closesSha256={data.source.closes_sha256}
              currentAge={age}
            />
            <section className="daily-evidence" aria-labelledby="daily-results">
              <h2 id="daily-results">Mô hình dự báo tốt đến đâu?</h2>
              <p>
                {data.model.test.rnn.count} dự đoán từ {day(data.model.splits.test.first)} đến{' '}
                {day(data.model.splits.test.last)}. Sai số giá càng nhỏ càng tốt.
              </p>
              <div className="daily-comparisons">
                {(['rnn', 'persistence'] as const).map((model) => (
                  <div key={model}>
                    <span>{model === 'rnn' ? 'RNN · MAE' : 'Giữ giá phiên trước'}</span>
                    <div className="editorial-bar">
                      <i
                        className={model === 'rnn' ? 'accent' : ''}
                        style={{
                          width: `${(data.model.test[model].MAE / Math.max(data.model.test.rnn.MAE, data.model.test.persistence.MAE, 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>{money(data.model.test[model].MAE)} VND</strong>
                  </div>
                ))}
              </div>
              <p className="daily-direction-metric">
                Đúng chiều tăng / giảm / không đổi{' '}
                <strong>{pct(data.model.test.rnn.direction_accuracy * 100)}%</strong>
              </p>
              <p className="daily-verdict">
                {data.model.beats_persistence_mae
                  ? 'RNN có sai số thấp hơn cách giữ giá phiên trước trong lần kiểm tra này.'
                  : 'RNN chưa tốt hơn cách giữ giá phiên trước trong lần kiểm tra này.'}
              </p>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
