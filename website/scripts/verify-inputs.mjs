/** Đối chiếu đầu vào và phép tính checkpoint với JSON thật; không sửa dữ liệu. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getInputReadout } from '../src/domain/demo/inputReadout.ts';

const bundle = JSON.parse(
  readFileSync(new URL('../public/data/demo.json', import.meta.url), 'utf8'),
);
const original = JSON.stringify(bundle);
const expected = { retailrocket: [24, 7, 3], amazon: [30, 1, 1] };

// Tính độc lập bằng số double của JavaScript. Checkpoint/kernel PyTorch dùng
// float32 và có thể cộng theo thứ tự khác, nên không yêu cầu trùng từng bit.
const FLOAT32_TOLERANCE = 1e-6;
function assertClose(actual, expectedValue, description) {
  assert.ok(Number.isFinite(actual), `${description}: kết quả phải hữu hạn`);
  assert.ok(Number.isFinite(expectedValue), `${description}: đối chiếu phải hữu hạn`);
  assert.ok(
    Math.abs(actual - expectedValue) <= FLOAT32_TOLERANCE,
    `${description}: ${actual} khác ${expectedValue}`,
  );
}

function assertFiniteVector(values, length, description) {
  assert.ok(Array.isArray(values), `${description}: cần một vector`);
  assert.equal(values.length, length, `${description}: sai kích thước`);
  assert.ok(values.every(Number.isFinite), `${description}: vector có NaN/Infinity`);
}

function dot(weights, values) {
  return weights.reduce((sum, weight, index) => sum + weight * values[index], 0);
}

test('Bản demo chỉ có Retailrocket và Amazon, đúng thứ tự trình bày', () => {
  assert.deepEqual(
    bundle.datasets.map((data) => data.id),
    ['retailrocket', 'amazon'],
  );
});

for (const data of bundle.datasets) {
  test(`${data.id}: trọng số và phép tính có đúng kích thước, chỉ chứa số hữu hạn`, () => {
    const [steps, features] = expected[data.id];
    assert.equal(data.context.length, steps);
    assert.equal(data.hiddenSize, 32);
    assertFiniteVector(data.recurrentUnit.inputWeights, features, 'Hàng W_ih[0]');
    assertFiniteVector(data.recurrentUnit.previousWeights, 32, 'Hàng W_hh[0]');
    assertFiniteVector(data.outputLayer.weights, 32, 'Trọng số Linear');
    assert.ok(Number.isFinite(data.outputLayer.bias));
    assert.ok(Number.isFinite(data.normalization.targetMean));
    assert.ok(Number.isFinite(data.normalization.targetScale));
    assert.ok(data.normalization.targetScale > 0);
    for (const [index, point] of data.context.entries()) {
      const label = `Bước ${index + 1}`;
      assertFiniteVector(point.normalizedInput, features, `${label}: x_t`);
      assertFiniteVector(point.hiddenState, 32, `${label}: h_t`);
      assertFiniteVector(point.calculation.inputTerms, features, `${label}: tích W_x × x`);
      assertFiniteVector(point.calculation.previousTerms, 32, `${label}: tích W_h × h`);
      for (const key of ['biasInput', 'biasHidden', 'preactivation', 'stateValue']) {
        assert.ok(Number.isFinite(point.calculation[key]), `${label}: ${key} phải hữu hạn`);
      }
    }
  });

  test(`${data.id}: tái dựng h_t[0] từ trọng số, đầu vào và trạng thái trước ở mọi bước`, () => {
    const { inputWeights, previousWeights } = data.recurrentUnit;
    const first = data.context[0].calculation;
    let previous = Array(data.hiddenSize).fill(0);
    for (const [index, point] of data.context.entries()) {
      const calculation = point.calculation;
      const label = `Bước ${index + 1}`;
      // Tính các tích từ W và x/h thật, không lấy tổng đã xuất làm đáp án.
      const inputProducts = inputWeights.map((weight, j) => weight * point.normalizedInput[j]);
      const previousProducts = previousWeights.map((weight, j) => weight * previous[j]);
      for (const [j, product] of inputProducts.entries()) {
        assertClose(product, calculation.inputTerms[j], `${label}: W_ih[0,${j}] × x[${j}]`);
      }
      for (const [j, product] of previousProducts.entries()) {
        assertClose(product, calculation.previousTerms[j], `${label}: W_hh[0,${j}] × h[${j}]`);
      }
      // Bias/trọng số giữ nguyên giữa các bước suy luận; chỉ trạng thái đổi.
      assert.equal(calculation.biasInput, first.biasInput);
      assert.equal(calculation.biasHidden, first.biasHidden);
      const preactivation =
        inputProducts.reduce((sum, value) => sum + value, 0) +
        calculation.biasInput +
        previousProducts.reduce((sum, value) => sum + value, 0) +
        calculation.biasHidden;
      assertClose(preactivation, calculation.preactivation, `${label}: tổng trước tanh`);
      const hiddenValue = Math.tanh(preactivation);
      assertClose(hiddenValue, calculation.stateValue, `${label}: tanh của tổng`);
      assertClose(hiddenValue, point.hiddenState[0], `${label}: trạng thái nn.RNN đã lưu`);
      assert.ok(point.hiddenState.every((value) => Math.abs(value) <= 1));
      previous = point.hiddenState;
    }
  });

  test(`${data.id}: Linear dùng đủ trạng thái cuối và đổi về đúng đơn vị dự báo`, () => {
    const finalPoint = data.context.at(-1);
    const standardized =
      dot(data.outputLayer.weights, finalPoint.hiddenState) + data.outputLayer.bias;
    assertClose(standardized, data.target.predictedStandardized, 'Linear(h_cuối)');
    const transformed =
      standardized * data.normalization.targetScale + data.normalization.targetMean;
    assertClose(transformed, data.target.predictedTransformed, 'Đảo chuẩn hóa bằng thống kê train');
    // Retail: mục tiêu log1p(số giao dịch); Amazon: log return của phiên sau.
    const originalUnits =
      data.id === 'retailrocket'
        ? Math.max(0, Math.expm1(transformed))
        : finalPoint.value * Math.exp(transformed);
    assertClose(originalUnits, data.target.prediction, 'Dự báo ở đơn vị gốc');
  });

  test(`${data.id}: chưa đọc không lộ số liệu hoặc timestamp của quan sát đầu`, () => {
    // Getter ném lỗi nếu helper đọc context/target khi vẫn ở bước 0.
    const hidden = {
      ...data,
      get context() {
        throw new Error('Chưa được đọc quan sát');
      },
      get target() {
        throw new Error('Không dùng nhãn tương lai trong phần đầu vào');
      },
    };
    for (const read of [0, -1]) {
      const view = getInputReadout(hidden, read);
      assert.equal(view.timestamp, '');
      assert.equal(view.featureCount, expected[data.id][1]);
      assert.ok(view.items.every((item) => item.value === null));
    }
  });

  test(`${data.id}: mọi bước đọc đúng quan sát và giữ nguyên vector chuẩn hóa`, () => {
    const [steps, features, displayed] = expected[data.id];
    assert.equal(data.lookback, steps);
    assert.equal(data.context.length, steps);
    assert.equal(data.inputSize, features);
    assert.equal(data.featureNames.length, features);
    for (let read = 1; read <= steps; read++) {
      const point = data.context[read - 1];
      const inputBefore = [...point.input];
      const normalizedBefore = [...point.normalizedInput];
      const view = getInputReadout(data, read);
      assert.equal(view.featureCount, features);
      assert.equal(view.items.length, displayed);
      assert.equal(point.input.length, features);
      assert.equal(point.normalizedInput.length, features);
      assert.ok(point.normalizedInput.every(Number.isFinite));
      assert.deepEqual(point.input, inputBefore);
      assert.deepEqual(point.normalizedInput, normalizedBefore);
      const timestamp =
        data.id === 'amazon'
          ? `${point.timestamp.slice(8, 10)}/${point.timestamp.slice(5, 7)}`
          : point.timestamp.slice(11, 16);
      assert.equal(view.timestamp, timestamp);

      if (data.id === 'retailrocket') {
        for (const [index, feature] of ['log_view', 'log_addtocart', 'log_transaction'].entries()) {
          const rawCount = Math.expm1(point.input[data.featureNames.indexOf(feature)]);
          const item = view.items[index];
          assert.ok(Number.isInteger(item.value));
          assert.ok(item.value >= 0);
          assert.ok(Math.abs(item.value - rawCount) < 1e-9);
          assert.equal(item.digits, 0);
        }
        assert.equal(view.items[2].value, point.value);
      } else if (data.id === 'amazon') {
        const item = view.items[0];
        assert.equal(item.label, 'Lợi suất log');
        assert.equal(item.unit, '%');
        assert.equal(item.digits, 3);
        assert.equal(item.value, point.input[data.featureNames.indexOf('log_return')] * 100);
        assert.notEqual(
          item.value,
          point.value,
          'Giá USD của biểu đồ không phải đầu vào log return',
        );
        assert.equal(view.extra, '1 giá trị mỗi phiên');
      }
      if (data.id !== 'amazon') {
        const temporal = ['hour_sin', 'hour_cos', 'weekday_sin', 'weekday_cos'];
        for (const feature of temporal) {
          const value = point.input[data.featureNames.indexOf(feature)];
          assert.ok(Number.isFinite(value) && Math.abs(value) <= 1);
        }
        assert.match(view.extra, /4.*sin\/cos/);
      }
      assert.match(view.preprocessing, /tập học/);
    }
    // Các pha kết quả giữ đầu vào cuối; không đọc sang nhãn target.
    assert.deepEqual(getInputReadout(data, steps + 3), getInputReadout(data, steps));
  });
}

test('Đọc bằng tên đặc trưng, không phụ thuộc thứ tự cột', () => {
  for (const data of bundle.datasets) {
    const reversed = {
      ...data,
      featureNames: [...data.featureNames].reverse(),
      context: data.context.map((point) => ({
        ...point,
        input: [...point.input].reverse(),
        normalizedInput: [...point.normalizedInput].reverse(),
      })),
    };
    assert.deepEqual(getInputReadout(reversed, 1), getInputReadout(data, 1));
  }
});

test('Đồng hồ nguồn được giữ nguyên, không đổi theo múi giờ trình duyệt', () => {
  for (const data of bundle.datasets) {
    const sourceClock = {
      ...data,
      context: [{ ...data.context[0], timestamp: '2024-03-05T23:45:00-07:00' }],
    };
    assert.equal(
      getInputReadout(sourceClock, 1).timestamp,
      data.id === 'amazon' ? '05/03' : '23:45',
    );
  }
});

test('Helper không sửa JSON đầu vào, trạng thái hoặc kết quả mô hình', () => {
  for (const data of bundle.datasets) {
    for (let read = 0; read <= data.lookback; read++) getInputReadout(data, read);
  }
  assert.equal(JSON.stringify(bundle), original);
});
