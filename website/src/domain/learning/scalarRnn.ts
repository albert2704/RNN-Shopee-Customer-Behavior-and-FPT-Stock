/**
 * RNN minh họa: mỗi bước có một đầu vào và một giá trị trạng thái.
 *
 * Đây là phép tính độc lập để giải thích forward → BPTT → SGD, không phải
 * hai mô hình 32 chiều được phát lại từ checkpoint trong demo chính.
 * Bộ wx, wh, b được dùng chung ở mọi bước thời gian; wy, by tạo đầu ra.
 */
export type ScalarWeights = {
  wx: number;
  wh: number;
  b: number;
  wy: number;
  by: number;
};

export const INITIAL_WEIGHTS: ScalarWeights = {
  wx: 0.5,
  wh: 0.8,
  b: 0.1,
  wy: 1.2,
  by: -0.05,
};

export const EXAMPLE_INPUT = [0.2, -0.1, 0.4];
export const EXAMPLE_TARGET = 0.3;
export const LEARNING_RATE = 0.1;

/**
 * Lan truyền thuận: hₜ = tanh(wx·xₜ + wh·hₜ₋₁ + b), rồi ŷ = wy·hT + by.
 * Mỗi lần gọi bắt đầu từ h₀ = 0 theo quy ước của ví dụ này.
 * Chỉ trạng thái thay đổi trong vòng lặp; không cập nhật bất kỳ trọng số nào.
 */
export function scalarForward(input: number[], weights: ScalarWeights = INITIAL_WEIGHTS) {
  const states: number[] = [];
  let previous = 0;

  for (const x of input) {
    previous = Math.tanh(weights.wx * x + weights.wh * previous + weights.b);
    states.push(previous);
  }

  return {
    states,
    prediction: weights.wy * previous + weights.by,
  };
}

/**
 * Lan truyền ngược qua thời gian (BPTT), với L = ½(ŷ − y)².
 *
 * Đầu tiên dL/dŷ = ŷ − y. Ở bước t, gọi aₜ là đầu vào của tanh:
 *   δₜ = dL/daₜ = (dL/dhₜ)·(1 − hₜ²).
 * Từ đó cộng đóng góp vào gradient dùng chung:
 *   dL/dwx += δₜ·xₜ; dL/dwh += δₜ·hₜ₋₁; dL/db += δₜ.
 * Đưa ảnh hưởng về bước trước bằng dL/dhₜ₋₁ = δₜ·wh.
 *
 * Duyệt ngược, cộng đóng góp từ mọi bước vì các bước cùng dùng một bộ
 * tham số. Toàn bộ gradient được tính với trọng số cũ, chưa cập nhật;
 * ví dụ dùng đạo hàm trực tiếp, không cắt gradient (gradient clipping).
 */
export function scalarGradient(
  input: number[],
  target: number,
  weights: ScalarWeights = INITIAL_WEIGHTS,
) {
  const forward = scalarForward(input, weights);
  const error = forward.prediction - target;

  // Lớp đầu ra: dL/dwy = (ŷ − y)·hT; dL/dby = ŷ − y.
  const gradient: ScalarWeights = {
    wx: 0,
    wh: 0,
    b: 0,
    wy: error * (forward.states.at(-1) ?? 0),
    by: error,
  };

  // Bắt đầu tại trạng thái cuối: dL/dhT = (ŷ − y)·wy.
  let stateGradient = error * weights.wy;

  for (let t = input.length - 1; t >= 0; t--) {
    const delta = stateGradient * (1 - forward.states[t] ** 2);
    gradient.wx += delta * input[t];
    gradient.wh += delta * (forward.states[t - 1] ?? 0);
    gradient.b += delta;
    stateGradient = delta * weights.wh;
  }

  return {
    ...forward,
    error,
    loss: 0.5 * error ** 2,
    gradient,
  };
}

/**
 * Một bước SGD: θ mới = θ cũ − η·dL/dθ, với η là tốc độ học.
 * Tạo bộ tham số mới để cả năm tham số dùng cùng gradient đã tính xong;
 * không sửa trọng số đầu vào và không tính lại gradient giữa các cập nhật.
 */
export function scalarUpdate(
  weights: ScalarWeights,
  gradient: ScalarWeights,
  rate = LEARNING_RATE,
): ScalarWeights {
  return {
    wx: weights.wx - rate * gradient.wx,
    wh: weights.wh - rate * gradient.wh,
    b: weights.b - rate * gradient.b,
    wy: weights.wy - rate * gradient.wy,
    by: weights.by - rate * gradient.by,
  };
}
