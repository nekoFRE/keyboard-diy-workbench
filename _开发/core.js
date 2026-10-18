/* Keyboard Layout Draft interchange v1.0.0. Pure geometry and impact rules. */
(function (root) {
  'use strict';
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const stable = (x) =>
    JSON.stringify(x, function (k, v) {
      return v && typeof v === 'object' && !Array.isArray(v)
        ? Object.keys(v)
            .sort()
            .reduce((a, k) => ((a[k] = v[k]), a), {})
        : v;
    });
  const TYPES = ['key', 'encoder', 'jog', 'oled'];
  const names = { key: '机械按键', encoder: '小旋钮', jog: '大转盘', oled: 'OLED 屏幕' };
  const BASELINE_ID = 'bv1nt4y1e7hz-tutorial-reference-v1';
  const matrixInput = (r, c) => ({ kind: 'matrix', row: r, col: c });
  function makeBaseline() {
    const slots = [
      'K01',
      'K02',
      'K03',
      'K10',
      'K11',
      'K12',
      'K13',
      'K20',
      'K21',
      'K22',
      'K23',
      'K32',
      'K33',
    ];
    const positions = [
      [36.05, 18],
      [55.1, 37.05],
      [74.15, 37.05],
      [17, 37.05],
      [36.05, 37.05],
      [55.1, 56.1],
      [74.15, 56.1],
      [17, 56.1],
      [36.05, 56.1],
      [55.1, 75.15],
      [74.15, 75.15],
      [55.1, 94.2],
      [74.15, 94.2],
    ];
    const fn = {
      K01: ['TO(1)', 'TO(2)', 'TO(3)', 'TO(0)'],
      K02: ['KC_3', 'KC_W', 'LSFT(LCTL(KC_RBRC))', 'RGB_M_P'],
      K03: ['KC_4', 'KC_DEL', 'KC_DEL', 'RGB_TOG'],
      K10: ['KC_1', 'KC_Q', 'LSFT(LCTL(KC_LBRC))', 'RGB_MOD'],
      K11: ['KC_2', 'LCTL(KC_K)', 'LCTL(KC_SLSH)', 'RGB_RMOD'],
      K12: ['KC_7', 'KC_L', 'KC_L', 'RGB_SAI'],
      K13: ['KC_8', 'LCTL(KC_Z)', 'LCTL(KC_Z)', 'RGB_SAD'],
      K20: ['KC_5', 'KC_J', 'KC_J', 'RGB_HUI'],
      K21: ['KC_6', 'KC_K', 'KC_K', 'RGB_HUD'],
      K22: ['KC_9', 'KC_I', 'KC_I', 'RGB_VAI'],
      K23: ['KC_0', 'KC_O', 'KC_O', 'RGB_VAD'],
      K32: ['KC_DEL', 'KC_COMM', 'KC_F9', 'RGB_M_B'],
      K33: ['KC_ENT', 'KC_DOT', 'KC_F9', 'RGB_M_R'],
    };
    function comp(id, type, label, x, y, w, h, electrical, keycodes = {}) {
      return {
        id,
        type,
        label,
        geometry: {
          x,
          y,
          width: w,
          height: h,
          rotation: 0,
          confirmed: false,
          source: '教程示意重建，非实测尺寸',
        },
        spec: {
          manufacturer: null,
          partNumber: null,
          footprint: null,
          supplyV: null,
          confirmed: false,
        },
        electrical,
        keycodes,
        rgb: false,
        notes: '',
      };
    }
    const components = slots.map((id, i) => {
      const c = comp(
        id,
        'key',
        id,
        ...positions[i],
        18,
        18,
        { input: matrixInput(+id[1], +id[2]) },
        Object.fromEntries(fn[id].map((v, k) => [String(k), v])),
      );
      c.rgb = true;
      return c;
    });
    components.unshift(
      comp(
        'ENC0',
        'encoder',
        '音量旋钮 K00',
        17,
        18,
        19,
        19,
        {
          encoder: {
            index: 0,
            pinA: 'C7',
            pinB: 'C6',
            common: 'GND',
            resolution: 2,
            cw: 'KC_AUDIO_VOL_UP',
            ccw: 'KC_AUDIO_VOL_DOWN',
          },
          press: matrixInput(0, 0),
        },
        { 0: 'KC_MUTE', 1: 'KC_MUTE', 2: 'KC_MUTE', 3: 'RGB_M_T' },
      ),
    );
    components.push(
      comp('JOG1', 'jog', '大转盘', 26, 85, 34, 34, {
        encoder: {
          index: 1,
          pinA: 'D6',
          pinB: 'D4',
          common: 'GND',
          resolution: 2,
          cw: 'KC_LEFT',
          ccw: 'KC_RIGHT',
        },
        press: { kind: 'direct', pin: 'F0', keycode: 'KC_SPC', implemented: false },
      }),
    );
    components.push(
      comp('OLED0', 'oled', '层状态 OLED', 64.5, 17, 32, 14, {
        display: {
          bus: 'I2C',
          sda: 'D1',
          scl: 'D0',
          address: null,
          controller: null,
          resolution: [128, 64],
          rotation: 180,
          supplyV: null,
        },
      }),
    );
    return {
      name: '教程原始布局参考',
      notes: '保留原功能关系；物理坐标与组件外包络为示意占位，必须实测。',
      board: {
        width: 93.5,
        height: 111.5,
        cornerRadius: 4,
        confirmed: false,
        source: '上盖 STL 的 XZ 包围范围作外壳草案参考，不是 PCB 外形',
        minimumGap: 1,
      },
      configuration: {
        mcu: 'ATmega32U4',
        package: 'TQFP44',
        clockHz: 16000000,
        matrix: {
          rows: 4,
          cols: 4,
          rowPins: ['F4', 'F5', 'F6', 'F7'],
          colPins: ['B6', 'B5', 'B4', 'D7'],
          diodeDirection: 'ROW2COL',
          directionVerified: false,
        },
        lighting: { enabled: true, count: 13, dataPin: 'F1', partNumber: null, supplyV: null },
        layers: ['Windows', 'Premiere', 'DaVinci', '设置'],
        bootloader: null,
        qmkCommit: null,
      },
      components,
    };
  }
  const BASELINE = makeBaseline();
  const sourceContext = {
    tutorial: '多媒体机械键盘DIY完整图文教程.pdf',
    video: 'BV1nT4y1E7Hz',
    referenceDate: '2026-10-18',
    coordinateSystem: {
      unit: 'mm',
      origin: 'top-left of rectangular enclosure draft',
      x: 'right',
      y: 'down',
      position: 'component center',
      rotation: 'degrees clockwise',
      box: 'rotated outer envelope; not switch cutout or PCB footprint',
      circles: 'encoder and jog use diameter width=height',
    },
    geometryStatus:
      'All baseline physical geometry is illustrative and unmeasured. 93.5 x 111.5 references upper-shell STL XZ extents; it is not a PCB outline.',
    files: [
      'edit_keyboard/config.h',
      'edit_keyboard/kb.h',
      'edit_keyboard/rules.mk',
      'edit_keyboard/keymaps/default/keymap.c',
      '电路板及电路图/Schematic_Editor_keyboard_2020-07-12_22-10-05.pdf',
      '3D模型/上盖.stl',
      '3D模型/底盖.stl',
    ],
    knownIssues: [
      '原理图矩阵阴极似接 ROW，原 config.h 却写 ROW2COL，必须核对实际连线。',
      'USB 5V 经 SS14 与 AMS1117-5.0 的供电路径需复核。',
      '原图 UCAP 电容标 0.1µF，需按 MCU 手册核对；时钟器件与外接电容需核对。',
      '大转盘 F0 按压只有定义，原固件没有实现读取与发键。',
      '原 BOM 部分电阻阻值与料号冲突；旧 QMK API 需按固定版本移植。',
    ],
    chapters: {
      baseline: '3–10',
      schematic: '7、9–11',
      pcb: '12',
      plate: '8、13',
      case: '13、26',
      bom: '6–7',
      matrix: '9–10、19',
      gpio: '10、21–22',
      qmk: '17–25',
      acceptance: '15、27–29',
    },
  };
  const circular = (c) => c.type === 'encoder' || c.type === 'jog';
  function polygon(c) {
    const g = c.geometry,
      a = (g.rotation * Math.PI) / 180,
      cs = Math.cos(a),
      sn = Math.sin(a);
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, y]) => ({
      x: g.x + ((x * g.width) / 2) * cs - ((y * g.height) / 2) * sn,
      y: g.y + ((x * g.width) / 2) * sn + ((y * g.height) / 2) * cs,
    }));
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function pointSeg(p, a, b) {
    const l = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (l === 0) return dist(p, a);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l));
    return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
  }
  function inside(p, poly) {
    let sign = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        v = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (Math.abs(v) < 1e-9) continue;
      if (sign && Math.sign(v) !== sign) return false;
      sign = Math.sign(v);
    }
    return true;
  }
  function polyOverlap(a, b) {
    for (const poly of [a, b])
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i],
          q = poly[(i + 1) % poly.length],
          axis = { x: q.y - p.y, y: p.x - q.x };
        const aa = a.map((v) => v.x * axis.x + v.y * axis.y),
          bb = b.map((v) => v.x * axis.x + v.y * axis.y);
        if (Math.max(...aa) <= Math.min(...bb) + 1e-8 || Math.max(...bb) <= Math.min(...aa) + 1e-8)
          return false;
      }
    return true;
  }
  function gap(a, b) {
    if (circular(a) && circular(b)) {
      const v = dist(a.geometry, b.geometry) - (a.geometry.width + b.geometry.width) / 2;
      return { overlap: v < -1e-7, gap: Math.max(0, v) };
    }
    if (circular(a) || circular(b)) {
      const circle = circular(a) ? a : b,
        rect = circular(a) ? b : a,
        poly = polygon(rect),
        g = circle.geometry;
      const v = Math.min(...poly.map((p, i) => pointSeg(g, p, poly[(i + 1) % 4]))) - g.width / 2;
      const overlap = inside(g, poly) || v < -1e-7;
      return { overlap, gap: overlap ? 0 : Math.max(0, v) };
    }
    const aa = polygon(a),
      bb = polygon(b);
    if (polyOverlap(aa, bb)) return { overlap: true, gap: 0 };
    const v = Math.min(
      ...aa.flatMap((p) => bb.map((q, i) => pointSeg(p, q, bb[(i + 1) % 4]))),
      ...bb.flatMap((p) => aa.map((q, i) => pointSeg(p, q, aa[(i + 1) % 4]))),
    );
    return { overlap: false, gap: v };
  }
  function bounds(c) {
    if (circular(c)) {
      const g = c.geometry,
        r = g.width / 2;
      return { left: g.x - r, right: g.x + r, top: g.y - r, bottom: g.y + r };
    }
    const p = polygon(c);
    return {
      left: Math.min(...p.map((v) => v.x)),
      right: Math.max(...p.map((v) => v.x)),
      top: Math.min(...p.map((v) => v.y)),
      bottom: Math.max(...p.map((v) => v.y)),
    };
  }
  function boundary(c, board) {
    const b = bounds(c),
      g = c.geometry;
    let clearance = Math.min(b.left, b.top, board.width - b.right, board.height - b.bottom);
    const r = Math.min(board.cornerRadius, board.width / 2, board.height / 2);
    // A rounded rectangle's signed distance is exact for a point; circles use center + radius.
    function sdf(p) {
      const qx = Math.abs(p.x - board.width / 2) - (board.width / 2 - r),
        qy = Math.abs(p.y - board.height / 2) - (board.height / 2 - r);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    }
    if (circular(c)) clearance = -sdf(g) - g.width / 2;
    else clearance = -Math.max(...polygon(c).map(sdf));
    return { outside: clearance < -1e-7, clearance };
  }
  function matrixOf(c) {
    return c.electrical.input?.kind === 'matrix'
      ? c.electrical.input
      : c.electrical.press?.kind === 'matrix'
        ? c.electrical.press
        : null;
  }
  function validateDesign(d) {
    const errs = [];
    const err = (t) => errs.push(t);
    const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
    const finite = (v, min, max) =>
      typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
    const str = (v, max = 500) => typeof v === 'string' && v.length <= max;
    const nullable = (v, max = 100) => v === null || str(v, max);
    const pin = (v) => v === null || (typeof v === 'string' && /^[A-F][0-7]$/.test(v));
    const keys = (v, allowed, label) => {
      if (object(v) && Object.keys(v).some((k) => !allowed.includes(k)))
        err(label + ' 包含此格式不支持的字段，请把额外说明写到 notes');
    };
    if (!object(d)) return ['design 必须是对象'];
    keys(d, ['name', 'notes', 'board', 'configuration', 'components'], 'design');
    if (!str(d.name, 100) || !str(d.notes, 10000)) err('名称或备注无效');
    const b = d.board;
    if (
      !object(b) ||
      !finite(b.width, 10, 1000) ||
      !finite(b.height, 10, 1000) ||
      !finite(b.cornerRadius, 0, 500) ||
      b.cornerRadius > Math.min(b.width, b.height) / 2 ||
      !finite(b.minimumGap, 0, 100) ||
      typeof b.confirmed !== 'boolean' ||
      !str(b.source, 1000)
    )
      err('外形参数无效：尺寸 10–1000 mm，圆角不可大于短边一半');
    keys(b, ['width', 'height', 'cornerRadius', 'minimumGap', 'confirmed', 'source'], 'board');
    const f = d.configuration,
      m = f?.matrix,
      l = f?.lighting;
    keys(
      f,
      ['mcu', 'package', 'clockHz', 'matrix', 'lighting', 'layers', 'bootloader', 'qmkCommit'],
      'configuration',
    );
    keys(
      m,
      ['rows', 'cols', 'rowPins', 'colPins', 'diodeDirection', 'directionVerified'],
      'matrix',
    );
    keys(l, ['enabled', 'count', 'dataPin', 'partNumber', 'supplyV'], 'lighting');
    if (
      !object(f) ||
      !str(f.mcu, 100) ||
      !str(f.package, 100) ||
      !finite(f.clockHz, 1, 1e9) ||
      !nullable(f.bootloader) ||
      !nullable(f.qmkCommit)
    )
      err('控制器配置不完整');
    if (
      !object(m) ||
      !Number.isInteger(m.rows) ||
      !Number.isInteger(m.cols) ||
      m.rows < 1 ||
      m.rows > 32 ||
      m.cols < 1 ||
      m.cols > 32 ||
      !Array.isArray(m.rowPins) ||
      !Array.isArray(m.colPins) ||
      m.rowPins.length !== m.rows ||
      m.colPins.length !== m.cols ||
      ![...m.rowPins, ...m.colPins].every(pin) ||
      !['ROW2COL', 'COL2ROW'].includes(m.diodeDirection) ||
      typeof m.directionVerified !== 'boolean'
    )
      err('矩阵配置无效：行列数需与 GPIO 数组长度一致');
    if (
      !object(l) ||
      typeof l.enabled !== 'boolean' ||
      !Number.isInteger(l.count) ||
      l.count < 0 ||
      l.count > 1024 ||
      !pin(l.dataPin) ||
      !nullable(l.partNumber) ||
      !(l.supplyV === null || finite(l.supplyV, 0, 60))
    )
      err('灯光配置无效');
    if (!Array.isArray(f?.layers) || f.layers.length !== 4 || !f.layers.every((v) => str(v, 100)))
      err('此版本需要 4 个功能层名称');
    if (!Array.isArray(d.components) || d.components.length > 200)
      return [...errs, '组件列表无效或超过 200 项'];
    const ids = new Set();
    function input(v, id) {
      if (!object(v)) return err(id + ' 输入映射无效');
      if (v.kind === 'matrix') {
        keys(v, ['kind', 'row', 'col'], id);
        if (!(
          (v.row === null && v.col === null) ||
          (Number.isInteger(v.row) &&
            Number.isInteger(v.col) &&
            v.row >= 0 &&
            v.col >= 0 &&
            v.row < (m?.rows || 0) &&
            v.col < (m?.cols || 0))
        ))
          err(id + ' 矩阵位置超界或未成对填写');
      } else if (v.kind === 'direct') {
        keys(v, ['kind', 'pin', 'keycode', 'implemented'], id);
        if (!pin(v.pin) || !str(v.keycode, 100) || typeof v.implemented !== 'boolean')
          err(id + ' 直连输入无效');
      } else err(id + ' 输入类型无效');
    }
    d.components.forEach((c) => {
      if (!object(c)) {
        err('组件必须是对象');
        return;
      }
      keys(
        c,
        ['id', 'type', 'label', 'geometry', 'spec', 'electrical', 'keycodes', 'rgb', 'notes'],
        'component',
      );
      keys(
        c.geometry,
        ['x', 'y', 'width', 'height', 'rotation', 'confirmed', 'source'],
        'geometry',
      );
      keys(c.spec, ['manufacturer', 'partNumber', 'footprint', 'supplyV', 'confirmed'], 'spec');
      keys(c.electrical, ['input', 'press', 'encoder', 'display'], 'electrical');
      keys(
        c.electrical?.encoder,
        ['index', 'pinA', 'pinB', 'common', 'resolution', 'cw', 'ccw'],
        'encoder',
      );
      keys(
        c.electrical?.display,
        ['bus', 'sda', 'scl', 'address', 'controller', 'resolution', 'rotation', 'supplyV'],
        'display',
      );
      const id = c.id;
      if (!str(id, 64) || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(id) || ids.has(id))
        err('组件 ID 无效或重复：' + id);
      ids.add(id);
      if (
        !TYPES.includes(c.type) ||
        !str(c.label, 100) ||
        !str(c.notes, 10000) ||
        typeof c.rgb !== 'boolean'
      )
        err(id + ' 类型或文字字段无效');
      const g = c.geometry;
      if (
        !object(g) ||
        !finite(g.x, -2000, 2000) ||
        !finite(g.y, -2000, 2000) ||
        !finite(g.width, 1, 500) ||
        !finite(g.height, 1, 500) ||
        !finite(g.rotation, -36000, 36000) ||
        typeof g.confirmed !== 'boolean' ||
        !str(g.source, 1000)
      )
        err(id + ' 几何尺寸无效');
      if (circular(c) && g && Math.abs(g.width - g.height) > 1e-6)
        err(id + ' 圆形组件宽高必须相等');
      const s = c.spec;
      if (
        !object(s) ||
        !['manufacturer', 'partNumber', 'footprint'].every((k) => nullable(s[k])) ||
        !(s.supplyV === null || finite(s.supplyV, 0, 60)) ||
        typeof s.confirmed !== 'boolean'
      )
        err(id + ' 器件规格无效');
      const e = c.electrical;
      if (!object(e)) {
        err(id + ' 缺少电气对象');
        return;
      }
      if (c.type === 'key') {
        if (!e.input) err(id + ' 按键缺少输入');
        else input(e.input, id);
      }
      if (c.type === 'encoder' || c.type === 'jog') {
        const v = e.encoder;
        if (
          !object(v) ||
          !(v.index === null || (Number.isInteger(v.index) && v.index >= 0 && v.index < 32)) ||
          !pin(v.pinA) ||
          !pin(v.pinB) ||
          v.common !== 'GND' ||
          !Number.isInteger(v.resolution) ||
          v.resolution < 1 ||
          v.resolution > 32 ||
          !str(v.cw, 100) ||
          !str(v.ccw, 100)
        )
          err(id + ' 编码器参数无效');
        if (e.press !== null) input(e.press, id);
      }
      if (c.type === 'oled') {
        const v = e.display;
        if (
          !object(v) ||
          v.bus !== 'I2C' ||
          !pin(v.sda) ||
          !pin(v.scl) ||
          !nullable(v.controller) ||
          !(
            v.address === null ||
            (Number.isInteger(v.address) && v.address >= 0 && v.address <= 127)
          ) ||
          !Array.isArray(v.resolution) ||
          v.resolution.length !== 2 ||
          !v.resolution.every((n) => Number.isInteger(n) && n > 0 && n <= 1024) ||
          ![0, 90, 180, 270].includes(v.rotation) ||
          !(v.supplyV === null || finite(v.supplyV, 0, 60))
        )
          err(id + ' OLED 参数无效');
      }
      if (
        !object(c.keycodes) ||
        !Object.entries(c.keycodes).every(([k, v]) => /^[0-3]$/.test(k) && str(v, 100))
      )
        err(id + ' 键码无效');
      if (
        (c.type === 'key' || e.press?.kind === 'matrix') &&
        ![0, 1, 2, 3].every((k) => str(c.keycodes[k], 100))
      )
        err(id + ' 应填写 4 个层键码');
    });
    return errs;
  }
  function validatePackage(pkg) {
    if (
      !pkg ||
      pkg.schemaVersion !== '1.0.0' ||
      pkg.kind !== 'keyboard-layout-draft' ||
      pkg.baselineId !== BASELINE_ID
    )
      return ['不是本工具支持的 1.0.0 布局 JSON，或基准 ID 不匹配'];
    if (
      Object.keys(pkg).some(
        (k) =>
          ![
            '$schema',
            'kind',
            'schemaVersion',
            'baselineId',
            'exportedAt',
            'sourceContext',
            'referenceBaseline',
            'design',
            'analysis',
          ].includes(k),
      ) ||
      !pkg.analysis ||
      typeof pkg.analysis !== 'object' ||
      Array.isArray(pkg.analysis)
    )
      return ['文件包含不支持的字段，或缺少 analysis 对象'];
    if (
      pkg.$schema !== 'urn:keyboard-layout-draft:schema:1.0.0' ||
      typeof pkg.exportedAt !== 'string' ||
      !Number.isFinite(Date.parse(pkg.exportedAt))
    )
      return ['格式标识或导出时间缺失/无效'];
    if (stable(pkg.referenceBaseline) !== stable(BASELINE))
      return ['内置原始基准被改写；请从编辑器重新导出，不要修改 referenceBaseline'];
    if (stable(pkg.sourceContext) !== stable(sourceContext))
      return ['来源与坐标约定被改写；请保留 sourceContext'];
    return validateDesign(pkg.design);
  }
  function diff(d) {
    const before = new Map(BASELINE.components.map((c) => [c.id, c])),
      after = new Map(d.components.map((c) => [c.id, c]));
    const changes = [];
    for (const [id, a] of before) {
      const b = after.get(id);
      if (!b) {
        changes.push({ id, kind: 'removed', label: a.label });
        continue;
      }
      const fields = [];
      for (const k of ['x', 'y', 'rotation', 'width', 'height'])
        if (a.geometry[k] !== b.geometry[k]) fields.push(k);
      if (fields.length)
        changes.push({
          id,
          kind: 'geometry',
          label: b.label,
          fields,
          before: clone(a.geometry),
          after: clone(b.geometry),
        });
      for (const k of ['type', 'spec', 'electrical', 'keycodes', 'rgb', 'label', 'notes'])
        if (stable(a[k]) !== stable(b[k])) changes.push({ id, kind: k, label: b.label });
      if (a.geometry.confirmed !== b.geometry.confirmed || a.geometry.source !== b.geometry.source)
        changes.push({ id, kind: 'geometryEvidence', label: b.label });
    }
    for (const [id, c] of after)
      if (!before.has(id)) changes.push({ id, kind: 'added', label: c.label });
    for (const k of ['board', 'configuration'])
      if (stable(d[k]) !== stable(BASELINE[k]))
        changes.push({ id: k, kind: k, label: k === 'board' ? '外形与间隙设置' : '全局电气配置' });
    return changes;
  }
  function analyze(d) {
    const changes = diff(d),
      issues = [],
      distances = [];
    const issue = (code, message, ids = [], severity = 'warning') =>
      issues.push({ code, message, componentIds: ids, severity });
    const collisions = [];
    for (let i = 0; i < d.components.length; i++) {
      const a = d.components[i],
        edge = boundary(a, d.board);
      if (edge.outside) issue('OUTSIDE', a.id + ' 外包络越过外壳草案边界', [a.id], 'error');
      else if (edge.clearance < d.board.minimumGap)
        issue('EDGE_GAP', a.id + ' 距外形边缘仅 ' + edge.clearance.toFixed(2) + ' mm', [a.id]);
      for (let j = i + 1; j < d.components.length; j++) {
        const b = d.components[j],
          v = gap(a, b),
          rec = { a: a.id, b: b.id, gapMm: +v.gap.toFixed(3), overlap: v.overlap };
        distances.push(rec);
        if (v.overlap) {
          collisions.push(rec);
          issue('COLLISION', a.id + ' 与 ' + b.id + ' 外包络重叠', [a.id, b.id], 'error');
        } else if (v.gap + 1e-6 < d.board.minimumGap)
          issue('CLEARANCE', a.id + ' 与 ' + b.id + ' 净距 ' + v.gap.toFixed(2) + ' mm', [
            a.id,
            b.id,
          ]);
      }
    }
    const m = d.configuration.matrix,
      coords = new Map(),
      pins = new Map(),
      indices = new Set();
    function pinUse(pin, net, id) {
      if (!pin) {
        issue('GPIO_UNASSIGNED', id + ' 的 ' + net + ' 尚未分配 GPIO', [id]);
        return;
      }
      if (!pins.has(pin)) pins.set(pin, new Map());
      const nets = pins.get(pin);
      if (!nets.has(net)) nets.set(net, []);
      nets.get(net).push(id);
    }
    m.rowPins.forEach((pin, i) => pinUse(pin, 'row' + i, 'matrix'));
    m.colPins.forEach((pin, i) => pinUse(pin, 'col' + i, 'matrix'));
    d.components.forEach((c) => {
      const e = c.electrical,
        v = matrixOf(c);
      if (v) {
        if (v.row === null) issue('MATRIX_UNASSIGNED', c.id + ' 的矩阵位置尚未分配', [c.id]);
        else {
          const k = v.row + ',' + v.col;
          if (coords.has(k))
            issue(
              'MATRIX_DUPLICATE',
              c.id + ' 与 ' + coords.get(k) + ' 复用同一矩阵交点 ' + k,
              [c.id, coords.get(k)],
              'error',
            );
          else coords.set(k, c.id);
        }
      }
      const inp = e.input || e.press;
      if (inp?.kind === 'direct') {
        pinUse(inp.pin, 'direct-' + c.id, c.id);
        if (!inp.implemented)
          issue('INPUT_NOT_IMPLEMENTED', c.id + ' 的直连按压尚未实现固件', [c.id]);
      }
      if (e.encoder) {
        const v = e.encoder;
        pinUse(v.pinA, 'encoder-' + c.id + '-A', c.id);
        pinUse(v.pinB, 'encoder-' + c.id + '-B', c.id);
        if (v.index === null) issue('ENCODER_INDEX', c.id + ' 未分配编码器索引', [c.id]);
        else if (indices.has(v.index))
          issue('ENCODER_INDEX', c.id + ' 的编码器索引重复', [c.id], 'error');
        else indices.add(v.index);
      }
      if (e.display) {
        const v = e.display;
        pinUse(v.sda, 'i2c-sda', c.id);
        pinUse(v.scl, 'i2c-scl', c.id);
        if (!v.controller || v.address === null || v.supplyV === null)
          issue('OLED_SPEC', c.id + ' 控制器、I²C 地址或供电仍需确认', [c.id]);
        if (d.configuration.mcu === 'ATmega32U4' && (v.sda !== 'D1' || v.scl !== 'D0'))
          issue('I2C_PINS', c.id + ' 不再采用 ATmega32U4 硬件 I²C D1/D0，需验证驱动', [c.id]);
      }
    });
    const l = d.configuration.lighting;
    if (l.enabled) {
      pinUse(l.dataPin, 'rgb-data', 'lighting');
      if (d.components.filter((c) => c.rgb).length !== l.count)
        issue('RGB_COUNT', '按组件标记的 RGB 数与全局灯珠数不一致；组合灯珠以实际清单为准');
      if (l.supplyV === null || !l.partNumber)
        issue('RGB_SPEC', 'RGB 器件型号、额定电压和总电流待确认');
    }
    for (const [pin, nets] of pins)
      if (nets.size > 1)
        issue(
          'GPIO_CONFLICT',
          pin + ' 同时分配给 ' + [...nets.keys()].join(' / '),
          [...nets.values()].flat(),
          'error',
        );
    const sdaScl = new Map();
    d.components
      .filter((c) => c.electrical.display)
      .forEach((c) => {
        const v = c.electrical.display;
        if (v.address !== null) {
          const k = v.sda + '/' + v.scl + '/' + v.address;
          if (sdaScl.has(k))
            issue(
              'I2C_ADDRESS',
              c.id + ' 与 ' + sdaScl.get(k) + ' 的 I²C 地址重复',
              [c.id, sdaScl.get(k)],
              'error',
            );
          sdaScl.set(k, c.id);
        }
      });
    if (
      indices.size &&
      [...indices].some((v, i) => ![...indices].sort((a, b) => a - b).includes(i))
    )
      issue(
        'ENCODER_SEQUENCE',
        '编码器索引不是从 0 连续排列；删除或重编号后需同步 QMK 数组与回调。',
      );
    if (!d.board.confirmed) issue('BOARD_DIMENSION', '外壳草案尺寸尚未实测；不是 PCB 尺寸');
    const unmeasured = d.components.filter((c) => !c.geometry.confirmed);
    if (unmeasured.length)
      issue(
        'DIMENSIONS',
        unmeasured.length + ' 个组件的外包络/位置尚未确认',
        unmeasured.map((c) => c.id),
      );
    const specs = d.components.filter(
      (c) => !c.spec.confirmed || !c.spec.partNumber || !c.spec.footprint,
    );
    if (specs.length)
      issue(
        'SPECS',
        specs.length + ' 个组件缺少已确认型号或安装封装',
        specs.map((c) => c.id),
      );
    if (!m.directionVerified)
      issue('DIODE_DIRECTION', '二极管方向尚未实测，原资料图纸与配置有矛盾');
    if (!d.configuration.bootloader || !d.configuration.qmkCommit)
      issue('QMK_VERSION', '引导程序与固定 QMK 提交尚未记录');
    if (d.configuration.mcu !== 'ATmega32U4')
      issue('NEW_MCU', '已更换主控：引脚能力、电平和驱动必须按新器件数据手册重新验证');
    const supported = new Set([
      'B0',
      'B1',
      'B2',
      'B3',
      'B4',
      'B5',
      'B6',
      'B7',
      'C6',
      'C7',
      'D0',
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
      'D6',
      'D7',
      'E2',
      'E6',
      'F0',
      'F1',
      'F4',
      'F5',
      'F6',
      'F7',
    ]);
    if (d.configuration.mcu === 'ATmega32U4')
      for (const pin of pins.keys())
        if (!supported.has(pin))
          issue('MCU_PIN', pin + ' 不是 ATmega32U4 可用的通用端口名', [], 'error');
    const tasks = {};
    for (const [id, label, pages] of [
      ['pcb', 'PCB', '12'],
      ['schematic', '原理图', '7、11'],
      ['matrix', '按键矩阵', '9–10、19'],
      ['gpio', 'GPIO', '10、21–22'],
      ['case', '外壳', '13、26'],
      ['plate', '定位板', '8、13'],
      ['bom', '物料清单', '6–7'],
      ['qmk', 'QMK 固件', '17–25'],
    ])
      tasks[id] = {
        domain: id,
        label,
        status: 'unchanged',
        tutorialPages: pages,
        reasons: [],
        steps: [],
      };
    const rank = { unchanged: 0, verify: 1, must: 2 };
    function flag(id, status, reason, step) {
      const t = tasks[id];
      if (rank[status] > rank[t.status]) t.status = status;
      if (!t.reasons.includes(reason)) t.reasons.push(reason);
      if (step && !t.steps.includes(step)) t.steps.push(step);
    }
    const additions = changes.filter((c) => c.kind === 'added'),
      removals = changes.filter((c) => c.kind === 'removed'),
      structural = changes.some((c) => ['added', 'removed', 'type'].includes(c.kind)),
      geom = changes.filter((c) => c.kind === 'geometry'),
      resized = geom.filter((c) => c.fields.some((f) => ['width', 'height'].includes(f))),
      shapeChanged = ['width', 'height', 'cornerRadius'].some(
        (k) => d.board[k] !== BASELINE.board[k],
      );
    const movedIds = geom.map((c) => c.id);
    if (geom.length) {
      flag(
        'pcb',
        'must',
        '组件位置、朝向或外包络改变；需更新物理布局，不代表全部重画电路',
        '在 EDA 中按 ID 更新器件摆放，保留网络定义，检查局部重布线与 DRC。',
      );
      flag('case', 'must', '组件几何发生变化', '更新轴孔、屏幕窗、旋钮净空、螺柱与插头避让。');
      if (
        geom.some((v) =>
          ['key', 'encoder', 'jog'].includes(d.components.find((c) => c.id === v.id)?.type),
        )
      )
        flag(
          'plate',
          'must',
          '按键或旋转件的机械几何变化',
          '重建相应孔位并用真实安装图核对板厚和公差。',
        );
      flag(
        'qmk',
        'verify',
        '物理位置不改变按键行为或矩阵分配',
        '保留 ID→矩阵→键码；若使用可视布局元数据，只同步 LAYOUT 坐标与图示。',
      );
      if (resized.length)
        flag(
          'bom',
          'verify',
          '外包络尺寸变化，尚不能推断更换了电气器件',
          '确认键帽宽度、轴体、旋钮帽或屏幕模块是否需要换料。',
        );
    }
    if (shapeChanged) {
      flag('case', 'must', '外形尺寸或圆角变化', '重建外壳轮廓与装配净空。');
      flag(
        'pcb',
        'verify',
        '编辑的是外壳草案外形，不是 PCB 轮廓',
        '核对现有 PCB 是否仍可装入，必要时才修改 PCB 板边与安装孔。',
      );
      flag('plate', 'verify', '外壳边界变化', '核对定位板边界与固定方式。');
    }
    if (structural) {
      for (const id of ['pcb', 'case', 'bom', 'qmk'])
        flag(
          id,
          'must',
          '增加、删除或替换了组件',
          '按稳定 ID 更新清单、相关孔位和固件功能；清理移除组件的引用。',
        );
      const plateChange = changes.some(
        (x) =>
          ['added', 'removed', 'type'].includes(x.kind) &&
          [
            d.components.find((c) => c.id === x.id),
            BASELINE.components.find((c) => c.id === x.id),
          ].some((c) => c && c.type !== 'oled'),
      );
      flag(
        'plate',
        plateChange ? 'must' : 'verify',
        '组件数量或类型改变',
        '只更新涉及定位板的轴孔与旋转件孔；仅增加屏幕时验证是否影响现有定位板。',
      );
      for (const id of ['schematic', 'matrix', 'gpio'])
        flag(
          id,
          'verify',
          '组件数量或类型改变，但尚不能假定必须增加 GPIO',
          '判断是否可复用空矩阵交点、既有 I²C 总线或原网络；确认后再决定改线。',
        );
      if (additions.length)
        flag(
          'qmk',
          'must',
          '新组件尚需明确输入映射和驱动支持',
          '先分配逻辑输入；新增矩阵键可先考虑 r3c0/r3c1，不自动分配或增加行列。',
        );
      if (removals.length)
        flag(
          'qmk',
          'must',
          '组件删除',
          '将移除输入对应位置设 KC_NO 或移除驱动；检查是否删掉唯一切层/返回入口。',
        );
    }
    if (changes.some((c) => c.kind === 'spec')) {
      flag(
        'bom',
        'must',
        '器件规格记录改变或补录',
        '更新采购与规格记录，不把补录字段自动视为更换了器件。',
      );
      for (const id of ['pcb', 'schematic', 'gpio', 'qmk', 'case', 'plate'])
        flag(
          id,
          'verify',
          '规格记录变化，需要区分补录资料与真实换料',
          '按厂家图纸核对引脚、焊盘、供电、驱动和安装尺寸；仅补录不代表要重画硬件。',
        );
    }
    if (changes.some((c) => c.kind === 'electrical')) {
      for (const id of ['pcb', 'schematic', 'qmk'])
        flag(
          id,
          'must',
          '输入接法、外设参数或旋转行为记录改变',
          '逐项核对变更字段：硬件接线更新到网表；纯行为/地址参数只改相应固件。',
        );
      for (const id of ['matrix', 'gpio'])
        flag(id, 'verify', '组件电气定义发生变化', '核对矩阵交点、GPIO 复用和所选 MCU 功能。');
    }
    // Refine electrical-only changes: behavior, driver/address, index and resolution are not copper/net changes.
    const netView = (c) => ({
      type: c.type,
      input: c.electrical.input
        ? {
            kind: c.electrical.input.kind,
            row: c.electrical.input.row,
            col: c.electrical.input.col,
            pin: c.electrical.input.pin,
          }
        : null,
      press: c.electrical.press
        ? {
            kind: c.electrical.press.kind,
            row: c.electrical.press.row,
            col: c.electrical.press.col,
            pin: c.electrical.press.pin,
          }
        : null,
      encoder: c.electrical.encoder
        ? {
            a: c.electrical.encoder.pinA,
            b: c.electrical.encoder.pinB,
            common: c.electrical.encoder.common,
          }
        : null,
      display: c.electrical.display
        ? {
            bus: c.electrical.display.bus,
            sda: c.electrical.display.sda,
            scl: c.electrical.display.scl,
          }
        : null,
    });
    const baseById = new Map(BASELINE.components.map((c) => [c.id, c]));
    const netChanged = d.components.some(
      (c) => baseById.has(c.id) && stable(netView(c)) !== stable(netView(baseById.get(c.id))),
    );
    const f = d.configuration,
      bf = BASELINE.configuration;
    const matrixChanged = stable(f.matrix) !== stable(bf.matrix),
      matrixNets = ['rows', 'cols', 'rowPins', 'colPins'].some(
        (k) => stable(f.matrix[k]) !== stable(bf.matrix[k]),
      );
    const lightingNets =
      f.lighting.enabled !== bf.lighting.enabled || f.lighting.dataPin !== bf.lighting.dataPin;
    const controllerChanged = ['mcu', 'package', 'clockHz'].some((k) => f[k] !== bf[k]);
    if (
      changes.some((c) => c.kind === 'electrical') &&
      !netChanged &&
      !structural &&
      !controllerChanged &&
      !matrixNets &&
      !lightingNets
    ) {
      for (const id of ['pcb', 'schematic', 'matrix', 'gpio']) {
        const t = tasks[id];
        t.reasons = t.reasons.filter(
          (r) => !['输入接法、外设参数或旋转行为记录改变', '组件电气定义发生变化'].includes(r),
        );
        t.steps = t.steps.filter(
          (s) => !s.startsWith('逐项核对变更字段') && !s.startsWith('核对矩阵交点'),
        );
        t.status = t.reasons.length
          ? id === 'pcb' && geom.length
            ? 'must'
            : 'verify'
          : 'unchanged';
      }
      flag(
        'qmk',
        'must',
        '仅外设行为、驱动参数或输入实现状态变化，不改变电气连接',
        '更新对应回调、地址/驱动或键码，单项测试；无需据此重画原理图。',
      );
    }
    const inputView = (c) => ({
      input: c.electrical.input || null,
      press: c.electrical.press?.kind === 'matrix' ? c.electrical.press : null,
    });
    const matrixMappingChanged = d.components.some(
      (c) => baseById.has(c.id) && stable(inputView(c)) !== stable(inputView(baseById.get(c.id))),
    );
    if (netChanged || matrixNets || lightingNets) {
      for (const id of ['pcb', 'schematic', 'gpio', 'qmk'])
        flag(
          id,
          'must',
          '实际网络分配发生变化',
          '同步 MCU 端口、网表、PCB 走线与固件定义，重新检查资源冲突。',
        );
      if (matrixNets || matrixMappingChanged)
        flag(
          'matrix',
          'must',
          '矩阵输入或行列网络发生变化',
          '更新矩阵对应关系；保留不受影响的交点。',
        );
      else if (
        tasks.matrix.reasons.length === 1 &&
        tasks.matrix.reasons[0] === '组件电气定义发生变化'
      ) {
        tasks.matrix = { ...tasks.matrix, status: 'unchanged', reasons: [], steps: [] };
      }
    }
    if (matrixChanged && !matrixNets) {
      flag(
        'matrix',
        'verify',
        '二极管方向声明或确认状态改变',
        '按实际二极管连线验证扫描方向；仅确认状态更新不改硬件。',
      );
      if (f.matrix.diodeDirection !== bf.matrix.diodeDirection)
        flag('qmk', 'must', '扫描方向配置改变', '使用实测方向重新构建并测试多键输入。');
    }
    if (controllerChanged) {
      for (const id of ['schematic', 'pcb', 'gpio', 'qmk', 'bom'])
        flag(
          id,
          'must',
          '主控、封装或时钟方案改变',
          '重新确认电源、USB、时钟、GPIO、引导程序和器件规格。',
        );
      for (const id of ['matrix', 'case', 'plate'])
        flag(id, 'verify', '控制器方案改变', '验证资源容量与机械安装，保留兼容的矩阵与轴位。');
    }
    if (changes.some((c) => c.kind === 'keycodes'))
      flag('qmk', 'must', '功能层键码变化', '按 ID 修改键码，验证快捷键和切层返回路径。');
    if (
      stable(f.layers) !== stable(bf.layers) ||
      f.bootloader !== bf.bootloader ||
      f.qmkCommit !== bf.qmkCommit
    )
      flag(
        'qmk',
        'verify',
        '功能层名称、引导器或 QMK 版本记录改变',
        '确认迁移兼容性、构建方式和 USB 更新方式。',
      );
    if (stable(f.lighting) !== stable(bf.lighting) || changes.some((c) => c.kind === 'rgb')) {
      flag('bom', 'verify', 'RGB 配置或组件灯光标记变化', '核对灯珠数量、物料、电压与总功耗。');
      flag('qmk', 'must', 'RGB 配置变化', '同步灯珠数量与启用状态，确认数据链与限流。');
      flag(
        'schematic',
        'verify',
        'RGB 数量或规格可能变化',
        '确认实际灯珠网络；只修改软件灯效不增加 GPIO。',
      );
    }
    for (const t of Object.values(tasks))
      if (!t.reasons.length) {
        t.reasons.push('与原始基准相比，未发现必须改动此部分的字段。');
        t.steps.push('可保留原定义；原资料已知问题仍需按教程核对。');
      }
    return {
      generatedAt: new Date().toISOString(),
      ruleVersion: '1.0.0',
      draftOnly: true,
      changes,
      summary: {
        components: d.components.length,
        keys: d.components.filter((c) => c.type === 'key').length,
        matrixAssigned: coords.size,
        matrixCapacity: m.rows * m.cols,
        gpioUsed: pins.size,
        collisions: collisions.length,
      },
      tasks: Object.values(tasks),
      issues,
      collisions,
      distances: distances.sort((a, b) => a.gapMm - b.gapMm),
      knownBaselineIssues: clone(sourceContext.knownIssues),
      nextSteps: [
        '确认外包络、安装孔、PCB 焊盘、模块高度和插头净空。',
        '逐项完成矩阵/GPIO 分配和器件电气规格记录。',
        '把此 JSON 作为统一输入分析改版；不能直接交工厂加工或直接刷入固件。',
      ],
    };
  }
  function exportPackage(d) {
    return {
      $schema: 'urn:keyboard-layout-draft:schema:1.0.0',
      kind: 'keyboard-layout-draft',
      schemaVersion: '1.0.0',
      baselineId: BASELINE_ID,
      exportedAt: new Date().toISOString(),
      sourceContext: clone(sourceContext),
      referenceBaseline: clone(BASELINE),
      design: clone(d),
      analysis: analyze(d),
    };
  }
  root.LayoutCore = {
    clone,
    TYPES,
    names,
    BASELINE_ID,
    baseline: () => clone(BASELINE),
    sourceContext: () => clone(sourceContext),
    circular,
    polygon,
    gap,
    bounds,
    boundary,
    matrixOf,
    validateDesign,
    validatePackage,
    diff,
    analyze,
    exportPackage,
  };
  if (typeof module !== 'undefined') module.exports = root.LayoutCore;
})(typeof window !== 'undefined' ? window : globalThis);
