// 使用说明.md 是唯一正文来源；截图是源资源，HTML/PDF 是阅读产物。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.dirname(__dirname);
const escapeHTML = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

(async () => {
  const { marked } = await import('marked');
  const source = fs.readFileSync(path.join(root, '使用说明.md'), 'utf8');
  const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
  const headings = [...source.matchAll(/^## (.+)$/gm)].map((m, i) => ({
    title: m[1],
    id: 'guide-' + (i + 1),
  }));
  let html = marked.parse(source);
  let index = 0;
  html = html.replace(
    /<h2>([\s\S]*?)<\/h2>/g,
    (_, text) =>
      `${index ? '</section>' : ''}<section id="${headings[index++].id}" class="guide-section"><h2>${text}</h2>`,
  );
  html += '</section>';
  let figureCount = 0;
  html = html.replace(
    /<p>\s*<img src="([^"]+)" alt="([^"]*)"[^>]*>\s*<\/p>/g,
    (_, src, caption) => {
      const imagePath = path.resolve(root, decodeURIComponent(src));
      if (!imagePath.startsWith(path.join(root, 'docs', 'images') + path.sep))
        throw Error('Unexpected guide asset: ' + src);
      const data = fs.readFileSync(imagePath);
      figureCount++;
      return `<figure><img src="data:image/png;base64,${data.toString('base64')}" alt="${caption}" tabindex="0" title="点击放大图片"><figcaption>${caption}</figcaption></figure>`;
    },
  );
  if (figureCount !== 8) throw Error('Expected 8 guide screenshots, got ' + figureCount);
  const css = fs.readFileSync(path.join(__dirname, 'guide.css'), 'utf8');
  const result = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="guide-source-sha256" content="${sourceHash}"><title>键盘 DIY 工作台 · 图文使用指南</title><style>${css}</style></head>
<body><nav class="guide-nav"><strong>键盘 DIY 工作台</strong><p>统一图文使用指南</p><button id="printGuide">打印 / 另存 PDF</button><label class="section-picker">跳到章节<select id="sectionJump"><option value="top">选择阅读章节</option>${headings.map((h) => `<option value="${h.id}">${escapeHTML(h.title)}</option>`).join('')}</select></label><a href="#top">从头阅读</a>${headings.map((h) => `<a href="#${h.id}">${escapeHTML(h.title)}</a>`).join('')}<small>图片可点击放大<br>离线运行 · 无外部资源</small></nav>
<main id="top" data-guide-source-sha256="${sourceHash}">${html}<footer>指南正文：使用说明.md<br>源文件 SHA-256：${sourceHash}</footer></main>
<dialog id="imageViewer"><button id="closeImage">关闭放大图 · Esc</button><img alt="界面截图放大"></dialog>
<script>document.getElementById('printGuide').onclick=()=>window.print();document.getElementById('sectionJump').onchange=e=>document.getElementById(e.target.value).scrollIntoView({block:'start'});const viewer=document.getElementById('imageViewer');const show=(img)=>{viewer.querySelector('img').src=img.src;viewer.querySelector('img').alt=img.alt;viewer.showModal();};document.querySelectorAll('figure img').forEach(img=>{img.onclick=()=>show(img);img.onkeydown=e=>{if(e.key==='Enter'){show(img);}};});document.getElementById('closeImage').onclick=()=>viewer.close();</script></body></html>`;
  fs.writeFileSync(path.join(root, '使用说明图文版.html'), result);
  console.log('Built unified guide:', headings.length, 'sections,', figureCount, 'screenshots');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
