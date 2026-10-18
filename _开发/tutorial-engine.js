(function (root) {
  'use strict';
  const C = root.LayoutCore || (typeof require === 'function' ? require('./core.js') : null),
    P =
      root.KeyboardProject || (typeof require === 'function' ? require('./project-core.js') : null),
    cl = C.clone;
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const val = (v) => (v === null || v === undefined || v === '' ? '待确认' : String(v)),
    num = (n) => Number(n).toFixed(2),
    p = (t) => ['p', t],
    h = (t) => ['h', t],
    table = (heads, rows) => ['table', heads, rows],
    code = (t) => ['code', t];
  const kind = { key: '机械轴位', encoder: '旋钮', jog: '转盘', oled: 'OLED' },
    knownStatus = {
      must: '需要重新设计或修改',
      verify: '需要重新验证',
      unchanged: '本次变化可保持',
    };
  function projection(d, p, key) {
    const c = d.components,
      f = d.configuration,
      net = (v) => (v ? { kind: v.kind, row: v.row, col: v.col, pin: v.pin } : null);
    if (key.startsWith('files:'))
      return p.engineeringFiles
        .filter((f) => key === 'files:all' || f.category === key.slice(6))
        .map(({ contentBase64, ...f }) => f);
    switch (key) {
      case 'identity':
        return { name: d.name, notes: d.notes };
      case 'geometry':
        return {
          board: d.board,
          components: c.map((x) => ({
            id: x.id,
            type: x.type,
            label: x.label,
            geometry: x.geometry,
          })),
        };
      case 'mechanical':
        return {
          geometry: projection(d, p, 'geometry'),
          specs: c.map((x) => ({
            id: x.id,
            part: x.spec.partNumber,
            footprint: x.spec.footprint,
            confirmed: x.spec.confirmed,
          })),
        };
      case 'topology':
        return c.map((x) => ({
          id: x.id,
          type: x.type,
          label: x.label,
          inputKind: x.electrical.input?.kind,
          pressKind: x.electrical.press?.kind,
        }));
      case 'inventory':
        return c.map((x) => ({
          id: x.id,
          type: x.type,
          label: x.label,
          rgb: x.rgb,
          width: x.geometry.width,
          height: x.geometry.height,
        }));
      case 'specs':
        return c.map((x) => ({ id: x.id, type: x.type, spec: x.spec }));
      case 'controller':
        return { mcu: f.mcu, package: f.package, clockHz: f.clockHz };
      case 'matrix':
        return {
          configuration: f.matrix,
          inputs: c.map((x) => ({ id: x.id, input: C.matrixOf(x) })),
        };
      case 'gpio':
        return {
          mcu: f.mcu,
          package: f.package,
          rows: f.matrix.rowPins,
          cols: f.matrix.colPins,
          lighting: { enabled: f.lighting.enabled, pin: f.lighting.dataPin },
          components: c.map((x) => ({
            id: x.id,
            input: net(x.electrical.input),
            press: net(x.electrical.press),
            encoder: x.electrical.encoder
              ? {
                  a: x.electrical.encoder.pinA,
                  b: x.electrical.encoder.pinB,
                  common: x.electrical.encoder.common,
                }
              : null,
            display: x.electrical.display
              ? {
                  sda: x.electrical.display.sda,
                  scl: x.electrical.display.scl,
                  bus: x.electrical.display.bus,
                }
              : null,
          })),
        };
      case 'functions':
        return {
          layers: f.layers,
          components: c.map((x) => ({
            id: x.id,
            keycodes: x.keycodes,
            encoder: x.electrical.encoder,
            press: x.electrical.press?.kind === 'direct' ? x.electrical.press : null,
            input: x.electrical.input?.kind === 'direct' ? x.electrical.input : null,
          })),
        };
      case 'encoders':
        return c
          .filter((x) => x.electrical.encoder)
          .map((x) => ({
            id: x.id,
            label: x.label,
            electrical: x.electrical,
            keycodes: x.keycodes,
          }));
      case 'encoderSpecs':
        return c.filter((x) => x.electrical.encoder).map((x) => ({ id: x.id, spec: x.spec }));
      case 'oled':
        return c
          .filter((x) => x.electrical.display)
          .map((x) => ({ id: x.id, label: x.label, display: x.electrical.display }));
      case 'displaySpecs':
        return c.filter((x) => x.electrical.display).map((x) => ({ id: x.id, spec: x.spec }));
      case 'rgb':
        return { lighting: f.lighting, components: c.map((x) => ({ id: x.id, rgb: x.rgb })) };
      case 'directInputs':
        return c.map((x) => ({
          id: x.id,
          input: x.electrical.input?.kind === 'direct' ? x.electrical.input : null,
          press: x.electrical.press?.kind === 'direct' ? x.electrical.press : null,
        }));
      case 'artifactStatus':
        return p.engineeringFiles.map((f) => ({
          id: f.id,
          compatible: f.dependencyHash === artifactHash(p, f.category, d),
        }));
      case 'toolchain':
        return { qmkCommit: f.qmkCommit, bootloader: f.bootloader };
      case 'layers':
        return f.layers;
      default:
        throw Error('未注册的教程依赖 ' + key);
    }
  }
  function dependency(p, chapter, d = p.working.design) {
    return P.sha256({
      engine: '2.0.0',
      chapterId: chapter.id,
      principles: chapter.principles,
      reference: chapter.referenceBlocks,
      figures: chapter.figures,
      templateSteps: chapter.templateSteps || [],
      inputs: Object.fromEntries(chapter.dependsOn.map((key) => [key, projection(d, p, key)])),
    });
  }
  const artifactDeps = {
    schematic: ['topology', 'matrix', 'gpio', 'controller', 'specs', 'rgb'],
    pcb: ['mechanical', 'topology', 'matrix', 'gpio', 'controller', 'specs', 'rgb'],
    case: ['mechanical'],
    plate: ['mechanical'],
    bom: ['inventory', 'specs', 'rgb', 'controller'],
    firmware: ['topology', 'matrix', 'gpio', 'controller', 'functions', 'oled', 'rgb', 'toolchain'],
    evidence: [
      'geometry',
      'topology',
      'matrix',
      'gpio',
      'controller',
      'functions',
      'oled',
      'rgb',
      'toolchain',
    ],
    other: [
      'identity',
      'geometry',
      'topology',
      'matrix',
      'gpio',
      'controller',
      'functions',
      'oled',
      'rgb',
      'toolchain',
    ],
  };
  function artifactHash(p, category, d = p.working.design) {
    return P.sha256(
      Object.fromEntries(
        (artifactDeps[category] || artifactDeps.other).map((k) => [k, projection(d, p, k)]),
      ),
    );
  }
  function wiringRows(d) {
    const m = d.configuration.matrix,
      rows = [];
    for (const c of d.components) {
      const e = c.electrical,
        v = C.matrixOf(c);
      if (v)
        rows.push([
          c.id + ' 按压',
          v.row === null ? '未分配矩阵' : `r${v.row}c${v.col}`,
          v.row === null ? '待分配' : `行 ${val(m.rowPins[v.row])} / 列 ${val(m.colPins[v.col])}`,
          '按真实二极管方向和通断检查',
        ]);
      for (const input of [e.input, e.press])
        if (input?.kind === 'direct')
          rows.push([
            c.id + ' 直连按压',
            val(input.pin),
            val(input.keycode),
            input.implemented ? '已记录实现；仍需实测按下/释放' : '未实现读取、去抖与释放',
          ]);
      if (e.encoder)
        rows.push([
          c.id + ' 旋转',
          `A ${val(e.encoder.pinA)} / B ${val(e.encoder.pinB)}`,
          '公共端 ' + e.encoder.common,
          `索引 ${val(e.encoder.index)}；每格分辨率 ${e.encoder.resolution}`,
        ]);
      if (e.display)
        rows.push([
          c.id + ' 显示',
          `SDA ${val(e.display.sda)} / SCL ${val(e.display.scl)}`,
          `VCC ${val(e.display.supplyV)} V；GND 共地`,
          `控制器 ${val(e.display.controller)}；地址 ${e.display.address === null ? '待确认' : '0x' + e.display.address.toString(16)}`,
        ]);
    }
    if (d.configuration.lighting.enabled)
      rows.push([
        'RGB 数据链',
        val(d.configuration.lighting.dataPin),
        `${d.configuration.lighting.count} 节点；供电 ${val(d.configuration.lighting.supplyV)} V`,
        '串联 DI→DO，真实料号与总电流待核对',
      ]);
    return rows;
  }
  function geometryRows(d) {
    return d.components.map((c) => [
      c.id + ' ' + c.label,
      kind[c.type],
      `${num(c.geometry.x)}, ${num(c.geometry.y)}`,
      `${num(c.geometry.width)} × ${num(c.geometry.height)}`,
      `${c.geometry.rotation}°`,
      c.geometry.confirmed ? '已记录实测依据' : '草案 未确认',
    ]);
  }
  function bomRows(d) {
    const rows = d.components.map((c) => [
      c.id,
      kind[c.type],
      1,
      val(c.spec.manufacturer),
      val(c.spec.partNumber),
      val(c.spec.footprint),
      c.spec.confirmed ? '已记录规格确认' : '待选型/核对',
    ]);
    rows.unshift([
      'MCU',
      d.configuration.mcu,
      1,
      '待确认',
      '待确认',
      d.configuration.package,
      '供电、USB、时钟外围未自动选型',
    ]);
    rows.push([
      'LED',
      'RGB 灯珠',
      d.configuration.lighting.enabled ? d.configuration.lighting.count : 0,
      '待确认',
      val(d.configuration.lighting.partNumber),
      '待确认',
      '并非完整可采购 BOM',
    ]);
    return rows;
  }
  function matrixRows(d) {
    const m = d.configuration.matrix;
    return Array.from({ length: m.rows }, (_, r) => [
      'r' + r + ' / ' + val(m.rowPins[r]),
      ...Array.from({ length: m.cols }, (_, col) => {
        const found = d.components.filter(
          (c) => C.matrixOf(c)?.row === r && C.matrixOf(c)?.col === col,
        );
        return found.length
          ? found.map((c) => c.id).join(' / ') + (found.length > 1 ? ' 交点冲突' : '')
          : 'KC_NO / 空位';
      }),
    ]);
  }
  function dynamic(n, d, project, analysis) {
    const f = d.configuration,
      m = f.matrix,
      keys = d.components.filter((c) => c.type === 'key'),
      enc = d.components.filter((c) => c.electrical.encoder),
      oled = d.components.filter((c) => c.electrical.display),
      blocks = [],
      steps = [];
    const step = (title, instruction, check) =>
      steps.push({
        id: 's' + String(steps.length + 1).padStart(2, '0'),
        title,
        instruction,
        check,
      });
    switch (n) {
      case 1:
        blocks.push(
          p('当前草案名称：' + d.name),
          p(
            `本教程对应当前 JSON：${keys.length} 个机械轴位、${enc.length} 个旋转输入、${oled.length} 个显示模块；主控 ${f.mcu}，封装 ${f.package}。外壳草案 ${num(d.board.width)} × ${num(d.board.height)} mm，${d.board.confirmed ? '已记录外形确认依据' : '外形尚未实测确认'}。`,
          ),
          p(
            '先完成选型与尺寸核对，再做最小输入测试、PCB 与结构设计、焊接上电、固件联调、装壳验收。可确定的表格来自本次 JSON；未知工程参数保持待确认。',
          ),
          p('设计备注：' + (d.notes || '暂无')),
        );
        step(
          '明确制作边界',
          '本教程是与布局版本绑定的设计与制作指导，当前布局图不是 PCB、外壳加工图或可刷写固件。',
          '核对封面布局版本与 SHA-256。',
        );
        break;
      case 2:
        blocks.push(
          p(
            '章节编号与原 32 页教程相对应。每章包含可复用的原理、当前设计数据、执行步骤、待确认项和独立的人工内容。原始全文可在各章参考区展开；打印时可选择是否包含。',
          ),
        );
        break;
      case 3:
        blocks.push(
          table(
            ['系统项目', '当前设计'],
            [
              ['主控', `${f.mcu} / ${f.package} / ${f.clockHz} Hz`],
              [
                '矩阵',
                `${m.rows} 行 × ${m.cols} 列，已分配 ${analysis.summary.matrixAssigned} 个交点`,
              ],
              ['旋转输入', enc.map((c) => c.id).join('、') || '无'],
              ['显示模块', oled.map((c) => c.id).join('、') || '无'],
              [
                '灯光',
                f.lighting.enabled
                  ? `${f.lighting.count} 节点，数据 ${val(f.lighting.dataPin)}`
                  : '关闭',
              ],
            ],
          ),
        );
        step(
          '沿信号路径理解系统',
          '按键/编码器→主控读取→QMK→USB HID→电脑；屏幕和灯光是输出分支。',
          '能分别说明旋转、按压、层切换的作用。',
        );
        break;
      case 4:
        step(
          '原附件保留作参考',
          '复制到自己的工程后再修改；用明确的 PCB/CAD/QMK 源文件承接布局 JSON。不要把 STL 或 Gerber 误当完整可编辑源工程。',
          '给工程文件登记类别、版本和关联布局。',
        );
        break;
      case 5:
        blocks.push(
          p(
            `当前方案使用 ${f.mcu}，有 ${keys.length} 个机械轴位和 ${enc.length} 个旋转输入。先练习与所选封装相匹配的焊接；下载器与工具链由真实主控和引导器决定。`,
          ),
        );
        step(
          '准备工具与练习板',
          '准备温控焊台、助焊剂、吸锡带、放大观察、万用表、可靠数据线和相容下载器。',
          '断电练习能完成小阻容和目标封装，不以整板作首次练习。',
        );
        step(
          '先做最小输入',
          '可先在明确受 QMK 支持的开发板上接一键或 2×2 矩阵，验证按下与释放。',
          '记录板型、电压、引脚和工具链版本。',
        );
        break;
      case 6:
        blocks.push(
          p(
            '下表只统计布局中明确记录的器件与轴位，不自动虚构电源、USB、时钟、去耦、连接器和阻容规格。键帽、轴座、灯珠、螺丝、隔柱须在完整 BOM 中分项核对。',
          ),
          table(['ID', '类别', '数量', '厂家', '准确型号', '封装/图纸', '状态'], bomRows(d)),
        );
        step(
          '补齐可采购 BOM',
          '逐项补厂家、型号、封装、额定电压、数量及采购替代关系；原附件电阻阻值与料号冲突不能沿用。',
          '未确认项全部有负责人或待办；本表不能直接下单。',
        );
        break;
      case 7:
        blocks.push(
          p(
            '下面的原项目问题不会因布局未变而自动消失；更换主控或电源架构后，应按新的方案重新审查。',
          ),
          ...C.sourceContext().knownIssues.map(p),
        );
        step(
          '审查扫描方向',
          '当前声明 ' +
            m.diodeDirection +
            '，' +
            (m.directionVerified
              ? '已记录验证状态；仍应保留实测记录。'
              : '尚未验证。先断电核对二极管阴极与行列连通。'),
          '实测方向与最终固件相符。',
        );
        step(
          '审查供电与时钟',
          '确认主控 VCC/AVCC/UVCC、UCAP、时钟、USB、保护与电平；不根据名为 +5V 的网推断真实电压。',
          '有修订原理图与测量依据，不凭本教程推定电源已通过。',
        );
        break;
      case 8:
        blocks.push(
          p(
            `外壳草案：宽 ${num(d.board.width)} mm，高 ${num(d.board.height)} mm，圆角 ${num(d.board.cornerRadius)} mm，最小二维净距 ${num(d.board.minimumGap)} mm。来源：${d.board.source}`,
          ),
          table(
            ['组件', '类别', '中心 X Y mm', '外包络 宽高 mm', '旋转', '尺寸状态'],
            geometryRows(d),
          ),
        );
        step(
          '确认真实机械尺寸',
          '核对每个器件的安装孔、板厚、焊盘、顶部高度、插头与转盘操作净空；坐标使用中心点，X 向右、Y 向下。',
          '按厂家图纸或实物记录尺寸来源，不能以占位尺寸直接加工。',
        );
        step(
          '验证布局变化',
          '只移动位置时保留组件 ID、网络、矩阵和键码；在 PCB/CAD 中更新位置、孔位和必要的局部走线。',
          '纸样或样板触达检查、二维碰撞与三维干涉均完成。',
        );
        break;
      case 9:
        blocks.push(
          p(
            `当前矩阵为 ${m.rows}×${m.cols}，容量 ${m.rows * m.cols}。声明 ${m.diodeDirection}，验证状态：${m.directionVerified ? '已记录确认' : '待实测'}。`,
          ),
          table(
            [
              '逻辑行',
              ...Array.from({ length: m.cols }, (_, i) => 'c' + i + ' / ' + val(m.colPins[i])),
            ],
            matrixRows(d),
          ),
        );
        step(
          '建立逻辑输入表',
          '把实体 ID 对到行列交点；新增键先评估空位，不自动增加 GPIO。空交点不代表 PCB 已有焊盘。',
          '没有重复交点，未分配输入明确标注。',
        );
        step(
          '断电检查二极管',
          '按原理图和实际焊接共同确定 COL2ROW 或 ROW2COL，不盲抄原配置。',
          '单键和矩形角多键测试无鬼键。',
        );
        break;
      case 10:
        blocks.push(
          table(['输入或外设', '逻辑位置/信号', '端口或供电记录', '需要验证'], wiringRows(d)),
        );
        step(
          '核对端口命名与资源',
          '端口名来自芯片端口，不等同开发板丝印。更换封装或 MCU 时重新核对物理脚号、复用功能与电平。',
          '无重复 GPIO、无未分配信号；真实脚号记录在原理图。',
        );
        break;
      case 11:
        blocks.push(
          p(
            `本次目标主控为 ${f.mcu}，时钟声明 ${f.clockHz} Hz。按第 10 章当前信号表更新网络；PCB/CAD 的电源、USB、时钟与保护网络不能由布局几何自动确定。`,
          ),
        );
        step(
          '分模块画原理图',
          '依次画供电与 USB、主控最小系统、矩阵、编码器、显示与灯链，再加连接器和下载接口。',
          '完成 ERC 并逐条解释警告，电源与未知参数无臆造。',
        );
        step(
          '判断是否需要改线',
          '仅位置变化可保留逻辑网络；改变引脚、输入类型或 MCU 才同步受影响的电气连接。',
          '有网络差异说明，而不是无差别重画全部电路。',
        );
        break;
      case 12:
        blocks.push(
          p(
            '把当前布局中心、角度与外包络当作机械约束导入参考；依据真实封装建立焊盘与安装孔。外壳轮廓变了只表示需验证 PCB 能否装入，不直接等于 PCB 板边必须变化。',
          ),
        );
        step(
          '更新 PCB 摆放与局部布线',
          '按稳定 ID 搬动相应封装，保留不受影响网络，处理局部走线和地回流。',
          '机械图叠合，USB/时钟/去耦与供电线宽检查。',
        );
        step(
          '检查加工输出',
          '运行 DRC，独立打开最终 Gerber/钻孔/外形；逐项核对板厚、孔位、比例与定位结构。',
          '登记关联本布局的 PCB 源工程与制造输出；未登记不声称已有文件。',
        );
        break;
      case 13:
        blocks.push(
          p(
            `当前外壳草案 ${num(d.board.width)}×${num(d.board.height)} mm。具体板厚、轴孔/卡扣、屏幕窗、编码器安装高度、螺丝长度与公差，均不能由二维布局推断。`,
          ),
        );
        step(
          '更新定位板与外壳',
          '更新被移动或新增组件对应的孔位和窗口；保留兼容的其余结构。',
          '已按真实机械图核对轴座、屏幕、旋钮、线材与插头净空。',
        );
        step(
          '先做试片',
          '打印或加工一小段孔位/卡扣，验证尺寸、缩放、收缩与材料。',
          '切片方向、支撑与配合间隙有实测记录。',
        );
        break;
      case 14:
        step(
          '按低到高的顺序焊接',
          '先阻容与二极管，再主控、USB、电源与时钟，最后高的轴座、编码器与接口；实际顺序按当前 BOM 和器件工艺复核。',
          '断电，方向正确，无桥连、翘脚与明显虚焊。',
        );
        step(
          '逐模块检查',
          '每焊完一模块，放大观察并结合原理图测连通与电源地。',
          '不是单凭蜂鸣判断，保留返修前后照片和测量。',
        );
        break;
      case 15:
        step(
          '断电预检',
          '拔 USB/ISP，检查供电与地、电源极性、相邻脚桥连、复位和时钟；电容充电造成的瞬间蜂鸣不能直接判短路。',
          '供电路径已审查，未依赖尚未确认的电源数值。',
        );
        step(
          '最小负载首次上电',
          '先不接屏幕，关闭灯光；确认下载器与 USB 是否同时供电，使用合适限流并记录 VBUS、主控供电、RESET、UCAP 和电流。',
          '异常发热或电压异常立即断电；电源稳定后才排软件。',
        );
        break;
      case 16:
        blocks.push(
          p(
            `当前记录的引导程序：${val(f.bootloader)}；QMK 提交：${val(f.qmkCommit)}。没有这些记录时不能自动给出熔丝或刷写命令的确定参数。`,
          ),
        );
        step(
          '先识别引导方式',
          '确认裸片/开发板是否带引导器，读取签名和现有设置；按真实连接器网名逐线核对 ISP，不按外观猜排针顺序。',
          '记录引导器来源、时钟源与引导区设置；没有编造熔丝数值。',
        );
        step(
          '写后校验与 USB 验证',
          '只在正确电压、编程器和已审定方案下写入并读回校验，再断开 ISP 验证 USB 引导模式。',
          '连接方式与固件工具一致。',
        );
        break;
      case 17:
        blocks.push(
          p(
            `目标 MCU：${f.mcu}；引导器：${val(f.bootloader)}；QMK 版本/提交：${val(f.qmkCommit)}。固定这些信息后再迁移旧键盘定义。`,
          ),
          code('qmk doctor\n# Use your actual keyboard definition and keymap name.'),
        );
        step(
          '准备兼容工具链',
          '按固定版本的官方说明准备环境，先构建已知可用示例验证工具链，再适配本项目。',
          '构建日志无未解决关键依赖错误。',
        );
        step(
          '保留可复现记录',
          '保存完整仓库提交、键盘路径、键位名、MCU 和引导器信息。',
          '不依赖一份脱离源码的 HEX。',
        );
        break;
      case 18: {
        const lines = [`#define MATRIX_ROWS ${m.rows}`, `#define MATRIX_COLS ${m.cols}`];
        if (m.rowPins.every(Boolean) && m.colPins.every(Boolean))
          lines.push(
            `#define MATRIX_ROW_PINS { ${m.rowPins.join(', ')} }`,
            `#define MATRIX_COL_PINS { ${m.colPins.join(', ')} }`,
          );
        else lines.push('// Matrix GPIO assignment incomplete.');
        lines.push(
          m.directionVerified
            ? `#define DIODE_DIRECTION ${m.diodeDirection}`
            : `// DIODE_DIRECTION pending physical verification; declared ${m.diodeDirection}`,
        );
        blocks.push(
          p(
            '以下仅为从 JSON 提取的配置片段，不是完整、已编译的 QMK 工程。布局定义、元数据、驱动与引导器须按固定版本补齐。',
          ),
          code(lines.join('\n')),
          table(
            ['配置', '当前记录'],
            [
              ['MCU / 封装', f.mcu + ' / ' + f.package],
              ['时钟', f.clockHz + ' Hz'],
              ['QMK 提交', val(f.qmkCommit)],
              ['引导器', val(f.bootloader)],
              ['显示模块', oled.length],
              ['RGB', f.lighting.enabled ? f.lighting.count + ' 节点' : '关闭'],
            ],
          ),
        );
        step(
          '按固定版本迁移接口',
          '核对 OLED、encoder 回调、RGB 参数名、LAYOUT 元数据和键码；不把老源码复制成功等同于已适配。',
          '配置片段与真实网表一致，未知项未伪造。',
        );
        break;
      }
      case 19:
        blocks.push(
          table(
            ['ID', '矩阵/直连', ...f.layers.map((v, i) => i + ' ' + v)],
            d.components
              .filter((c) => c.type === 'key' || c.electrical.press?.kind === 'matrix')
              .map((c) => {
                const v = C.matrixOf(c);
                return [
                  c.id,
                  v?.row === null ? '未分配' : v ? `r${v.row}c${v.col}` : '直连',
                  ...f.layers.map((_, i) => c.keycodes[i] || '未定义'),
                ];
              }),
          ),
        );
        step(
          '按 ID 保留功能关系',
          '物理位置变化后，原矩阵和键码可以保留；只在有意改变接线或行为时修改相应映射。',
          '没有重复交点、未分配输入，空位使用 KC_NO。',
        );
        step(
          '检查层返回与特殊输入',
          '逐层检查切换入口、返回基础层的路径和编码器按压。',
          '没有因删键而失去唯一切层或返回入口。',
        );
        break;
      case 20:
        blocks.push(
          p(
            '当前四层名称：' +
              f.layers.map((s, i) => i + ' ' + s).join(' / ') +
              '。键码以第 19 章为准；快捷键语义由目标软件、焦点和键盘布局共同决定。',
          ),
        );
        step(
          '先用普通键盘验证目标快捷键',
          '确认应用里目标操作的真实绑定，再修改对应 ID 的键码。',
          '文本测试与目标应用测试均通过；修饰键没有粘住。',
        );
        break;
      case 21:
        blocks.push(
          enc.length
            ? table(
                ['ID', '索引', 'A / B', '每格', '顺时针 / 逆时针', '按压'],
                enc.map((c) => {
                  const e = c.electrical.encoder,
                    v = C.matrixOf(c),
                    press = c.electrical.press;
                  return [
                    c.id,
                    val(e.index),
                    `${val(e.pinA)} / ${val(e.pinB)}`,
                    e.resolution,
                    `${e.cw} / ${e.ccw}`,
                    v
                      ? v.row === null
                        ? '矩阵待分配'
                        : `r${v.row}c${v.col}`
                      : press?.kind === 'direct'
                        ? `${val(press.pin)}：${press.implemented ? '记录为已实现' : '未实现'}`
                        : '无按压',
                  ];
                }),
              )
            : p('当前没有旋转输入，本章不要求安装编码器。'),
        );
        step(
          '分别测试旋转和按压',
          'A/B 用于方向，公共端接地；按压按第 10 章的矩阵或直连记录独立处理。未实现直连输入时，补读脚、去抖、按下与松开。',
          '慢转、快转和反转方向正确；索引、分辨率和按压释放均实测。',
        );
        break;
      case 22:
        blocks.push(
          oled.length
            ? table(
                ['ID', '控制器', '像素', 'SDA / SCL', '地址', '供电', '图像旋转'],
                oled.map((c) => {
                  const v = c.electrical.display;
                  return [
                    c.id,
                    val(v.controller),
                    v.resolution.join('×'),
                    `${val(v.sda)} / ${val(v.scl)}`,
                    v.address === null ? '待确认' : '0x' + v.address.toString(16),
                    val(v.supplyV) + ' V',
                    v.rotation + '°',
                  ];
                }),
              )
            : p('当前没有 OLED，本章无显示模块的安装与驱动步骤。'),
        );
        step(
          '按信号名接线',
          '显示模块须核对控制器、额定电压、I²C 地址、上拉电平和排针顺序；不能因为是 128×64 就默认相同模块。',
          '共地、信号顺序和电压有依据，断电接插。',
        );
        step(
          '从固定文字到层显示',
          '先显示固定文字，再显示当前层，最后加图标。无显示模块时跳过，不保留无用驱动。',
          '黑屏先排电源/通信，再排位图与休眠。',
        );
        break;
      case 23:
        blocks.push(
          oled.length
            ? table(
                ['显示 ID', '整屏字节数按 1 bit 计算', '层名称'],
                oled.map((c) => [
                  c.id,
                  Math.ceil(
                    (c.electrical.display.resolution[0] * c.electrical.display.resolution[1]) / 8,
                  ),
                  f.layers.join(' / '),
                ]),
              )
            : p('当前未配置显示，原图标仅作历史参考。'),
        );
        step(
          '按实际分辨率导出单色位图',
          '确认页布局、位序、极性和驱动；先用单点/横线测试，再输出完整图。原图标不自动缩放到不同分辨率。',
          '字节数和方向相符，切层无残影。',
        );
        break;
      case 24:
        blocks.push(
          table(
            ['灯链参数', '当前记录'],
            [
              ['启用', f.lighting.enabled ? '是' : '否'],
              ['节点数', f.lighting.count],
              ['数据端口', val(f.lighting.dataPin)],
              ['准确型号', val(f.lighting.partNumber)],
              ['额定供电', val(f.lighting.supplyV) + ' V'],
              ['组件 RGB 标记数量', d.components.filter((c) => c.rgb).length],
            ],
          ),
          p(
            '总电流上限、USB 枚举/挂起电流、线宽和保险丝必须依实际灯珠与供电方案核算；不把所有灯珠按一个猜测电流套用。',
          ),
        );
        step(
          '核对灯链和数量',
          'V/G 接电源地，主控只接第一颗 DI，DO 再接下一颗 DI。无灯光时关闭相关驱动。',
          '数量、方向、数据脚、额定电压与实际焊接一致。',
        );
        step(
          '低亮度联调',
          '先低亮单色，再按红绿蓝检查；逐步记录电流、电压和是否重启。',
          '限亮度不能替代电源设计与 USB 电流管理。',
        );
        break;
      case 25:
        blocks.push(
          p(
            `本版本 MCU ${f.mcu}；引导器 ${val(f.bootloader)}；QMK 提交 ${val(f.qmkCommit)}。键盘定义路径和键位名称尚未在布局格式中指定，命令保留占位。`,
          ),
          code(
            'qmk compile -kb <your-keyboard> -km <your-keymap>\n# Flash only after build, bootloader and hardware checks.',
          ),
        );
        step(
          '先构建后写入',
          '确认定义可识别、警告已处理、应用区大小与实际引导区一致；不凭旧 4096 字节假设确定空间。',
          '有对应本布局的源码、构建日志和固件校验。',
        );
        step(
          '分阶段联调',
          '一键→完整矩阵→编码器→显示→灯光，每次只改一项。',
          'USB 枚举、按下与释放、各层输出可靠；失败可返回最后工作版本。',
        );
        break;
      case 26:
        blocks.push(
          p(
            `本次需装配 ${keys.length} 个机械轴位、${enc.length} 个旋转组件和 ${oled.length} 个显示模块。装壳前先按当前布局与真实器件干装，不按原照片推断新孔位。`,
          ),
        );
        step(
          '壳外全功能测试',
          '先完成裸板验证，再干装外壳、定位板、PCB、屏幕与旋转组件。',
          '无顶板、挤线、挡 USB/复位或常按状态。',
        );
        step(
          '逐项装配并复测',
          '支撑热插拔座，轴脚对准后垂直压入；固定屏幕与线材，均匀紧固螺丝。',
          '装一个测一个，最后检查全部输入与壳内绝缘。',
        );
        break;
      case 27:
        blocks.push(
          table(
            ['验收对象', '当前范围', '方法'],
            [
              ['USB', '目标 ' + f.mcu, '反复重连与复位，记录枚举与电流'],
              [
                '矩阵',
                analysis.summary.matrixAssigned + ' 个已分配交点',
                '逐个按下/释放、矩形角多键测试',
              ],
              ['旋转', enc.map((c) => c.id).join('、') || '无', '慢转/快转/反转，按压单独测试'],
              [
                '显示',
                oled.map((c) => c.id).join('、') || '无',
                '文字、图标、切层、方向、休眠与唤醒',
              ],
              [
                'RGB',
                f.lighting.enabled ? f.lighting.count + ' 节点' : '关闭',
                '低亮红绿蓝、全链路、电压与电流',
              ],
              [
                '机械',
                num(d.board.width) + '×' + num(d.board.height) + ' mm 草案',
                '轴程、旋转、按压、插头和装壳干涉',
              ],
            ],
          ),
        );
        step(
          '按当前版本记录测试',
          '测试报告要记布局版本、设计哈希、固件提交、工程文件修订、操作、预期、实测与复现次数。',
          '标记步骤完成不代替测量证据；设计变化后相关已完成步骤需复查。',
        );
        step(
          '壳内壳外各验收一次',
          '功能和供电通过后再做长时间使用，观察断连、随机复位和温升。',
          '未确认电路或尺寸不因软件检查无冲突而自动通过。',
        );
        break;
      case 28:
        step(
          '先找共同部分再测量',
          '整行故障先查行线，后半灯链故障先查第一个异常节点；先缩小范围再返修。',
          '断电测阻值/通断；有电测量时避免探针短接。',
        );
        break;
      case 29:
        step(
          '用最小功能排查',
          '固定一键、固定文字、低亮纯色；每次只改变一个配置，保存日志和最后可用版本。',
          '区分构建、引导、硬件与应用焦点问题。',
        );
        break;
      case 30:
        step(
          '继续迭代并复用章节',
          '每次修改布局只重建相关章节；原理、工具和排错知识继续复用。',
          '保存布局快照和完整项目，人工内容保留且过期时提示复核。',
        );
        break;
      case 31:
        blocks.push(
          project.engineeringFiles.length
            ? table(
                ['文件', '类别 / 修订', '关联布局', '内容', '确认状态'],
                project.engineeringFiles.map((f) => [
                  f.name,
                  f.category + ' / ' + f.revision,
                  f.layoutVersionId,
                  f.contentBase64 ? '已内嵌，SHA-256 可校验' : '仅登记，交付时仍需提供',
                  f.confirmed
                    ? f.dependencyHash === artifactHash(project, f.category, d)
                      ? '人工确认且依赖一致'
                      : '设计依赖变化，需复核'
                    : '未确认',
                ]),
              )
            : p(
                '尚未登记工程文件。可在工程交付页加入 PCB/CAD/QMK/BOM/测试记录；工具不会自动伪造这些文件。',
              ),
        );
        step(
          '登记与版本关联',
          '把工程源文件、加工输出、固件、BOM 和测试证据关联到明确布局版本。已登记文件变旧时保留历史并重新确认相容性。',
          '交付清单同时说明缺失文件、未确认项和设计草案边界。',
        );
        break;
      case 32:
        break;
    }
    return { blocks, steps };
  }
  function relevantIssues(ch, report) {
    const map = {
      geometry: ['OUTSIDE', 'EDGE_GAP', 'COLLISION', 'CLEARANCE', 'DIMENSIONS', 'BOARD_DIMENSION'],
      mechanical: ['OUTSIDE', 'EDGE_GAP', 'COLLISION', 'CLEARANCE', 'DIMENSIONS', 'SPECS'],
      matrix: ['MATRIX_UNASSIGNED', 'MATRIX_DUPLICATE', 'DIODE_DIRECTION'],
      gpio: ['GPIO_UNASSIGNED', 'GPIO_CONFLICT', 'MCU_PIN', 'I2C_PINS'],
      controller: ['NEW_MCU'],
      toolchain: ['QMK_VERSION'],
      specs: ['SPECS'],
      encoderSpecs: ['SPECS'],
      displaySpecs: ['OLED_SPEC', 'SPECS'],
      encoders: ['ENCODER_INDEX', 'ENCODER_SEQUENCE', 'INPUT_NOT_IMPLEMENTED', 'GPIO_UNASSIGNED'],
      oled: ['OLED_SPEC', 'I2C_ADDRESS', 'I2C_PINS'],
      rgb: ['RGB_COUNT', 'RGB_SPEC'],
    };
    const accepted = new Set(ch.dependsOn.flatMap((k) => map[k] || []));
    return report.issues.filter((i) => accepted.has(i.code));
  }
  function build(project, previous = null, layoutVersionId = null) {
    const d = project.working.design,
      errors = C.validateDesign(d);
    if (errors.length) throw Error(errors.join('\n'));
    const report = C.analyze(d),
      old = new Map((previous?.chapters || []).map((c) => [c.id, c]));
    let reused = 0;
    const chapters = project.library.chapters.map((ch) => {
      const depHash = dependency(project, ch),
        issues = relevantIssues(ch, report),
        note = project.notes[ch.id] || null,
        checks = Object.fromEntries(
          Object.entries(project.stepChecks).filter(([k]) => k.startsWith(ch.id + '/')),
        ),
        draft = project.editorDrafts[ch.id] || null,
        cacheKey = P.sha256({ depHash, issues, note, checks, draft }),
        prev = old.get(ch.id);
      if (prev?.cacheKey === cacheKey) {
        reused++;
        return prev;
      }
      const current = dynamic(ch.sourcePage, d, project, report),
        steps = [...current.steps, ...(ch.templateSteps || [])].map((s) => {
          const c = checks[ch.id + '/' + s.id];
          return {
            ...s,
            record: c || null,
            effectiveStatus: c
              ? c.dependencyHash === depHash
                ? c.status
                : 'needs-review'
              : 'todo',
          };
        });
      const manual = note
        ? {
            ...cl(note),
            effectiveStatus:
              note.dependencyHash !== depHash
                ? 'needs-review'
                : note.confirmed
                  ? 'confirmed'
                  : 'draft',
          }
        : null;
      const module = {
        id: ch.id,
        title: ch.title,
        sourcePage: ch.sourcePage,
        dependsOn: cl(ch.dependsOn),
        dependencyHash: depHash,
        cacheKey,
        principles: cl(ch.principles),
        generated: current.blocks,
        steps,
        issues: cl(issues),
        figures: cl(ch.figures),
        referenceBlocks: cl(ch.referenceBlocks),
        manual,
        editorDraft: !!draft,
        domainTasks: [],
        engineeringDomains: cl(ch.domains),
        changedInputs: ch.dependsOn.filter(
          (key) =>
            P.canonical(projection(d, project, key)) !==
            P.canonical(projection(C.baseline(), project, key)),
        ),
      };
      module.contentHash = P.sha256(module);
      return module;
    });
    const hash = P.hashDesign(d),
      v = project.layoutVersions.find((v) => v.designHash === hash),
      model = {
        kind: 'keyboard-diy-tutorial',
        schemaVersion: '2.0.0',
        templateVersion: '2.0.0',
        projectId: project.id,
        projectName: project.name,
        layoutVersionId: layoutVersionId || v?.id || '未保存工作区',
        designHash: hash,
        libraryVersion: project.library.version,
        sourcePdf: project.library.sourcePdf,
        sourcePdfSha256: project.library.sourcePdfSha256,
        assetHashes: Object.fromEntries(
          Object.entries(project.library.assets).map(([k, v]) => [k, v.sha256]),
        ),
        layout: cl(d),
        summary: cl(report.summary),
        chapters,
        knownIssues: cl(report.knownBaselineIssues),
      };
    return { model, reused, changed: chapters.length - reused };
  }
  function saveTutorial(project) {
    if (project.tutorialVersions.length >= 100)
      throw Error('教程版本已达 100 个；请先导出完整项目后另存，不会删除历史。');
    const v = P.saveLayout(project),
      model = build(project, null, v.id).model,
      contentHash = P.sha256(model),
      existing = project.tutorialVersions.find((t) => t.contentHash === contentHash);
    if (existing) return existing;
    const rec = {
      id: 'T' + String(project.tutorialVersions.length + 1).padStart(3, '0'),
      layoutVersionId: v.id,
      designHash: v.designHash,
      contentHash,
      createdAt: P.stamp(),
      model: cl(model),
    };
    project.tutorialVersions.push(rec);
    P.touch(project, 'save-tutorial', rec.id);
    return rec;
  }
  function layoutSvg(d) {
    const bb = d.components.map(C.bounds),
      left = Math.min(0, ...bb.map((b) => b.left)) - 10,
      top = Math.min(0, ...bb.map((b) => b.top)) - 10,
      right = Math.max(d.board.width, ...bb.map((b) => b.right)) + 10,
      bottom = Math.max(d.board.height, ...bb.map((b) => b.bottom)) + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${right - left} ${bottom - top}" role="img" aria-label="当前布局图，单位毫米"><rect width="${d.board.width}" height="${d.board.height}" rx="${d.board.cornerRadius}" fill="#f3f7f7" stroke="#5e8291" stroke-width=".4"/>${d.components
      .map((c) => {
        const g = c.geometry,
          shape = C.circular(c)
            ? `<circle r="${g.width / 2}"/>`
            : `<rect x="${-g.width / 2}" y="${-g.height / 2}" width="${g.width}" height="${g.height}" rx="1"/>`;
        return `<g transform="translate(${g.x} ${g.y}) rotate(${g.rotation})" fill="${c.type === 'key' ? '#d6ebe1' : c.type === 'oled' ? '#dcecf3' : '#dce3f1'}" stroke="#6f8e9b" stroke-width=".35">${shape}<text stroke="none" fill="#203e4c" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(0.7, Math.min(2.5, g.width / Math.max(c.id.length, 5)))}">${esc(c.id)}</text></g>`;
      })
      .join(
        '',
      )}<text x="${d.board.width / 2}" y="-4" text-anchor="middle" fill="#416471" font-size="2.5">外壳草案 ${num(d.board.width)} × ${num(d.board.height)} mm</text></svg>`;
  }
  function inline(text) {
    let last = 0,
      res = '';
    const re = /<a href="(https:\/\/[^"<>]+)">([^<>]*)<\/a>/g;
    for (const m of String(text).matchAll(re)) {
      res +=
        esc(String(text).slice(last, m.index)) +
        `<a href="${esc(m[1])}" rel="noreferrer">${esc(m[2])}</a>`;
      last = m.index + m[0].length;
    }
    return (res + esc(String(text).slice(last))).replace(/\n/g, '<br>');
  }
  function blockHtmlBase(b, library, model, scope = '') {
    if (b[0] === 'fig') {
      const a = library.assets[b[1]],
        ok = a && a.sha256 === model.assetHashes[b[1]];
      return ok
        ? `<figure class="reference-figure"><img src="${a.dataUri}" alt="${esc(b[2])}"><figcaption>原教程参考图 · ${esc(b[2])}。展示原项目，不是当前设计的加工图。</figcaption></figure>`
        : `<p class="warning">图片资源缺失或哈希不匹配：${esc(b[1])}，未用其他图片替代。</p>`;
    }
    if (b[0] === 'table')
      return `<div class="table-wrap"><table><thead><tr>${b[1].map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${b[2].map((row) => `<tr>${row.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    if (b[0] === 'code') return `<pre><code>${esc(b[1])}</code></pre>`;
    if (b[0] === 'h') return `<h4>${esc(b[1])}</h4>`;
    return `<p${b[0] === 'small' ? ' class="small"' : ''}>${inline(b[1])}</p>`;
  }
  function blockHtml(b, library, model, scope = '') {
    if (b[0] === 'table' && b[1].length > 8) {
      let html = '';
      for (let start = 1; start < b[1].length; start += 7) {
        const indices = [
          0,
          ...Array.from({ length: Math.min(7, b[1].length - start) }, (_, i) => start + i),
        ];
        html += blockHtmlBase(
          ['table', indices.map((i) => b[1][i]), b[2].map((row) => indices.map((i) => row[i]))],
          library,
          model,
          scope,
        );
      }
      return html;
    }
    return blockHtmlBase(b, library, model, scope);
  }
  const CSS = `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:#20333c;background:#eff3f4;font:15px/1.8 system-ui,"Microsoft YaHei",sans-serif}.print-tools{position:sticky;top:0;padding:10px 18px;background:#193b4a;color:white;display:flex;gap:10px;align-items:center;z-index:2;flex-wrap:wrap}.print-tools button{padding:6px 14px;background:#d6eee5;border:0;border-radius:5px;cursor:pointer}.print-tools label{font-size:12px}.document{max-width:960px;margin:24px auto;background:white;padding:42px 52px;box-shadow:0 3px 24px #173c4b12}h1{font-size:27px;line-height:1.4;color:black}h2{font-size:22px;color:black;line-height:1.5;margin:0 0 14px}h3{font-size:17px;color:black;margin:24px 0 8px}h4{font-size:15px;color:black;margin:15px 0 6px}p{margin:10px 0;overflow-wrap:anywhere}.small,.meta{font-size:12px;color:#5e717b}.meta code{word-break:break-all}.warning{background:#fff4e4;border-left:3px solid #d5a057;padding:10px;font-size:13px}.critical{background:#fff0f0;border-color:#c95d68}.tag{display:inline-block;padding:2px 7px;border-radius:5px;font-size:11px;background:#e9f3f1;color:#316b61;margin-right:6px}.tag.stale{background:#fff1df;color:#8d5c1e}.tag.confirmed{background:#e3f1e7;color:#2b6943}.toc{columns:2;column-gap:24px;font-size:13px;line-height:1.9;padding:12px 0}.toc a{display:block;break-inside:avoid;color:#315e70;text-decoration:none}.chapter{margin-top:48px;padding-top:18px;border-top:1px solid #d9e3e7;scroll-margin-top:70px}.dependency{font-size:11px;color:#70838b;overflow-wrap:anywhere}.table-wrap{overflow:auto;margin:14px 0}table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.6;table-layout:auto}th,td{padding:8px;border:1px solid #d9d9d9;text-align:left;vertical-align:middle;overflow-wrap:anywhere}thead{background:#e8eff3;display:table-header-group}tr{break-inside:avoid}figure{margin:18px 0;text-align:center}figure img{max-width:100%;max-height:300px;object-fit:contain}figcaption{font-size:11px;color:#6b7c85;text-align:left;line-height:1.6;margin-top:7px}.current-layout svg{display:block;width:100%;height:360px}pre{background:#f3f6f7;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.65 Consolas,monospace;break-inside:avoid}.step{margin:13px 0;padding:10px 0;border-bottom:1px solid #e6ecef;break-inside:avoid}.step strong{font-size:14px}.step p{font-size:13px}.principle{font-size:14px}.manual{margin:18px 0;border:1px solid #c8ddd4;padding:12px;border-radius:5px}.manual .text{white-space:pre-wrap;font-size:14px;overflow-wrap:anywhere}.reference{margin:18px 0;font-size:12px;color:#5b707c}.reference summary{cursor:pointer;color:#476d80}.reference[open]{padding:12px;background:#f7f9fa}.reference .original{padding-top:10px}.reference .original figure{display:none}a{color:#216477}.cover{padding-bottom:20px}.cover .warning{font-size:14px}.signature{font-size:11px;color:#687a84;margin-top:30px}.source-summary{font-size:12px;color:#657883}.change-list{font-size:12px}body.show-original .reference{display:block}.pending{font-size:13px;margin:2px 0;padding-left:20px} @media(max-width:650px){.document{padding:23px 18px;margin:0}.toc{columns:1}h1{font-size:23px}.current-layout svg{height:310px}table{font-size:11px}th,td{padding:5px}}@page{size:A4;margin:16mm 14mm 17mm}@media print{html{scroll-behavior:auto}body{background:white;font-size:10pt;line-height:1.65}.print-tools{display:none}.document{width:auto;max-width:none;margin:0;padding:0;box-shadow:none}h1{font-size:22pt}h2{font-size:17pt;break-after:avoid}h3,h4{break-after:avoid}p{widows:3;orphans:3}.chapter{break-before:auto;margin-top:9mm;padding-top:4mm;border-top:.25mm solid #d9e3e7}.cover{break-after:page}.toc{columns:2}.reference{display:none!important}body.show-original .reference{display:block!important}.reference .original{display:block!important}.table-wrap{overflow:visible}table{font-size:8pt}th,td{padding:5px}.current-layout svg{height:90mm;max-width:170mm;margin:auto}figure img{max-height:65mm;max-width:170mm}figure{break-inside:avoid}pre{font-size:8pt}.step{padding:6px 0}.warning{font-size:9pt}.manual{break-inside:avoid}a{color:black;text-decoration:none}.dependency{font-size:7pt;break-after:avoid}thead{break-after:avoid}tbody tr:first-child{break-after:avoid}details>summary{list-style:none}}`;
  function render(model, library, record = null) {
    const draw = (b) => blockHtml(b, library, model),
      chapterHtml = model.chapters
        .map(
          (ch) =>
            `<section class="chapter" id="${esc(ch.id)}" data-content-hash="${ch.contentHash}"><h2>${ch.sourcePage} ${esc(ch.title)}</h2><div class="dependency">依赖：${esc(ch.dependsOn.join(' / ') || '固定知识')} · 章节版本 ${ch.contentHash.slice(0, 12)}</div>${ch.changedInputs?.length ? '<p class="warning">本章已按当前 JSON 同步。' + (ch.engineeringDomains?.length ? '关联工程 ' + ch.engineeringDomains.map(esc).join(' / ') + ' 的变更仍需落实到真实工程并验证。' : '仍需按本章检查条件确认。') + ' 自动更新不会把待确认参数视为已通过。</p>' : ''}${ch.id === 'ch08' ? `<figure class="current-layout">${layoutSvg(model.layout)}<figcaption>当前 JSON 的二维布局草案，单位 mm；不含真实焊盘、轴孔、器件高度与加工公差。</figcaption></figure>` : ''}${ch.generated.map(draw).join('')}${
              ch.domainTasks.some((t) => t.status !== 'unchanged')
                ? `<h3>本设计的工程处理</h3>${ch.domainTasks
                    .filter((t) => t.status !== 'unchanged')
                    .map(
                      (t) =>
                        `<p class="change-list"><b>${esc(t.label)} · ${knownStatus[t.status]}</b>：${t.steps.map(esc).join(' ')}</p>`,
                    )
                    .join('')}`
                : ''
            }${ch.issues.length ? `<h3>需要人工确认或重新设计</h3><div class="warning"><ul class="pending">${ch.issues.map((i) => `<li class="${i.severity === 'error' ? 'critical' : ''}">${esc(i.message)}</li>`).join('')}</ul></div>` : ''}${ch.principles.length ? `<h3>原理与操作说明</h3><div class="principle">${ch.principles.map(draw).join('')}</div>` : ''}${ch.figures.map(draw).join('')}${ch.steps.length ? `<h3>制作步骤与完成条件</h3>${ch.steps.map((s) => `<div class="step" data-step="${esc(ch.id + '/' + s.id)}"><strong>${esc(s.id)} ${esc(s.title)}</strong><span class="tag ${s.effectiveStatus === 'needs-review' ? 'stale' : ''}">${{ todo: '未完成', done: '已记录完成', blocked: '受阻', 'needs-review': '设计已变 需要复查' }[s.effectiveStatus]}</span><p>${esc(s.instruction)}</p><p><b>检查：</b>${esc(s.check)}</p>${s.record?.notes ? `<p class="small">记录：${esc(s.record.notes)}</p>` : ''}</div>`).join('')}` : ''}${ch.manual ? `<div class="manual"><strong>人工编写内容</strong><span class="tag ${ch.manual.effectiveStatus === 'confirmed' ? 'confirmed' : 'stale'}">${{ confirmed: '人工确认且依赖一致', draft: '待审核', 'needs-review': '原内容保留 依赖已变需复核' }[ch.manual.effectiveStatus]}</span><div class="text">${esc(ch.manual.body)}</div><p class="small">作者 ${esc(ch.manual.author || '未记录')} · 依据 ${esc(ch.manual.evidence || '未记录')} · ${esc(ch.manual.updatedAt)}</p></div>` : ''}${ch.editorDraft ? '<p class="warning">本章有未应用的人工作文草稿，已保存在项目中；正文仍采用上次保存的内容。</p>' : ''}<details class="reference"><summary>展开原教程第 ${ch.sourcePage} 页全文参考 仅描述原项目</summary><div class="original"><p class="warning">以下历史参考未经当前布局改写，涉及原引脚、数量和尺寸时，以本章上面的当前数据和确认状态为准。它不是当前加工依据。</p>${ch.referenceBlocks.map(draw).join('')}</div></details></section>`,
        )
        .join('');
    const manifest = {
      kind: 'keyboard-diy-tutorial-manifest',
      schemaVersion: '2.0.0',
      projectId: model.projectId,
      layoutVersionId: model.layoutVersionId,
      tutorialVersionId: record?.id || '实时预览',
      designHash: model.designHash,
      contentHash: P.sha256(model),
      chapters: model.chapters.map((c) => ({
        id: c.id,
        dependencyHash: c.dependencyHash,
        contentHash: c.contentHash,
      })),
      layoutPackage: C.exportPackage(model.layout),
    };
    const safeJSON = JSON.stringify(manifest).replace(/</g, '\\u003c');
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="layout-sha256" content="${model.designHash}"><title>${esc(model.projectName)} ${esc(record?.id || '当前')} DIY 教程</title><style>${CSS}</style></head><body><div class="print-tools"><button id="printDoc">打印或另存 PDF</button><button id="downloadLayout">下载本教程布局 JSON</button><label><input type="checkbox" id="includeOriginal">打印时附上原教程全文参考</label><span style="font-size:12px">${esc(model.layoutVersionId)} · ${esc(record?.id || '实时预览')}</span></div><main class="document"><section class="cover"><h1>${esc(model.projectName)}<br>当前版本 DIY 制作教程</h1><p class="meta">项目 ${esc(model.projectId)}<br>布局 ${esc(model.layoutVersionId)} · 教程 ${esc(record?.id || '实时预览')} · 模板 ${model.templateVersion}<br>布局 SHA-256 <code>${model.designHash}</code><br>正文 SHA-256 <code>${manifest.contentHash}</code></p><p class="warning">这是与当前布局版本绑定的设计与制作教程。已知参数自动同步；未确认电路、尺寸、规格与工程文件必须人工核对。图形和配置片段不是可加工 PCB、外壳或可直接刷写固件。</p><h3>阅读导航</h3><nav class="toc">${model.chapters.map((c) => `<a href="#${esc(c.id)}">${c.sourcePage} ${esc(c.title)}</a>`).join('')}</nav><p class="source-summary">来源：${esc(model.sourcePdf)}，原 32 章正文与 15 幅图片均保留。当前动态数据与历史参考分开显示；不确定内容不会自动补造。</p></section>${chapterHtml}<p class="signature">教程与工程文件均需按设计版本核对。源 PDF SHA-256：${model.sourcePdfSha256}</p></main><script type="application/json" id="tutorial-manifest">${safeJSON}</script><script>document.getElementById('printDoc').onclick=()=>window.print();document.getElementById('includeOriginal').onchange=e=>{document.body.classList.toggle('show-original',e.target.checked);document.querySelectorAll('.reference').forEach(d=>d.open=e.target.checked);};document.getElementById('downloadLayout').onclick=()=>{const m=JSON.parse(document.getElementById('tutorial-manifest').textContent),b=new Blob([JSON.stringify(m.layoutPackage,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=m.layoutVersionId+'.layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);};</script></body></html>`;
  }
  function aiRequest(p, chapterIds) {
    const model = build(p).model;
    return {
      kind: 'keyboard-diy-ai-request',
      schemaVersion: '1.0.0',
      requestId: 'AI-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      projectId: p.id,
      designHash: model.designHash,
      instructions:
        '只返回指定章节的纯文本补充建议，未知参数写待确认。禁止改写设计、基准、安全检查或确认状态。返回 kind=keyboard-diy-ai-response schemaVersion=1.0.0，并原样带回 requestId/projectId/designHash；suggestions 每项包含 chapterId/dependencyHash/text。',
      chapters: model.chapters
        .filter((c) => chapterIds.includes(c.id))
        .map((c) => ({
          chapterId: c.id,
          dependencyHash: c.dependencyHash,
          title: c.title,
          facts: c.generated,
          steps: c.steps,
          unresolved: c.issues,
          existingManualText: c.manual?.body || '',
        })),
    };
  }
  function validateAI(response, p, request) {
    if (
      !response ||
      response.kind !== 'keyboard-diy-ai-response' ||
      response.schemaVersion !== '1.0.0' ||
      response.projectId !== p.id ||
      response.requestId !== request?.requestId ||
      response.designHash !== P.hashDesign(p.working.design) ||
      response.designHash !== request.designHash ||
      !Array.isArray(response.suggestions)
    )
      return ['AI 响应格式、请求标识或布局版本不匹配；旧建议不会自动应用'];
    const errors = [];
    for (const s of response.suggestions) {
      const ch = p.library.chapters.find((c) => c.id === s.chapterId),
        requested = request.chapters.find((c) => c.chapterId === s.chapterId);
      if (
        !ch ||
        !requested ||
        s.dependencyHash !== dependency(p, ch) ||
        s.dependencyHash !== requested.dependencyHash ||
        typeof s.text !== 'string' ||
        s.text.length > 30000
      )
        errors.push('章节建议过期、未请求或正文无效 ' + s.chapterId);
    }
    return errors;
  }
  root.KeyboardTutorial = {
    projection,
    dependency,
    artifactHash,
    artifactDeps,
    wiringRows,
    geometryRows,
    bomRows,
    matrixRows,
    build,
    saveTutorial,
    layoutSvg,
    render,
    CSS,
    aiRequest,
    validateAI,
  };
  if (typeof module !== 'undefined') module.exports = root.KeyboardTutorial;
})(typeof window !== 'undefined' ? window : globalThis);
