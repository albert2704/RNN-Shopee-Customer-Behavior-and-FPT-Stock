import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { formatDate, formatNumber as n, modelLabels, type Dataset, type DatasetId } from '../types';
import { DATASET_COPY } from '../domain/demo/demoCopy';
export default function Appendix({
  dataset,
  onDataset,
  onDeep,
}: {
  dataset: DatasetId;
  onDataset: (id: DatasetId) => void;
  onDeep: () => void;
}) {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(false);
    fetch(`/data/${dataset}.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((value: Dataset) => {
        const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
        if (
          !value ||
          value.id !== dataset ||
          !Array.isArray(value.metrics) ||
          !value.metrics.length ||
          !value.metrics.every((m) => typeof m.model === 'string' && finite(m.mae) && m.mae >= 0) ||
          !Array.isArray(value.overviewSeries) ||
          value.overviewSeries.length < 2 ||
          !value.overviewSeries.every((p) => typeof p.timestamp === 'string' && finite(p.actual)) ||
          !finite(value.summary?.rows) ||
          typeof value.description !== 'string' ||
          typeof value.frequency !== 'string' ||
          typeof value.source?.url !== 'string' ||
          typeof value.source?.label !== 'string' ||
          !finite(value.protocol?.lookback) ||
          !(['train', 'validation', 'test'] as const).every(
            (k) =>
              finite(value.protocol[k]?.n) &&
              typeof value.protocol[k]?.start === 'string' &&
              typeof value.protocol[k]?.end === 'string',
          )
        )
          throw Error('Dữ liệu không hợp lệ');
        setData(value);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, [dataset, retry]);
  const max = Math.max(...(data?.metrics.map((m) => m.mae) ?? [1]), 1);
  return (
    <main className="appendix-main">
      <header className="appendix-heading">
        <div>
          <span className="editorial-eyebrow">PHỤ LỤC · DỮ LIỆU VÀ CÔNG THỨC</span>
          <h1>Hai tập dữ liệu</h1>
          <p>Xem dữ liệu và dự báo về giao dịch và giá cổ phiếu.</p>
        </div>
        <div className="appendix-toggle" role="group" aria-label="Tập dữ liệu">
          {(['shopee', 'fpt'] as const).map((id) => (
            <button key={id} aria-pressed={dataset === id} onClick={() => onDataset(id)}>
              <span>{DATASET_COPY[id].name}</span>
              <small>{id === 'shopee' ? 'Hành vi · mô phỏng' : 'Chứng khoán'}</small>
            </button>
          ))}
        </div>
      </header>
      {!data ? (
        <div className="stage-loading" role="status">
          {error ? 'Không tải được dữ liệu.' : 'Đang tải tập dữ liệu…'}
          {error && <button onClick={() => setRetry((v) => v + 1)}>Thử lại</button>}
        </div>
      ) : (
        <div className="appendix-body">
          <section>
            <h2>{DATASET_COPY[dataset].question}</h2>
            <p className="appendix-description">{data.description}</p>
            <a href={data.source.url} target="_blank" rel="noreferrer">
              {data.source.label} <ArrowUpRight size={14} />
            </a>
            <div className="appendix-facts">
              <div>
                <span>Số mốc dữ liệu</span>
                <strong>{n(data.summary.rows, 0)}</strong>
              </div>
              <div>
                <span>Tần suất</span>
                <strong>{data.frequency}</strong>
              </div>
              <div>
                <span>Lịch sử dùng</span>
                <strong>
                  {data.protocol.lookback} {dataset === 'fpt' ? 'phiên' : 'ngày'}
                </strong>
              </div>
            </div>
            <div className="appendix-chart-label">
              <span>{dataset === 'shopee' ? 'Số đơn hàng mỗi ngày' : 'Giá đóng cửa'}</span>
              <span>{data.unit}</span>
            </div>
            <OverviewChart data={data} />
            <p className="appendix-chart-note">Biểu đồ chỉ hiển thị một phần số mốc dữ liệu.</p>
            <button className="editorial-link" onClick={onDeep}>
              Xem dữ liệu, công thức & mã nguồn <ArrowUpRight size={16} />
            </button>
          </section>
          <aside>
            <section>
              <h2>Chia dữ liệu theo thời gian</h2>
              <div
                className="appendix-split"
                aria-label="Huấn luyện 70%, chọn mô hình 15%, kiểm tra 15%"
              >
                <span>70%</span>
                <span>15%</span>
                <span>15%</span>
              </div>
              <div className="appendix-splits">
                {(['train', 'validation', 'test'] as const).map((split, i) => (
                  <div key={split}>
                    <span>{['Huấn luyện', 'Chọn mô hình', 'Kiểm tra'][i]}</span>
                    <strong>{n(data.protocol[split].n, 0)} mẫu</strong>
                    <small>
                      {formatDate(data.protocol[split].start)}
                      <br />— {formatDate(data.protocol[split].end)}
                    </small>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h2>Kết quả dự báo · MAE</h2>
              <p className="appendix-metric-unit">{data.unit} · càng nhỏ càng tốt</p>
              {data.metrics.map((metric) => (
                <div className="appendix-metric" key={metric.model}>
                  <span>{modelLabels[metric.model] ?? metric.model}</span>
                  <div className="editorial-bar">
                    <i
                      className={['rnn', 'gru'].includes(metric.model) ? 'accent' : ''}
                      style={{ width: `${(metric.mae / max) * 100}%` }}
                    />
                  </div>
                  <strong>{n(metric.mae, 2)}</strong>
                </div>
              ))}
            </section>
            <p className="appendix-policy">
              Dữ liệu được chia theo thứ tự thời gian. Chuẩn hóa chỉ dùng tập huấn luyện; chọn mô
              hình trên tập chọn mô hình rồi đánh giá trên tập kiểm tra.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
function OverviewChart({ data }: { data: Dataset }) {
  const values = data.overviewSeries.map((p) => p.actual);
  const low = Math.min(...values),
    high = Math.max(...values),
    pad = Math.max((high - low) * 0.1, 1);
  const min = low - pad,
    max = high + pad;
  const x = (i: number) => 80 + (i / (values.length - 1)) * 825;
  const y = (v: number) => 260 - ((v - min) / (max - min)) * 230;
  return (
    <svg
      className="appendix-chart"
      viewBox="0 0 940 300"
      role="img"
      aria-label={`Tổng quan ${data.title}, ${values.length} mốc được hiển thị`}
    >
      {[0, 1, 2, 3].map((i) => {
        const value = min + ((max - min) * i) / 3;
        return (
          <g key={i}>
            <line x1={80} x2={910} y1={y(value)} y2={y(value)} stroke="#D9D4C8" />
            <text x={67} y={y(value) + 5} textAnchor="end">
              {n(value, 0)}
            </text>
          </g>
        );
      })}
      <polyline
        points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
        fill="none"
        stroke="#161512"
        strokeWidth={1.5}
      />
      {[
        0,
        Math.floor((values.length - 1) / 3),
        Math.floor(((values.length - 1) * 2) / 3),
        values.length - 1,
      ].map((i) => (
        <text key={i} x={x(i)} y={292} textAnchor="middle">
          {data.overviewSeries[i].timestamp.slice(0, 4)}
        </text>
      ))}
    </svg>
  );
}
