const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./core.js');
const task = (d, id) => C.analyze(d).tasks.find((t) => t.domain === id).status;
test('原基准可完整往返，16组件13轴14矩阵输入16GPIO且无碰撞', () => {
  const d = C.baseline(),
    r = C.analyze(d);
  assert.deepEqual(C.validatePackage(C.exportPackage(d)), []);
  assert.equal(d.components.length, 16);
  assert.equal(r.summary.keys, 13);
  assert.equal(r.summary.matrixAssigned, 14);
  assert.equal(r.summary.gpioUsed, 16);
  assert.equal(r.summary.collisions, 0);
  assert.ok(r.tasks.every((t) => t.status === 'unchanged'));
  assert.equal(d.components.find((c) => c.id === 'JOG1').electrical.press.implemented, false);
});
test('纯位置变更不误判原理图/矩阵/GPIO需修改', () => {
  const d = C.baseline();
  d.components[0].geometry.x += 2;
  assert.equal(task(d, 'pcb'), 'must');
  assert.equal(task(d, 'case'), 'must');
  assert.equal(task(d, 'plate'), 'must');
  for (const id of ['schematic', 'matrix', 'gpio', 'bom']) assert.equal(task(d, id), 'unchanged');
  assert.equal(task(d, 'qmk'), 'verify');
});
test('只改外壳轮廓不直接强制改PCB', () => {
  const d = C.baseline();
  d.board.width += 10;
  assert.equal(task(d, 'case'), 'must');
  assert.equal(task(d, 'pcb'), 'verify');
  for (const id of ['schematic', 'matrix', 'gpio', 'qmk']) assert.equal(task(d, id), 'unchanged');
});
test('只改功能键码无需重画硬件', () => {
  const d = C.baseline();
  d.components[1].keycodes[0] = 'KC_A';
  assert.equal(task(d, 'qmk'), 'must');
  for (const id of ['pcb', 'schematic', 'matrix', 'gpio', 'case', 'plate', 'bom'])
    assert.equal(task(d, id), 'unchanged');
});
test('新增键使用空矩阵交点不自动增加GPIO', () => {
  const d = C.baseline(),
    c = C.clone(d.components[1]);
  c.id = 'NEW_KEY';
  c.geometry.x = 110;
  c.electrical.input = { kind: 'matrix', row: 3, col: 0 };
  c.rgb = false;
  d.components.push(c);
  const r = C.analyze(d);
  assert.equal(r.summary.gpioUsed, 16);
  assert.equal(task(d, 'matrix'), 'verify');
  assert.equal(task(d, 'gpio'), 'verify');
  assert.equal(task(d, 'pcb'), 'must');
  assert.ok(!r.issues.some((i) => i.code === 'MATRIX_DUPLICATE'));
});
test('矩阵交点和GPIO冲突明确报告', () => {
  const d = C.baseline();
  d.components[1].electrical.input = { kind: 'matrix', row: 0, col: 0 };
  d.components[0].electrical.encoder.pinA = 'F4';
  const r = C.analyze(d);
  assert.ok(r.issues.some((i) => i.code === 'GPIO_CONFLICT'));
  assert.ok(r.issues.some((i) => i.code === 'MATRIX_DUPLICATE'));
});
test('修改旋转行为只改固件，修改外设引脚不改按键矩阵', () => {
  let d = C.baseline();
  d.components[0].electrical.encoder.cw = 'KC_A';
  for (const id of ['pcb', 'schematic', 'matrix', 'gpio']) assert.equal(task(d, id), 'unchanged');
  assert.equal(task(d, 'qmk'), 'must');
  d = C.baseline();
  d.components[0].electrical.encoder.pinA = 'D2';
  assert.equal(task(d, 'pcb'), 'must');
  assert.equal(task(d, 'gpio'), 'must');
  assert.equal(task(d, 'matrix'), 'unchanged');
});
test('改变矩阵脚或交点时同步网表与固件', () => {
  const d = C.baseline();
  d.configuration.matrix.rowPins[0] = 'D2';
  for (const id of ['pcb', 'schematic', 'matrix', 'gpio', 'qmk']) assert.equal(task(d, id), 'must');
});
test('矩形旋转碰撞，圆形与矩形净距正确', () => {
  const a = C.clone(C.baseline().components[1]),
    b = C.clone(a);
  a.geometry = { ...a.geometry, x: 0, y: 0, width: 10, height: 10, rotation: 45 };
  b.geometry = { ...b.geometry, x: 12, y: 0, width: 10, height: 10 };
  assert.equal(C.gap(a, b).overlap, true);
  b.geometry.x = 20;
  assert.ok(C.gap(a, b).gap > 7);
  const circle = C.clone(C.baseline().components[0]);
  circle.geometry = { ...circle.geometry, x: 0, y: 0, width: 10, height: 10 };
  b.geometry = { ...b.geometry, x: 20, y: 0, width: 10, height: 10, rotation: 0 };
  assert.equal(C.gap(circle, b).gap, 10);
  b.geometry.x = 9;
  assert.equal(C.gap(circle, b).overlap, true);
});
test('圆角边界和旋转越界不是只测中心', () => {
  const d = C.baseline(),
    c = C.clone(d.components[1]);
  c.geometry = { ...c.geometry, x: 3, y: 3, width: 5, height: 5, rotation: 0 };
  assert.ok(C.boundary(c, { width: 100, height: 100, cornerRadius: 10 }).outside);
  c.geometry.x = 0;
  assert.ok(C.boundary(c, d.board).outside);
});
test('不改写基准，支持JSON对象字段重排', () => {
  const p = C.exportPackage(C.baseline());
  p.referenceBaseline.name = 'bad';
  assert.ok(C.validatePackage(p).length);
  const q = C.exportPackage(C.baseline());
  q.referenceBaseline = Object.fromEntries(Object.entries(q.referenceBaseline).reverse());
  assert.deepEqual(C.validatePackage(q), []);
});
test('错误数据拒绝，不把未知规格猜成默认值', () => {
  const d = C.baseline();
  d.components[1].geometry.width = -1;
  assert.ok(C.validateDesign(d).length);
  d.components[1].geometry.width = 18;
  d.components[1].electrical.input.row = 99;
  assert.ok(C.validateDesign(d).length);
  const b = C.baseline();
  assert.ok(C.analyze(b).issues.some((i) => i.code === 'OLED_SPEC'));
  assert.equal(b.components.find((c) => c.type === 'oled').electrical.display.controller, null);
});
test('删除OLED仅验证定位板，补录器件规格不强制改PCB', () => {
  const d = C.baseline();
  d.components = d.components.filter((c) => c.type !== 'oled');
  assert.equal(task(d, 'plate'), 'verify');
  const b = C.baseline();
  b.components[1].spec.partNumber = 'confirmed-example';
  assert.equal(task(b, 'pcb'), 'verify');
  assert.equal(task(b, 'bom'), 'must');
});
test('analysis缓存不可信，导出总是重新生成', () => {
  const p = C.exportPackage(C.baseline());
  p.analysis = { tasks: [] };
  assert.deepEqual(C.validatePackage(p), []);
  assert.equal(C.exportPackage(p.design).analysis.tasks.length, 8);
});
