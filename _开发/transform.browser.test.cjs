const { chromium } = require('playwright');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.dirname(__dirname),
  out = path.join(__dirname, '测试输出', '画布工具');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch(require('./browser-config.cjs'));
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      offline: true,
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, '键盘布局编辑器.html')).href);
    await page.waitForFunction(() => !!window.KeyboardDIY);
    const get = () => page.evaluate(() => KeyboardLayoutEditor.getDesign());
    const key = async () => (await get()).components.find((c) => c.id === 'K10');
    const tool = async (mode) => {
      await page.locator(`[data-tool=${mode}]`).click();
      assert.equal(await page.locator(`[data-tool=${mode}]`).getAttribute('aria-pressed'), 'true');
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
    const drag = async (locator, dx, dy, keys = []) => {
      const b = await locator.boundingBox();
      assert.ok(b);
      const scale = await page.evaluate(() => document.getElementById('canvas').getScreenCTM().a);
      for (const k of keys) await page.keyboard.down(k);
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 + dx * scale, b.y + b.height / 2 + dy * scale, {
        steps: 6,
      });
      await page.mouse.up();
      for (const k of keys) await page.keyboard.up(k);
    };
    const reset = async () => {
      await page.locator('#compare').selectOption('current');
      await page.locator('#editTarget').selectOption('component');
      await tool('move');
      await page.locator('#restore').click();
      await page.locator('#canvas g[data-id=K10]').click();
    };
    const near = (a, b) => assert.ok(Math.abs(a - b) < 0.05, `${a} != ${b}`);
    await reset();
    await tool('select');
    const original = await get();
    await drag(page.locator('#canvas g[data-id=K10]'), 8, 5);
    assert.deepEqual(await get(), original);
    assert.equal(await page.locator('[data-handle]').count(), 0);
    console.log('PASS 选择模式只选中，不拖动也不产生设计变化');
    await tool('resize');
    assert.equal(await page.locator('[data-handle=resize]').count(), 8);
    let before = await key();
    await drag(page.locator('[data-direction=e]'), 6, 0);
    let after = await key();
    near(after.geometry.width, before.geometry.width + 6);
    near(after.geometry.height, before.geometry.height);
    near(after.geometry.x - before.geometry.x, 3);
    assert.deepEqual(after.electrical, before.electrical);
    assert.deepEqual(after.keycodes, before.keycodes);
    await page.locator('#undo').click();
    assert.deepEqual((await key()).geometry, before.geometry);
    await page.locator('#redo').click();
    near((await key()).geometry.width, after.geometry.width);
    console.log('PASS 组件边拉伸固定对边、保留电气关系，每次拖动可一步撤销/重做');
    await reset();
    await tool('resize');
    before = await key();
    await drag(page.locator('[data-direction=se]'), 6, 3, ['Shift', 'Alt']);
    after = await key();
    near(
      after.geometry.width / after.geometry.height,
      before.geometry.width / before.geometry.height,
    );
    near(after.geometry.x, before.geometry.x);
    near(after.geometry.y, before.geometry.y);
    await page.locator('#canvas g[data-id=ENC0]').click();
    assert.equal(await page.locator('[data-handle=resize]').count(), 4);
    await drag(page.locator('[data-direction=e]'), 3, 0);
    let circle = (await get()).components.find((c) => c.id === 'ENC0');
    near(circle.geometry.width, circle.geometry.height);
    console.log('PASS Shift等比、Alt中心缩放和圆形等径拉伸');
    await reset();
    await tool('rotate');
    before = await key();
    const a = await point(before.geometry.x, before.geometry.y - before.geometry.height / 2 - 6),
      b = await point(before.geometry.x + before.geometry.height / 2 + 6, before.geometry.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 7 });
    await page.mouse.up();
    after = await key();
    near(after.geometry.rotation, 90);
    near(after.geometry.x, before.geometry.x);
    assert.deepEqual(after.electrical, before.electrical);
    console.log('PASS 旋转模式在画布直接旋转且不改变引脚');
    await reset();
    await tool('resize');
    const cancelBefore = await get();
    const box = await page.locator('[data-direction=se]').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 70, box.y + 45, { steps: 4 });
    assert.notEqual(
      (await key()).geometry.width,
      cancelBefore.components.find((c) => c.id === 'K10').geometry.width,
    );
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.deepEqual(await get(), cancelBefore);
    console.log('PASS Esc取消正在进行的拉伸，恢复完整设计');
    await page.locator('#editTarget').selectOption('board');
    assert.equal(await page.locator('[data-tool=resize]').getAttribute('aria-pressed'), 'true');
    const boardBefore = await get();
    const tutorialBefore = await page.evaluate(() => KeyboardDIY.getPreview());
    await drag(page.locator('[data-board-handle=e]'), 8, 0);
    let boardAfter = await get();
    near(boardAfter.board.width, Math.round(boardBefore.board.width + 8));
    assert.deepEqual(boardAfter.components, boardBefore.components);
    await drag(page.locator('[data-board-handle=s]'), 0, 6);
    boardAfter = await get();
    near(boardAfter.board.height, Math.round(boardBefore.board.height + 6));
    const beforeCorner = await get();
    await drag(page.locator('[data-board-handle=se]'), 4, 3);
    boardAfter = await get();
    near(boardAfter.board.width, beforeCorner.board.width + 4);
    near(boardAfter.board.height, beforeCorner.board.height + 3);
    await page.locator('#undo').click();
    assert.deepEqual((await get()).board, beforeCorner.board);
    await drag(page.locator('[data-board-handle=radius]'), 3, 0);
    boardAfter = await get();
    near(boardAfter.board.cornerRadius, boardBefore.board.cornerRadius + 3);
    assert.equal(boardAfter.board.confirmed, false);
    assert.deepEqual(boardAfter.components, boardBefore.components);
    const tasks = await page.evaluate(() => KeyboardLayoutEditor.getAnalysis().tasks);
    for (const name of ['matrix', 'gpio', 'schematic'])
      assert.equal(tasks.find((t) => t.domain === name).status, 'unchanged');
    const tutorialAfter = await page.evaluate(() => KeyboardDIY.getPreview());
    assert.deepEqual(tutorialAfter.layout.board, boardAfter.board);
    assert.equal(
      tutorialAfter.chapters.find((c) => c.id === 'ch09').contentHash,
      tutorialBefore.chapters.find((c) => c.id === 'ch09').contentHash,
    );
    await page.screenshot({ path: path.join(out, '外壳直接拉伸.png'), fullPage: true });
    console.log('PASS 外壳拖边调整宽度和圆角，组件与矩阵/GPIO/原理图不受误改');
    await tool('pan');
    const panBefore = await get();
    await drag(page.locator('#canvas'), 30, 20);
    assert.deepEqual(await get(), panBefore);
    await page.locator('#compare').selectOption('baseline');
    assert.equal(await page.locator('[data-board-handle],[data-handle]').count(), 0);
    await tool('resize');
    const p = await point(60, 60);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 50, p.y + 20);
    await page.mouse.up();
    assert.deepEqual(await get(), panBefore);
    console.log('PASS 平移仅改变视图，原始基准始终只读');
    await page.locator('#compare').selectOption('current');
    await page.locator('#editTarget').selectOption('component');
    await tool('resize');
    await page.locator('#canvas g[data-id=K10]').click();
    await page.screenshot({ path: path.join(out, '组件直接拉伸.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log('PASS 新工具栏窄屏无横向溢出，页面无脚本错误');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
