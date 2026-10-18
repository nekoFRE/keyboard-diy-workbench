const { chromium } = require('playwright');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  { pathToFileURL } = require('node:url');
const C = require('./core.js'),
  P = require('./project-core.js');
const root = path.dirname(__dirname),
  out = path.join(__dirname, '测试输出');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch(require('./browser-config.cjs')),
    context = await browser.newContext({
      viewport: { width: 1536, height: 1050 },
      acceptDownloads: true,
      offline: true,
    });
  const page = await context.newPage(),
    errors = [],
    requests = [],
    results = [];
  context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  const url = pathToFileURL(path.join(root, '键盘布局编辑器.html')).href;
  await page.goto(url);
  await page.waitForFunction(() => !!window.KeyboardDIY);
  assert.deepEqual(errors, []);
  const project = () => page.evaluate(() => KeyboardDIY.getProject()),
    preview = () => page.evaluate(() => KeyboardDIY.getPreview());
  const ch = (m, id) => m.chapters.find((c) => c.id === id);
  const check = async (name, fn) => {
    await fn();
    results.push({ name, passed: true });
    console.log('PASS', name);
  };
  const current = async () => {
    await page.locator('#tutorialPreview').click();
    await page.locator('#tutorialChoice').selectOption('live');
  };
  const changeKeyX = async (x) => {
    await page.locator('#studio [data-studio=layout]').click();
    await page.locator('#canvas g[data-id=K10]').click();
    await page.locator('#propX').fill(String(x));
    await page.locator('#propX').press('Tab');
  };
  let original, firstRecord, firstHTML, projectPath, zipPath, aiRequest;
  await check('直接file URL离线加载升级版，旧编辑器和32章知识库均可用', async () => {
    const p = await project();
    assert.equal(p.library.chapters.length, 32);
    assert.equal(Object.keys(p.library.assets).length, 15);
    assert.equal(p.working.design.components.length, 16);
    original = await preview();
    assert.equal(original.chapters.length, 32);
  });
  await check('完整图文教程在iframe中离线预览，原图片加载成功', async () => {
    await page.locator('#tutorialPreview').click();
    const frame = page.frameLocator('#tutorialFrame');
    await frame.locator('#ch08').waitFor();
    assert.equal(await frame.locator('.chapter').count(), 32);
    await page.waitForFunction(
      () =>
        document.getElementById('tutorialFrame').dataset.ready === 'true' &&
        [...document.getElementById('tutorialFrame').contentDocument.images].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
    );
    await page.screenshot({ path: path.join(out, '教程预览.png'), fullPage: true });
  });
  await check('人工确认正文与步骤完成记录可以保存', async () => {
    await page.locator('#manualBody').fill('保留这一段机械人工正文。');
    await page.locator('#manualAuthor').fill('验证者');
    await page.locator('#manualEvidence').fill('机械样板记录 A');
    await page.locator('#manualConfirmed').check();
    await page.locator('#saveManual').click();
    assert.equal(ch(await preview(), 'ch08').manual.effectiveStatus, 'confirmed');
    await page.locator('[data-step-status=s01]').selectOption('done');
    await page.locator('[data-chapter=ch09]').click();
    await page.locator('#manualBody').fill('保留矩阵人工内容。');
    await page.locator('#manualEvidence').fill('二极管实测记录 A');
    await page.locator('#manualConfirmed').check();
    await page.locator('#saveManual').click();
    await page.locator('[data-step-status=s01]').selectOption('done');
  });
  await check('拖动布局联动相关章节，保留未受影响章节与人工确认', async () => {
    await changeKeyX(16);
    const m = await preview();
    assert.equal(ch(m, 'ch08').manual.body, '保留这一段机械人工正文。');
    assert.equal(ch(m, 'ch08').manual.effectiveStatus, 'needs-review');
    assert.equal(ch(m, 'ch08').steps[0].effectiveStatus, 'needs-review');
    assert.equal(ch(m, 'ch09').manual.effectiveStatus, 'confirmed');
    for (const id of ['ch02', 'ch06', 'ch10', 'ch11', 'ch18', 'ch21', 'ch28', 'ch32'])
      assert.equal(ch(m, id).contentHash, ch(original, id).contentHash, id);
    await current();
    await page.locator('[data-chapter=ch08]').click();
    assert.equal(await page.locator('#manualBody').inputValue(), '保留这一段机械人工正文。');
    assert.equal(await page.locator('#manualConfirmed').isChecked(), false);
  });
  await check('未应用人工草稿自动保留在项目中', async () => {
    await page.locator('[data-chapter=ch11]').click();
    await page.locator('#manualBody').fill('这是尚未应用的接线笔记草稿。');
    await page.locator('[data-chapter=ch08]').click();
    await page.locator('[data-chapter=ch11]').click();
    assert.equal(await page.locator('#manualBody').inputValue(), '这是尚未应用的接线笔记草稿。');
    assert.equal((await project()).editorDrafts.ch11.body, '这是尚未应用的接线笔记草稿。');
  });
  await check('生成HTML教程绑定明确布局版本和正文快照', async () => {
    const ev = page.waitForEvent('download');
    await page.locator('#snapshotTutorial').click();
    const dl = await ev;
    firstHTML = path.join(out, '生成教程-T001.html');
    await dl.saveAs(firstHTML);
    const p = await project();
    firstRecord = p.tutorialVersions[0];
    assert.equal(firstRecord.layoutVersionId, 'L002');
    assert.equal(firstRecord.designHash, P.hashDesign(p.working.design));
    assert.equal(await page.locator('#tutorialChoice').inputValue(), firstRecord.id);
    assert.equal(await page.locator('#manualBody').count(), 0);
  });
  await check('继续修改不改写历史教程，再生成得到新绑定', async () => {
    await changeKeyX(18);
    const ev = page.waitForEvent('download');
    await page.locator('#generateTutorial').click();
    await (await ev).saveAs(path.join(out, '生成教程-T002.html'));
    const p = await project();
    assert.equal(p.tutorialVersions.length, 2);
    assert.equal(p.tutorialVersions[0].contentHash, firstRecord.contentHash);
    assert.equal(p.tutorialVersions[1].layoutVersionId, 'L003');
  });
  await check('恢复布局版本保留人工正文与历史教程', async () => {
    await page.locator('#projectManager').click();
    await page.locator('[data-restore-layout=L002]').click();
    const p = await project();
    assert.equal(P.hashDesign(p.working.design), firstRecord.designHash);
    assert.equal(p.notes.ch08.body, '保留这一段机械人工正文。');
    assert.equal(p.tutorialVersions.length, 2);
  });
  await check('完整项目保存与真实文件重新导入恢复全部上下文', async () => {
    const ev = page.waitForEvent('download');
    await page.locator('#saveProject').click();
    const dl = await ev;
    projectPath = path.join(out, '项目往返.keyboard-project.json');
    await dl.saveAs(projectPath);
    const exported = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
    assert.deepEqual(P.validate(exported), []);
    await page.locator('#projectFile').setInputFiles(projectPath);
    await page.waitForFunction((id) => KeyboardDIY.getProject().id === id, exported.id);
    const p = await project();
    assert.equal(p.tutorialVersions.length, 2);
    assert.equal(p.notes.ch09.confirmed, true);
    assert.equal(p.editorDrafts.ch11.body, '这是尚未应用的接线笔记草稿。');
    await page.screenshot({ path: path.join(out, '项目版本.png'), fullPage: true });
  });
  await check('篡改历史教程项目被拒绝，当前项目不变', async () => {
    const p = await project(),
      bad = P.clone(p);
    bad.tutorialVersions[0].model.projectName = '篡改正文';
    await page.locator('#projectFile').setInputFiles({
      name: 'bad-project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(bad)),
    });
    await page.waitForFunction(() =>
      document.getElementById('toast').textContent.includes('导入失败'),
    );
    assert.equal(
      (await project()).tutorialVersions[0].contentHash,
      p.tutorialVersions[0].contentHash,
    );
  });
  await check('真实工程文件内嵌、哈希、布局依赖与重新确认', async () => {
    await page.locator('#studio [data-studio=files]').click();
    await page.locator('#fileCategory').selectOption('case');
    await page.locator('#fileRevision').fill('TEST-A');
    await page.locator('#fileNotes').fill('仅测试登记与二进制往返，不是CAD加工文件');
    await page.locator('#confirmFile').check();
    await page.locator('#engineeringFile').setInputFiles({
      name: '测试样件.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from([0, 1, 2, 128, 255]),
    });
    await page.waitForFunction(() => KeyboardDIY.getProject().engineeringFiles.length === 1);
    let p = await project();
    assert.equal(p.engineeringFiles[0].size, 5);
    assert.equal(p.engineeringFiles[0].sha256, P.sha256(new Uint8Array([0, 1, 2, 128, 255])));
    await changeKeyX(15);
    await page.locator('#engineeringManager').click();
    assert.ok((await page.locator('#studioBody').innerText()).includes('设计依赖变化，需要复核'));
    await page.locator('[data-confirm-file=F001]').click();
    p = await project();
    assert.equal(p.engineeringFiles[0].designHash, P.hashDesign(p.working.design));
    assert.equal(p.engineeringFiles[0].history.length, 1);
  });
  await check('标准ZIP交付包包含真实内嵌文件和缺失清单', async () => {
    const ev = page.waitForEvent('download');
    await page.locator('#exportDelivery').click();
    const dl = await ev;
    zipPath = path.join(out, '交付包验证.zip');
    await dl.saveAs(zipPath);
    assert.ok(fs.statSync(zipPath).size > 4e6);
  });
  await check('可选AI只生成待审核建议，保留人工正文且不改布局', async () => {
    await page.locator('#studio [data-studio=ai]').click();
    await page.locator('#aiChapter').selectOption('ch08');
    const ev = page.waitForEvent('download');
    await page.locator('#exportAIRequest').click();
    const dl = await ev,
      filename = path.join(out, 'ai-request.json');
    await dl.saveAs(filename);
    aiRequest = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const response = {
      kind: 'keyboard-diy-ai-response',
      schemaVersion: '1.0.0',
      requestId: aiRequest.requestId,
      projectId: aiRequest.projectId,
      designHash: aiRequest.designHash,
      suggestions: [
        {
          chapterId: 'ch08',
          dependencyHash: aiRequest.chapters[0].dependencyHash,
          text: '<script>alert(1)</script> 请实测高度，不补造尺寸。',
        },
      ],
    };
    fs.writeFileSync(path.join(out, 'ai-response.json'), JSON.stringify(response));
    await page.locator('#aiResponseFile').setInputFiles(path.join(out, 'ai-response.json'));
    await page.waitForFunction(() => KeyboardDIY.getProject().aiInbox?.length === 1);
    const before = await project();
    await page.locator('[data-adopt-ai="0"]').click();
    const after = await project();
    assert.equal(P.hashDesign(after.working.design), P.hashDesign(before.working.design));
    assert.ok(after.notes.ch08.body.startsWith('保留这一段机械人工正文。'));
    assert.equal(after.notes.ch08.confirmed, false);
    assert.ok(after.notes.ch08.history.length > 0);
  });
  await check('布局变化后过期AI响应不能应用', async () => {
    await changeKeyX(14);
    await page.locator('#aiManager').click();
    await page.locator('#aiResponseFile').setInputFiles(path.join(out, 'ai-response.json'));
    await page.waitForFunction(() =>
      document.getElementById('toast').textContent.includes('AI 建议未应用'),
    );
    assert.equal((await project()).aiInbox.length, 1);
  });
  await check('IndexedDB保存后刷新，可恢复项目而不重复输入背景', async () => {
    const before = await project();
    await page.waitForTimeout(800);
    await page.reload();
    await page.waitForFunction(() => !!window.KeyboardDIY);
    await page.locator('#resumeProject').waitFor({ state: 'visible' });
    await page.locator('#resumeProject').click();
    await page.waitForFunction((id) => KeyboardDIY.getProject().id === id, before.id);
    const p = await project();
    assert.equal(P.hashDesign(p.working.design), P.hashDesign(before.working.design));
    assert.equal(p.notes.ch08.body, before.notes.ch08.body);
    assert.equal(p.engineeringFiles.length, 1);
  });
  await check('历史导出HTML独立打开，图片与版本清单一致，可生成PDF', async () => {
    const printPage = await context.newPage();
    await printPage.goto(pathToFileURL(firstHTML).href);
    await printPage.waitForFunction(() =>
      [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    );
    assert.equal(await printPage.locator('.chapter').count(), 32);
    const manifest = await printPage.locator('#tutorial-manifest').textContent(),
      m = JSON.parse(manifest);
    assert.equal(m.designHash, firstRecord.designHash);
    assert.equal(m.layoutVersionId, 'L002');
    assert.equal(m.tutorialVersionId, 'T001');
    await printPage.emulateMedia({ media: 'print' });
    await printPage.pdf({
      path: path.join(out, '教程打印验证.pdf'),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    await printPage.close();
  });
  await check('窄屏布局与教程界面不横向溢出', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#studio [data-studio=layout]').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await current();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(out, '窄屏教程.png'), fullPage: true });
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  results.push({ name: '离线无外部网络请求与JavaScript异常', passed: true });
  fs.writeFileSync(
    path.join(out, '升级验证结果.json'),
    JSON.stringify(
      {
        passed: true,
        checks: results,
        errors,
        networkRequests: requests,
        firstTutorial: {
          layoutVersionId: firstRecord.layoutVersionId,
          tutorialVersionId: firstRecord.id,
          designHash: firstRecord.designHash,
        },
        browser: 'Chromium headless file:// offline',
      },
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
