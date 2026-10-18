(function () {
  'use strict';
  const C = LayoutCore,
    P = KeyboardProject,
    T = KeyboardTutorial,
    E = KeyboardLayoutEditor,
    $ = (id) => document.getElementById(id),
    esc = (s) =>
      String(s ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
      );
  const library = JSON.parse($('tutorial-library-data').textContent);
  let project = P.create(E.getDesign(), library),
    model = null,
    mode = null,
    chapterId = 'ch08',
    tutorialChoice = 'live',
    guard = false,
    saveTimer,
    renderTimer,
    provider = null,
    pending = null,
    lastStats = { reused: 0, changed: 32 },
    dbPromise = null;
  const categories = {
    schematic: '原理图',
    pcb: 'PCB / Gerber',
    plate: '定位板',
    case: '外壳 / CAD',
    bom: '物料清单',
    firmware: 'QMK / 固件',
    evidence: '测试与确认依据',
    other: '其他工程资料',
  };
  const nav = document.createElement('nav');
  nav.className = 'studio-nav';
  nav.innerHTML =
    '<button data-studio="layout">布局编辑</button><button data-studio="tutorial" id="tutorialPreview">教程预览</button><button id="generateTutorial">生成当前版本教程</button><button data-studio="project" id="projectManager">项目与版本</button><button data-studio="files" id="engineeringManager">工程交付</button><button data-studio="ai" id="aiManager">可选 AI 更新</button><button id="resumeProject" class="hidden">恢复上次项目</button><span class="project-status" id="projectStatus"></span>';
  document.querySelector('header').after(nav);
  const studio = document.createElement('section');
  studio.id = 'studio';
  studio.className = 'studio hidden';
  studio.innerHTML =
    '<div class="studio-head"><strong>键盘 DIY 项目工作台</strong><button data-studio="layout">返回布局</button><button data-studio="tutorial">教程预览</button><button data-studio="project">项目版本</button><button data-studio="files">工程交付</button><button data-studio="ai">AI 更新</button><button id="saveProject" class="primary">保存完整项目</button><button id="snapshotLayout">保存布局版本</button><button id="snapshotTutorial" class="primary">生成当前版本教程</button><span class="studio-caption" id="studioCaption"></span></div><div class="studio-body" id="studioBody"></div>';
  document.body.append(studio);
  for (const [id, accept] of [
    ['projectFile', '.json'],
    ['engineeringFile', '*'],
    ['aiResponseFile', '.json'],
  ]) {
    const input = document.createElement('input');
    input.id = id;
    input.type = 'file';
    input.accept = accept;
    input.className = 'hidden';
    document.body.append(input);
  }
  function notify(text, error = false) {
    const el = $('toast');
    clearTimeout(el._timer);
    el.textContent = text;
    el.className = 'toast studio-toast' + (error ? ' error' : '');
    el._timer = setTimeout(() => el.classList.add('hidden'), error ? 8000 : 3400);
  }
  const safe = (s) =>
    String(s || '键盘项目')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\.\./g, '_')
      .slice(0, 80);
  function download(name, data, type = 'application/json;charset=utf-8') {
    const blob = data instanceof Blob ? data : new Blob([data], { type }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function db() {
    if (!dbPromise)
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('keyboard-diy-projects', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('projects');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    return dbPromise;
  }
  async function store(value) {
    try {
      const database = await db();
      await new Promise((resolve, reject) => {
        const tx = database.transaction('projects', 'readwrite');
        tx.objectStore('projects').put(value, value.id);
        tx.objectStore('projects').put(value.id, '__active__');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      return 'IndexedDB';
    } catch (e) {
      localStorage.setItem('keyboard-diy-project-' + value.id, JSON.stringify(value));
      localStorage.setItem('keyboard-diy-active', value.id);
      return '浏览器存储';
    }
  }
  async function readSaved() {
    try {
      const database = await db();
      return await new Promise((resolve, reject) => {
        const tx = database.transaction('projects', 'readonly'),
          req = tx.objectStore('projects').get('__active__');
        req.onsuccess = () => {
          if (!req.result) return resolve(null);
          const r = tx.objectStore('projects').get(req.result);
          r.onsuccess = () => resolve(r.result || null);
          r.onerror = () => reject(r.error);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      const id = localStorage.getItem('keyboard-diy-active');
      return id ? JSON.parse(localStorage.getItem('keyboard-diy-project-' + id)) : null;
    }
  }
  async function listSaved() {
    try {
      const database = await db();
      return await new Promise((resolve, reject) => {
        const tx = database.transaction('projects', 'readonly'),
          r = tx.objectStore('projects').getAll();
        r.onsuccess = () =>
          resolve(
            r.result.filter((p) => p && typeof p === 'object' && p.kind === 'keyboard-diy-project'),
          );
        r.onerror = () => reject(r.error);
      });
    } catch (e) {
      const result = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('keyboard-diy-project-'))
          try {
            result.push(JSON.parse(localStorage.getItem(key)));
          } catch {}
      }
      return result;
    }
  }
  function autosave() {
    clearTimeout(saveTimer);
    const value = project;
    saveTimer = setTimeout(async () => {
      try {
        const where = await store(value);
        if (project.id === value.id)
          $('projectStatus').title = '项目草稿已保存到 ' + where + '；完整项目 JSON 才是可靠备份。';
      } catch (e) {
        $('projectStatus').title = '浏览器项目草稿保存失败：' + e.message;
        notify('本地项目草稿未能保存；请立即“保存完整项目”下载备份。', true);
      }
    }, 350);
  }
  function rebuild() {
    const result = T.build(project, model);
    model = result.model;
    if (result.changed) lastStats = { reused: result.reused, changed: result.changed };
    status();
    return model;
  }
  function status() {
    const hash = P.hashDesign(project.working.design),
      v = project.layoutVersions.find((v) => v.designHash === hash),
      label = v
        ? v.id
        : '基于 ' + (project.working.basedOnVersionId || '初始') + ' · 工作区未存版本';
    $('projectStatus').textContent = label + ' · 教程随布局联动';
    $('studioCaption').textContent = project.name + ' · ' + label + ' · ' + hash.slice(0, 10);
  }
  function syncFromEditor() {
    if (guard) return;
    if (P.sync(project, E.getDesign())) {
      rebuild();
      autosave();
      if (mode) {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(renderStudio, 200);
      }
    }
  }
  window.addEventListener('keyboard-layout-render', syncFromEditor);
  function show(next) {
    if (next === 'layout') {
      mode = null;
      studio.classList.add('hidden');
      return;
    }
    mode = next;
    studio.classList.remove('hidden');
    rebuild();
    renderStudio();
  }
  document
    .querySelectorAll('[data-studio]')
    .forEach((b) => (b.onclick = () => show(b.dataset.studio)));
  function renderStudio() {
    status();
    if (mode === 'tutorial') renderTutorial();
    if (mode === 'project') renderProject();
    if (mode === 'files') renderFiles();
    if (mode === 'ai') renderAI();
  }
  function persist() {
    P.touch(project);
    rebuild();
    autosave();
  }
  function generate(downloadHTML = true) {
    syncFromEditor();
    const rec = T.saveTutorial(project);
    rebuild();
    autosave();
    if (downloadHTML)
      download(
        safe(project.name) + '-' + rec.layoutVersionId + '-' + rec.id + '-教程.html',
        T.render(rec.model, project.library, rec),
        'text/html;charset=utf-8',
      );
    tutorialChoice = rec.id;
    if (mode === 'tutorial') renderTutorial();
    else if (mode === 'project') renderProject();
    notify(`已生成 ${rec.id}，绑定布局 ${rec.layoutVersionId}；HTML 可离线查看并打印为 PDF。`);
    return rec;
  }
  $('generateTutorial').onclick = () => {
    try {
      generate();
    } catch (e) {
      notify(e.message, true);
    }
  };
  $('snapshotTutorial').onclick = $('generateTutorial').onclick;
  function saveProject() {
    syncFromEditor();
    const text = JSON.stringify(project, null, 2);
    download(safe(project.name) + '.keyboard-project.json', text);
    autosave();
    notify('已下载完整项目：布局、教程版本、人工内容与内嵌工程文件均保留。');
  }
  $('saveProject').onclick = saveProject;
  $('snapshotLayout').onclick = () => {
    try {
      syncFromEditor();
      const v = P.saveLayout(project, $('versionLabel')?.value || '布局快照');
      persist();
      renderStudio();
      notify('已保存 ' + v.id + '，原有教程快照与人工内容均保留。');
    } catch (e) {
      notify(e.message, true);
    }
  };
  async function importProjectValue(value) {
    const errors = P.validate(value);
    if (errors.length) throw Error(errors.slice(0, 8).join('\n'));
    await store(project).catch(() => {});
    clearTimeout(saveTimer);
    guard = true;
    project = P.clone(value);
    project.aiRequests ||= [];
    project.aiInbox ||= [];
    model = null;
    tutorialChoice = 'live';
    try {
      E.replaceDesign(project.working.design, true);
    } finally {
      guard = false;
    }
    rebuild();
    autosave();
    renderStudio();
    notify('已恢复完整项目；布局、历史教程和人工内容均保留。');
  }
  $('projectFile').onchange = async () => {
    const file = $('projectFile').files[0];
    if (!file) return;
    try {
      if (file.size > 64 * 1024 * 1024) throw Error('完整项目文件超过 64 MB');
      await importProjectValue(JSON.parse(await file.text()));
    } catch (e) {
      notify('导入失败，当前项目保留：' + e.message, true);
    }
    $('projectFile').value = '';
  };
  $('resumeProject').onclick = async () => {
    if (!pending) return;
    try {
      await importProjectValue(pending);
      $('resumeProject').classList.add('hidden');
      show('project');
    } catch (e) {
      notify('恢复失败：' + e.message, true);
    }
  };
  async function restore(id) {
    try {
      P.saveLayout(project, '恢复历史前的自动快照');
      const d = P.restoreLayout(project, id);
      guard = true;
      try {
        E.replaceDesign(d);
      } finally {
        guard = false;
      }
      tutorialChoice = 'live';
      persist();
      renderStudio();
      notify('已恢复 ' + id + '；恢复前的设计已另存，人工内容不会被删除。');
    } catch (e) {
      notify(e.message, true);
    }
  }
  function renderProject() {
    const body = $('studioBody');
    body.className = 'studio-body project-view';
    const hash = P.hashDesign(project.working.design);
    body.innerHTML = `<h2>项目与版本</h2><div class="card"><div class="pair"><div><label>项目名称<input id="projectName" maxlength="100" value="${esc(project.name)}"></label><p class="version-line">项目 ID ${esc(project.id)}<br>当前布局 SHA-256 <code>${hash}</code></p></div><div class="stack"><button id="importProject">导入完整项目 JSON</button><button id="exportProject2" class="primary">保存完整项目 JSON</button><p class="hint">原 *.layout.json 仍可用顶部“打开 JSON”载入到当前项目。长期继续制作请保存 *.keyboard-project.json，后者还包含教程、人工内容、检查记录与工程文件。</p></div></div><div class="status-grid"><div><b>${project.layoutVersions.length}</b>布局版本</div><div><b>${project.tutorialVersions.length}</b>教程版本</div><div><b>${Object.keys(project.notes).length}</b>人工章节</div><div><b>${project.engineeringFiles.length}</b>工程文件记录</div></div></div><div class="card"><h3>布局版本</h3><div class="row"><input id="versionLabel" placeholder="版本说明，例如 调整转盘和屏幕位置"><button id="saveLayoutVersion">保存当前布局版本</button></div><p class="hint">恢复前会先保留当前工作区。恢复布局不删除现有人工作文；受影响的确认会变为需复核。</p><div class="table-scroll"><table class="small-table"><thead><tr><th>版本</th><th>说明</th><th>设计 SHA-256</th><th>操作</th></tr></thead><tbody>${project.layoutVersions
      .slice()
      .reverse()
      .map(
        (v) =>
          `<tr><td>${v.id}${v.designHash === hash ? ' · 当前' : ''}</td><td>${esc(v.label)}<br><span class="micro">${esc(v.createdAt)}</span></td><td><code>${v.designHash.slice(0, 20)}</code></td><td><button data-restore-layout="${v.id}">恢复</button> <button data-layout-export="${v.id}">导出 JSON</button></td></tr>`,
      )
      .join(
        '',
      )}</tbody></table></div></div><div class="card"><h3>教程版本</h3><p class="hint">每个教程都有独立正文快照和布局版本绑定。历史教程不会跟随当前工作区变化；生成新教程才会创建新快照。</p><div class="table-scroll"><table class="small-table"><thead><tr><th>教程</th><th>关联布局</th><th>正文校验</th><th>操作</th></tr></thead><tbody>${
      project.tutorialVersions
        .slice()
        .reverse()
        .map(
          (t) =>
            `<tr><td>${t.id}<br><span class="micro">${esc(t.createdAt)}</span></td><td>${t.layoutVersionId}<br><code>${t.designHash.slice(0, 16)}</code></td><td><code>${t.contentHash.slice(0, 16)}</code></td><td><button data-view-tutorial="${t.id}">查看</button> <button data-export-tutorial="${t.id}">导出 HTML</button></td></tr>`,
        )
        .join('') ||
      '<tr><td colspan="4">尚未生成教程版本。实时预览可用；点击“生成当前版本教程”固定快照。</td></tr>'
    }</tbody></table></div></div><div class="card"><h3>浏览器中的其他项目草稿</h3><div id="savedProjects" class="hint">正在读取本地存档…</div><p class="micro">不依赖浏览器存储作为唯一备份。文件路径变化、浏览器清理或无痕模式可能使本地草稿不可用。</p></div><details class="card"><summary>最近项目操作</summary>${project.audit
      .slice(-25)
      .reverse()
      .map((a) => `<p class="micro">${esc(a.at)} · ${esc(a.action)} · ${esc(a.detail || '')}</p>`)
      .join('')}</details>`;
    $('projectName').onchange = () => {
      project.name = $('projectName').value;
      persist();
    };
    $('importProject').onclick = () => $('projectFile').click();
    $('exportProject2').onclick = saveProject;
    $('saveLayoutVersion').onclick = $('snapshotLayout').onclick;
    body
      .querySelectorAll('[data-restore-layout]')
      .forEach((b) => (b.onclick = () => restore(b.dataset.restoreLayout)));
    body.querySelectorAll('[data-layout-export]').forEach(
      (b) =>
        (b.onclick = () => {
          const v = project.layoutVersions.find((v) => v.id === b.dataset.layoutExport);
          download(v.id + '.layout.json', JSON.stringify(C.exportPackage(v.design), null, 2));
        }),
    );
    body.querySelectorAll('[data-view-tutorial]').forEach(
      (b) =>
        (b.onclick = () => {
          tutorialChoice = b.dataset.viewTutorial;
          show('tutorial');
        }),
    );
    body
      .querySelectorAll('[data-export-tutorial]')
      .forEach((b) => (b.onclick = () => exportTutorial(b.dataset.exportTutorial)));
    listSaved()
      .then((list) => {
        if (!$('savedProjects')) return;
        $('savedProjects').innerHTML =
          list
            .map(
              (p) =>
                `<p>${esc(p.name)} · ${esc(p.updatedAt)} <button data-saved="${esc(p.id)}">恢复此项目</button></p>`,
            )
            .join('') || '尚无浏览器项目存档。';
        $('savedProjects')
          .querySelectorAll('[data-saved]')
          .forEach(
            (b) =>
              (b.onclick = () =>
                importProjectValue(list.find((p) => p.id === b.dataset.saved)).catch((e) =>
                  notify(e.message, true),
                )),
          );
      })
      .catch((e) => {
        if ($('savedProjects'))
          $('savedProjects').textContent = '本地存档不可用；请使用已导出的项目 JSON。';
      });
  }
  function exportTutorial(id) {
    const rec = project.tutorialVersions.find((t) => t.id === id);
    if (rec)
      download(
        safe(project.name) + '-' + rec.layoutVersionId + '-' + rec.id + '-教程.html',
        T.render(rec.model, project.library, rec),
        'text/html;charset=utf-8',
      );
  }
  function renderTutorial() {
    const body = $('studioBody');
    body.className = 'studio-body tutorial-view';
    const record = project.tutorialVersions.find((t) => t.id === tutorialChoice),
      live = !record,
      current = record?.model || model,
      ch = current.chapters.find((c) => c.id === chapterId) || current.chapters[0];
    chapterId = ch.id;
    const note = project.editorDrafts[ch.id] ||
      project.notes[ch.id] || { body: '', author: '', evidence: '', confirmed: false };
    body.innerHTML = `<aside class="tutorial-side"><h2>完整教程预览</h2><label>预览来源<select id="tutorialChoice"><option value="live">实时当前工作区</option>${project.tutorialVersions
      .slice()
      .reverse()
      .map(
        (t) =>
          `<option value="${t.id}" ${record?.id === t.id ? 'selected' : ''}>${t.id} → ${t.layoutVersionId}</option>`,
      )
      .join(
        '',
      )}</select></label><p class="version-line">${live ? '实时教程已按当前 JSON 同步' : '历史快照，只读'}<br>布局 ${esc(current.layoutVersionId)}<br>设计 <code>${current.designHash.slice(0, 20)}</code></p>${live ? `<p class="micro">本次复用 ${lastStats.reused} 章，重建 ${lastStats.changed} 章。无关原理与人工内容保留。</p>` : '<p class="readonly-banner">历史教程不会自动更新。要继续编辑请选择“实时当前工作区”。</p>'}<div class="chapter-list">${current.chapters.map((c) => `<button data-chapter="${c.id}" class="${c.id === ch.id ? 'active' : ''}">${c.sourcePage} ${esc(c.title)}<small>${c.manual?.effectiveStatus === 'needs-review' ? '人工内容需复核 · ' : ''}${c.issues.length ? '待确认 ' + c.issues.length + ' 项 · ' : ''}${c.contentHash.slice(0, 8)}</small></button>`).join('')}</div><div class="chapter-editor"><h3>本章人工内容</h3><p class="micro">人工内容独立保存，自动更新不会覆盖；依赖变化时保留正文并提示复核。</p>${live ? `<label>补充正文<textarea id="manualBody" maxlength="30000">${esc(note.body)}</textarea></label><label>作者<input id="manualAuthor" maxlength="200" value="${esc(note.author)}"></label><label>确认依据<textarea id="manualEvidence" maxlength="5000" style="min-height:65px">${esc(note.evidence)}</textarea></label><label class="check"><input id="manualConfirmed" type="checkbox" ${note.confirmed && (project.editorDrafts[ch.id] ? note.dependencyHash === ch.dependencyHash : ch.manual?.effectiveStatus === 'confirmed') ? 'checked' : ''}>人工确认此内容适用于当前依赖</label><button id="saveManual" class="primary">保存并应用人工内容</button><p class="micro" id="manualDraftStatus">${project.editorDrafts[ch.id] ? '有未应用草稿；已保留在项目中。' : '编辑中的草稿自动保留，点上方按钮后进入正文。'}</p>` : ch.manual ? `<div class="text-block">${esc(ch.manual.body)}</div>` : '<p class="micro">此快照没有人工补充。</p>'}${ch.manual ? `<p class="pending-text">状态：${{ confirmed: '人工确认且依赖一致', draft: '待审核', 'needs-review': '旧内容保留，设计依赖已变，需复核' }[ch.manual.effectiveStatus]}</p>` : ''}${
      live && project.notes[ch.id]?.history?.length
        ? `<details><summary>历史人工内容 ${project.notes[ch.id].history.length} 条</summary>${project.notes[
            ch.id
          ].history
            .slice()
            .reverse()
            .map(
              (n, i) =>
                `<div class="history-note"><p>${esc(n.at)} · ${esc(n.author)}</p><div class="text-block">${esc(n.body)}</div><button data-note-history="${project.notes[ch.id].history.length - i - 1}">取回到草稿</button></div>`,
            )
            .join('')}</details>`
        : ''
    }<h3>本章步骤检查</h3>${
      ch.steps
        .map(
          (s) =>
            `<div class="step-check"><strong>${s.id} ${esc(s.title)}</strong><p class="micro">${esc(s.check)}</p>${
              live
                ? `<select data-step-status="${s.id}">${s.effectiveStatus === 'needs-review' ? '<option value="review" disabled selected>设计依赖已变，原记录需复查</option>' : ''}${[
                    ['todo', '未完成'],
                    ['done', '已记录完成'],
                    ['blocked', '受阻'],
                  ]
                    .map(
                      ([v, t]) =>
                        `<option value="${v}" ${s.effectiveStatus === v ? 'selected' : ''}>${t}</option>`,
                    )
                    .join(
                      '',
                    )}</select><input data-step-note="${s.id}" value="${esc(s.record?.notes || '')}" placeholder="测量/测试记录或依据" style="font-size:12px;margin-top:5px">`
                : `<p class="micro">${esc(s.effectiveStatus)}</p>`
            }</div>`,
        )
        .join('') || '<p class="micro">本章为固定知识或参考资料。</p>'
    }<p class="warning">记录步骤完成不代表全部电路、尺寸或制造条件自动通过。未确认项仍保留。</p></div></aside><div class="tutorial-frame-wrap"><div class="frame-bar"><strong>${esc(current.layoutVersionId)} / ${esc(record?.id || '实时')}</strong><button id="printTutorial">打印 / 另存 PDF</button><button id="exportPreviewHTML">${live ? '生成并导出 HTML' : '导出此历史 HTML'}</button><span class="micro">含当前布局图、原图、完整步骤与未知项</span></div><iframe id="tutorialFrame" class="tutorial-frame" title="完整DIY教程预览" sandbox="allow-scripts allow-same-origin allow-modals allow-downloads"></iframe></div>`;
    body.querySelector('.chapter-list .active')?.scrollIntoView({ block: 'nearest' });
    const frame = $('tutorialFrame');
    frame.onload = () => {
      try {
        frame.contentDocument
          .getElementById(ch.id)
          ?.scrollIntoView({ behavior: 'instant', block: 'start' });
        frame.dataset.ready = 'true';
      } catch {}
    };
    frame.srcdoc = T.render(current, project.library, record || null);
    $('tutorialChoice').onchange = () => {
      tutorialChoice = $('tutorialChoice').value;
      renderTutorial();
    };
    body.querySelectorAll('[data-chapter]').forEach(
      (b) =>
        (b.onclick = () => {
          chapterId = b.dataset.chapter;
          renderTutorial();
        }),
    );
    $('printTutorial').onclick = () => frame.contentWindow.print();
    $('exportPreviewHTML').onclick = () => {
      try {
        record ? exportTutorial(record.id) : generate();
      } catch (e) {
        notify(e.message, true);
      }
    };
    if (live) {
      const draft = () => {
        project.editorDrafts[ch.id] = {
          body: $('manualBody').value,
          author: $('manualAuthor').value,
          evidence: $('manualEvidence').value,
          confirmed: $('manualConfirmed').checked,
          dependencyHash: ch.dependencyHash,
        };
        P.touch(project);
        autosave();
        $('manualDraftStatus').textContent = '未应用草稿已保留；保存后才更新教程正文。';
      };
      for (const id of ['manualBody', 'manualAuthor', 'manualEvidence', 'manualConfirmed'])
        $(id).oninput = draft;
      $('saveManual').onclick = () => {
        try {
          const confirm = $('manualConfirmed').checked;
          if (confirm && (!$('manualBody').value.trim() || !$('manualEvidence').value.trim()))
            throw Error('确认人工内容前，请填写正文与确认依据。');
          P.setNote(
            project,
            ch.id,
            $('manualBody').value,
            $('manualAuthor').value,
            $('manualEvidence').value,
            confirm,
            T.dependency(
              project,
              project.library.chapters.find((c) => c.id === ch.id),
            ),
          );
          persist();
          renderTutorial();
          notify('人工内容已保留，自动生成不会覆盖。');
        } catch (e) {
          notify(e.message, true);
        }
      };
      body.querySelectorAll('[data-note-history]').forEach(
        (b) =>
          (b.onclick = () => {
            const n = project.notes[ch.id].history[Number(b.dataset.noteHistory)];
            project.editorDrafts[ch.id] = {
              body: n.body,
              author: n.author,
              evidence: n.evidence,
              confirmed: false,
            };
            autosave();
            renderTutorial();
          }),
      );
      body.querySelectorAll('[data-step-status]').forEach(
        (el) =>
          (el.onchange = () => {
            const id = el.dataset.stepStatus,
              notes = body.querySelector(`[data-step-note="${id}"]`).value;
            P.setCheck(project, ch.id, id, el.value, ch.dependencyHash, notes);
            persist();
            renderTutorial();
          }),
      );
      body.querySelectorAll('[data-step-note]').forEach(
        (el) =>
          (el.onchange = () => {
            const id = el.dataset.stepNote,
              status = body.querySelector(`[data-step-status="${id}"]`).value;
            P.setCheck(
              project,
              ch.id,
              id,
              status === 'review' ? 'todo' : status,
              ch.dependencyHash,
              el.value,
            );
            persist();
          }),
      );
    }
  }
  function renderFiles() {
    const body = $('studioBody');
    body.className = 'studio-body files-view';
    body.innerHTML = `<h2>工程文件与制作交付包</h2><div class="card"><p class="warning">这里管理真实工程文件和版本关联，不自动生成 PCB/CAD/可刷写固件。交付 ZIP 明确标为草案包，未登记或未确认文件不会被伪造为已完成。</p><div class="fieldgrid"><label>文件类别<select id="fileCategory">${Object.entries(
      categories,
    )
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join(
        '',
      )}</select></label><label>修订号<input id="fileRevision" placeholder="例如 rev-A"></label></div><label>文件说明<textarea id="fileNotes" placeholder="文件用途、软件版本、限制与验证依据"></textarea></label><label class="check"><input type="checkbox" id="embedFile" checked>将文件内容内嵌到项目与交付包（单个 ≤10 MB，总计 ≤30 MB）</label><label class="check" style="margin-top:7px"><input type="checkbox" id="confirmFile">人工确认文件与当前布局相容</label><button id="addEngineeringFile" style="margin-top:12px">选择并登记工程文件</button><p class="micro">只登记模式保留文件名、大小和 SHA-256；交付包会列出仍需另外提供的文件。修改布局后按类别依赖判断是否需要重新验证。</p></div><div class="card"><h3>已登记文件</h3><div class="table-scroll"><table class="small-table"><thead><tr><th>文件与修订</th><th>类别 / 布局</th><th>内容</th><th>当前状态</th><th>操作</th></tr></thead><tbody>${
      project.engineeringFiles
        .map((f) => {
          const same = f.dependencyHash === T.artifactHash(project, f.category),
            status = !f.confirmed
              ? '未确认'
              : same
                ? '人工确认，依赖一致'
                : '设计依赖变化，需要复核';
          return `<tr><td>${esc(f.name)}<br>${esc(f.revision)}<br><code>${f.sha256.slice(0, 16)}</code></td><td>${esc(categories[f.category])}<br>${f.layoutVersionId}</td><td>${f.contentBase64 ? '已内嵌' : '仅登记'}<br>${f.size} bytes</td><td class="${same && f.confirmed ? '' : 'error-text'}">${status}</td><td><button data-confirm-file="${f.id}">复核并关联当前版</button>${f.contentBase64 ? ` <button data-download-file="${f.id}">下载原文件</button>` : ''}</td></tr>`;
        })
        .join('') || '<tr><td colspan="5">尚未登记真实工程文件。</td></tr>'
    }</tbody></table></div></div><div class="card"><h3>导出制作交付草案包</h3><p class="hint">ZIP 包含项目 JSON、对应布局 JSON、完整教程 HTML、派生 BOM CSV、接线说明、manifest 和已内嵌工程文件。每次导出会固定当前布局与教程版本。</p><button class="primary" id="exportDelivery">生成并下载交付 ZIP</button></div>`;
    $('addEngineeringFile').onclick = () => $('engineeringFile').click();
    $('engineeringFile').onchange = async () => {
      const file = $('engineeringFile').files[0];
      if (!file) return;
      try {
        const embed = $('embedFile').checked;
        if (embed && file.size > 10 * 1024 * 1024)
          throw Error('文件超过 10 MB，请取消内嵌后仅登记。');
        const bytes = new Uint8Array(await file.arrayBuffer()),
          category = $('fileCategory').value;
        P.addFile(
          project,
          file,
          category,
          $('fileRevision').value,
          $('fileNotes').value,
          $('confirmFile').checked,
          bytes,
          embed,
          T.artifactHash(project, category),
        );
        persist();
        renderFiles();
        notify('工程文件已登记并关联布局版本。');
      } catch (e) {
        notify(e.message, true);
      }
      $('engineeringFile').value = '';
    };
    body.querySelectorAll('[data-confirm-file]').forEach(
      (b) =>
        (b.onclick = () => {
          const f = project.engineeringFiles.find((f) => f.id === b.dataset.confirmFile),
            v = P.saveLayout(project);
          f.history.push({
            layoutVersionId: f.layoutVersionId,
            designHash: f.designHash,
            dependencyHash: f.dependencyHash,
            confirmed: f.confirmed,
            at: P.stamp(),
          });
          f.layoutVersionId = v.id;
          f.designHash = v.designHash;
          f.dependencyHash = T.artifactHash(project, f.category);
          f.confirmed = true;
          P.touch(project, 'confirm-file', f.id);
          persist();
          renderFiles();
        }),
    );
    body.querySelectorAll('[data-download-file]').forEach(
      (b) =>
        (b.onclick = () => {
          const f = project.engineeringFiles.find((f) => f.id === b.dataset.downloadFile);
          download(safe(f.name), P.base64Bytes(f.contentBase64), 'application/octet-stream');
        }),
    );
    $('exportDelivery').onclick = () => {
      try {
        const files = deliveryFiles();
        download(
          safe(project.name) + '-' + files.manifest.layoutVersionId + '-交付草案.zip',
          P.zip(files.files),
          'application/zip',
        );
        notify('交付草案包已生成；缺失工程文件与未确认项见 manifest。');
      } catch (e) {
        notify(e.message, true);
      }
    };
  }
  function csv(rows) {
    return (
      '\ufeff' +
      rows
        .map((row) =>
          row
            .map((v) => {
              let s = String(v ?? '');
              if (/^[=+\-@]/.test(s)) s = "'" + s;
              return '"' + s.replace(/"/g, '""') + '"';
            })
            .join(','),
        )
        .join('\r\n')
    );
  }
  function deliveryFiles() {
    syncFromEditor();
    const rec = T.saveTutorial(project),
      d = project.working.design,
      analysis = C.analyze(d),
      manifest = {
        kind: 'keyboard-diy-delivery-draft',
        schemaVersion: '1.0.0',
        projectId: project.id,
        layoutVersionId: rec.layoutVersionId,
        tutorialVersionId: rec.id,
        designHash: rec.designHash,
        tutorialContentHash: rec.contentHash,
        readyForManufacture: false,
        reason: '布局草案与教程不替代电气、机械和固件工程验证',
        unresolved: analysis.issues,
        knownBaselineIssues: analysis.knownBaselineIssues,
        engineeringFiles: project.engineeringFiles.map(({ contentBase64, ...f }) => ({
          ...f,
          included: contentBase64 !== null,
          compatibleDependencies: f.dependencyHash === T.artifactHash(project, f.category),
        })),
        missingCategories: Object.keys(categories).filter(
          (k) =>
            ['schematic', 'pcb', 'plate', 'case', 'bom', 'firmware'].includes(k) &&
            !project.engineeringFiles.some((f) => f.category === k),
        ),
      };
    const files = [
      { name: 'project.keyboard-project.json', data: JSON.stringify(project, null, 2) },
      {
        name: rec.layoutVersionId + '.layout.json',
        data: JSON.stringify(C.exportPackage(d), null, 2),
      },
      { name: rec.id + '-教程.html', data: T.render(rec.model, project.library, rec) },
      {
        name: '派生物料待确认.csv',
        data: csv([['ID', '类别', '数量', '厂家', '型号', '封装', '状态'], ...T.bomRows(d)]),
      },
      {
        name: '当前接线说明.md',
        data:
          '# 当前接线记录\n\n布局 ' +
          rec.layoutVersionId +
          '\n\n这是 JSON 中的接线声明，必须按原理图与实物核对。\n\n' +
          T.wiringRows(d)
            .map((row) => '- ' + row.join(' | '))
            .join('\n'),
      },
      { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
      {
        name: '交付前须知.md',
        data:
          '# 制作交付草案包\n\n不能直接投产。先读 manifest 的 unresolved、missingCategories 与工程文件确认状态。\n\n仅登记、未内嵌的文件需另行提供；依赖变化的文件需要人工复核。\n\n没有自动生成 Gerber、STL、QMK 完整工程或固件。\n\n当前设计 SHA-256 ' +
          rec.designHash,
      },
    ];
    for (const f of project.engineeringFiles)
      if (f.contentBase64 !== null)
        files.push({
          name: 'engineering/' + f.id + '-' + safe(f.name),
          data: P.base64Bytes(f.contentBase64),
        });
    persist();
    return { files, manifest };
  }
  function renderAI() {
    const body = $('studioBody');
    body.className = 'studio-body ai-view';
    const requests = project.aiRequests || [],
      inbox = project.aiInbox || [];
    body.innerHTML = `<h2>可选 AI 更新接口</h2><div class="card"><p>离线模板已能生成完整教程。AI 只用于补充解释或待确认问题，不会自动修改布局、引脚、已确认正文或安全检查。</p><label>请求更新的章节<select id="aiChapter">${project.library.chapters.map((c) => `<option value="${c.id}">${c.sourcePage} ${esc(c.title)}</option>`).join('')}</select></label><div class="file-actions" style="margin-top:12px"><button id="exportAIRequest">导出 AI 更新请求 JSON</button><button id="importAIResponse">导入 AI 建议 JSON</button><button id="callAIProvider" ${provider ? '' : 'disabled'}>调用已注册适配器</button></div><p class="hint">默认不连接任何服务，也不保存 API 密钥。可把请求交给你选择的 AI，再按协议导入响应；响应需匹配项目、请求、布局哈希与章节依赖。没有服务时全部功能仍可离线使用。</p><details><summary>响应格式与适配接口</summary><pre class="text-block">${esc(JSON.stringify({ kind: 'keyboard-diy-ai-response', schemaVersion: '1.0.0', requestId: '原请求 requestId', projectId: '原请求 projectId', designHash: '原请求 designHash', suggestions: [{ chapterId: 'ch08', dependencyHash: '原请求的章节依赖哈希', text: '纯文本建议，未知项保持待确认' }] }, null, 2))}</pre><p class="hint">开发者可注册 window.KeyboardDIY.registerAIProvider(async request =&gt; response)。只有点击调用按钮才执行；网络和鉴权由自有适配器负责，页面不内置密钥。</p></details></div><div class="card"><h3>待审核建议</h3>${inbox.map((s, i) => `<article class="card"><strong>${esc(s.chapterId)} · ${s.accepted ? '已取入人工待审核内容' : '待审核'}</strong><p class="text-block">${esc(s.text)}</p><button data-adopt-ai="${i}" ${s.accepted ? 'disabled' : ''}>追加到人工待审核内容</button></article>`).join('') || '<p class="hint">没有待审核 AI 建议。</p>'}</div><details class="card"><summary>已导出的请求 ${requests.length} 个</summary>${requests.map((r) => `<p class="micro">${esc(r.requestId)} · ${r.designHash.slice(0, 12)} · ${r.chapters.map((c) => c.chapterId).join(', ')}</p>`).join('')}</details>`;
    const makeRequest = () => {
      const r = T.aiRequest(project, [$('aiChapter').value]);
      project.aiRequests ||= [];
      project.aiRequests.push(r);
      P.touch(project, 'ai-request', r.requestId);
      autosave();
      return r;
    };
    $('exportAIRequest').onclick = () => {
      const r = makeRequest();
      download(r.requestId + '.ai-request.json', JSON.stringify(r, null, 2));
      renderAI();
    };
    $('importAIResponse').onclick = () => $('aiResponseFile').click();
    $('aiResponseFile').onchange = async () => {
      const file = $('aiResponseFile').files[0];
      if (!file) return;
      try {
        if (file.size > 1024 * 1024) throw Error('AI 响应不得超过 1 MB');
        ingestAI(JSON.parse(await file.text()));
      } catch (e) {
        notify('AI 建议未应用：' + e.message, true);
      }
      $('aiResponseFile').value = '';
    };
    $('callAIProvider').onclick = async () => {
      try {
        const request = makeRequest(),
          response = await provider(P.clone(request));
        ingestAI(response);
      } catch (e) {
        notify('AI 适配器调用失败；离线教程不受影响：' + e.message, true);
      }
    };
    body.querySelectorAll('[data-adopt-ai]').forEach(
      (b) =>
        (b.onclick = () => {
          try {
            const s = project.aiInbox[Number(b.dataset.adoptAi)],
              ch = project.library.chapters.find((c) => c.id === s.chapterId);
            if (
              !ch ||
              s.designHash !== P.hashDesign(project.working.design) ||
              s.dependencyHash !== T.dependency(project, ch)
            )
              throw Error('建议对应的布局或依赖已改变，请重新请求。');
            const old = project.notes[ch.id],
              text = (old?.body ? old.body + '\n\n' : '') + 'AI 补充建议 待人工审核\n' + s.text;
            P.setNote(
              project,
              ch.id,
              text,
              old?.author || '',
              old?.evidence || '',
              false,
              T.dependency(project, ch),
            );
            project.notes[ch.id].origin = 'ai-assisted';
            s.accepted = true;
            persist();
            renderAI();
            notify('已追加为待审核内容；原人工正文和历史保留，未改布局。');
          } catch (e) {
            notify(e.message, true);
          }
        }),
    );
  }
  function ingestAI(response) {
    const request = project.aiRequests?.find((r) => r.requestId === response.requestId),
      errors = T.validateAI(response, project, request);
    if (errors.length) throw Error(errors.join('\n'));
    project.aiInbox ||= [];
    for (const s of response.suggestions)
      project.aiInbox.push({
        ...P.clone(s),
        requestId: response.requestId,
        designHash: response.designHash,
        accepted: false,
      });
    P.touch(project, 'ai-response', response.requestId);
    autosave();
    if (mode === 'ai') renderAI();
    notify('建议已进入待审核区，尚未改变教程或设计。');
  }
  window.KeyboardDIY = {
    isOpen: () => !!mode,
    show,
    getProject: () => P.clone(project),
    getPreview: () => P.clone(rebuild()),
    getStats: () => ({ reused: lastStats.reused, changed: lastStats.changed }),
    importProject: importProjectValue,
    generate: () => generate(false),
    getDelivery: deliveryFiles,
    registerAIProvider: (fn) => {
      if (typeof fn !== 'function') throw Error('适配器必须是函数');
      provider = fn;
      if (mode === 'ai') renderAI();
    },
    ingestAI,
  };
  window.addEventListener('keydown', (ev) => {
    if (!mode) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      saveProject();
    }
    if (ev.key === 'Escape' && !ev.target.closest('input,textarea,select')) show('layout');
  });
  rebuild();
  readSaved()
    .then((value) => {
      if (value) {
        pending = value;
        $('resumeProject').classList.remove('hidden');
        $('resumeProject').title = '上次项目 ' + value.name;
      }
    })
    .catch(() => {});
})();
