/** Các pha trình diễn một bước; không tính lại RNN hay thay đổi checkpoint. */
export type HandoverPhase = 'idle' | 'input' | 'update' | 'state' | 'transfer' | 'output';

export function getHandoverPhase(
  read: number,
  lookback: number,
  progress: number,
  snapshot = false,
): HandoverPhase {
  if (read === 0) return 'idle';
  if (read > lookback) return 'output';
  // Hai bước đầu giải thích cơ chế. Từ bước 3 chỉ hiện trạng thái đã tính,
  // tránh lặp chuyển động nhanh trong khi biểu đồ đọc phần lịch sử còn lại.
  if (snapshot || read >= 3) return 'state';
  if (progress < 0.2) return 'input';
  if (progress < 0.42) return 'update';
  // Bước cuối đưa h_L sang lớp dự đoán, không quay lại một đầu vào không tồn tại.
  if (read < lookback && progress >= 0.58) return 'transfer';
  return 'state';
}

/** Tích lũy thời gian đã chạy; đổi tốc độ không làm mất phần đã xem. */
export function advanceClock(elapsed: number, delta: number, speed: number, duration: number) {
  return Math.min(duration, Math.max(0, elapsed + Math.max(0, delta) * speed));
}

export interface StateBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface TransferGeometry {
  from: StateBox;
  to: StateBox;
  railY: number;
  stacked?: boolean;
}

/** Di chuyển cả vector: đi xuống, sang trái, rồi vào vị trí trạng thái trước. */
export function getTransferPosition(progress: number, geometry: TransferGeometry) {
  const { from, to, railY } = geometry;
  const p = Math.min(1, Math.max(0, progress));
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  // Trên điện thoại hai thẻ nằm chéo nhau: đi qua khoảng trống giữa chúng,
  // tránh đường vòng dưới vốn sẽ đi xuyên qua thẻ dự đoán ở cột trái.
  const points = geometry.stacked
    ? [start, end]
    : [start, { x: start.x, y: railY }, { x: end.x, y: railY }, end];
  const lengths = points
    .slice(1)
    .map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
  let distance = p * lengths.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const ratio = lengths[i] ? distance / lengths[i] : 0;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
        width: from.width + (to.width - from.width) * p,
        height: from.height + (to.height - from.height) * p,
      };
    }
    distance -= lengths[i];
  }
  return { ...end, width: to.width, height: to.height };
}
