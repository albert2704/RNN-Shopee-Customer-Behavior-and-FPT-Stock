import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Requires an already running built site and permission to use a browser.
// This file must not be run to circumvent a browser or localhost safety block.
// Replay uses real timers; all backend APIs are mocked, so no chat request can
// reach a real service. Teaching JSON remains served by the site.
const baseURL = (process.env.SITE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = new URL('../qa/editorial/', import.meta.url);
const fixture = async (name) =>
  JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
// The saved daily snapshot is retained solely as the mocked chatbot's source.
const [demo, chatData, shopee, fpt] = await Promise.all(
  ['demo', 'fpt-daily', 'shopee', 'fpt'].map(fixture),
);
const datasets = demo.datasets;
const format = (value, digits = 2) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
const checks = [];
const pageErrors = [];
const apiRequests = [];
const chatRequests = [];
const pass = (message) => {
  checks.push(message);
  console.log('PASS', message);
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  reducedMotion: 'reduce',
  timezoneId: 'Asia/Ho_Chi_Minh',
});
const page = await context.newPage();
page.on('pageerror', (error) => pageErrors.push(error.message));
let statusAvailable = true;
await context.route('**/api/**', async (route) => {
  const request = route.request();
  const pathname = new URL(request.url()).pathname;
  apiRequests.push({ pathname, method: request.method() });
  let body = {};
  if (pathname === '/api/chat/status' && statusAvailable) {
    body = {
      ready: true,
      api_key_configured: true,
      graph_connected: true,
      data_available: true,
      model: 'mock-model',
      observed_through: chatData.forecast.observed_through,
      reference_close: chatData.forecast.last_close,
    };
  } else if (pathname === '/api/chat') {
    const payload = request.postDataJSON();
    chatRequests.push(payload);
    const longAnswer = chatRequests.length > 1;
    body = {
      paragraphs: Array.from({ length: longAnswer ? 18 : 2 }, (_, index) => ({
        text: `Câu trả lời kiểm thử ${chatRequests.length}.${index + 1}. Đây là nội dung mô phỏng để kiểm tra hội thoại và vị trí cuộn, không phải tư vấn đầu tư.`,
        citations: ['FPT-TEST'],
      })),
      followups: ['Cần đối chiếu nguồn nào?'],
      sources: [
        {
          citation_id: 'FPT-TEST',
          title: 'Nguồn kiểm thử FPT',
          text: 'Nội dung nguồn giả lập để kiểm tra nút trích dẫn.',
          source_url: chatData.source.source_url,
          source_pointer: 'fixture/forecast',
        },
      ],
      freshness: {
        observed_through: chatData.forecast.observed_through,
        calendar_days: 0,
        stale: false,
      },
      graph: {
        backend: 'mock',
        retrieval: 'fixture',
        bundle: 'test',
        documents: 1,
        paths: ['FPT → fixture'],
      },
      model: 'mock-model',
    };
  }
  // Invalid status responses exercise the unknown-connection state without
  // emitting expected HTTP errors into the browser console.
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});

const chapterNames = {
  shopee: 'Shopee Thailand',
  fpt: 'FPT',
  summary: 'Tổng kết',
  chat: 'Hỏi đáp',
  appendix: 'Phụ lục',
};
const hashes = {
  shopee: '#demo',
  fpt: '#fpt',
  summary: '#tong-ket',
  chat: '#hoi-dap',
  appendix: '#phu-luc',
};
const chapterButton = (id) =>
  id === 'appendix'
    ? page.locator('.chapter-tools').getByRole('button', { name: 'Phụ lục', exact: true })
    : page
        .getByRole('navigation', { name: 'Chương trình bày' })
        .getByRole('button', { name: new RegExp(`${chapterNames[id]}$`) });
const progress = () =>
  page.getByRole('slider', { name: 'Tiến trình demo', exact: true, includeHidden: true });
const player = () => page.locator('.stage-primary');
const workspace = (data) =>
  page.getByRole('region', { name: `Hoạt ảnh ${data.title}`, exact: true });
const chart = (data) => workspace(data).locator('.stage-chart svg');
const panel = (phase) => page.getByRole('complementary', { name: phase, exact: true });
const dialog = () => page.locator('.stage-dialog');
const screenshot = (name) =>
  page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });

