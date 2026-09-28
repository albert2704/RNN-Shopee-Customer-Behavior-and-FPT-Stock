import { useEffect, useRef, useState } from 'react';
import type { DemoDataset } from '../../demoTypes';
import { formatDate, formatNumber as n } from '../../types';
import { formatAmount as amount, timeLabel } from '../../domain/demo/demoCopy';

/** Vẽ lịch sử và kết quả đã lưu; đường biểu đồ không phải toàn bộ vector đầu vào. */
export default function ReplayChart({
  data,
  read,
  predicted,
  revealed,
}: {
  data: DemoDataset;
  read: number;
  predicted: boolean;
  revealed: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 800, height: 282 });
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Miền trục cố định cho cả lượt để tránh biểu đồ nhảy khi mở đáp án.
  // Dùng dữ liệu tương lai ở đây chỉ để bố trí hình vẽ, không đưa vào mô hình.
  const values = [
    ...data.context.map((p) => p.value),
    data.target.value,
    data.target.prediction,
    data.target.baseline,
  ];
  const rawMin = Math.min(...values),
    rawMax = Math.max(...values),
    pad = Math.max((rawMax - rawMin) * 0.22, rawMax * 0.003, 1);
  const min = Math.max(0, rawMin - pad),
    max = rawMax + pad;
  const width = Math.max(280, size.width),
    height = Math.max(140, size.height);
  // VND prices have longer tick labels than event counts.
  const left = data.id === 'fpt' ? (width < 480 ? 76 : 90) : width < 480 ? 48 : 68,
    right = width - 37,
    top = 25,
    bottom = height - 27;
  const x = (i: number) => left + ((right - left) * i) / data.lookback;
  const y = (v: number) => bottom - ((v - min) / (max - min)) * (bottom - top);
  // count chỉ quyết định tô sáng bao nhiêu điểm đã đọc, không tính lại dự báo.
  const path = (count: number) =>
    data.context
      .slice(0, count)
      .map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`)
      .join(' ');
  const index = read - 1;
  return (
    <div className="stage-chart">
      <div className="stage-chart-label">
        <span>{data.id === 'shopee' ? 'Số đơn hàng mỗi ngày' : 'Giá đóng cửa'}</span>
        <span>{data.unit}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${data.title}: ${read}/${data.lookback} ${data.stepUnit} đã đọc.${predicted ? ` RNN dự đoán ${amount(data, data.target.prediction)}.` : ''}${revealed ? ` Thực tế ${amount(data, data.target.value)}.` : ''}`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = min + (max - min) * f;
          return (
            <g key={f}>
              <line x1={left} x2={right + 25} y1={y(v)} y2={y(v)} stroke="#D9D4C8" />
              <text x={left - 12} y={y(v) + 4} textAnchor="end">
                {n(v, 0)}
              </text>
            </g>
          );
        })}
        <rect
          x={x(data.lookback) - 18}
          y="17"
          width="38"
          height={bottom - 9}
          rx="0"
          fill="#F6E1DA"
        />
        <text x={x(data.lookback)} y="12" textAnchor="middle" className="stage-future-label">
          {data.id === 'fpt' ? 'Phiên tới' : 'Ngày mai'}
        </text>
        <path
          d={path(data.lookback)}
          fill="none"
          stroke="#C9C3B6"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {read > 0 && (
          <>
            <path
              d={path(read)}
              className="stage-read-path"
              fill="none"
              stroke="#161512"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <line
              x1={x(index)}
              x2={x(index)}
              y1={top}
              y2={bottom}
              stroke="#161512"
              strokeDasharray="4 5"
            />
            <circle
              className="stage-reading-dot"
              cx={x(index)}
              cy={y(data.context[index].value)}
              r="6"
              fill="#161512"
              stroke="#F6F4EF"
              strokeWidth="2"
            />
          </>
        )}
        {predicted && (
          <>
            <path
              d={`M${x(data.lookback - 1)},${y(data.target.baseline)} L${x(data.lookback)},${y(data.target.baseline)}`}
              fill="none"
              stroke="#8D877B"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <path
              d={`M${x(data.lookback - 1)},${y(data.context[data.lookback - 1].value)} L${x(data.lookback)},${y(data.target.prediction)}`}
              fill="none"
              stroke="#D2462A"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle
              cx={x(data.lookback)}
              cy={y(data.target.prediction)}
              r="6"
              fill="#D2462A"
              stroke="#F6F4EF"
              strokeWidth="2"
            />
          </>
        )}
        {revealed && (
          <>
            <path
              d={`M${x(data.lookback - 1)},${y(data.context[data.lookback - 1].value)} L${x(data.lookback)},${y(data.target.value)}`}
              fill="none"
              stroke="#161512"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d={`M${x(data.lookback)} ${y(data.target.value) - 8}l8 8-8 8-8-8Z`}
              fill="#161512"
              stroke="#F6F4EF"
              strokeWidth="2"
            />
          </>
        )}
        {[
          0,
          Math.floor(data.lookback / 3),
          Math.floor((data.lookback * 2) / 3),
          data.lookback - 1,
        ].map((i) => (
          <text key={i} x={x(i)} y={height - 6} textAnchor="middle">
            {timeLabel(data, data.context[i].timestamp)}
          </text>
        ))}
      </svg>
      <div className="stage-chart-foot">
        <div className="stage-legend">
          <span>
            <i />
            Lịch sử
          </span>
          <span>
            <i className="blue" />
            RNN
          </span>
          <span>
            <i className="diamond" />
            Thực tế
          </span>
          {predicted && (
            <span>
              <i className="baseline" />
              Giữ nguyên
            </span>
          )}
        </div>
        <span>
          {formatDate(data.context[0].timestamp)} → {formatDate(data.target.timestamp)}
        </span>
      </div>
    </div>
  );
}
