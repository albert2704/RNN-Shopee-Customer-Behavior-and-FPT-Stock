/**
 * Quy ước thời gian của hoạt ảnh, KHÔNG phải thuật toán huấn luyện RNN.
 * Với cửa sổ dài L: frame 0 = chưa đọc; 1..L = đọc lịch sử;
 * L+1 = dự đoán; L+2 = mở đáp án; L+3 = đánh giá toàn tập kiểm tra.
 * Tách các quy tắc thuần này khỏi React để dễ giải thích và kiểm tra biên.
 */
export type DemoPhase = 0 | 1 | 2 | 3;
export type PlaybackMode = 'all' | 'single';

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
  if (frame < lookback) return 700;
  if (frame === lookback) return 1500;
  if (frame === lookback + 1) return 2600;
  if (frame === lookback + 2) return 5000;
  return 7000;
}

export interface ReplayPosition {
  index: number;
  frame: number;
  mode: PlaybackMode;
}

/** Kết thúc tập đang xem: chạy riêng thì dừng; chạy cả bộ thì chuyển tập/tổng kết. */
export function advanceReplay(position: ReplayPosition, lookback: number, datasetCount: number) {
  if (position.frame < lookback + 3) {
    return { index: position.index, frame: position.frame + 1, playing: true, summary: false };
  }
  if (position.mode === 'single') {
    return { index: position.index, frame: position.frame, playing: false, summary: false };
  }
  if (position.index + 1 < datasetCount) {
    return { index: position.index + 1, frame: 0, playing: true, summary: false };
  }
  return { index: position.index, frame: position.frame, playing: false, summary: true };
}
