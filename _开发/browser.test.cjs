const { chromium } = require('playwright');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const C = require('./core.js');
const out = path.dirname(__dirname),
  results = [];
(async () => {
  const browser = await chromium.launch(require('./browser-config.cjs'));
  const context = await browser.newContext({
    viewport: { width: 1536, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(out, '键盘布局编辑器.html')).href);
  await page.waitForSelector('#canvas g[data-id="K10"]');
  const get = () => page.evaluate(() => KeyboardLayoutEditor.getDesign()),
    analysis = () => page.evaluate(() => KeyboardLayoutEditor.getAnalysis());
  const reset = async () => {
    await page.locator('#restore').click();
  };
  const select = async (id) => {
    await page.locator(`#canvas g[data-id="${id}"]`).click();
  };
  const change = async (id, value) => {
    await page.locator('#' + id).fill(String(value));
    await page.locator('#' + id).press('Tab');
  };
  const point = async (x, y) =>
    page.evaluate(
      ([x, y]) => {
        const svg = document.getElementById('canvas'),
          p = svg.createSVGPoint();
        p.x = x;
        p.y = y;
        const q = p.matrixTransform(svg.getScreenCTM());
        return { x: q.x, y: q.y };
      },
      [x, y],
    );
  const check = async (name, fn) => {
    await fn();
    results.push({ name, passed: true });
    console.log('PASS', name);
  };
  await check('file://离线直接打开，无外部资源请求与运行异常', async () => {
    assert.equal((await get()).components.length, 16);
    assert.equal((await analysis()).summary.collisions, 0);
    assert.equal(await page.locator('script[src],link[rel=stylesheet],img[src]').count(), 0);
  });
  await page.screenshot({ path: path.join(__dirname, '界面-原始布局.png'), fullPage: true });
  await check('实际鼠标拖动，碰撞检测，撤销恢复电气关系', async () => {
    const orig = (await get()).components.find((c) => c.id === 'K10');
    const p = await point(orig.geometry.x, orig.geometry.y),
      q = await point(orig.geometry.x + 8, orig.geometry.y);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(q.x, q.y, { steps: 8 });
    await page.mouse.up();
    const d = await get(),
      c = d.components.find((c) => c.id === 'K10');
    assert.ok(c.geometry.x > orig.geometry.x + 5);
    assert.deepEqual(c.electrical, orig.electrical);
    assert.ok((await analysis()).collisions.length > 0);
    await page.locator('#undo').click();
    assert.equal((await get()).components.find((c) => c.id === 'K10').geometry.x, orig.geometry.x);
    await page.locator('#redo').click();
    assert.ok((await get()).components.find((c) => c.id === 'K10').geometry.x > orig.geometry.x);
    await reset();
  });
  await check('旋转按钮、尺寸输入、拖动旋转手柄和缩放手柄', async () => {
    await select('K10');
    await page.locator('#rotRight').click();
    assert.equal((await get()).components.find((c) => c.id === 'K10').geometry.rotation, 15);
    await change('propW', 25);
    assert.equal((await get()).components.find((c) => c.id === 'K10').geometry.width, 25);
    const handle = await page.locator('[data-handle=rotate]').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    const target = await point(35, 37);
    await page.mouse.move(target.x, target.y, { steps: 7 });
    await page.mouse.up();
    assert.ok((await get()).components.find((c) => c.id === 'K10').geometry.rotation > 50);
    const resize = await page.locator('[data-handle=resize][data-direction=se]').boundingBox();
    const old = (await get()).components.find((c) => c.id === 'K10').geometry.width;
    await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
    await page.mouse.down();
    await page.mouse.move(resize.x + resize.width / 2 + 35, resize.y + resize.height / 2 + 30, {
      steps: 6,
    });
    await page.mouse.up();
    assert.notEqual((await get()).components.find((c) => c.id === 'K10').geometry.width, old);
    await reset();
  });
  await check('新增按键、分配空交点、复制清空映射、删除与撤销', async () => {
    await page.locator('[data-add=key]').click();
    let d = await get(),
      c = d.components.at(-1);
    assert.equal(c.electrical.input.row, null);
    await page.locator('#in_matrix').selectOption('3,0');
    assert.equal((await analysis()).summary.gpioUsed, 16);
    await page.locator('#duplicate').click();
    d = await get();
    assert.equal(d.components.at(-1).electrical.input.row, null);
    assert.equal(d.components.length, 18);
    await page.locator('#delete').click();
    assert.equal((await get()).components.length, 17);
    await page.locator('#undo').click();
    assert.equal((await get()).components.length, 18);
    await reset();
  });
  await check('新增旋钮、转盘和OLED并记录未知规格', async () => {
    for (const type of ['encoder', 'jog', 'oled']) await page.locator(`[data-add=${type}]`).click();
    assert.equal((await get()).components.length, 19);
    assert.ok((await analysis()).issues.some((i) => i.code === 'GPIO_UNASSIGNED'));
    await change('oledSda', 'D1');
    await change('oledScl', 'D0');
    await change('oledController', 'SSD1306');
    await change('oledAddress', 60);
    await change('oledV', 3.3);
    const c = (await get()).components.at(-1);
    assert.equal(c.electrical.display.address, 60);
    assert.equal(c.spec.partNumber, null);
    await reset();
  });
  await check('更改外壳轮廓、非法外形回滚', async () => {
    await page.locator('#boardW').fill('120');
    await page.locator('#applyBoard').click();
    assert.equal((await get()).board.width, 120);
    assert.equal((await analysis()).tasks.find((t) => t.domain === 'pcb').status, 'verify');
    await page.locator('#boardW').fill('-2');
    await page.locator('#applyBoard').click();
    assert.equal((await get()).board.width, 120);
    await reset();
  });
  await check('实际文件导入示例，物理改版不误判电路', async () => {
    await page.locator('#file').setInputFiles(path.join(out, '修改示例.layout.json'));
    await page.waitForFunction(() => KeyboardLayoutEditor.getDesign().board.width === 99.5);
    const r = await analysis();
    for (const id of ['matrix', 'gpio', 'schematic'])
      assert.equal(r.tasks.find((t) => t.domain === id).status, 'unchanged');
    await page.locator('[data-tab=analysis]').click();
    await page.locator('[data-filter=must]').click();
    assert.ok((await page.locator('.task').count()) >= 3);
    await page.locator('[data-filter=all]').click();
    await page.locator('#compare').selectOption('overlay');
    await page.screenshot({ path: path.join(__dirname, '界面-改版分析.png'), fullPage: true });
    await page.locator('#compare').selectOption('baseline');
    assert.equal(await page.locator('#canvas [data-id]').count(), 0);
    await page.locator('#compare').selectOption('current');
  });
  await check('错误基准文件导入被拒绝，当前布局不变', async () => {
    const before = await get(),
      p = C.exportPackage(C.baseline());
    p.referenceBaseline.name = 'tampered';
    await page.locator('#file').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(p)),
    });
    await page.waitForFunction(() =>
      document.getElementById('toast').textContent.includes('基准被改写'),
    );
    assert.deepEqual(await get(), before);
  });
  await check('全局GPIO冲突检查和撤销', async () => {
    await page.locator('#settings').click();
    await page.locator('#setRowPins').fill('F1,F5,F6,F7');
    await page.locator('#applySettings').click();
    assert.ok((await analysis()).issues.some((i) => i.code === 'GPIO_CONFLICT'));
    await page.locator('#undo').click();
    assert.ok(!(await analysis()).issues.some((i) => i.code === 'GPIO_CONFLICT'));
  });
  await check('导出JSON与重新加载，无信息损失', async () => {
    const before = await get(),
      downloadEvent = page.waitForEvent('download');
    await page.locator('#export').click();
    const download = await downloadEvent;
    const dest = path.join(__dirname, '浏览器导出验证.layout.json');
    await download.saveAs(dest);
    const pkg = JSON.parse(fs.readFileSync(dest, 'utf8'));
    assert.deepEqual(C.validatePackage(pkg), []);
    assert.deepEqual(pkg.design, before);
    await reset();
    await page.locator('#file').setInputFiles(dest);
    await page.waitForFunction(() => KeyboardLayoutEditor.getDesign().board.width === 99.5);
    assert.deepEqual(await get(), before);
  });
  await check('不可信文字按文本显示，没有HTML注入', async () => {
    await page.locator('[data-tab=properties]').click();
    await select('K10');
    await change('propLabel', '<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('#panel img').count(), 0);
    await reset();
  });
  await check('补录规格后面板保持展开，可继续填写且不强制重画PCB', async () => {
    await select('K10');
    const details = page
      .locator('#panel details')
      .filter({ has: page.locator('summary', { hasText: '实际器件规格' }) });
    await details.locator('summary').click();
    await change('specManufacturer', '待确认厂家');
    assert.ok(await page.locator('#specPart').isVisible());
    await change('specPart', '待确认型号');
    assert.ok(await page.locator('#specFootprint').isVisible());
    await page.evaluate(() => {
      const input = document.getElementById('specManufacturer');
      const details = input.closest('details');
      // 同一事件循环内展开并编辑，不能依赖延后派发的 toggle 事件。
      details.open = false;
      details.open = true;
      input.value = '立即填写的厂家';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.ok(await page.locator('#specPart').isVisible());
    assert.equal((await analysis()).tasks.find((t) => t.domain === 'pcb').status, 'verify');
    await reset();
  });
  await check('快捷键导出、旋转、删除与撤销', async () => {
    await select('K10');
    await page.keyboard.press('r');
    assert.equal((await get()).components.find((c) => c.id === 'K10').geometry.rotation, 15);
    await page.keyboard.press('Delete');
    assert.equal((await get()).components.length, 15);
    await page.keyboard.press('Control+z');
    assert.equal((await get()).components.length, 16);
    const dl = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    assert.ok((await dl).suggestedFilename().endsWith('.layout.json'));
    await reset();
  });
  await check('窄屏页面无横向溢出，可继续查看画布和面板', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    );
    await page.screenshot({ path: path.join(__dirname, '界面-窄屏.png'), fullPage: true });
  });
  assert.deepEqual(errors, []);
  results.push({ name: '页面无JavaScript异常', passed: true });
  fs.writeFileSync(
    path.join(__dirname, '浏览器验证结果.json'),
    JSON.stringify(
      { passed: true, checks: results, browser: `Chromium ${browser.version()}; file URL`, errors },
      null,
      2,
    ),
  );
  await browser.close();
  console.log('ALL', results.length, 'PASS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
