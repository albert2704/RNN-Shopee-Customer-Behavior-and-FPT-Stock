/** Kiểm tra biên hành vi khi tách code: không cần mở trình duyệt hay huấn luyện lại. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceReplay,
  getFrameDuration,
  getReplayPhase,
} from '../src/domain/demo/replayTimeline.ts';
import {
  advanceClock,
  getHandoverPhase,
  getTransferPosition,
} from '../src/domain/demo/stateHandover.ts';
import {
  INITIAL_WEIGHTS,
  scalarForward,
  scalarGradient,
  scalarUpdate,
} from '../src/components/learningMath.ts';

for (const lookback of [24, 30]) {
  test(`Cửa sổ ${lookback}: không lộ dự đoán/đáp án trước khi đọc đủ`, () => {
    for (const frame of [0, 1, lookback - 1, lookback]) {
      const state = getReplayPhase(frame, lookback);
      assert.equal(state.read, frame);
      assert.equal(state.phase, 0);
      assert.equal(state.predicted, false);
      assert.equal(state.revealed, false);
    }
    assert.deepEqual(getReplayPhase(lookback + 1, lookback), {
      read: lookback,
      predicted: true,
      revealed: false,
      evaluated: false,
      phase: 1,
      lastFrame: lookback + 3,
    });
    assert.equal(getReplayPhase(lookback + 2, lookback).phase, 2);
    assert.equal(getReplayPhase(lookback + 2, lookback).revealed, true);
    assert.equal(getReplayPhase(lookback + 2, lookback).evaluated, false);
    assert.equal(getReplayPhase(lookback + 3, lookback).evaluated, true);
  });
}

for (const [index, lookback] of [30, 30].entries()) {
  test(`Tập ${index}: tự chạy đến dự đoán rồi dừng, giữ nguyên tập đang chọn`, () => {
    let state = { index, frame: 0, playing: true, summary: false };
    const visited = [];
    while (state.playing) {
      visited.push(state.frame);
      state = advanceReplay(state, lookback);
    }
    assert.deepEqual(
      visited,
      Array.from({ length: lookback + 1 }, (_, i) => i),
    );
    assert.deepEqual(state, { index, frame: lookback + 1, playing: false, summary: false });
    for (let tick = 0; tick < 20; tick++) state = advanceReplay(state, lookback);
    assert.equal(state.frame, lookback + 1);
    assert.equal(getReplayPhase(state.frame, lookback).revealed, false);
  });

  test(`Tập ${index}: mỗi lần bấm chỉ mở một pha, thực tế và toàn tập không tự chuyển`, () => {
    const prediction = { index, frame: lookback + 1 };
    const actual = advanceReplay(prediction, lookback, true);
    assert.deepEqual(actual, { index, frame: lookback + 2, playing: false, summary: false });
    assert.deepEqual(advanceReplay(actual, lookback), actual);
    const evaluation = advanceReplay(actual, lookback, true);
    assert.deepEqual(evaluation, { index, frame: lookback + 3, playing: false, summary: false });
    assert.deepEqual(advanceReplay(evaluation, lookback), evaluation);
    assert.deepEqual(advanceReplay(evaluation, lookback, true), evaluation);
  });
}

test('Hai bước đầu giữ nhịp giải thích; mọi bước từ 3 đọc nhanh, kết quả không dùng đồng hồ', () => {
  for (const length of [24, 30]) {
    assert.equal(getFrameDuration(0, length), 1200);
    assert.equal(getFrameDuration(1, length), 4400);
    assert.equal(getFrameDuration(2, length), 4400);
    for (let frame = 3; frame <= length; frame++)
      assert.equal(getFrameDuration(frame, length), 250);
    for (let frame = length + 1; frame <= length + 3; frame++)
      assert.equal(getFrameDuration(frame, length), 0);
  }
});

for (const lookback of [24, 30]) {
  test(`Cửa sổ ${lookback}: hai bước đầu đi qua đủ các pha nhận, cập nhật và truyền trạng thái`, () => {
    const boundaries = [
      [0, 'input'],
      [0.199999, 'input'],
      [0.2, 'update'],
      [0.419999, 'update'],
      [0.42, 'state'],
      [0.579999, 'state'],
      [0.58, 'transfer'],
      [1, 'transfer'],
    ];
    for (const read of [1, 2]) {
      for (const [progress, phase] of boundaries) {
        assert.equal(getHandoverPhase(read, lookback, progress), phase);
      }
    }
  });

  test(`Cửa sổ ${lookback}: từ bước 3 không lặp chuyển động hoặc nhấp nháy các pha`, () => {
    for (let read = 3; read <= lookback; read++) {
      for (const progress of [0, 0.2, 0.42, 0.58, 0.9, 1]) {
        assert.equal(getHandoverPhase(read, lookback, progress), 'state');
      }
    }
  });

  test(`Cửa sổ ${lookback}: đầu vào cuối không truyền sang một bước lịch sử không tồn tại`, () => {
    for (const progress of [0, 0.199999, 0.2, 0.419999, 0.42, 0.58, 1]) {
      const phase = getHandoverPhase(lookback, lookback, progress);
      assert.notEqual(phase, 'transfer');
      assert.notEqual(phase, 'output');
    }
    assert.equal(getHandoverPhase(lookback, lookback, 0.42), 'state');
    assert.equal(getHandoverPhase(lookback, lookback, 1), 'state');
    assert.equal(getHandoverPhase(lookback + 1, lookback, 0), 'output');
  });

  test(`Cửa sổ ${lookback}: tua đến bước hợp lệ hiển thị trạng thái đã có, không chạy lại chuyển động`, () => {
    for (const progress of [0, 0.2, 0.42, 0.58, 1]) {
      assert.equal(getHandoverPhase(0, lookback, progress), 'idle');
      assert.equal(getHandoverPhase(0, lookback, progress, true), 'idle');
      for (let read = 1; read <= lookback; read++) {
        assert.equal(getHandoverPhase(read, lookback, progress, true), 'state');
      }
      assert.equal(getHandoverPhase(lookback + 1, lookback, progress, true), 'output');
    }
  });
}

test('Đồng hồ cộng tiếp phần đã chạy khi đổi tốc độ; delta bằng 0 không làm mất tiến độ', () => {
  const duration = 4400;
  let elapsed = advanceClock(0, 400, 1, duration);
  assert.equal(elapsed, 400);
  elapsed = advanceClock(elapsed, 0, 2, duration);
  assert.equal(elapsed, 400);
  elapsed = advanceClock(elapsed, 100, 2, duration);
  assert.equal(elapsed, 600);
  elapsed = advanceClock(elapsed, 400, 0.5, duration);
  assert.equal(elapsed, 800);
  // Hàm thuần nhận speed=0 cũng phải giữ nguyên; hook tự ngừng clock khi pause.
  assert.equal(advanceClock(elapsed, 5000, 0, duration), elapsed);
  assert.equal(advanceClock(elapsed, 3600, 1, duration), duration);
});

test('Đồng hồ chặn đúng biên: không chạy lùi vì delta âm và không vượt thời lượng bước', () => {
  assert.equal(advanceClock(100, -20, 2, 4400), 100);
  assert.equal(advanceClock(-100, 0, 1, 4400), 0);
  assert.equal(advanceClock(4500, 0, 1, 4400), 4400);
  assert.equal(advanceClock(4399, 0.5, 2, 4400), 4400);
  assert.equal(advanceClock(4300, 500, 2, 4400), 4400);
  assert.equal(advanceClock(0, 100, 1, 0), 0);
});

test('Vector đi từ tâm trạng thái mới qua đường nối đến đúng tâm trạng thái trước', () => {
  const geometry = {
    from: { x: 80, y: 20, width: 40, height: 40 },
    to: { x: 0, y: 30, width: 20, height: 20 },
    railY: 100,
  };
  const start = { x: 100, y: 40, width: 40, height: 40 };
  const end = { x: 10, y: 40, width: 20, height: 20 };
  assert.deepEqual(getTransferPosition(0, geometry), start);
  assert.deepEqual(getTransferPosition(1, geometry), end);
  // Hai đoạn dọc dài 60; đoạn ngang dài 90. Nửa đường nằm giữa đoạn ngang.
  assert.deepEqual(getTransferPosition(0.5, geometry), {
    x: 55,
    y: 100,
    width: 30,
    height: 30,
  });
  assert.deepEqual(getTransferPosition(-1, geometry), start);
  assert.deepEqual(getTransferPosition(2, geometry), end);
  // Bố cục điện thoại đi qua khoảng trống chéo, không vòng xuyên thẻ dự đoán.
  assert.deepEqual(getTransferPosition(0.5, { ...geometry, stacked: true }), {
    x: 55,
    y: 40,
    width: 30,
    height: 30,
  });
});

test('Đường truyền có độ dài bằng 0 vẫn trả tọa độ hữu hạn', () => {
  const box = { x: 0, y: 0, width: 20, height: 20 };
  assert.deepEqual(getTransferPosition(0.5, { from: box, to: box, railY: 10 }), {
    x: 10,
    y: 10,
    width: 20,
    height: 20,
  });
});

test('Ví dụ BPTT: gradient khớp sai phân hữu hạn và SGD giảm loss trong lần học minh họa', () => {
  const input = [0.2, -0.1, 0.4];
  const target = 0.3;
  const before = scalarGradient(input, target);
  // Giá trị đối chiếu từ results/toy_rnn.json của ví dụ PyTorch đã kiểm chứng.
  assert.ok(Math.abs(before.prediction - 0.46997200379695453) < 1e-10);
  for (const key of Object.keys(INITIAL_WEIGHTS)) {
    const epsilon = 1e-6;
    const plus = scalarForward(input, {
      ...INITIAL_WEIGHTS,
      [key]: INITIAL_WEIGHTS[key] + epsilon,
    }).prediction;
    const minus = scalarForward(input, {
      ...INITIAL_WEIGHTS,
      [key]: INITIAL_WEIGHTS[key] - epsilon,
    }).prediction;
    const numerical = (0.5 * (plus - target) ** 2 - 0.5 * (minus - target) ** 2) / (2 * epsilon);
    assert.ok(Math.abs(numerical - before.gradient[key]) < 1e-8, key);
  }
  const updated = scalarUpdate(INITIAL_WEIGHTS, before.gradient);
  const after = scalarGradient(input, target, updated);
  assert.ok(Math.abs(updated.wx - 0.49269052210693776) < 1e-10);
  assert.ok(after.loss < before.loss);
  assert.deepEqual(INITIAL_WEIGHTS, { wx: 0.5, wh: 0.8, b: 0.1, wy: 1.2, by: -0.05 });
});
