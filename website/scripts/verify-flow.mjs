import {chromium, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

// Run against an already-built local site. This exercises the actual replay
// timers at 2×; the complete two-dataset tour takes about 43 seconds.
const url = (process.env.SITE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = new URL('../qa/flow/', import.meta.url);
await mkdir(output, {recursive: true});
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: {width: 1280, height: 720},
  reducedMotion: 'reduce',
  timezoneId: 'Asia/Ho_Chi_Minh',
});
const page = await context.newPage();
const checks = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});

const pass = message => { checks.push(message); console.log('PASS', message); };
const number = (value, digits = 2) => new Intl.NumberFormat('vi-VN', {maximumFractionDigits: digits}).format(value);
const amount = (data, value) => `${number(value, 2)} ${data.unit}`;
// includeHidden lets us read (never operate) the inert underlying slider while
// a modal is open, to verify that its paused position is preserved.
const progress = () => page.getByRole('slider', {name: 'Tiến trình demo', exact: true, includeHidden: true});
const datasets = () => page.getByRole('navigation', {name: 'Chọn dữ liệu demo'});
const datasetButton = name => datasets().getByRole('button', {name: new RegExp(name)});
const workspace = data => page.getByRole('region', {name: `Hoạt ảnh ${data.title}`, exact: true});
const chart = data => workspace(data).getByRole('img', {name: new RegExp(`^${data.title}:`)});
const focusPanel = (data, phase) => workspace(data).getByRole('complementary', {name: phase, exact: true});
const metricAmount = (data, value) => `${number(value, data.id === 'amazon' ? 4 : 2)} ${data.unit}`;
const screenshot = name => page.screenshot({path: fileURLToPath(new URL(`${name}.png`, output))});

async function noHorizontalOverflow() {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function fitsProjector() {
  await noHorizontalOverflow();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), {
    message: 'The entire main demo fits the 1280×720 projector viewport without scrolling',
  }).toBe(true);
  const player = page.getByRole('button', {name: /^(Chạy cả 2 demo|Chạy tập này|Tiếp tục|Chạy lại tập này|Chạy lại cả 2|Tạm dừng)$/});
  await expect(player).toBeInViewport({ratio: 1});
}

async function fitsQuickAnswer() {
  await expect.poll(() => page.locator('.stage-dialog-body').evaluate(element =>
    element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth), {
    message: 'Each quick answer fits the desktop dialog without scrolling',
  }).toBe(true);
  await expect(page.getByRole('button', {name: 'Đọc giải thích đầy đủ', exact: true})).toBeInViewport({ratio: 1});
}

// Keyboard input exercises the same range control a presenter uses; no direct
// DOM value assignment, React state access, or synthetic forecast injection.
async function scrubTo(step) {
  await progress().press('Home');
  for (let index = 0; index < step; index++) await progress().press('ArrowRight');
  await expect(progress()).toHaveValue(String(step));
}