async function selectChapter(id) {
  await chapterButton(id).click();
  await expect(page).toHaveURL(new RegExp(`${hashes[id]}$`));
  await expect(chapterButton(id)).toHaveAttribute('aria-current', 'page');
}
async function scrubTo(frame) {
  await progress().press('Home');
  for (let i = 0; i < frame; i++) await progress().press('ArrowRight');
  await expect(progress()).toHaveValue(String(frame));
}
async function noHorizontalOverflow() {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    .toBe(true);
}
async function fitsDesktop(contentSelector) {
  await noHorizontalOverflow();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const stage = document.querySelector('.editorial-stage');
          const box = stage.getBoundingClientRect();
          return (
            document.documentElement.scrollHeight <= innerHeight + 1 &&
            box.left >= -1 &&
            box.top >= -1 &&
            box.right <= innerWidth + 1 &&
            box.bottom <= innerHeight + 1 &&
            Math.abs(box.width / box.height - 16 / 9) < 0.001
          );
        }),
      { message: 'The 16:9 stage fits inside the viewport without page scrolling' },
    )
    .toBe(true);
  if (contentSelector) {
    await expect
      .poll(
        () =>
          page
            .locator(contentSelector)
            .evaluate(
              (element) =>
                element.scrollWidth <= element.clientWidth + 1 &&
                element.scrollHeight <= element.clientHeight + 1,
            ),
        {
          message: `${contentSelector} fits its desktop presentation area without internal clipping`,
        },
      )
      .toBe(true);
  }
}

