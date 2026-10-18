const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./transform.js');
const g = { x: 30, y: 40, width: 20, height: 10, rotation: 0, confirmed: true, source: 'test' };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const world = (z, x, y) => {
  const a = (z.rotation * Math.PI) / 180;
  return { x: z.x + x * Math.cos(a) - y * Math.sin(a), y: z.y + x * Math.sin(a) + y * Math.cos(a) };
};
test('边手柄仅拉伸对应尺寸，并固定对边', () => {
  const next = T.resize(g, 'e', { x: 40, y: 40 }, { x: 46, y: 40 });
  near(next.width, 26);
  near(next.height, 10);
  near(next.x - next.width / 2, g.x - g.width / 2);
  const west = T.resize(g, 'w', { x: 20, y: 40 }, { x: 15, y: 40 });
  near(west.width, 25);
  near(west.x + west.width / 2, g.x + g.width / 2);
});
test('旋转后的角拉伸固定对角，坐标变换无漂移', () => {
  for (const rotation of [0, 30, 90, 183, 315]) {
    const z = { ...g, rotation };
    const start = world(z, 10, 5),
      point = world(z, 18, 8);
    const next = T.resize(z, 'se', start, point),
      oldAnchor = world(z, -10, -5),
      newAnchor = world(next, -next.width / 2, -next.height / 2);
    near(next.width, 28);
    near(next.height, 13);
    near(oldAnchor.x, newAnchor.x);
    near(oldAnchor.y, newAnchor.y);
  }
});
test('Shift保留比例，Alt从中心缩放，圆形始终等径', () => {
  const next = T.resize(
    g,
    'se',
    { x: 40, y: 45 },
    { x: 50, y: 49 },
    { aspect: true, center: true, step: 1 },
  );
  near(next.width / next.height, 2);
  near(next.x, 30);
  near(next.y, 40);
  const circle = T.resize(
    { ...g, height: 20 },
    'e',
    { x: 40, y: 40 },
    { x: 44, y: 40 },
    { circular: true },
  );
  near(circle.width, 24);
  near(circle.height, 24);
  near(circle.x, 32);
  near(circle.y, 40);
});
test('拉伸越过对边与极大尺寸均限制为合法值', () => {
  const tiny = T.resize(g, 'e', { x: 40, y: 40 }, { x: -500, y: 40 });
  near(tiny.width, 1);
  const huge = T.resize(g, 'se', { x: 40, y: 45 }, { x: 9999, y: 9999 }, { step: 19.05 });
  assert.ok(huge.width <= 500 && huge.height <= 500);
});
test('旋转从按下角度计算，不跳转，跨越正负180度保持连续', () => {
  const start = world(g, 0, -10),
    end = world(g, 10, 0);
  near(T.rotate(g, start, end).rotation, 90);
  const z = { ...g, rotation: 30 };
  near(T.rotate(z, start, start).rotation, 30);
  const a = world(g, Math.cos((179 * Math.PI) / 180) * 10, Math.sin((179 * Math.PI) / 180) * 10);
  const b = world(g, Math.cos((-179 * Math.PI) / 180) * 10, Math.sin((-179 * Math.PI) / 180) * 10);
  near(T.rotate(g, a, b).rotation, 2);
});
test('外壳拉伸只改外形，尺寸有界且圆角随收缩合法', () => {
  const b = {
    width: 100,
    height: 80,
    cornerRadius: 20,
    confirmed: true,
    source: 'test',
    minimumGap: 1,
  };
  const next = T.board(b, 'e', { x: 100, y: 40 }, { x: 120, y: 40 });
  near(next.width, 120);
  near(next.height, 80);
  near(b.width, 100);
  const small = T.board(b, 'se', { x: 100, y: 80 }, { x: -999, y: -999 });
  near(small.width, 10);
  near(small.height, 10);
  near(small.cornerRadius, 5);
  const radius = T.board(b, 'radius', { x: 20, y: 0 }, { x: 100, y: 0 });
  near(radius.cornerRadius, 40);
});
