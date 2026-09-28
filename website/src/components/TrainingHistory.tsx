import { useEffect, useState } from 'react';
import { ChevronDown, Pause, Play } from 'lucide-react';
import { formatNumber as n, type Dataset } from '../types';
import LearningExample from './LearningExample';

/** Phụ lục: ví dụ SGD riêng và biểu đồ loss đã ghi lại của thí nghiệm Shopee Thailand. */
export default function TrainingHistory({ data, onFocus }: { data: Dataset; onFocus: () => void }) {
  // epoch chỉ chọn hàng trong lịch sử đã lưu, không chạy optimizer trong trình duyệt.
  const [epoch, setEpoch] = useState(1),
    [playing, setPlaying] = useState(false),
    rows = data.history.rnn,
    row = rows[epoch - 1];
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setEpoch((e) => Math.min(rows.length, e + 1)), 320);
    return () => clearInterval(id);
  }, [playing, rows.length]);
  useEffect(() => {
    if (epoch === rows.length) setPlaying(false);
  }, [epoch, rows.length]);
  const max = Math.ceil(Math.max(...rows.flatMap((r) => [r.train, r.validation])) * 5) / 5,
    x = (i: number) => 55 + (i / (rows.length - 1)) * 670,
    y = (v: number) => 232 - (v / max) * 184;
  return (
    <section
      id="learning"
      data-flow-topic
      className="flow-section"
      onFocusCapture={onFocus}
      onPointerDown={onFocus}
    >
      <div className="flow-section-heading">
        <div>
          <h2>RNN học như thế nào?</h2>
          <p>Dự đoán, đo sai số, rồi điều chỉnh trọng số.</p>
        </div>
      </div>
      <LearningExample onFocus={onFocus} />
      <details className="recorded-training">
        <summary>
          Xem lịch sử huấn luyện RNN trên Shopee Thailand <ChevronDown size={17} />
        </summary>
        <div className="learning-layout">
          <div className="training-explainer">
            <p>
              Mô hình học từ các đoạn dữ liệu đã có đáp án. Sai số giúp điều chỉnh cách tính cho lần
              dự đoán sau.
            </p>
            <dl>
              <div>
                <dt>Khi học</dt>
                <dd>Trọng số được điều chỉnh.</dd>
              </div>
              <div>
                <dt>Khi dự đoán</dt>
                <dd>Trọng số giữ nguyên; trạng thái thay đổi sau mỗi ngày.</dd>
              </div>
            </dl>
            <details>
              <summary>
                Công thức <ChevronDown size={16} />
              </summary>
              <p>
                <b>hₜ = tanh(Wₓxₜ + Wₕhₜ₋₁ + b)</b>
              </p>
              <p>
                xₜ: đầu vào · hₜ: trạng thái ẩn.
                <br />W và b: các trọng số được học.
              </p>
              <p>
                Mô hình Shopee Thailand dùng 5 đầu vào mỗi ngày: log1p của số lượt truy cập, thăm
                trang sản phẩm, giỏ hàng, thanh toán và số đơn. Dữ liệu là mô phỏng. Mỗi trạng thái
                có 32 giá trị.
              </p>
            </details>
          </div>
          <div className="training-player">
            <div className="training-readout">
              <div>
                <span>Lượt huấn luyện</span>
                <strong>
                  {epoch}
                  <small> / {rows.length}</small>
                </strong>
              </div>
              <div>
                <span>Loss trên tập học</span>
                <strong>{n(row.train, 4)}</strong>
              </div>
              <div>
                <span>Loss trên tập chọn</span>
                <strong>{n(row.validation, 4)}</strong>
              </div>
            </div>
            <svg
              viewBox="0 0 780 280"
              role="img"
              aria-label={`Loss RNN trên Shopee Thailand đến lượt ${epoch}. Đây là kết quả đã lưu, không huấn luyện lại.`}
            >
              {[0, 1, 2, 3, 4]
                .map((i) => (i * max) / 4)
                .map((v) => (
                  <g key={v}>
                    <text x="40" y={y(v) + 5} textAnchor="end">
                      {n(v, 2)}
                    </text>
                    <line x1="55" x2="725" y1={y(v)} y2={y(v)} stroke="#e0e7db" />
                  </g>
                ))}
              <text x="55" y="25">
                Loss
              </text>
              {(['train', 'validation'] as const).map((key, k) => (
                <g key={key}>
                  <path
                    d={rows
                      .slice(0, epoch)
                      .map((r, i) => `${i ? 'L' : 'M'}${x(i)} ${y(r[key])}`)
                      .join(' ')}
                    fill="none"
                    stroke={k ? '#ad774d' : '#365eeb'}
                    strokeWidth="3"
                  />
                  <circle
                    cx={x(epoch - 1)}
                    cy={y(row[key])}
                    r="5"
                    fill={k ? '#ad774d' : '#365eeb'}
                  />
                </g>
              ))}
              <text x="55" y="263">
                1
              </text>
              <text x="725" y="263" textAnchor="end">
                {rows.length} lượt
              </text>
            </svg>
            <div className="training-controls">
              <button
                className="flow-icon-button"
                aria-label={playing ? 'Tạm dừng lịch sử huấn luyện' : 'Phát lịch sử huấn luyện'}
                onClick={() => {
                  onFocus();
                  if (epoch === rows.length) setEpoch(1);
                  setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <label>
                <span className="sr-only">Lượt huấn luyện đang xem</span>
                <input
                  type="range"
                  min="1"
                  max={rows.length}
                  value={epoch}
                  onChange={(e) => {
                    setPlaying(false);
                    setEpoch(Number(e.target.value));
                    onFocus();
                  }}
                />
              </label>
              <span>
                {epoch} / {rows.length}
              </span>
            </div>
            <div className="flow-legend">
              <span>
                <i className="rnn" />
                Tập học
              </span>
              <span>
                <i className="baseline" />
                Tập chọn mô hình
              </span>
            </div>
            <p className="flow-fineprint">
              Mỗi lượt (epoch) đi qua tập học một lần. Loss là MSE trên mục tiêu log1p đã chuẩn hóa,
              không có đơn vị số đơn hàng. Mô hình được chọn ở lượt {data.models.rnn.bestEpoch}.
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}
