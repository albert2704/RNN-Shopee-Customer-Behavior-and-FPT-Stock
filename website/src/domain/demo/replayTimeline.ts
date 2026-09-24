/**
 * Quy ước thời gian của hoạt ảnh, KHÔNG phải thuật toán huấn luyện RNN.
 * Với cửa sổ dài L: frame 0 = chưa đọc; 1..L = đọc lịch sử;
 * L+1 = dự đoán; L+2 = mở đáp án; L+3 = đánh giá toàn tập kiểm tra.
 * Tách các quy tắc thuần này khỏi React để dễ giải thích và kiểm tra biên.
 */
export type DemoPhase = 0 | 1 | 2 | 3;

export function getReplayPhase(frame: number, lookback: number) {
  return {
    read: Math.min(frame, lookback),
    predicted: frame >= lookback + 1,
    revealed: frame >= lookback + 2,
    evaluated: frame >= lookback + 3,
    phase: (frame <= lookback ? 0 : Math.min(frame - lookback, 3)) as DemoPhase,
    lastFrame: lookback + 3,
  };
}

/** Nhịp đọc chỉ điều khiển màn hình; không thay đổi dữ liệu hoặc dự đoán. */
export function getFrameDuration(frame: number, lookback: number): number {
  if (frame === 0) return 1200;
  if (frame <= 2) return 4400; // Hai bước đầu: đọc -> cập nhật -> thấy cả vector quay lại.
  if (frame <= lookback) return 250; // Từ bước 3, đọc nhanh cả phần lịch sử còn lại.
  return 0; // Các pha kết quả không dùng đồng hồ.
}

export interface ReplayPosition {
  index: number;
  frame: number;
}

/** Tự chạy đến dự đoán rồi dừng. Mỗi thao tác thủ công chỉ mở thêm một pha. */
export function advanceReplay(position: ReplayPosition, lookback: number, manual = false) {
  const limit = manual ? lookback + 3 : lookback + 1;
  const frame = position.frame < limit ? position.frame + 1 : position.frame;
  return {
    index: position.index,
    frame,
    playing: !manual && frame < lookback + 1,
    summary: false,
  };
}
