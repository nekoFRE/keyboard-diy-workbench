(function (root) {
  'use strict';
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const snap = (v, step) => (step ? Math.round(v / step) * step : v);
  const directions = {
    n: [0, -1],
    ne: [1, -1],
    e: [1, 0],
    se: [1, 1],
    s: [0, 1],
    sw: [-1, 1],
    w: [-1, 0],
    nw: [-1, -1],
  };
  function resize(g, direction, start, point, options = {}) {
    const [sx, sy] = directions[direction];
    const a = (g.rotation * Math.PI) / 180,
      cos = Math.cos(a),
      sin = Math.sin(a);
    const dx = (point.x - start.x) * cos + (point.y - start.y) * sin;
    const dy = -(point.x - start.x) * sin + (point.y - start.y) * cos;
    const factor = options.center ? 2 : 1,
      step = options.step || 0;
    let width = g.width + factor * sx * dx,
      height = g.height + factor * sy * dy;
    if (options.circular || options.aspect) {
      const ratio = options.circular ? 1 : g.width / g.height;
      const useWidth =
        sx &&
        (!sy || Math.abs((width - g.width) / g.width) >= Math.abs((height - g.height) / g.height));
      width = useWidth ? snap(width, step) : snap(height, step) * ratio;
      width = clamp(width, Math.max(1, ratio), Math.min(500, 500 * ratio));
      height = width / ratio;
    } else {
      width = sx ? clamp(snap(width, step), 1, 500) : g.width;
      height = sy ? clamp(snap(height, step), 1, 500) : g.height;
    }
    const localX = options.center ? 0 : (sx * (width - g.width)) / 2;
    const localY = options.center ? 0 : (sy * (height - g.height)) / 2;
    return {
      ...g,
      width,
      height,
      x: g.x + localX * cos - localY * sin,
      y: g.y + localX * sin + localY * cos,
    };
  }
  function rotate(g, start, point, step = 0) {
    const a = Math.atan2(start.y - g.y, start.x - g.x);
    const b = Math.atan2(point.y - g.y, point.x - g.x);
    const delta = (Math.atan2(Math.sin(b - a), Math.cos(b - a)) * 180) / Math.PI;
    return { ...g, rotation: snap(g.rotation + delta, step || 1) };
  }
  function board(b, direction, start, point, step = 0) {
    const next = { ...b };
    if (direction === 'radius')
      next.cornerRadius = clamp(
        snap(b.cornerRadius + point.x - start.x, step),
        0,
        Math.min(b.width, b.height) / 2,
      );
    else {
      if (direction.includes('e'))
        next.width = clamp(snap(b.width + point.x - start.x, step), 10, 1000);
      if (direction.includes('s'))
        next.height = clamp(snap(b.height + point.y - start.y, step), 10, 1000);
      next.cornerRadius = Math.min(b.cornerRadius, next.width / 2, next.height / 2);
    }
    return next;
  }
  const api = { directions, resize, rotate, board };
  root.KeyboardTransform = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
