import { useState, useEffect, useRef, useId } from 'react';
import { colors, modelLabels, formatNumber, formatDate, type Point } from '../types';

export default function SignalChart({
  points,
  models = ['actual'],
  unit,
  label,
  time = false,
  compact = false,
}: {
  points: Point[];
  models?: string[];
  unit: string;
  label: string;
  time?: boolean;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [selection, setSelection] = useState<number | null>(null);
  const fillId = useId().replace(/:/g, '');
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(290, entries[0].contentRect.width)),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setSelection(null), [points]);
  const height = compact ? 160 : 300,
    left = compact ? 12 : 56,
    right = 18,
    top = 20,
    bottom = compact ? 16 : 37;
  const vals = points.flatMap((p) =>
    models.map((m) => p[m]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v)),
  );
  const min = vals.length ? Math.min(...vals) : 0,
    max = vals.length ? Math.max(...vals) : 1;
  const range = Math.max(max - min, 1),
    low = Math.max(0, min - range * 0.1),
    high = max + range * 0.12;
  const plotW = width - left - right,
    plotH = height - top - bottom;
  const x = (i: number) => left + (i / Math.max(1, points.length - 1)) * plotW;
  const y = (v: number) => top + ((high - v) / (high - low)) * plotH;
  const path = (key: string) =>
    points
      .map((p, i) =>
        typeof p[key] === 'number'
          ? `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p[key] as number).toFixed(2)}`
          : '',
      )
      .join(' ');
  const i = selection ?? Math.max(0, points.length - 1),
    p = points[i];
  const selected = x(i);
  const spansMonths =
    points.length > 1 &&
    Date.parse(points.at(-1)!.timestamp) - Date.parse(points[0].timestamp) > 60 * 86400000;
  return (
    <div className={`signal-chart ${compact ? 'is-compact' : ''}`} ref={ref}>
      {!compact && (
        <div className="chart-readout" aria-live="off">
          <span className="readout-time">
            {p ? formatDate(p.timestamp, time) : 'Không có dữ liệu'}
          </span>
          <div>
            {models.map((key) => (
              <span key={key}>
                <i style={{ background: colors[key] || '#6b756e' }} />
                {modelLabels[key] || key}
                <strong>
                  {p && typeof p[key] === 'number' ? formatNumber(p[key] as number) : '—'}
                </strong>
              </span>
            ))}
          </div>
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setSelection(
            Math.min(
              points.length - 1,
              Math.max(
                0,
                Math.round(
                  ((((e.clientX - r.left) / r.width) * width - left) / plotW) * (points.length - 1),
                ),
              ),
            ),
          );
        }}
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#365eeb" stopOpacity=".10" />
            <stop offset="100%" stopColor="#365eeb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {!compact &&
          Array.from({ length: 5 }, (_, i) => {
            const v = low + ((high - low) * i) / 4;
            return (
              <g key={i}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="#e8ece7"
                  strokeDasharray="3 5"
                />
                <text x={left - 12} y={y(v) + 4} textAnchor="end" className="axis-label">
                  {formatNumber(v, 0)}
                </text>
              </g>
            );
          })}
        {models.includes('actual') && points.length > 1 && (
          <path
            d={`${path('actual')} L${x(points.length - 1)},${height - bottom} L${left},${height - bottom} Z`}
            fill={`url(#${fillId})`}
          />
        )}
        {models.map((key) => (
          <path
            key={key}
            d={path(key)}
            fill="none"
            stroke={colors[key] || '#6b756e'}
            strokeWidth={key === 'actual' ? 1.9 : 1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={key === 'persistence' ? '4 5' : undefined}
            opacity={key === 'actual' ? 0.75 : 1}
          />
        ))}
        {!compact &&
          [0, 0.25, 0.5, 0.75, 1]
            .filter((_, i) => width > 580 || i % 2 === 0)
            .map((f) => {
              const j = Math.round(f * Math.max(0, points.length - 1));
              return (
                points[j] && (
                  <text
                    key={f}
                    x={x(j)}
                    y={height - 9}
                    textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
                    className="axis-label"
                  >
                    {width > 550
                      ? formatDate(points[j].timestamp)
                      : spansMonths
                        ? formatDate(points[j].timestamp).slice(3)
                        : formatDate(points[j].timestamp).slice(0, 5)}
                  </text>
                )
              );
            })}
        {!compact && p && (
          <g>
            <line
              x1={selected}
              x2={selected}
              y1={top}
              y2={height - bottom}
              stroke="#adb8b0"
              strokeDasharray="4 5"
            />
            {models.map(
              (key) =>
                typeof p[key] === 'number' && (
                  <circle
                    key={key}
                    cx={selected}
                    cy={y(p[key] as number)}
                    r={4}
                    fill={colors[key] || '#6b756e'}
                    stroke="white"
                    strokeWidth="2"
                  />
                ),
            )}
          </g>
        )}
      </svg>
      {!compact && points.length > 1 && (
        <div className="chart-scrubber">
          <span>{unit}</span>
          <label>
            <span className="sr-only">Di chuyển dọc thời gian trên biểu đồ</span>
            <input
              type="range"
              min="0"
              max={points.length - 1}
              value={i}
              onChange={(e) => setSelection(Number(e.target.value))}
              aria-valuetext={
                p ? `${formatDate(p.timestamp, time)}, ${formatNumber(p.actual)} ${unit}` : ''
              }
            />
          </label>
          <span>Khám phá theo thời gian</span>
        </div>
      )}
    </div>
  );
}
