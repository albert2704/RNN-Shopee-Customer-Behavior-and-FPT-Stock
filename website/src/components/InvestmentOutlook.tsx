import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import {
  isOutlook,
  matchesDaily,
  type Outlook,
  type OutlookHorizon,
} from '../domain/finance/outlookContract';
import './InvestmentOutlook.css';

type Props = {
  observedThrough: string;
  lastClose: number;
  closesSha256: string;
  currentAge: number;
  compact?: boolean;
};
type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; outlook: Outlook; offline: boolean }
  | { kind: 'unavailable'; message: string };

const OPTIONS = [
  { months: 1, label: '1 tháng' },
  { months: 3, label: '3 tháng' },
  { months: 6, label: '6 tháng' },
] as const;
const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
const percent = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
const day = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00+07:00`).toLocaleDateString('vi-VN');

function mismatchReason(outlook: Outlook, observedThrough: string, closesSha256: string) {
  if (outlook.observed_through < observedThrough) {
    return `Mô hình dài hạn mới có dữ liệu đến ${day(outlook.observed_through)}, cũ hơn mốc giá ${day(observedThrough)} đang xem. Chưa hiển thị dự báo này.`;
  }
  if (outlook.observed_through > observedThrough) {
    return `Mô hình dài hạn dùng dữ liệu đến ${day(outlook.observed_through)}, khác mốc giá ${day(observedThrough)} đang xem. Chưa hiển thị dự báo này.`;
  }
  if (outlook.source.closes_sha256 !== closesSha256) {
    return 'Lịch sử giá dùng cho mô hình khác với dữ liệu đang xem. Chưa hiển thị dự báo này.';
  }
  return 'Giá đầu vào của mô hình dài hạn khác với giá đang xem tại cùng ngày. Chưa hiển thị dự báo này.';
}

async function fetchOutlook(url: string, signal: AbortSignal): Promise<Outlook> {
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`http_${response.status}`);
  const value: unknown = await response.json();
  if (!isOutlook(value)) throw new Error('invalid_outlook');
  return value;
}

function chatQuestion(horizon: OutlookHorizon) {
  return `Với dự báo thử nghiệm FPT trong khoảng ${horizon.label}, những yếu tố nào ủng hộ hoặc làm yếu nhận định này, và tôi nên theo dõi điều gì tiếp theo?`;
}

export default function InvestmentOutlook({
  observedThrough,
  lastClose,
  closesSha256,
  currentAge,
  compact = false,
}: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [selected, setSelected] = useState<1 | 3 | 6>(1);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    async function load() {
      setState({ kind: 'loading' });
      let mismatch = false;
      let mismatchMessage = '';
      let apiFailed = false;
      try {
        const outlook = await fetchOutlook(
          '/api/fpt/outlook',
          AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        );
        if (matchesDaily(outlook, observedThrough, lastClose, closesSha256)) {
          if (!cancelled) setState({ kind: 'ready', outlook, offline: false });
          return;
        }
        mismatch = true;
        mismatchMessage = mismatchReason(outlook, observedThrough, closesSha256);
      } catch {
        if (controller.signal.aborted) return;
        apiFailed = true;
      }

      try {
        const outlook = await fetchOutlook(
          '/data/fpt-outlook.json',
          AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        );
        if (matchesDaily(outlook, observedThrough, lastClose, closesSha256)) {
          if (!cancelled) setState({ kind: 'ready', outlook, offline: true });
          return;
        }
        mismatch = true;
        mismatchMessage = mismatchReason(outlook, observedThrough, closesSha256);
      } catch {
        if (controller.signal.aborted) return;
      }

      if (!cancelled) {
        const message = mismatch
          ? mismatchMessage
          : apiFailed
            ? 'Chưa có bản dự báo dài hạn đã lưu. Hãy thử tải lại sau khi dịch vụ được cập nhật.'
            : 'Chưa tải được mô hình dài hạn. Hãy kiểm tra kết nối rồi thử lại.';
        setState({
          kind: 'unavailable',
          message,
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [observedThrough, lastClose, closesSha256, retry]);

  const outlook = state.kind === 'ready' ? state.outlook : null;
  const horizon = outlook?.horizons.find((item) => item.months === selected);
  const dailyStale = currentAge >= 7;
  const direction = horizon
    ? { up: 'Tăng', down: 'Giảm', flat: 'Không đổi' }[horizon.direction]
    : '';
  if (compact)
    return (
      <section className="outlook-compact" aria-labelledby="outlook-compact-title">
        <header>
          <h2 id="outlook-compact-title">Góc nhìn 1–6 tháng</h2>
          <span>Giá mốc {money(lastClose)} VND</span>
        </header>
        {state.kind === 'loading' && (
          <p role="status">Đang tải góc nhìn theo mốc giá {day(observedThrough)}…</p>
        )}
        {state.kind === 'unavailable' && (
          <div role="status">
            <p>{state.message}</p>
            <button onClick={() => setRetry((value) => value + 1)}>
              <RefreshCw size={15} /> Thử lại
            </button>
          </div>
        )}
        {state.kind === 'ready' && (
          <>
            <div className="outlook-columns">
              {state.outlook.horizons.map((item) => (
                <article key={item.months}>
                  <span>
                    {item.sessions} PHIÊN · {item.months} tháng
                  </span>
                  <strong>{money(item.predicted_close)}</strong>
                  <p>
                    {{ up: 'Tăng', down: 'Giảm', flat: 'Không đổi' }[item.direction]}{' '}
                    {item.predicted_return_pct > 0 ? '+' : ''}
                    {percent(item.predicted_return_pct)}%
                  </p>
                  <small>THỬ NGHIỆM</small>
                </article>
              ))}
            </div>
            <p>
              {state.outlook.horizons.every((item) => !item.support.beats_persistence)
                ? 'Cả ba mốc chưa tốt hơn cách giữ nguyên giá trên tập kiểm tra.'
                : 'Kết quả thử nghiệm ở từng mốc, không phải cam kết về giá tương lai.'}{' '}
              Giá lịch sử có thể chưa phản ánh đầy đủ chia tách hoặc cổ tức.
            </p>
            {(state.offline || dailyStale) && (
              <p role="status">
                {state.offline ? 'Đang xem bản đã lưu. ' : ''}
                {dailyStale ? 'Dữ liệu giá đã cũ. ' : ''}Cùng mốc dữ liệu{' '}
                {day(state.outlook.observed_through)}.
              </p>
            )}
          </>
        )}
      </section>
    );
  return (
    <section className="investment-outlook" aria-labelledby="investment-outlook-title">
      <div className="investment-outlook-heading">
        <div>
          <span className="investment-outlook-eyebrow">FPT · GÓC NHÌN THỬ NGHIỆM</span>
          <h2 id="investment-outlook-title">Góc nhìn 1–6 tháng</h2>
          <p>Ba mô hình riêng ước tính giá sau khoảng 21, 63 hoặc 126 phiên giao dịch.</p>
        </div>
        <span className="investment-outlook-anchor">Giá mốc {money(lastClose)} VND</span>
      </div>

      <div className="investment-horizon-tabs" role="group" aria-label="Chọn khoảng dự báo">
        {OPTIONS.map((option) => (
          <button
            key={option.months}
            type="button"
            aria-pressed={selected === option.months}
            className={selected === option.months ? 'selected' : ''}
            onClick={() => setSelected(option.months)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {state.kind === 'loading' && (
        <p className="investment-outlook-status" role="status">
          Đang tải góc nhìn theo mốc giá {day(observedThrough)}…
        </p>
      )}
      {state.kind === 'unavailable' && (
        <div className="investment-outlook-status" role="status">
          <p>{state.message}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            <RefreshCw size={15} /> Thử lại
          </button>
        </div>
      )}
      {state.kind === 'ready' && horizon && (
        <>
          <div className="investment-outlook-result" aria-live="polite">
            <div>
              <span>
                ƯỚC TÍNH SAU {horizon.sessions} PHIÊN · {horizon.label.toUpperCase()}
              </span>
              <strong>
                {money(horizon.predicted_close)} <small>VND</small>
              </strong>
              <p>
                {direction} {horizon.predicted_return_pct > 0 ? '+' : ''}
                {percent(horizon.predicted_return_pct)}% so với giá mốc
              </p>
            </div>
            <p className="investment-outlook-experiment">
              Kết quả thử nghiệm của một mô hình trên một mã cổ phiếu, không phải xác suất hay lời
              khuyên mua bán. Giá lịch sử có thể chưa phản ánh đầy đủ sự kiện chia tách hoặc cổ tức.
            </p>
          </div>
          {(state.kind === 'ready' && state.offline) || dailyStale ? (
            <p className="investment-outlook-stale" role="status">
              {state.offline
                ? `Đang xem bản đã lưu, cùng mốc dữ liệu ${day(state.outlook.observed_through)}.`
                : `Dữ liệu giá đến ${day(observedThrough)} đã cũ. Cập nhật giá trước khi dùng góc nhìn này.`}
            </p>
          ) : null}
          <div className="investment-outlook-actions">
            <a
              href="#chat"
              onClick={() => {
                window.sessionStorage.setItem('fpt-chat-prefill', chatQuestion(horizon));
              }}
            >
              Hỏi thêm về mốc {horizon.label} <ArrowUpRight size={15} />
            </a>
            <details>
              <summary>Kết quả kiểm tra và nguồn</summary>
              <div className="investment-outlook-details">
                <p>
                  Trên {horizon.test.rnn.count ?? 'các'} dự báo trong khoảng{' '}
                  {day(horizon.test_period.first_target)} đến {day(horizon.test_period.last_target)}
                  , sai số tuyệt đối trung bình của RNN là {money(horizon.test.rnn.MAE)} VND; giữ
                  nguyên giá là {money(horizon.test.persistence.MAE)} VND.
                </p>
                <p>
                  Trong {horizon.non_overlapping.count} khoảng kiểm tra không chồng lấn, MAE RNN là{' '}
                  {money(horizon.non_overlapping.rnn_mae)} VND và MAE giữ nguyên giá là{' '}
                  {money(horizon.non_overlapping.persistence_mae)} VND. Độ đúng chiều biến động là{' '}
                  {percent(horizon.non_overlapping.direction_accuracy * 100)}%.
                </p>
                <p>{horizon.support.reason}</p>
                <p>
                  Dữ liệu đến {day(state.outlook.observed_through)}; mô hình dùng {horizon.lookback}{' '}
                  log return và chọn checkpoint ở epoch {horizon.best_epoch} trên validation. Đây là
                  dự báo trực tiếp ở từng mốc, không cộng dồn dự báo phiên trước.
                </p>
                {state.outlook.source.source_url && (
                  <p>
                    Nguồn giá:{' '}
                    <a href={state.outlook.source.source_url} target="_blank" rel="noreferrer">
                      {state.outlook.source.provider || 'Nguồn dữ liệu'} <ArrowUpRight size={12} />
                    </a>
                    {state.outlook.source.adjustment_note
                      ? ` · ${state.outlook.source.adjustment_note}`
                      : ''}
                  </p>
                )}
              </div>
            </details>
          </div>
          <details className="investment-company-sources">
            <summary>Thông tin công ty đã kiểm chứng</summary>
            {state.outlook.company_documents?.length ? (
              <ul>
                {state.outlook.company_documents.map((document) => (
                  <li key={document.citation_id}>
                    <a href={document.source_url} target="_blank" rel="noreferrer">
                      {document.title} <ArrowUpRight size={12} />
                    </a>
                    <span>
                      {document.category} · Công bố {day(document.published_at)} · {document.period}
                    </span>
                    <p>{document.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="investment-company-empty">
                Bản đang xem chưa kèm tài liệu công ty. Thử tải lại khi dịch vụ có dữ liệu mới.
              </p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
