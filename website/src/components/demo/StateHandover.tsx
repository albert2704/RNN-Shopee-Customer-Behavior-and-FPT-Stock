import { useId, useLayoutEffect, useState, type RefObject } from 'react';
import { getTransferPosition, type TransferGeometry } from '../../domain/demo/stateHandover';
import { stateColor } from '../../domain/demo/demoCopy';

interface Props {
  root: RefObject<HTMLDivElement | null>;
  source: RefObject<HTMLDivElement | null>;
  destination: RefObject<HTMLDivElement | null>;
  values: number[];
  progress: number;
  transferring: boolean;
  visible: boolean;
  layoutKey: string;
}

/** Bản sao 32 giá trị đi từ h_t sang vị trí dùng h_t ở bước kế tiếp. */
export default function StateHandover({
  root,
  source,
  destination,
  values,
  progress,
  transferring,
  visible,
  layoutKey,
}: Props) {
  const marker = useId();
  const [geometry, setGeometry] = useState<TransferGeometry | null>(null);

  useLayoutEffect(() => {
    const container = root.current;
    const from = source.current;
    const to = destination.current;
    if (!container || !from || !to) return;
    function measure() {
      const parent = container!.getBoundingClientRect();
      const box = (element: HTMLDivElement) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left - parent.left,
          y: rect.top - parent.top,
          width: rect.width,
          height: rect.height,
        };
      };
      const sourceBox = box(from!);
      const destinationBox = box(to!);
      setGeometry({
        from: sourceBox,
        to: destinationBox,
        railY: parent.height - 14,
        stacked: sourceBox.y > destinationBox.y + 60,
      });
    }
    measure();
    // Đo lại khi đổi viewport/toàn màn hình; không dùng tọa độ cứng theo ảnh chụp.
    const observer = new ResizeObserver(measure);
    [container, from, to].forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [root, source, destination, layoutKey]);

  if (!geometry || !visible) return null;
  const { from, to, railY } = geometry;
  const startX = from.x + from.width / 2;
  const endX = to.x + to.width / 2;
  const startY = from.y + from.height / 2;
  const endY = to.y + to.height / 2;
  const packet = getTransferPosition(progress, geometry);
  const gap = 2; // Phải khớp khoảng cách giữa các ô ở hai vector trong CSS.
  const cellWidth = (packet.width - gap * 15) / 16;
  const cellHeight = (packet.height - gap) / 2;

  return (
    <svg className="stage-transfer-layer" aria-hidden="true">
      <defs>
        <marker id={marker} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M1 1 L6 4 L1 7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </marker>
      </defs>
      <path
        className="stage-transfer-route"
        d={
          geometry.stacked
            ? `M${startX} ${startY} L${endX} ${endY}`
            : `M${startX} ${startY} V${railY} H${endX} V${endY}`
        }
        fill="none"
        markerEnd={`url(#${marker})`}
      />
      {transferring && (
        <g
          className="stage-transfer-packet"
          transform={`translate(${packet.x - packet.width / 2} ${packet.y - packet.height / 2})`}
        >
          <rect
            className="stage-transfer-outline"
            x="-4"
            y="-4"
            width={packet.width + 8}
            height={packet.height + 8}
            rx="5"
            fill="#fff"
            stroke="#365eeb"
            strokeWidth="2"
          />
          {values.map((value, i) => (
            <rect
              key={i}
              x={(i % 16) * (cellWidth + gap)}
              y={Math.floor(i / 16) * (cellHeight + gap)}
              width={cellWidth}
              height={cellHeight}
              rx="1.5"
              fill={stateColor(value)}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