try {
  const response = await context.request.get(`${url}/data/demo.json`);
  assert.equal(response.status(), 200);
  const {datasets: data} = await response.json();
  assert.deepEqual(data.map(item => item.id), ['retailrocket', 'amazon']);
  // These fixtures protect the source examples, not merely UI/JSON agreement.
  const fixtures = [
    {id: 'retailrocket', name: 'Retailrocket', question: 'Giờ tới có bao nhiêu sự kiện giao dịch?', lookback: 24, inputSize: 7, timestamp: '2015-08-28T13:00:00+00:00', actual: 13, prediction: 1.162278763348847, count: 491},
    {id: 'amazon', name: 'Amazon', question: 'Giá điều chỉnh phiên tới là bao nhiêu?', lookback: 30, inputSize: 1, timestamp: '2019-12-17T00:00:00+00:00', actual: 89.532997, prediction: 88.55347474242303, count: 999},
  ];
  for (const fixture of fixtures) {
    const item = data.find(value => value.id === fixture.id);
    assert.equal(item.lookback, fixture.lookback);
    assert.equal(item.inputSize, fixture.inputSize);
    assert.equal(item.context.length, fixture.lookback);
    assert.equal(item.target.timestamp, fixture.timestamp);
    assert.equal(item.target.value, fixture.actual);
    assert.ok(Math.abs(item.target.prediction - fixture.prediction) < 1e-9);
    assert.equal(item.target.baseline, item.context.at(-1).value);
    assert.equal(item.metrics.testCount, fixture.count);
    assert.equal(item.verification.status, 'passed');
    assert.ok(item.verification.manualRecurrenceMaximumAbsoluteError < 1e-6);
    assert.ok(item.context.every(point => point.normalizedInput.length === fixture.inputSize && point.hiddenState.length === 32));
  }
  pass('Both examples retain the verified first test target and correct 24/30-step input windows');

  await page.goto(`${url}/#talk/1`);
  await expect(page).toHaveURL(/#demo$/);
  await expect(workspace(data[0])).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('button', {name: 'Chạy cả 2 demo', exact: true})).toBeVisible();
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await expect(page.getByLabel('Dự đoán của bạn', {exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: /^(Tiếp theo|Quay lại)$/})).toHaveCount(0);
  await fitsProjector();
  await screenshot('desktop-ready');
  pass('Opening the site shows one ready-to-run demo with no guess field or slide navigation');

  await page.getByRole('combobox', {name: 'Tốc độ phát'}).selectOption('2');
  for (const [index, item] of data.entries()) {
    await datasetButton(fixtures[index].name).click();
    await expect(datasetButton(fixtures[index].name)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', {level: 1})).toHaveText(fixtures[index].question);
    await expect(progress()).toHaveValue('0');
    await expect(progress()).toHaveAttribute('max', String(item.lookback + 3));
    await page.getByRole('button', {name: 'Chạy tập này', exact: true}).click();
    await expect.poll(async () => Number(await progress().inputValue())).toBeGreaterThan(0);
    await page.getByRole('button', {name: 'Tạm dừng', exact: true}).click();
    const pausedAt = await progress().inputValue();
    await page.waitForTimeout(800);
    await expect(progress()).toHaveValue(pausedAt);
    await expect(page.getByRole('button', {name: 'Tiếp tục', exact: true})).toBeVisible();

    await scrubTo(5);
    const states = workspace(item).getByRole('img', {name: `32 giá trị trạng thái sau 5 ${item.stepUnit}`, exact: true});
    assert.deepEqual(await states.locator('[title]').evaluateAll(nodes => nodes.map(node => node.title)),
      item.context[4].hiddenState.map((value, unit) => `h[${unit}]: ${number(value, 4)}`));
    const previousStates = workspace(item).getByRole('img', {name: `Trạng thái trước: 4 ${item.stepUnit} đã đọc`, exact: true});
    assert.deepEqual(await previousStates.locator('[title]').evaluateAll(nodes => nodes.map(node => node.title)),
      item.context[3].hiddenState.map((value, unit) => `h trước[${unit}]: ${number(value, 4)}`));
    await expect(focusPanel(item, 'Đọc chuỗi')).toBeVisible();
    await expect(workspace(item)).toContainText('trọng số đã học giữ nguyên.');
    await expect(workspace(item).locator('.stage-rnn-calculation')).toHaveCount(0);
    await page.getByRole('button', {name: 'Xem phép tính', exact: true}).click();
    const calculationDialog = page.getByRole('dialog');
    const calculation = calculationDialog.locator('.stage-rnn-calculation');
    await expect(calculation).toContainText('Ví dụ: tính ô 1 / 32');
    await expect(calculation).toContainText(`${item.inputSize} tích từ dữ liệu mới`);
    await expect(calculation.locator('.stage-rnn-result')).toContainText(number(item.context[4].calculation.stateValue, 4));
    await expect(workspace(item).locator('.stage-prediction-readout')).toHaveCount(0);
    await expect(calculationDialog.locator('.stage-prediction-readout')).toHaveCount(0);
    await calculationDialog.getByRole('button', {name: 'Đóng và về demo'}).click();
    await expect(progress()).toHaveValue('5');
    await expect(workspace(item).locator('.stage-transfer-packet')).toHaveCount(0);
    await expect(workspace(item).locator('.stage-mechanism')).toHaveAttribute('data-handover', 'state');
    await fitsProjector();
    pass(`${item.title}: playback and pause work; all 32 current and previous state values match consecutive checkpoint steps`);

    if (item.id === 'retailrocket') {
      await page.getByRole('button', {name: 'Tiếp tục', exact: true}).click();
      await page.getByRole('button', {name: 'Dữ liệu & phép tính', exact: true}).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleName(`${item.title} · dữ liệu & phép tính`);
      const modalFrame = Number(await progress().inputValue());
      const hiddenText = `[${item.context[modalFrame - 1].hiddenState.map(value => number(value, 4)).join('; ')}]`;
      await expect(dialog.getByText(hiddenText, {exact: true})).toBeVisible();
      await page.waitForTimeout(800);
      await expect(progress()).toHaveValue(String(modalFrame));
      await dialog.getByRole('button', {name: 'Đóng và về demo'}).click();
      await expect(page.getByRole('button', {name: 'Tiếp tục', exact: true})).toBeVisible();
      await expect(progress()).toHaveValue(String(modalFrame));

      await page.getByRole('button', {name: 'Tiếp tục', exact: true}).click();
      await page.getByRole('button', {name: 'Giải thích nhanh', exact: true}).click();
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleName('Giải thích nhanh');
      const quickFrame = await progress().inputValue();
      const topics = dialog.getByRole('tablist', {name: 'Chủ đề giải thích nhanh'});
      await expect(topics.getByRole('tab')).toHaveCount(4);
      await expect(topics.getByRole('tab', {name: 'Trạng thái', exact: true})).toHaveAttribute('aria-selected', 'true');
      await expect(dialog.getByRole('tabpanel')).toHaveCount(1);
      await fitsQuickAnswer();
      await topics.getByRole('tab', {name: 'Trạng thái', exact: true}).press('ArrowRight');
      await expect(topics.getByRole('tab', {name: 'Trọng số', exact: true})).toBeFocused();
      await expect(topics.getByRole('tab', {name: 'Trọng số', exact: true})).toHaveAttribute('aria-selected', 'true');
      await expect(dialog.getByRole('tabpanel')).toContainText('Giữ nguyên trọng số');
      await fitsQuickAnswer();
      await topics.getByRole('tab', {name: 'Đầu vào', exact: true}).click();
      await expect(dialog.getByRole('tabpanel')).toContainText('24 × 7');
      await expect(dialog.getByRole('tabpanel')).toContainText('Biểu đồ chỉ vẽ số sự kiện giao dịch.');
      await fitsQuickAnswer();
      await topics.getByRole('tab', {name: 'Huấn luyện', exact: true}).click();
      await expect(dialog.getByRole('tabpanel')).toContainText('độc lập với hai mô hình thật');
      await dialog.getByRole('button', {name: 'Xem một lần học', exact: true}).click();
      // With reduced motion, the separate scalar example goes directly to its
      // completed update. These fixtures protect the actual SGD arithmetic.
      await expect(dialog.getByRole('tabpanel')).toContainText('0,492691');
      await expect(dialog.getByRole('tabpanel')).toContainText('0,351');
      await expect(dialog.getByRole('tabpanel')).toContainText('0,001323');
      await expect(dialog.getByRole('button', {name: 'Phát lại lần học', exact: true})).toBeVisible();
      await fitsQuickAnswer();
      await page.waitForTimeout(800);
      await expect(progress()).toHaveValue(quickFrame);
      await dialog.getByRole('button', {name: 'Đọc giải thích đầy đủ', exact: true}).click();
      await expect(dialog).toHaveAccessibleName('Giải thích RNN');
      await expect(dialog.getByRole('heading', {name: 'Giải thích RNN', exact: true})).toBeVisible();
      await dialog.getByRole('button', {name: 'Đóng và về demo'}).click();
      await expect(page.getByRole('button', {name: 'Tiếp tục', exact: true})).toBeVisible();
      await page.waitForTimeout(800);
      await expect(progress()).toHaveValue(quickFrame);
      pass('Named dialogs pause and retain the exact step; all four quick answers, keyboard tabs, scalar SGD and full-reference link work');
    }

    await scrubTo(item.lookback + 1);
    await expect(focusPanel(item, 'Dự đoán')).toContainText('Đọc đủ chuỗi → dự đoán');
    await expect(focusPanel(item, 'Dự đoán').locator('.stage-forecast-hero')).toContainText(number(item.target.prediction, 2));
    await page.getByRole('button', {name: 'Xem cách đổi đơn vị', exact: true}).click();
    const predictionReadout = page.getByRole('dialog').locator('.stage-prediction-readout');
    await expect(predictionReadout).toBeVisible();
    await expect(predictionReadout.locator('.stage-linear-result')).toContainText(number(item.target.predictedStandardized, 4));
    await expect(predictionReadout.locator('.stage-converted-result')).toContainText(amount(item, item.target.prediction));
    await page.getByRole('dialog').getByRole('button', {name: 'Đóng và về demo'}).click();
    await expect(chart(item)).toHaveAccessibleName(/RNN dự đoán/);
    await expect(chart(item)).not.toHaveAccessibleName(/Thực tế/);
    await expect(page.getByRole('status')).toHaveText(`RNN dự đoán ${amount(item, item.target.prediction)}.`);
    await fitsProjector();

    await progress().press('ArrowRight');
    await expect(progress()).toHaveValue(String(item.lookback + 2));
    await expect(focusPanel(item, 'Thực tế').locator('.stage-baseline strong')).toHaveText(number(item.target.baseline, 2));
    await expect(focusPanel(item, 'Thực tế')).toContainText(amount(item, item.target.absoluteError));
    await expect(focusPanel(item, 'Thực tế')).toContainText(amount(item, item.target.baselineAbsoluteError));
    await expect(focusPanel(item, 'Thực tế')).not.toContainText('MAE');
    await expect(page.getByRole('status')).toHaveText(`Thực tế ${amount(item, item.target.value)}. Sai số RNN ${amount(item, item.target.absoluteError)}; giữ nguyên ${amount(item, item.target.baselineAbsoluteError)}.`);
    await fitsProjector();
    await screenshot(`${item.id}-example`);

    await progress().press('End');
    await expect(progress()).toHaveValue(String(item.lookback + 3));
    await expect(chart(item)).toHaveAccessibleName(`${item.title}: ${item.lookback}/${item.lookback} ${item.stepUnit} đã đọc. RNN dự đoán ${amount(item, item.target.prediction)}. Thực tế ${amount(item, item.target.value)}.`);
    await expect(focusPanel(item, 'Toàn tập')).toContainText(metricAmount(item, item.metrics.rnnMae));
    await expect(focusPanel(item, 'Toàn tập')).toContainText(metricAmount(item, item.metrics.baselineMae));
    await expect(focusPanel(item, 'Toàn tập')).toContainText('Biểu đồ bên cạnh chỉ là một ví dụ.');
    await expect(focusPanel(item, 'Toàn tập')).not.toContainText('Sai số RNN');
    await expect(page.getByRole('status')).toContainText(`MAE RNN ${number(item.metrics.rnnMae, 4)} ${item.unit}`);
    await expect(page.getByRole('button', {name: 'Chạy lại tập này', exact: true})).toBeVisible();
    await fitsProjector();
    await screenshot(`${item.id}-result`);

    await scrubTo(1);
    await expect(chart(item)).not.toHaveAccessibleName(/RNN dự đoán|Thực tế/);
    await expect(workspace(item).locator('.stage-prediction-readout')).toHaveCount(0);
    await expect(workspace(item).getByText(`Chờ đủ ${item.lookback} ${item.stepUnit}`, {exact: true})).toBeVisible();
    await expect(focusPanel(item, 'Đọc chuỗi')).toContainText(`Đọc ${item.stepUnit} 1 / ${item.lookback}`);
    const initialStates = workspace(item).getByRole('img', {name: `Trạng thái trước: 0 ${item.stepUnit} đã đọc`, exact: true});
    assert.deepEqual(await initialStates.locator('[title]').evaluateAll(nodes => nodes.map(node => node.title)),
      Array.from({length: 32}, (_, unit) => `h trước[${unit}]: 0`));
    pass(`${item.title}: phase panel separates prediction, example error and full-test MAE; status announces values; rewinding restores initial state and hides future outputs`);
  }

  // One action must carry the audience through both datasets and finish at
  // the summary. Do not scrub, click tabs, or scroll during this entire block.
  await page.getByRole('button', {name: 'Chạy lại cả 2 từ đầu', exact: true}).click();
  for (const [index, item] of data.entries()) {
    await expect(datasetButton(fixtures[index].name)).toHaveAttribute('aria-pressed', 'true', {timeout: 30000});
    await expect(chart(item)).toHaveAccessibleName(/RNN dự đoán.*Thực tế/, {timeout: 30000});
    await expect(focusPanel(item, 'Toàn tập')).toContainText(metricAmount(item, item.metrics.rnnMae), {timeout: 30000});
    await fitsProjector();
  }
  await expect(page.getByRole('heading', {name: 'Cùng là RNN, hiệu quả khác nhau.', exact: true})).toBeVisible({timeout: 30000});
  await expect(page.getByRole('button', {name: 'Chạy lại cả 2', exact: true})).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(2);
  const amazonSummary = page.getByRole('article').filter({has: page.getByRole('heading', {name: 'Amazon', exact: true})});
  await expect(amazonSummary).toContainText('2,2687');
  await expect(amazonSummary).toContainText('2,2623');
  await expect(amazonSummary).toContainText('RNN chưa tốt hơn');
  await fitsProjector();
  await screenshot('desktop-summary');
  pass('One uninterrupted action runs Retailrocket → Amazon → summary with automatic forecasts, truth and evaluation');

  // Mobile may stack vertically; it must not clip or require sideways scrolling.
  for (const [width, height] of [[768, 1024], [390, 844], [320, 740]]) {
    await page.setViewportSize({width, height});
    await noHorizontalOverflow();
    for (const [index, item] of data.entries()) {
      await datasetButton(fixtures[index].name).click();
      await expect(workspace(item)).toBeVisible();
      await noHorizontalOverflow();
    }
    await page.getByRole('button', {name: 'Dữ liệu & phép tính', exact: true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await noHorizontalOverflow();
    await page.getByRole('button', {name: 'Đóng và về demo'}).click();
    await page.getByRole('button', {name: 'Giải thích nhanh', exact: true}).click();
    const quickDialog = page.getByRole('dialog', {name: 'Giải thích nhanh', exact: true});
    await expect(quickDialog).toBeVisible();
    for (const topic of ['Trạng thái', 'Trọng số', 'Huấn luyện', 'Đầu vào']) {
      await quickDialog.getByRole('tab', {name: topic, exact: true}).click();
      await noHorizontalOverflow();
      await expect.poll(() => quickDialog.locator('.stage-dialog-body').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    await quickDialog.getByRole('button', {name: 'Đóng và về demo'}).click();
    if (width === 390) await screenshot('mobile-demo');
    pass(`${width}px layout: all dataset views, details and four quick answers remain free of horizontal overflow`);
  }

  assert.deepEqual(errors, []);
  pass('No uncaught browser or console errors');
  await writeFile(new URL('verification.json', output), JSON.stringify({url, checks, errors, time: new Date().toISOString()}, null, 2));
} finally {
  await browser.close();
}
