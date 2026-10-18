const fs = require('node:fs');
const path = require('node:path');
const C = require('./core.js');
const out = path.dirname(__dirname);
require('node:child_process').execFileSync(
  process.execPath,
  [path.join(__dirname, 'build-guide.cjs')],
  { stdio: 'inherit' },
);
const userGuide = fs.readFileSync(path.join(out, '使用说明图文版.html'), 'utf8');
const library = {
  ...JSON.parse(fs.readFileSync(path.join(__dirname, '教程章节.json'), 'utf8')),
  ...JSON.parse(fs.readFileSync(path.join(__dirname, '教程图片.json'), 'utf8')),
};
fs.writeFileSync(path.join(__dirname, 'tutorial-library.json'), JSON.stringify(library));
const libraryErrors = require('./project-core.js').validateLibrary(library);
if (libraryErrors.length) throw Error(libraryErrors.join('\n'));
const additions =
  '<style>' +
  fs.readFileSync(path.join(__dirname, 'studio.css'), 'utf8') +
  '</style><script type="application/json" id="tutorial-library-data">' +
  JSON.stringify(library).replace(/</g, '\\u003c') +
  '</script>' +
  '<script type="application/json" id="user-guide-data">' +
  JSON.stringify(userGuide).replace(/</g, '\\u003c') +
  '</script>' +
  ['project-core.js', 'tutorial-engine.js', 'project-ui.js']
    .map(
      (name) =>
        '<script>' +
        fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/<\/script/gi, '<\\/script') +
        '</script>',
    )
    .join('');
