// 读取 data/releases.json（由 GitHub Actions 定时同步），渲染最新版本与更新日志。
// 若本地数据不可用，或 GitHub 上已有更新的版本，则直接使用 GitHub API 的数据。
(() => {
  const REPO = "chungbinb/ycIDE-electron";
  const LOCAL_URL = "data/releases.json";
  const API_URL = `https://api.github.com/repos/${REPO}/releases?per_page=20`;
  const SHOW_COUNT = 6;

  const listEl = document.getElementById("changelogList");
  const noteEl = document.getElementById("versionNote");
  const downloadBtn = document.getElementById("downloadBtn");
  if (!listEl) return;

  const escapeHtml = (s) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // 行内：`代码`、**粗体**、[文字](链接)
  const inline = (text) => {
    const codes = [];
    let s = escapeHtml(text).replace(/`([^`]+)`/g, (_, c) => {
      codes.push(c);
      return `\u0000${codes.length - 1}\u0000`;
    });
    s = s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\[(新增|优化|修复|变更|移除)\]/g, (_, t) => `<span class="tag tag-${t}">${t}</span>`);
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
  };

  // 精简 Markdown 渲染：标题、分隔线、引用、嵌套列表、段落
  const renderMarkdown = (md) => {
    const lines = md.split("\n");
    let html = "";
    const stack = []; // 列表缩进栈
    let para = [];

    const flushPara = () => {
      if (para.length) html += `<p>${inline(para.join(" "))}</p>`;
      para = [];
    };
    const closeLists = (depth = 0) => {
      while (stack.length > depth) {
        stack.pop();
        html += "</li></ul>";
      }
    };

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      const item = line.match(/^(\s*)[-*+]\s+(.*)$/);
      if (item) {
        flushPara();
        const indent = item[1].length;
        if (!stack.length || indent > stack[stack.length - 1]) {
          stack.push(indent);
          html += "<ul><li>";
        } else {
          while (stack.length > 1 && indent < stack[stack.length - 1]) {
            stack.pop();
            html += "</li></ul>";
          }
          html += "</li><li>";
        }
        html += inline(item[2]);
        continue;
      }
      if (!line.trim()) {
        flushPara();
        continue;
      }
      if (stack.length && /^\s+\S/.test(line)) {
        html += ` ${inline(line.trim())}`; // 列表项续行
        continue;
      }
      closeLists();
      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushPara();
        const level = Math.min(heading[1].length + 1, 6);
        html += `<h${level}>${inline(heading[2])}</h${level}>`;
      } else if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
        flushPara();
        html += "<hr />";
      } else if (line.startsWith(">")) {
        flushPara();
        html += `<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`;
      } else {
        para.push(line.trim());
      }
    }
    flushPara();
    closeLists();
    return html;
  };

  // 去掉正文开头与卡片标题重复的「## ycIDE - xxx」和分隔线
  const cleanBody = (body) => body.replace(/^\s*#{1,3}\s+ycIDE[^\n]*\n+(\s*-{3,}\s*\n+)?/, "");

  const versionOf = (tag, name) => {
    const m = `${tag} ${name || ""}`.match(/v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?/);
    return m ? (m[0].startsWith("v") ? m[0] : `v${m[0]}`) : tag;
  };

  const fromApi = (list) =>
    list
      .filter((r) => !r.draft)
      .map((r) => ({
        tag: r.tag_name,
        name: r.name || r.tag_name,
        version: versionOf(r.tag_name, r.name),
        date: (r.published_at || r.created_at || "").slice(0, 10),
        publishedAt: r.published_at || r.created_at,
        prerelease: r.prerelease,
        url: r.html_url,
        body: (r.body || "").replace(/\r\n/g, "\n").trim(),
        assets: (r.assets || []).map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url }))
      }));

  const formatSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);

  const mainAsset = (release) =>
    release.assets.find((a) => /\.(exe|7z|zip|msi)$/i.test(a.name)) || release.assets[0];

  const renderRelease = (r, open) => {
    const asset = mainAsset(r);
    const badge = r.prerelease ? '<span class="release-badge is-pre">测试版</span>' : '<span class="release-badge">正式版</span>';
    const download = asset
      ? `<a class="release-download" href="${escapeHtml(asset.url)}" rel="noopener noreferrer">下载 ${escapeHtml(asset.name)}<span>${formatSize(asset.size)}</span></a>`
      : "";
    return `<details class="release-card"${open ? " open" : ""}>
      <summary>
        <span class="release-title"><strong>${escapeHtml(r.version)}</strong>${badge}</span>
        <time datetime="${escapeHtml(r.publishedAt || r.date)}">${escapeHtml(r.date)}</time>
      </summary>
      <div class="release-body">
        ${renderMarkdown(cleanBody(r.body)) || "<p>暂无更新说明。</p>"}
        <div class="release-actions">
          ${download}
          <a class="release-link" href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">在 GitHub 查看</a>
        </div>
      </div>
    </details>`;
  };

  let currentTag = null;

  const render = (releases) => {
    if (!releases.length) return;
    currentTag = releases[0].tag;
    const latest = releases[0];
    const asset = mainAsset(latest);

    if (noteEl) {
      noteEl.innerHTML = `${latest.prerelease ? "开发测试版" : "正式版"} ${escapeHtml(latest.version)}（${escapeHtml(latest.date)}） · <a href="#changelog">查看更新说明</a>`;
    }
    if (downloadBtn && asset) {
      downloadBtn.href = asset.url;
      downloadBtn.removeAttribute("target");
      downloadBtn.textContent = `下载 ${latest.version}`;
    }
    listEl.innerHTML = releases.slice(0, SHOW_COUNT).map((r, i) => renderRelease(r, i === 0)).join("");
  };

  const fetchJson = async (url, timeoutMs) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: "no-cache", signal: ctrl.signal });
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  };

  (async () => {
    let hasLocal = false;
    try {
      const data = await fetchJson(LOCAL_URL, 8000);
      if (data.releases?.length) {
        render(data.releases);
        hasLocal = true;
      }
    } catch {}

    // 再向 GitHub 确认一次是否有更新的版本（国内网络可能较慢，失败则保持本地数据）
    try {
      const live = fromApi(await fetchJson(API_URL, 6000));
      if (live.length && live[0].tag !== currentTag) render(live);
    } catch {
      if (!hasLocal) {
        listEl.innerHTML = `<p class="changelog-empty">暂时无法获取版本信息，请前往 <a href="https://github.com/${REPO}/releases" target="_blank" rel="noopener noreferrer">GitHub Releases</a> 查看。</p>`;
      }
    }
  })();
})();
