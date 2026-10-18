const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.dirname(__dirname);
const out = path.join(__dirname, '测试输出', '使用指南');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch(require('./browser-config.cjs'));
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      offline: true,
    });
    const page = await context.newPage();
    const errors = [],
      requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (/^https?:/.test(r.url())) requests.push(r.url());
    });
    const sourceHash = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(root, '使用说明.md')))
      .digest('hex');
    await page.goto(pathToFileURL(path.join(root, '使用说明图文版.html')).href);
    assert.equal(await page.locator('main').getAttribute('data-guide-source-sha256'), sourceHash);
    assert.equal(await page.locator('.guide-section').count(), 13);
    assert.equal(await page.locator('figure img').count(), 8);
    await page.waitForFunction(() =>
      [...document.querySelectorAll('figure img')].every((i) => i.complete && i.naturalWidth > 0),
    );
    console.log('PASS 图文版正文哈希、13节目录、8张内嵌截图与统一源文件一致');
    await page.locator('figure img').first().click();
    await page.locator('#imageViewer[open]').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#imageViewer[open]').count(), 0);
    await page.locator('.guide-nav a[href="#guide-7"]').click();
    assert.ok(
      Math.abs(
        (await page.locator('#guide-7').evaluate((e) => e.getBoundingClientRect().top)) - 20,
      ) < 2,
    );
    await page.screenshot({ path: path.join(out, '桌面阅读.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#sectionJump').selectOption('guide-3');
    assert.ok(
      Math.abs(
        (await page.locator('#guide-3').evaluate((e) => e.getBoundingClientRect().top)) - 20,
      ) < 2,
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(out, '手机阅读.png') });
    console.log('PASS 目录定位、截图放大、窄屏阅读且无横向溢出');
    if (process.argv.includes('--pdf')) {
      await page.emulateMedia({ media: 'print' });
      await page.pdf({
        path: path.join(root, '使用说明图文版.pdf'),
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="width:100%;font:9px sans-serif;color:#627882;text-align:center">Keyboard DIY · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      });
      console.log('Generated 使用说明图文版.pdf');
    }
    // 把主 HTML 单独复制到另一目录，证明内置帮助不依赖旁边的说明文件。
    const singleFile = path.join(out, '离线独立编辑器.html');
    fs.copyFileSync(path.join(root, '键盘布局编辑器.html'), singleFile);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ media: 'screen' });
    await page.goto(pathToFileURL(singleFile).href);
    await page.waitForFunction(() => !!window.KeyboardDIY);
    await page.locator('#help').click();
    const frame = page.frameLocator('#guideFrame');
    await frame.locator('main').waitFor();
    assert.equal(await frame.locator('main').getAttribute('data-guide-source-sha256'), sourceHash);
    assert.equal(await frame.locator('figure img').count(), 8);
    assert.ok((await frame.locator('main').innerText()).includes('完整项目'));
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS 单文件编辑器内的图文帮助与指南一致，离线无网络请求或脚本异常');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
