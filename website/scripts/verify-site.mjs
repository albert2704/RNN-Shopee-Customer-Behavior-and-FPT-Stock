import {chromium, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const url = process.env.SITE_URL || 'http://127.0.0.1:5173';
const output = new URL('../qa/', import.meta.url);
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
const context = await browser.newContext({viewport:{width:1440,height:1000}, timezoneId:'Asia/Ho_Chi_Minh', reducedMotion:'reduce'});
const page = await context.newPage();
const errors = [];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const checks=[];
const check=(s)=>{checks.push(s);console.log('PASS',s);};
async function noOverflow(label){await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),{message:label}).toBe(true);check(label);}
try {
  await page.goto(url+'/#explore-datasets');
  await expect(page.locator('#dataset-panel')).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  const archive=await context.request.get(`${url}/downloads/a6-rnn-source.zip`);
  assert.equal(archive.status(),200);
  assert.equal((await archive.body()).subarray(0,2).toString(),'PK');
  check('Python source archive downloads as a valid ZIP');
  await page.screenshot({path:fileURLToPath(new URL('desktop-top.png',output))});
  await page.screenshot({path:fileURLToPath(new URL('desktop-full.png',output)),fullPage:true});
  await noOverflow('Desktop has no page overflow');
  for(const [id,name] of [['retailrocket','Retailrocket'],['amazon','Amazon']]){
    await page.getByRole('tab',{name:new RegExp(name)}).click();
    const d=await (await context.request.get(`${url}/data/${id}.json`)).json();
    await expect(page.locator('#dataset-panel h3')).toBeVisible();
    await page.getByRole('button',{name:'Dự báo',exact:true}).click();
    for(const m of d.metrics) assert(Number.isFinite(m.mae)&&Number.isFinite(m.rmse));
    await expect(page.locator('.model-toggles button')).toHaveCount(1+d.metrics.length);
    await page.getByLabel('Khoảng thời gian dự báo').selectOption('recent');
    await expect(page.locator('.chart-footnote')).toContainText(`80 /`);
    await page.getByRole('button',{name:'Xem 8 dòng dữ liệu'}).click();
    await expect(page.locator('.data-table tbody tr')).toHaveCount(8);
    await page.getByRole('button',{name:'Ẩn 8 dòng dữ liệu'}).click();
    const scrubber=page.getByRole('slider',{name:'Di chuyển dọc thời gian trên biểu đồ'});
    await scrubber.fill('0');
    await expect(scrubber).toHaveValue('0');
    check(`${name}: data, forecast range, readout and table work`);
  }
  await page.locator('#datasets').screenshot({path:fileURLToPath(new URL('desktop-amazon.png',output))});
  await page.getByRole('button',{name:'RMSE',exact:true}).click();
  await expect(page.locator('.metric-subtitle')).toContainText('Căn bậc hai');
  await page.getByLabel('Chọn dữ liệu so sánh').selectOption('amazon');
  await expect(page.locator('.result-interpretation')).toContainText('Amazon: chưa có cải thiện rõ ràng');
  check('Dataset selection and MAE/RMSE comparisons work');
  const lab=page.locator('.rnn-lab');
  await lab.getByRole('button',{name:'Đặt lại',exact:true}).click();
  await expect(lab.getByRole('button',{name:'Quay lại',exact:true})).toBeDisabled();
  for(let i=1;i<6;i++){
    await lab.getByRole('button',{name:'Tiếp theo',exact:true}).click();
    await expect(lab.locator('.rnn-step-current')).toHaveCount(1);
  }
  await lab.getByRole('button',{name:'Cập nhật một lần'}).click();
  await expect(lab.locator('.rnn-update-feedback')).toContainText('0.014445 → 0.001323');
  check('All six lesson steps and numerical SGD update work');
  await lab.screenshot({path:fileURLToPath(new URL('desktop-lab.png',output))});
  await lab.getByRole('button',{name:'Đặt lại',exact:true}).click();
  await lab.locator('.rnn-step-button').nth(2).click();
  await lab.getByRole('button',{name:'Chạy mô phỏng'}).click();
  await expect(lab.getByRole('button',{name:'t = 3',exact:true})).toHaveAttribute('aria-pressed','true',{timeout:6000});
  await expect(lab.getByRole('button',{name:'Chạy mô phỏng'})).toBeVisible({timeout:3000});
  check('Sequence playback completes');
  await lab.locator('summary').filter({hasText:'Đổi đầu vào và tham số'}).click();
  await lab.getByRole('slider',{name:'Đầu vào x₁'}).fill('0.7');
  await lab.locator('summary').filter({hasText:'Công thức và mã PyTorch'}).click();
  await lab.getByRole('button',{name:'PyTorch',exact:true}).click();
  await expect(lab.locator('pre')).toContainText('0.7');
  check('Changing input updates the generated PyTorch example');
  await lab.getByRole('button',{name:'Đặt lại',exact:true}).click();
  await lab.locator('details[open] summary').evaluateAll(nodes=>nodes.forEach(n=>n.click()));
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>scrollTo(0,0));
  await noOverflow('Mobile 390px has no page overflow');
  await page.screenshot({path:fileURLToPath(new URL('mobile-top.png',output))});
  await page.getByRole('button',{name:'Mở menu'}).click();
  await page.locator('.site-header nav').getByRole('link',{name:'Cách RNN hoạt động'}).click();
  await expect(page.getByRole('button',{name:'Mở menu'})).toHaveAttribute('aria-expanded','false');
  await lab.screenshot({path:fileURLToPath(new URL('mobile-lab.png',output))});
  await lab.locator('.rnn-step-button').nth(5).click();
  await lab.screenshot({path:fileURLToPath(new URL('mobile-update.png',output))});
  await page.locator('#datasets').screenshot({path:fileURLToPath(new URL('mobile-dataset.png',output))});
  await noOverflow('Mobile lesson and data remain within page');
  for(const width of [320,768]){await page.setViewportSize({width,height:900});await noOverflow(`${width}px has no page overflow`);}
  assert.deepEqual(errors,[]);
  check('No browser JavaScript or console errors');
  await writeFile(new URL('verification.json',output),JSON.stringify({url,checks,errors,timestamp:new Date().toISOString()},null,2));
} finally {await browser.close();}
