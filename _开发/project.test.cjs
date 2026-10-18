const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  crypto = require('node:crypto');
const C = require('./core.js'),
  P = require('./project-core.js'),
  T = require('./tutorial-engine.js'),
  library = JSON.parse(fs.readFileSync(__dirname + '/tutorial-library.json', 'utf8'));
const make = () => P.create(C.baseline(), library),
  chapter = (m, id) => m.chapters.find((c) => c.id === id);
test('SHA256与系统crypto一致，涵盖UTF8与原始文件字节', () => {
  for (const input of ['', 'abc', '中文与键盘', new Uint8Array([0, 255, 7, 0, 128])])
    assert.equal(P.sha256(input), crypto.createHash('sha256').update(input).digest('hex'));
});
test('保留原32章全文和15幅校验通过的图片', () => {
  assert.deepEqual(P.validateLibrary(library), []);
  assert.equal(library.chapters.length, 32);
  assert.equal(Object.keys(library.assets).length, 15);
  for (const c of library.chapters) {
    assert.ok(c.referenceBlocks.length > 0);
    assert.ok(Array.isArray(c.principles));
  }
  assert.equal(
    library.sourcePdfSha256,
    '79bc24f13c4fdd39dd18aeea6559fed5e9751505c55a0bd3d0906eea11e70b1c',
  );
});
test('离线生成完整教程有47个步骤及当前数据，未知项不补造', () => {
  const p = make(),
    m = T.build(p).model;
  assert.equal(m.chapters.length, 32);
  assert.equal(
    m.chapters.reduce((n, c) => n + c.steps.length, 0),
    47,
  );
  assert.ok(JSON.stringify(chapter(m, 'ch22').generated).includes('待确认'));
  assert.equal(
    p.working.design.components.find((c) => c.type === 'oled').electrical.display.controller,
    null,
  );
  const html = T.render(m, library);
  assert.ok(html.includes('data:image/jpeg;base64,'));
  assert.ok(html.includes('当前 JSON 的二维布局草案'));
  assert.ok(html.includes('断电'));
  assert.ok(html.includes('打印或另存 PDF'));
});
test('纯物理移动只影响相关章节，固定知识矩阵GPIO与接线章节保持完全一致', () => {
  const p = make(),
    base = T.build(p).model,
    d = P.clone(p.working.design);
  d.components.find((c) => c.id === 'K10').geometry.x += 2;
  P.sync(p, d);
  const r = T.build(p, base),
    m = r.model;
  for (const id of [
    'ch02',
    'ch03',
    'ch06',
    'ch07',
    'ch09',
    'ch10',
    'ch11',
    'ch16',
    'ch18',
    'ch19',
    'ch21',
    'ch22',
    'ch23',
    'ch24',
    'ch25',
    'ch28',
    'ch29',
    'ch30',
    'ch32',
  ])
    assert.equal(chapter(m, id), chapter(base, id), id);
  for (const id of ['ch01', 'ch08', 'ch12', 'ch13', 'ch26', 'ch27'])
    assert.notEqual(chapter(m, id).contentHash, chapter(base, id).contentHash, id);
  assert.ok(r.reused > 20);
});
test('增量更新与从当前JSON全新生成内容完全一致', () => {
  const p = make(),
    base = T.build(p).model,
    d = P.clone(p.working.design);
  d.components[0].geometry.x -= 2;
  d.board.width = 100;
  P.sync(p, d);
  const cached = T.build(p, base).model,
    fresh = T.build(p).model;
  assert.deepEqual(cached, fresh);
});
test('键码变化更新键位章节而不重写电路PCB与机械章节', () => {
  const p = make(),
    a = T.build(p).model,
    d = P.clone(p.working.design);
  d.components.find((c) => c.id === 'K10').keycodes['0'] = 'KC_A';
  P.sync(p, d);
  const b = T.build(p, a).model;
  assert.notEqual(chapter(a, 'ch19').contentHash, chapter(b, 'ch19').contentHash);
  for (const id of ['ch08', 'ch09', 'ch10', 'ch11', 'ch12', 'ch13', 'ch26'])
    assert.equal(chapter(a, id), chapter(b, id), id);
});
test('人工正文和已确认内容保留，只有相关依赖变化需要复核', () => {
  const p = make(),
    a = T.build(p).model;
  for (const id of ['ch08', 'ch09'])
    P.setNote(
      p,
      id,
      '人工确认正文 ' + id,
      '测试者',
      '实测记录 A',
      true,
      chapter(a, id).dependencyHash,
    );
  const afterNotes = T.build(p, a).model;
  P.setCheck(p, 'ch08', 's01', 'done', chapter(afterNotes, 'ch08').dependencyHash, '尺寸测量 A');
  P.setCheck(p, 'ch09', 's01', 'done', chapter(afterNotes, 'ch09').dependencyHash, '矩阵记录 A');
  const d = P.clone(p.working.design);
  d.components[1].geometry.x -= 2;
  P.sync(p, d);
  const b = T.build(p, afterNotes).model;
  assert.equal(chapter(b, 'ch08').manual.body, '人工确认正文 ch08');
  assert.equal(chapter(b, 'ch08').manual.effectiveStatus, 'needs-review');
  assert.equal(chapter(b, 'ch09').manual.effectiveStatus, 'confirmed');
  assert.equal(chapter(b, 'ch08').steps[0].effectiveStatus, 'needs-review');
  assert.equal(chapter(b, 'ch09').steps[0].effectiveStatus, 'done');
  assert.equal(p.notes.ch08.confirmed, true);
});
test('人工作文历史可追溯，保存新稿不删除旧稿', () => {
  const p = make(),
    ch = library.chapters.find((c) => c.id === 'ch08'),
    hash = T.dependency(p, ch);
  P.setNote(p, 'ch08', '第一稿', '甲', '依据', true, hash);
  P.setNote(p, 'ch08', '第二稿', '乙', '新依据', false, hash);
  assert.equal(p.notes.ch08.history[0].body, '第一稿');
  assert.equal(p.notes.ch08.body, '第二稿');
});
test('布局与教程快照明确绑定，历史教程完全不随后续布局变化', () => {
  const p = make(),
    t1 = T.saveTutorial(p),
    old = P.canonical(t1),
    d = P.clone(p.working.design);
  d.board.width = 110;
  P.sync(p, d);
  const t2 = T.saveTutorial(p);
  assert.equal(t1.layoutVersionId, 'L001');
  assert.equal(t2.layoutVersionId, 'L002');
  assert.equal(P.canonical(p.tutorialVersions[0]), old);
  assert.notEqual(t1.designHash, t2.designHash);
  assert.deepEqual(P.validate(p), []);
  P.restoreLayout(p, 'L001');
  assert.equal(P.hashDesign(p.working.design), t1.designHash);
  assert.equal(p.tutorialVersions.length, 2);
});
test('项目JSON往返含知识库、人工草稿和完整历史，篡改快照被拒绝', () => {
  const p = make();
  p.editorDrafts.ch08 = { body: '未应用草稿', author: '甲', evidence: '', confirmed: false };
  T.saveTutorial(p);
  const copy = JSON.parse(JSON.stringify(p));
  assert.deepEqual(P.validate(copy), []);
  assert.equal(copy.editorDrafts.ch08.body, '未应用草稿');
  copy.tutorialVersions[0].model.projectName = '篡改';
  assert.ok(P.validate(copy).some((e) => e.includes('教程版本')));
});
test('工程文件按类别关联，纯几何移动不误判固件/原理图失效', () => {
  const p = make(),
    caseHash = T.artifactHash(p, 'case'),
    firmware = T.artifactHash(p, 'firmware'),
    schematic = T.artifactHash(p, 'schematic'),
    bytes = new TextEncoder().encode('example cad bytes');
  const f = P.addFile(p, { name: '测试.step' }, 'case', 'A', '示例', true, bytes, true, caseHash);
  assert.equal(f.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(P.validate(p), []);
  const d = P.clone(p.working.design);
  d.components[1].geometry.x += 3;
  P.sync(p, d);
  assert.notEqual(T.artifactHash(p, 'case'), caseHash);
  assert.equal(T.artifactHash(p, 'firmware'), firmware);
  assert.equal(T.artifactHash(p, 'schematic'), schematic);
  assert.equal(f.confirmed, true);
});
test('AI接口有版本锁，建议没有自动改布局或确认正文的能力', () => {
  const p = make(),
    request = T.aiRequest(p, ['ch08']),
    response = {
      kind: 'keyboard-diy-ai-response',
      schemaVersion: '1.0.0',
      requestId: request.requestId,
      projectId: p.id,
      designHash: request.designHash,
      suggestions: [
        {
          chapterId: 'ch08',
          dependencyHash: request.chapters[0].dependencyHash,
          text: '请确认模块高度，不猜数值。',
        },
      ],
    };
  assert.deepEqual(T.validateAI(response, p, request), []);
  assert.equal(Object.keys(p.notes).length, 0);
  const d = P.clone(p.working.design);
  d.board.width += 1;
  P.sync(p, d);
  assert.ok(T.validateAI(response, p, request).length);
});
test('工程二进制被篡改后校验失败', () => {
  const p = make();
  P.addFile(
    p,
    { name: '固件.hex' },
    'firmware',
    'A',
    '示例',
    false,
    new Uint8Array([0, 1, 2, 255]),
    true,
    T.artifactHash(p, 'firmware'),
  );
  p.engineeringFiles[0].contentBase64 = P.bytesBase64(new Uint8Array([0, 1, 2, 254]));
  assert.ok(P.validate(p).some((e) => e.includes('内容校验失败')));
});
test('交付ZIP是标准UTF8存储格式且路径穿越被阻止', () => {
  const zip = P.zip([
    { name: '中文说明.txt', data: 'hello 中文' },
    { name: 'engineering/file.bin', data: new Uint8Array([0, 255]) },
  ]);
  assert.equal(new DataView(zip.buffer).getUint32(0, true), 0x04034b50);
  fs.writeFileSync(__dirname + '/zip-core-test.zip', zip);
  assert.throws(() => P.zip([{ name: '../bad', data: '' }]));
});
test('维护章节固定知识和扩展步骤只更新该章并使确认复核', () => {
  const p = make(),
    base = T.build(p).model,
    ch = p.library.chapters.find((c) => c.id === 'ch28');
  P.setNote(
    p,
    'ch28',
    '已确认的排错笔记',
    '甲',
    '依据',
    true,
    chapter(base, 'ch28').dependencyHash,
  );
  const before = T.build(p, base).model;
  ch.templateSteps = [
    { id: 'u01', title: '补充检查', instruction: '按维护者的实测依据检查。', check: '有记录' },
  ];
  const next = T.build(p, before).model;
  assert.equal(chapter(next, 'ch28').steps.at(-1).id, 'u01');
  assert.equal(chapter(next, 'ch28').manual.effectiveStatus, 'needs-review');
  for (const id of ['ch08', 'ch09', 'ch11', 'ch32'])
    assert.equal(chapter(next, id), chapter(before, id));
  assert.deepEqual(P.validate(p), []);
});