const html = fs
  .readFileSync(path.join(__dirname, 'ui.html'), 'utf8')
  .replace('/*__CORE__*/', fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8'))
  .replace('/*__TRANSFORM__*/', fs.readFileSync(path.join(__dirname, 'transform.js'), 'utf8'))
  .replace('</body>', additions + '</body>');
fs.writeFileSync(path.join(out, '键盘布局编辑器.html'), html, 'utf8');
const baseline = C.exportPackage(C.baseline());
if (!fs.existsSync(path.join(out, '原始基准.layout.json')))
  fs.writeFileSync(path.join(out, '原始基准.layout.json'), JSON.stringify(baseline, null, 2));
const sample = C.baseline();
sample.name = '示例 旋钮左移与加宽外形';
sample.notes =
  '仅示范物理改版：小旋钮左移 2 mm、OLED 下移 1 mm，外壳草案加宽到 99.5 mm。ID、矩阵、GPIO、键码和器件均保留；请看改版分析。';
sample.board.width = 99.5;
sample.board.source = '示例草案加宽，非实测';
sample.components.find((c) => c.id === 'ENC0').geometry.x -= 2;
sample.components.find((c) => c.id === 'OLED0').geometry.y += 1;
if (!fs.existsSync(path.join(out, '修改示例.layout.json')))
  fs.writeFileSync(
    path.join(out, '修改示例.layout.json'),
    JSON.stringify(C.exportPackage(sample), null, 2),
  );
const nullableText = { type: ['string', 'null'], maxLength: 100 };
const pin = { anyOf: [{ type: 'null' }, { type: 'string', pattern: '^[A-F][0-7]$' }] };
const finite = (min, max) => ({ type: 'number', minimum: min, maximum: max });
const input = {
  oneOf: [
    {
      type: 'object',
      required: ['kind', 'row', 'col'],
      properties: {
        kind: { const: 'matrix' },
        row: { type: ['integer', 'null'], minimum: 0, maximum: 31 },
        col: { type: ['integer', 'null'], minimum: 0, maximum: 31 },
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['kind', 'pin', 'keycode', 'implemented'],
      properties: {
        kind: { const: 'direct' },
        pin: { $ref: '#/$defs/pin' },
        keycode: { type: 'string', maxLength: 100 },
        implemented: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  ],
};
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:keyboard-layout-draft:schema:1.0.0',
  title: 'Keyboard Layout Draft 1.0.0',
  description:
    '毫米物理草案与硬件映射的统一输入；不是加工文件。中心坐标、顺时针角度；旋钮/转盘为圆形直径。',
  type: 'object',
  required: [
    '$schema',
    'kind',
    'schemaVersion',
    'baselineId',
    'exportedAt',
    'sourceContext',
    'referenceBaseline',
    'design',
    'analysis',
  ],
  properties: {
    $schema: { const: 'urn:keyboard-layout-draft:schema:1.0.0' },
    kind: { const: 'keyboard-layout-draft' },
    schemaVersion: { const: '1.0.0' },
    baselineId: { const: C.BASELINE_ID },
    exportedAt: { type: 'string', format: 'date-time' },
    sourceContext: { const: C.sourceContext() },
    referenceBaseline: { const: C.baseline() },
    design: { $ref: '#/$defs/design' },
    analysis: {
      type: 'object',
      readOnly: true,
      description: 'Derived cache; always recomputed on import; never use as authority.',
    },
  },
  additionalProperties: false,
  $defs: {
    pin,
    nullableText,
    input,
    geometry: {
      type: 'object',
      required: ['x', 'y', 'width', 'height', 'rotation', 'confirmed', 'source'],
      properties: {
        x: finite(-2000, 2000),
        y: finite(-2000, 2000),
        width: finite(1, 500),
        height: finite(1, 500),
        rotation: finite(-36000, 36000),
        confirmed: { type: 'boolean' },
        source: { type: 'string', maxLength: 1000 },
      },
      additionalProperties: false,
    },
    spec: {
      type: 'object',
      required: ['manufacturer', 'partNumber', 'footprint', 'supplyV', 'confirmed'],
      properties: {
        manufacturer: nullableText,
        partNumber: nullableText,
        footprint: nullableText,
        supplyV: { anyOf: [{ type: 'null' }, finite(0, 60)] },
        confirmed: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    encoder: {
      type: 'object',
      required: ['index', 'pinA', 'pinB', 'common', 'resolution', 'cw', 'ccw'],
      properties: {
        index: { type: ['integer', 'null'], minimum: 0, maximum: 31 },
        pinA: pin,
        pinB: pin,
        common: { const: 'GND' },
        resolution: { type: 'integer', minimum: 1, maximum: 32 },
        cw: { type: 'string', maxLength: 100 },
        ccw: { type: 'string', maxLength: 100 },
      },
      additionalProperties: false,
    },
    display: {
      type: 'object',
      required: ['bus', 'sda', 'scl', 'address', 'controller', 'resolution', 'rotation', 'supplyV'],
      properties: {
        bus: { const: 'I2C' },
        sda: pin,
        scl: pin,
        address: { type: ['integer', 'null'], minimum: 0, maximum: 127 },
        controller: nullableText,
        resolution: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { type: 'integer', minimum: 1, maximum: 1024 },
        },
        rotation: { enum: [0, 90, 180, 270] },
        supplyV: { anyOf: [{ type: 'null' }, finite(0, 60)] },
      },
      additionalProperties: false,
    },
    component: {
      type: 'object',
      required: [
        'id',
        'type',
        'label',
        'geometry',
        'spec',
        'electrical',
        'keycodes',
        'rgb',
        'notes',
      ],
      properties: {
        id: { type: 'string', maxLength: 64, pattern: '^[A-Za-z][A-Za-z0-9_-]*$' },
        type: { enum: C.TYPES },
        label: { type: 'string', maxLength: 100 },
        geometry: { $ref: '#/$defs/geometry' },
        spec: { $ref: '#/$defs/spec' },
        electrical: {
          type: 'object',
          properties: {
            input: { $ref: '#/$defs/input' },
            press: { anyOf: [{ type: 'null' }, { $ref: '#/$defs/input' }] },
            encoder: { $ref: '#/$defs/encoder' },
            display: { $ref: '#/$defs/display' },
          },
          additionalProperties: false,
        },
        keycodes: {
          type: 'object',
          propertyNames: { pattern: '^[0-3]$' },
          additionalProperties: { type: 'string', maxLength: 100 },
        },
        rgb: { type: 'boolean' },
        notes: { type: 'string', maxLength: 10000 },
      },
      allOf: [
        {
          if: { properties: { type: { const: 'key' } } },
          then: {
            properties: {
              electrical: { required: ['input'] },
              keycodes: { required: ['0', '1', '2', '3'] },
            },
          },
        },
        {
          if: { properties: { type: { enum: ['encoder', 'jog'] } } },
          then: { properties: { electrical: { required: ['encoder', 'press'] } } },
        },
        {
          if: { properties: { type: { const: 'oled' } } },
          then: { properties: { electrical: { required: ['display'] } } },
        },
      ],
      additionalProperties: false,
    },
    design: {
      type: 'object',
      required: ['name', 'notes', 'board', 'configuration', 'components'],
      properties: {
        name: { type: 'string', maxLength: 100 },
        notes: { type: 'string', maxLength: 10000 },
        board: {
          type: 'object',
          required: ['width', 'height', 'cornerRadius', 'confirmed', 'source', 'minimumGap'],
          properties: {
            width: finite(10, 1000),
            height: finite(10, 1000),
            cornerRadius: finite(0, 500),
            confirmed: { type: 'boolean' },
            source: { type: 'string', maxLength: 1000 },
            minimumGap: finite(0, 100),
          },
          additionalProperties: false,
        },
        configuration: {
          type: 'object',
          required: [
            'mcu',
            'package',
            'clockHz',
            'matrix',
            'lighting',
            'layers',
            'bootloader',
            'qmkCommit',
          ],
          properties: {
            mcu: { type: 'string', maxLength: 100 },
            package: { type: 'string', maxLength: 100 },
            clockHz: finite(1, 1e9),
            matrix: {
              type: 'object',
              required: [
                'rows',
                'cols',
                'rowPins',
                'colPins',
                'diodeDirection',
                'directionVerified',
              ],
              properties: {
                rows: { type: 'integer', minimum: 1, maximum: 32 },
                cols: { type: 'integer', minimum: 1, maximum: 32 },
                rowPins: { type: 'array', items: pin, minItems: 1, maxItems: 32 },
                colPins: { type: 'array', items: pin, minItems: 1, maxItems: 32 },
                diodeDirection: { enum: ['ROW2COL', 'COL2ROW'] },
                directionVerified: { type: 'boolean' },
              },
              additionalProperties: false,
            },
            lighting: {
              type: 'object',
              required: ['enabled', 'count', 'dataPin', 'partNumber', 'supplyV'],
              properties: {
                enabled: { type: 'boolean' },
                count: { type: 'integer', minimum: 0, maximum: 1024 },
                dataPin: pin,
                partNumber: nullableText,
                supplyV: { anyOf: [{ type: 'null' }, finite(0, 60)] },
              },
              additionalProperties: false,
            },
            layers: {
              type: 'array',
              minItems: 4,
              maxItems: 4,
              items: { type: 'string', maxLength: 100 },
            },
            bootloader: nullableText,
            qmkCommit: nullableText,
          },
          additionalProperties: false,
        },
        components: { type: 'array', items: { $ref: '#/$defs/component' }, maxItems: 200 },
      },
      additionalProperties: false,
    },
  },
  $comment:
    'Cross-field constraints (unique IDs, matrix bounds/pin array lengths, circle equal diameters, rounded-corner bounds) are additionally enforced by the editor. Specs may be null, but remain unresolved.',
};
fs.writeFileSync(path.join(out, 'layout.schema.json'), JSON.stringify(schema, null, 2));
fs.writeFileSync(
  path.join(out, 'project.schema.json'),
  JSON.stringify(require('./project-schema.cjs')(schema, C), null, 2),
);
console.log('Built HTML, baseline, example and schema:', out);
const P = require('./project-core.js'),
  T = require('./tutorial-engine.js'),
  project = P.create(C.baseline(), library);
project.name = '键盘 DIY 持续设计示例';
const record = T.saveTutorial(project);
fs.writeFileSync(
  path.join(out, '示例项目.keyboard-project.json'),
  JSON.stringify(project, null, 2),
);
fs.writeFileSync(path.join(out, '当前设计示例教程.html'), T.render(record.model, library, record));