try {
  assert.deepEqual(
    datasets.map((item) => item.id),
    ['shopee', 'fpt'],
  );
  for (const item of datasets) {
    assert.equal(item.context.length, item.lookback);
    assert.equal(item.verification.status, 'passed');
    assert.ok(item.context.every((point) => point.hiddenState.length === item.hiddenSize));
  }
  const redirects = [
    ['#talk/1', 'shopee'],
    ['#intro', 'shopee'],
    ['#top', 'shopee'],
    ['#fpt-daily', 'chat'],
    ['#du-bao', 'chat'],
    ['#chat', 'chat'],
    ['#explore-datasets', 'appendix'],
    ['#explore-results', 'appendix'],
  ];
  for (const [hash, id] of redirects) {
    await page.goto(`${baseURL}/${hash}`);
    await expect(page).toHaveURL(new RegExp(`${hashes[id]}$`));
    await expect(chapterButton(id)).toHaveAttribute('aria-current', 'page');
  }
  await page.goto(`${baseURL}/#demo`);
  await expect(workspace(datasets[0])).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByRole('navigation', { name: 'Chương trình bày' }).getByRole('button'),
  ).toHaveCount(4);
  await expect(page.getByRole('button', { name: /Dự báo hôm nay/ })).toHaveCount(0);
  await expect(page.locator('.daily-main')).toHaveCount(0);
  await fitsDesktop('.stage-main');
  await screenshot('desktop-ready');
  pass('The four chapters and appendix open correctly; former forecast hashes redirect to chat');

  await page
    .getByRole('group', { name: 'Tốc độ phát' })
    .getByRole('button', { name: '2×', exact: true })
    .click();
  for (const item of datasets) {
    await selectChapter(item.id);
    await expect(progress()).toHaveValue('0');
    await expect(progress()).toHaveAttribute('max', String(item.lookback + 1));
    await expect(player()).toHaveAccessibleName('Chạy tập này');
    await player().click();
    await expect.poll(async () => Number(await progress().inputValue())).toBeGreaterThan(0);
    await player().click();
    const paused = await progress().inputValue();
    await page.waitForTimeout(500);
    await expect(progress()).toHaveValue(paused);
    await expect(player()).toHaveAccessibleName('Tiếp tục');

    await scrubTo(5);
    assert.deepEqual(
      await workspace(item)
        .locator('.stage-state-grid > i')
        .evaluateAll((cells) => cells.map((cell) => cell.title)),
      item.context[4].hiddenState.map((value, index) => `h[${index}]: ${format(value, 4)}`),
    );
    await expect(workspace(item).locator('.stage-mechanism')).toHaveAttribute(
      'data-handover',
      'state',
    );
    await expect(chart(item)).not.toHaveAccessibleName(/RNN dự đoán|Thực tế/);

    await selectChapter(item.id);
    await player().click();
    await expect(player()).toHaveAccessibleName('Xem thực tế', { timeout: 30000 });
    await expect(progress()).toHaveValue(String(item.lookback + 1));
    await expect(panel('Dự đoán').locator('.stage-forecast-hero strong')).toHaveText(
      format(item.target.prediction),
    );
    await expect(chart(item)).toHaveAccessibleName(/RNN dự đoán/);
    await expect(chart(item)).not.toHaveAccessibleName(/Thực tế/);
    await page.waitForTimeout(800);
    await expect(player()).toHaveAccessibleName('Xem thực tế');
    await progress().press('End');
    await progress().press('ArrowRight');
    await expect(panel('Dự đoán')).toBeVisible();
    await expect(progress()).toHaveValue(String(item.lookback + 1));

    await player().click();
    await expect(panel('Thực tế').locator('.stage-actual strong')).toHaveText(
      format(item.target.value),
    );
    await expect(panel('Thực tế').locator('.stage-baseline strong')).toHaveText(
      format(item.target.baseline),
    );
    await expect(chart(item)).toHaveAccessibleName(/Thực tế/);
    await page.waitForTimeout(500);
    await expect(player()).toHaveAccessibleName('Xem toàn tập');
    // The scrubber remains capped at prediction while manual reveals advance.
    await expect(progress()).toHaveValue(String(item.lookback + 1));
    await player().click();
    await expect(panel('Toàn tập')).toContainText(format(item.metrics.rnnMae));
    await expect(panel('Toàn tập')).toContainText(format(item.metrics.baselineMae));
    await expect(player()).toHaveAccessibleName(item.id === 'shopee' ? 'Sang FPT' : 'Tổng kết');
    await fitsDesktop('.stage-main');
    await screenshot(`${item.id}-evaluation`);
    await player().click();
    await expect(page).toHaveURL(item.id === 'shopee' ? /#fpt$/ : /#tong-ket$/);
    if (item.id === 'shopee') {
      await expect(progress()).toHaveValue('0');
      await expect(player()).toHaveAccessibleName('Chạy tập này');
    }
    pass(
      `${item.title}: real timers stop at prediction; manual reveals, stored state, capped scrubber, and next chapter work`,
    );
  }

  await expect(
    page.getByRole('heading', { name: 'Cùng là RNN, hiệu quả khác nhau.', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.stage-summary article')).toHaveCount(2);
  await fitsDesktop('.stage-summary');
  await page
    .getByRole('heading', { name: 'Cùng là RNN, hiệu quả khác nhau.', exact: true })
    .click();
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/#fpt$/);
  await expect(panel('Toàn tập')).toBeVisible();
  await expect(player()).toHaveAccessibleName('Tổng kết');
  await selectChapter('summary');
  await page
    .locator('.chapter-footer')
    .getByRole('button', { name: '02 FPT', exact: true })
    .click();
  await expect(panel('Toàn tập')).toBeVisible();
  await expect(player()).toHaveAccessibleName('Tổng kết');
  await expect(chart(datasets[1])).toHaveAccessibleName(/RNN dự đoán.*Thực tế/);
  await scrubTo(1);
  await expect(panel('Đọc chuỗi')).toBeVisible();
  await expect(chart(datasets[1])).not.toHaveAccessibleName(/RNN dự đoán|Thực tế/);
  await selectChapter('fpt');
  await expect(progress()).toHaveValue('0');
  await expect(player()).toHaveAccessibleName('Chạy tập này');
  await page.getByRole('button', { name: 'Chạy lại tập này từ đầu', exact: true }).click();
  await expect(player()).toHaveAccessibleName('Tạm dừng');
  await expect(chapterButton('fpt')).toHaveAttribute('aria-current', 'page');
  await player().click();
  pass(
    'Summary back restores FPT evaluation; rewinding hides results; chapter selection resets and restart retains the dataset',
  );

  await selectChapter('shopee');
  await scrubTo(5);
  await page.getByRole('button', { name: 'Xem phép tính', exact: true }).click();
  await expect(dialog()).toBeVisible();
  await expect(dialog().locator('.stage-rnn-result')).toContainText(
    format(datasets[0].context[4].calculation.stateValue, 4),
  );
  await expect(dialog().locator('.stage-prediction-readout')).toHaveCount(0);
  await dialog().getByRole('button', { name: 'Đóng và về demo', exact: true }).click();
  await player().click();
  await page.getByRole('button', { name: 'Giải thích nhanh', exact: true }).click();
  await expect(dialog()).toHaveAccessibleName('Giải thích nhanh');
  const modalFrame = await progress().inputValue();
  await page.waitForTimeout(600);
  await expect(progress()).toHaveValue(modalFrame);
  await expect(dialog().getByRole('tab')).toHaveCount(4);
  await dialog().getByRole('tab', { name: 'Trạng thái', exact: true }).press('ArrowRight');
  await expect(dialog().getByRole('tab', { name: 'Trọng số', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog().getByRole('button', { name: 'Đọc giải thích đầy đủ', exact: true }).click();
  await expect(dialog()).toHaveAccessibleName('Giải thích RNN');
  await page.keyboard.press('Escape');
  await expect(dialog()).not.toBeVisible();
  await expect(progress()).toHaveValue(modalFrame);
  await expect(player()).toHaveAccessibleName('Tiếp tục');
  await scrubTo(datasets[0].lookback + 1);
  await page.getByRole('button', { name: 'Xem cách đổi đơn vị', exact: true }).click();
  await expect(dialog().locator('.stage-converted-result')).toContainText(
    format(datasets[0].target.prediction),
  );
  await page.keyboard.press('Escape');
  pass(
    'Calculation, quick-answer keyboard tabs, full reference, Escape, and prediction conversion preserve paused replay state',
  );

  await selectChapter('summary');
  await page
    .getByRole('heading', { name: 'Cùng là RNN, hiệu quả khác nhau.', exact: true })
    .click();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#hoi-dap$/);
  await expect(chapterButton('chat')).toHaveAccessibleName('04 Hỏi đáp');
  await expect(page.locator('.stock-chat-eyebrow')).toContainText('04 —');
  await expect(page.locator('.daily-main, .outlook-compact')).toHaveCount(0);
  await expect(page.locator('a[href="#du-bao"], a[href="#fpt-daily"]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Cập nhật & dự báo|Xem giá & dự báo FPT/ }),
  ).toHaveCount(0);
  await selectChapter('summary');
  await expect(
    page.locator('.chapter-footer').getByRole('button', { name: '04 Hỏi đáp', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('heading', { name: 'Cùng là RNN, hiệu quả khác nhau.', exact: true })
    .click();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/#hoi-dap$/);
  pass('Summary proceeds directly to chapter 04 chat; forecast screens and links are absent');

  await expect(page.locator('.stock-chat-reference')).toContainText(
    format(chatData.forecast.last_close),
  );
  const connection = page.locator('.stock-chat-connection');
  await expect(connection.locator('summary')).toContainText('Đã kết nối');
  await expect(page.locator('.stock-chat-prompts li')).toHaveCount(4);
  const field = page.getByRole('textbox', { name: 'Câu hỏi về đầu tư và dữ liệu FPT' });
  await field.fill('Câu hỏi kiểm thử một');
  await field.press('ArrowLeft');
  await expect(page).toHaveURL(/#hoi-dap$/);
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.locator('.stock-chat-turn.assistant')).toHaveCount(1);
  await page.getByRole('button', { name: 'Xem nguồn FPT-TEST', exact: true }).first().click();
  await expect(page.locator('.stock-chat-source.selected pre')).toHaveText(
    'Nội dung nguồn giả lập để kiểm tra nút trích dẫn.',
  );
  await field.fill('Câu hỏi kiểm thử hai');
  await field.press('Enter');
  await expect(page.locator('.stock-chat-turn.assistant')).toHaveCount(2);
  await expect
    .poll(() =>
      page.locator('.stock-chat-scroll').evaluate((scroll) => {
        const answer = scroll.querySelector('.stock-chat-turn.assistant:last-of-type');
        const latest = [...scroll.querySelectorAll('.stock-chat-turn.assistant')].at(-1) || answer;
        const outer = scroll.getBoundingClientRect();
        const inner = latest.getBoundingClientRect();
        return scroll.scrollTop > 0 && inner.top >= outer.top - 2 && inner.top < outer.bottom;
      }),
    )
    .toBe(true);
  assert.equal(chatRequests.length, 2);
  assert.deepEqual(
    chatRequests[1].messages.map(({ role }) => role),
    ['user', 'assistant', 'user'],
  );
  await selectChapter('summary');
  await selectChapter('chat');
  await expect(page.locator('.stock-chat-turn')).toHaveCount(4);
  await expect(page.locator('.stock-chat-turn.assistant').last()).toContainText(
    'Câu trả lời kiểm thử 2.1.',
  );
  await connection.locator('summary').click();
  statusAvailable = false;
  await connection.getByRole('button', { name: 'Kiểm tra kết nối', exact: true }).click();
  await expect(connection).toContainText('API key: chưa xác nhận');
  await expect(connection).toContainText('Neo4j: chưa xác nhận');
  statusAvailable = true;
  await connection.getByRole('button', { name: 'Kiểm tra kết nối', exact: true }).click();
  await expect(connection.locator('summary')).toContainText('Đã kết nối');
  await page.getByRole('button', { name: 'Cuộc trò chuyện mới', exact: true }).click();
  await expect(page.locator('.stock-chat-turn')).toHaveCount(0);
  pass(
    'Mocked chat preserves history and citations across chapters, scrolls to the latest answer, and keeps unavailable connection state unknown',
  );

  await selectChapter('appendix');
  for (const data of [shopee, fpt]) {
    await page
      .getByRole('group', { name: 'Tập dữ liệu', exact: true })
      .getByRole('button', { name: new RegExp(`^${data.title}`) })
      .click();
    await expect(page.locator('.appendix-description')).toHaveText(data.description);
    await expect(page.locator('.appendix-facts')).toContainText(format(data.summary.rows, 0));
    await expect(page.locator('.appendix-metric')).toHaveCount(data.metrics.length);
    await expect(page.locator('.appendix-chart')).toHaveAccessibleName(
      new RegExp(`${data.overviewSeries.length} mốc`),
    );
    await expect(page.locator('.appendix-body')).toContainText(format(data.metrics[0].mae));
    await fitsDesktop('.appendix-main');
  }
  await page
    .getByRole('button', { name: 'Xem dữ liệu, công thức & mã nguồn', exact: true })
    .click();
  const deep = page.getByRole('dialog', { name: 'Phụ lục chi tiết', exact: true });
  await expect(deep).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(deep).not.toBeVisible();
  await expect(page).toHaveURL(/#phu-luc$/);
  pass('Appendix toggles the historical datasets and exposes a dismissible deep-dive dialog');

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await selectChapter('shopee');
    await fitsDesktop('.stage-main');
    await expect(player()).toBeInViewport({ ratio: 1 });
    await selectChapter('summary');
    await fitsDesktop('.stage-summary');
  }
  pass('The full stage scales uniformly at 1280×720 and 1920×1080');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['shopee', 'fpt', 'summary', 'chat', 'appendix']) {
    await selectChapter(id);
    if (id === 'appendix') await expect(page.locator('.appendix-chart')).toBeVisible();
    await noHorizontalOverflow();
    if (id === 'shopee' || id === 'fpt') {
      await scrubTo(5);
      await expect(progress()).toHaveValue('5');
    }
    await screenshot(`mobile-${id}`);
  }
  assert.ok(
    !apiRequests.some(({ pathname }) => pathname.startsWith('/api/fpt/')),
    'Presentation navigation does not request removed forecast-page APIs',
  );
  assert.deepEqual(pageErrors, [], 'No unhandled page errors');
  pass('All five mobile views avoid horizontal overflow and retain usable replay controls');
} catch (error) {
  await screenshot('failure').catch(() => {});
  throw error;
} finally {
  await writeFile(
    new URL('results.json', output),
    JSON.stringify(
      {
        url: baseURL,
        checks,
        pageErrors,
        apiRequests,
        chatRequests: chatRequests.length,
        completedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  await browser.close();
}
