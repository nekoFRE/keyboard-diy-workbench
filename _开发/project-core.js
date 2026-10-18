(function (root) {
  'use strict';
  const C = root.LayoutCore || (typeof require === 'function' ? require('./core.js') : null),
    clone = C.clone;
  const canonical = (x) =>
    JSON.stringify(x, function (k, v) {
      return v && typeof v === 'object' && !Array.isArray(v)
        ? Object.keys(v)
            .sort()
            .reduce((o, k) => ((o[k] = v[k]), o), {})
        : v;
    });
  // SHA-256 on UTF-8 or raw bytes, also used for actual engineering file bytes.
  function sha256(value) {
    const input =
      value instanceof Uint8Array
        ? value
        : new TextEncoder().encode(typeof value === 'string' ? value : canonical(value));
    const length = input.length,
      buf = new Uint8Array(((length + 9 + 63) >> 6) << 6);
    buf.set(input);
    buf[length] = 128;
    const dv = new DataView(buf.buffer);
    dv.setUint32(buf.length - 8, Math.floor(length / 0x20000000));
    dv.setUint32(buf.length - 4, (length * 8) >>> 0);
    let h = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
      0x5be0cd19,
    ];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
      0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
      0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
      0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
      0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
      0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
      0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
      0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
      0xc67178f2,
    ];
    const r = (x, n) => (x >>> n) | (x << (32 - n));
    const w = new Uint32Array(64);
    for (let off = 0; off < buf.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15],
          b = w[i - 2];
        w[i] =
          (w[i - 16] +
            (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) +
            w[i - 7] +
            (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>>
          0;
      }
      let [a, b, c, d, e, f, g, z] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (z + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + k[i] + w[i]) >>> 0,
          t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        z = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }
      h = h.map((x, i) => (x + [a, b, c, d, e, f, g, z][i]) >>> 0);
    }
    return h.map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  const stamp = () => new Date().toISOString(),
    hashDesign = (d) => sha256(d),
    id = (prefix, n) => prefix + String(n).padStart(3, '0');
  function create(design, library) {
    const errors = C.validateDesign(design);
    if (errors.length) throw Error(errors.join('\n'));
    const le = validateLibrary(library);
    if (le.length) throw Error(le.join('\n'));
    const p = {
      kind: 'keyboard-diy-project',
      schemaVersion: '2.0.0',
      id: 'P-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      name: design.name,
      createdAt: stamp(),
      updatedAt: stamp(),
      baselineId: C.BASELINE_ID,
      sourceContext: C.sourceContext(),
      referenceBaseline: C.baseline(),
      library: clone(library),
      working: { design: clone(design), basedOnVersionId: null },
      layoutVersions: [],
      tutorialVersions: [],
      notes: {},
      editorDrafts: {},
      stepChecks: {},
      engineeringFiles: [],
      audit: [],
    };
    saveLayout(p, '初始布局');
    return p;
  }
  function touch(p, action, detail) {
    p.updatedAt = stamp();
    if (action) p.audit.push({ at: p.updatedAt, action, detail });
  }
  function sync(p, d) {
    const errors = C.validateDesign(d);
    if (errors.length) throw Error(errors.join('\n'));
    if (canonical(p.working.design) === canonical(d)) return false;
    p.working.design = clone(d);
    touch(p);
    return true;
  }
  function saveLayout(p, label) {
    const hash = hashDesign(p.working.design),
      old = p.layoutVersions.find((v) => v.designHash === hash);
    if (old) {
      p.working.basedOnVersionId = old.id;
      return old;
    }
    if (p.layoutVersions.length >= 100)
      throw Error('已达 100 个布局版本；请先导出完整项目并另存新项目，不会自动删除历史。');
    const v = {
      id: id('L', p.layoutVersions.length + 1),
      label: label || '布局版本',
      createdAt: stamp(),
      designHash: hash,
      design: clone(p.working.design),
    };
    p.layoutVersions.push(v);
    p.working.basedOnVersionId = v.id;
    touch(p, 'save-layout', v.id);
    return v;
  }
  function restoreLayout(p, versionId) {
    const v = p.layoutVersions.find((v) => v.id === versionId);
    if (!v) throw Error('布局版本不存在');
    p.working = { design: clone(v.design), basedOnVersionId: v.id };
    touch(p, 'restore-layout', v.id);
    return clone(v.design);
  }
  function setNote(p, chapterId, body, author, evidence, confirmed, dependencyHash) {
    if (!p.library.chapters.some((c) => c.id === chapterId)) throw Error('未知章节');
    if (
      typeof body !== 'string' ||
      body.length > 30000 ||
      typeof author !== 'string' ||
      author.length > 200 ||
      typeof evidence !== 'string' ||
      evidence.length > 5000
    )
      throw Error('人工内容字段过长或类型无效');
    if (confirmed && (!body.trim() || !evidence.trim())) throw Error('人工确认需要正文与依据');
    const old = p.notes[chapterId],
      history = old ? clone(old.history || []) : [];
    if (old)
      history.push({
        body: old.body,
        author: old.author,
        evidence: old.evidence,
        confirmed: old.confirmed,
        dependencyHash: old.dependencyHash,
        at: old.updatedAt,
        origin: old.origin || 'human',
      });
    p.notes[chapterId] = {
      body,
      author,
      evidence,
      confirmed: !!confirmed,
      dependencyHash,
      updatedAt: stamp(),
      origin: 'human',
      history,
    };
    delete p.editorDrafts[chapterId];
    touch(p, 'save-note', chapterId);
  }
  function setCheck(p, chapterId, stepId, status, dependencyHash, notes = '') {
    if (!['todo', 'done', 'blocked'].includes(status)) throw Error('步骤状态无效');
    p.stepChecks[chapterId + '/' + stepId] = {
      chapterId,
      stepId,
      status,
      dependencyHash,
      notes,
      at: stamp(),
    };
    touch(p);
  }
  function base64Bytes(str) {
    if (typeof atob === 'function') return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
    return new Uint8Array(Buffer.from(str, 'base64'));
  }
  function bytesBase64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192)
      s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s);
  }
  function validateLibrary(lib) {
    if (
      !lib ||
      lib.version !== '2.0.0' ||
      !Array.isArray(lib.chapters) ||
      lib.chapters.length !== 32 ||
      !lib.assets ||
      typeof lib.assets !== 'object'
    )
      return ['教程知识库缺失或版本不支持'];
    const errs = [];
    const ids = new Set();
    for (const c of lib.chapters) {
      if (
        !/^ch\d{2}$/.test(c.id) ||
        ids.has(c.id) ||
        typeof c.title !== 'string' ||
        !Array.isArray(c.principles) ||
        !Array.isArray(c.referenceBlocks) ||
        !Array.isArray(c.dependsOn) ||
        !Array.isArray(c.figures) ||
        !Array.isArray(c.domains)
      )
        errs.push('章节结构无效');
      ids.add(c.id);
      const blocks = [...c.principles, ...c.referenceBlocks, ...c.figures];
      for (const b of blocks) {
        if (!Array.isArray(b) || !['p', 'small', 'h', 'fig', 'table', 'code'].includes(b[0])) {
          errs.push('原教程块类型无效');
          continue;
        }
        if (b[0] === 'fig' && !lib.assets[b[1]]) errs.push('缺少教程图片 ' + b[1]);
        if (b[0] === 'table' && (!Array.isArray(b[1]) || !Array.isArray(b[2])))
          errs.push('表格结构无效');
      }
    }
    for (const [name, a] of Object.entries(lib.assets)) {
      if (
        !/^[\w.-]+$/.test(name) ||
        !a ||
        !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(a.dataUri || '')
      ) {
        errs.push('图片资源类型无效');
        continue;
      }
      try {
        if (sha256(base64Bytes(a.dataUri.split(',')[1])) !== a.sha256)
          errs.push('图片校验失败 ' + name);
      } catch (e) {
        errs.push('图片数据损坏');
      }
    }
    for (const c of lib.chapters) {
      const ids = new Set();
      if (
        c.templateSteps !== undefined &&
        (!Array.isArray(c.templateSteps) || c.templateSteps.length > 100)
      )
        errs.push('扩展步骤结构无效');
      for (const st of c.templateSteps || []) {
        if (
          !st ||
          !/^u[A-Za-z0-9_-]{1,30}$/.test(st.id) ||
          ids.has(st.id) ||
          typeof st.title !== 'string' ||
          typeof st.instruction !== 'string' ||
          typeof st.check !== 'string'
        )
          errs.push('扩展步骤身份或字段无效');
        ids.add(st.id);
      }
      if (
        c.principles.some(
          (b) => ['p', 'h', 'small', 'code'].includes(b[0]) && typeof b[1] !== 'string',
        )
      )
        errs.push('原理文本无效');
    }
    return errs;
  }
  function validate(p) {
    const errors = [];
    if (!p || p.kind !== 'keyboard-diy-project' || p.schemaVersion !== '2.0.0')
      return ['不是受支持的 2.0.0 项目文件'];
    if (
      p.baselineId !== C.BASELINE_ID ||
      canonical(p.referenceBaseline) !== canonical(C.baseline()) ||
      canonical(p.sourceContext) !== canonical(C.sourceContext())
    )
      errors.push('原始基准或来源被改写');
    if (
      typeof p.id !== 'string' ||
      typeof p.name !== 'string' ||
      !p.working ||
      !Array.isArray(p.layoutVersions) ||
      !Array.isArray(p.tutorialVersions) ||
      !Array.isArray(p.engineeringFiles) ||
      !p.notes ||
      !p.stepChecks ||
      !p.editorDrafts ||
      !Array.isArray(p.audit)
    )
      return [...errors, '项目结构不完整'];
    errors.push(...validateLibrary(p.library));
    errors.push(...C.validateDesign(p.working.design));
    if (
      p.layoutVersions.length > 100 ||
      p.tutorialVersions.length > 100 ||
      p.engineeringFiles.length > 100
    )
      errors.push('版本或工程文件数量超过 100');
    const layoutIds = new Set();
    for (const v of p.layoutVersions) {
      if (
        !/^L\d+$/.test(v.id) ||
        layoutIds.has(v.id) ||
        typeof v.label !== 'string' ||
        v.designHash !== hashDesign(v.design)
      )
        errors.push('布局版本校验失败 ' + v.id);
      layoutIds.add(v.id);
      errors.push(...C.validateDesign(v.design));
    }
    if (p.working.basedOnVersionId !== null && !layoutIds.has(p.working.basedOnVersionId))
      errors.push('工作区引用的布局版本不存在');
    const tids = new Set();
    for (const t of p.tutorialVersions) {
      const v = p.layoutVersions.find((v) => v.id === t.layoutVersionId);
      if (
        !/^T\d+$/.test(t.id) ||
        tids.has(t.id) ||
        !v ||
        v.designHash !== t.designHash ||
        !t.model ||
        t.model.designHash !== v.designHash ||
        t.contentHash !== sha256(t.model) ||
        !Array.isArray(t.model.chapters) ||
        t.model.chapters.length !== 32
      )
        errors.push('教程版本与布局绑定或内容校验失败 ' + t.id);
      tids.add(t.id);
    }
    for (const [key, n] of Object.entries(p.notes))
      if (
        !/^ch\d{2}$/.test(key) ||
        !n ||
        typeof n.body !== 'string' ||
        typeof n.author !== 'string' ||
        typeof n.evidence !== 'string' ||
        typeof n.confirmed !== 'boolean' ||
        typeof n.dependencyHash !== 'string' ||
        !Array.isArray(n.history)
      )
        errors.push('人工内容结构无效 ' + key);
    for (const [key, c] of Object.entries(p.stepChecks))
      if (
        !c ||
        !['todo', 'done', 'blocked'].includes(c.status) ||
        typeof c.dependencyHash !== 'string' ||
        key !== c.chapterId + '/' + c.stepId
      )
        errors.push('步骤检查记录无效');
    const fids = new Set();
    for (const f of p.engineeringFiles) {
      if (
        !f ||
        typeof f.id !== 'string' ||
        fids.has(f.id) ||
        typeof f.name !== 'string' ||
        !['schematic', 'pcb', 'case', 'plate', 'bom', 'firmware', 'evidence', 'other'].includes(
          f.category,
        ) ||
        !layoutIds.has(f.layoutVersionId) ||
        !/^[a-f0-9]{64}$/.test(f.sha256) ||
        typeof f.dependencyHash !== 'string' ||
        typeof f.confirmed !== 'boolean'
      )
        errors.push('工程文件记录无效');
      fids.add(f.id);
      if (f.contentBase64 !== null) {
        try {
          const bytes = base64Bytes(f.contentBase64);
          if (bytes.length !== f.size || sha256(bytes) !== f.sha256)
            errors.push('工程文件内容校验失败 ' + f.name);
        } catch (e) {
          errors.push('工程文件内容损坏');
        }
      }
    }
    if (p.name.length > 100 || p.id.length > 150) errors.push('项目名称或身份过长');
    for (const [key, n] of Object.entries(p.editorDrafts)) {
      if (
        !/^ch[0-9]{2}$/.test(key) ||
        !n ||
        typeof n.body !== 'string' ||
        n.body.length > 30000 ||
        typeof n.author !== 'string' ||
        typeof n.evidence !== 'string' ||
        typeof n.confirmed !== 'boolean'
      )
        errors.push('人工草稿结构无效');
    }
    for (const t of p.tutorialVersions) {
      const m = t.model;
      if (
        m &&
        (m.projectId !== p.id ||
          m.layoutVersionId !== t.layoutVersionId ||
          hashDesign(m.layout) !== t.designHash)
      )
        errors.push('教程快照内部布局绑定无效');
      if (m && Array.isArray(m.chapters))
        for (const ch of m.chapters) {
          if (
            !ch ||
            typeof ch.title !== 'string' ||
            !Array.isArray(ch.generated) ||
            !Array.isArray(ch.principles) ||
            !Array.isArray(ch.referenceBlocks) ||
            !Array.isArray(ch.figures) ||
            !Array.isArray(ch.steps) ||
            !Array.isArray(ch.issues) ||
            !Array.isArray(ch.domainTasks)
          )
            errors.push('教程章节结构无效');
          else {
            const { contentHash, ...rest } = ch;
            if (contentHash !== sha256(rest)) errors.push('教程章节校验失败');
          }
        }
    }
    for (const f of p.engineeringFiles) {
      const v = p.layoutVersions.find((v) => v.id === f.layoutVersionId);
      if (
        !v ||
        f.designHash !== v.designHash ||
        !Number.isInteger(f.size) ||
        f.size < 0 ||
        !Array.isArray(f.history) ||
        typeof f.revision !== 'string' ||
        typeof f.notes !== 'string'
      )
        errors.push('工程文件版本或元数据无效');
    }
    for (const key of ['aiRequests', 'aiInbox'])
      if (p[key] !== undefined && !Array.isArray(p[key])) errors.push('AI记录结构无效');
    if (Array.isArray(p.aiRequests))
      for (const r of p.aiRequests)
        if (
          !r ||
          typeof r.requestId !== 'string' ||
          !Array.isArray(r.chapters) ||
          !r.chapters.every(
            (c) => c && typeof c.chapterId === 'string' && typeof c.dependencyHash === 'string',
          )
        )
          errors.push('AI请求记录无效');
    if (Array.isArray(p.aiInbox))
      for (const i of p.aiInbox)
        if (
          !i ||
          typeof i.text !== 'string' ||
          typeof i.chapterId !== 'string' ||
          typeof i.dependencyHash !== 'string'
        )
          errors.push('AI建议记录无效');
    return [...new Set(errors)];
  }
  function addFile(p, file, category, revision, notes, confirmed, bytes, embed, dependencyHash) {
    if (p.engineeringFiles.length >= 100) throw Error('工程文件最多 100 个');
    if (embed && bytes.length > 10 * 1024 * 1024)
      throw Error('单文件内嵌上限 10 MB；大工程请只登记并在交付包外另行提供。');
    const total = p.engineeringFiles.reduce((n, f) => n + (f.contentBase64 ? f.size : 0), 0);
    if (embed && total + bytes.length > 30 * 1024 * 1024)
      throw Error('内嵌工程文件总量上限 30 MB；可改为仅登记。');
    const v = saveLayout(p),
      record = {
        id: id('F', p.engineeringFiles.length + 1),
        name: file.name,
        category,
        revision: revision || '',
        notes: notes || '',
        confirmed: !!confirmed,
        layoutVersionId: v.id,
        designHash: v.designHash,
        dependencyHash,
        sha256: sha256(bytes),
        size: bytes.length,
        contentBase64: embed ? bytesBase64(bytes) : null,
        createdAt: stamp(),
        history: [],
      };
    p.engineeringFiles.push(record);
    touch(p, 'add-file', record.id);
    return record;
  }
  // Store-only ZIP writer: no runtime packages, UTF-8 names, CRC-32 and standard headers.
  function zip(files) {
    const encoder = new TextEncoder(),
      chunks = [],
      central = [],
      crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
    let offset = 0,
      centralSize = 0;
    for (const file of files) {
      if (
        !file.name ||
        file.name.includes('..') ||
        file.name.startsWith('/') ||
        file.name.includes('\\')
      )
        throw Error('交付包文件名不安全');
      const name = encoder.encode(file.name),
        data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
      let crc = 0xffffffff;
      for (const b of data) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
      crc = (crc ^ 0xffffffff) >>> 0;
      const local = new Uint8Array(30 + name.length),
        v = new DataView(local.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 0x800, true);
      v.setUint16(12, 33, true);
      v.setUint32(14, crc, true);
      v.setUint32(18, data.length, true);
      v.setUint32(22, data.length, true);
      v.setUint16(26, name.length, true);
      local.set(name, 30);
      chunks.push(local, data);
      const center = new Uint8Array(46 + name.length),
        cv = new DataView(center.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x800, true);
      cv.setUint16(14, 33, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      center.set(name, 46);
      central.push(center);
      centralSize += center.length;
      offset += local.length + data.length;
    }
    const end = new Uint8Array(22),
      ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    let pos = 0;
    const result = new Uint8Array(offset + centralSize + 22);
    for (const c of [...chunks, ...central, end]) {
      result.set(c, pos);
      pos += c.length;
    }
    return result;
  }
  root.KeyboardProject = {
    canonical,
    sha256,
    hashDesign,
    create,
    sync,
    saveLayout,
    restoreLayout,
    setNote,
    setCheck,
    validate,
    validateLibrary,
    touch,
    addFile,
    base64Bytes,
    bytesBase64,
    zip,
    clone,
    stamp,
  };
  if (typeof module !== 'undefined') module.exports = root.KeyboardProject;
})(typeof window !== 'undefined' ? window : globalThis);
