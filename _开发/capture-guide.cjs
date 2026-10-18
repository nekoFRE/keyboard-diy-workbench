// 重新拍摄指南插图：只操作隔离浏览器中的演示项目，不改用户项目或基准文件。
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.dirname(__dirname);
const out = path.join(root, 'docs', 'images');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch(require('./browser-config.cjs'));
  const context = await browser.newContext({
    viewport: { width: 1360, height: 940 },
    deviceScaleFactor: 2,
    offline: true,
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(path.join(root, '键盘布局编辑器.html')).href);
  await page.waitForFunction(() => !!window.KeyboardDIY);
  await page.locator('#canvas g[data-id=K10]').click();
  // 编号只存在于本次截图，不进入应用源文件。
  await page.evaluate(() => {
    const points = [
      [1, 20, 94],
      [2, 20, 186],
      [3, 403, 220],
      [4, 1023, 184],
      [5, 380, 140],
    ];
    for (const [number, left, top] of points) {
      const el = document.createElement('div');
      el.dataset.guideMarker = '';
      el.textContent = number;
      el.style.cssText = `position:absolute;left:${left}px;top:${top}px;z-index:99;width:30px;height:30px;border-radius:50%;background:#b94132;color:white;border:2px solid white;box-shadow:0 2px 8px #0004;display:grid;place-items:center;font:bold 17px sans-serif;pointer-events:none;`;
      document.body.append(el);
    }
  });
  await page.screenshot({ path: path.join(out, '01-界面总览.png') });
  await page.evaluate(() =>
    document.querySelectorAll('[data-guide-marker]').forEach((e) => e.remove()),
  );
  const panelBox = await page.locator('.rightpanel').boundingBox();
  await page.screenshot({
    path: path.join(out, '02-组件尺寸.png'),
    clip: { ...panelBox, height: 450 },
  });
  await page.locator('#file').setInputFiles(path.join(root, '修改示例.layout.json'));
  await page.waitForFunction(() => KeyboardLayoutEditor.getDesign().board.width === 99.5);
  await page.locator('#compare').selectOption('overlay');
  await page.locator('[data-tab=analysis]').click();
  await page.screenshot({
    path: path.join(out, '03-改版分析.png'),
    clip: { ...panelBox, height: 620 },
  });
  await page.locator('#tutorialPreview').click();
  await page.waitForFunction(
    () => document.getElementById('tutorialFrame')?.dataset.ready === 'true',
  );
  await page.screenshot({ path: path.join(out, '04-教程联动.png') });
  await page.locator('#manualBody').fill('演示：计划核对旋钮安装高度，实际测量结果尚未填写。');
  await page.locator('#manualAuthor').fill('设计者（演示）');
  await page.locator('#manualEvidence').fill('待补充机械图或实测记录；此示例不作确认。');
  await page.locator('.chapter-editor').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const manualBox = await page.locator('.chapter-editor').boundingBox();
  const draftBox = await page.locator('#manualDraftStatus').boundingBox();
  await page.screenshot({
    path: path.join(out, '05-人工内容.png'),
    clip: {
      x: manualBox.x,
      y: manualBox.y,
      width: manualBox.width,
      height: draftBox.y + draftBox.height - manualBox.y + 8,
    },
  });
  await page.locator('#saveManual').click();
  await page.locator('#studio [data-studio=project]').click();
  await page.locator('#projectName').fill('我的键盘设计（指南演示）');
  await page.locator('#projectName').press('Tab');
  await page.locator('#versionLabel').fill('演示：旋钮左移、外壳加宽');
  await page.locator('#saveLayoutVersion').click();
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#snapshotTutorial').click();
  await downloadEvent;
  await page.locator('#studio [data-studio=project]').click();
  const cards = page.locator('#studioBody > .card');
  const a = await cards.nth(0).boundingBox(),
    b = await cards.nth(1).boundingBox();
  await page.screenshot({
    path: path.join(out, '06-项目版本.png'),
    clip: { x: a.x, y: a.y, width: a.width, height: b.y + b.height - a.y },
  });
  await page.locator('#studio [data-studio=files]').click();
  await page
    .locator('#studioBody > .card')
    .first()
    .screenshot({ path: path.join(out, '07-工程文件.png') });
  await page.locator('#studio [data-studio=ai]').click();
  await page
    .locator('#studioBody > .card')
    .first()
    .screenshot({ path: path.join(out, '08-可选AI.png') });
  await browser.close();
  console.log('Captured 8 guide screenshots:', out);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
