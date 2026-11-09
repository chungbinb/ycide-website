// 从 GitHub Releases 拉取 ycIDE 的版本与更新说明，写入 data/releases.json。
// 用法：node scripts/sync-releases.mjs   （可选环境变量 GITHUB_TOKEN 提高 API 限额）
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = process.env.RELEASES_REPO || "chungbinb/ycIDE-electron";
const LIMIT = Number(process.env.RELEASES_LIMIT || 20);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = resolve(root, "data", "releases.json");

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "ycide-website-release-sync"
};
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=${LIMIT}`, { headers });
if (!res.ok) {
  console.error(`GitHub API 请求失败：${res.status} ${await res.text()}`);
  process.exit(1);
}
const list = await res.json();

const versionOf = (r) => {
  const m = `${r.tag_name} ${r.name || ""}`.match(/v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?/);
  return m ? (m[0].startsWith("v") ? m[0] : `v${m[0]}`) : r.tag_name;
};

const releases = list
  .filter((r) => !r.draft)
  .map((r) => ({
    tag: r.tag_name,
    name: r.name || r.tag_name,
    version: versionOf(r),
    date: (r.published_at || r.created_at || "").slice(0, 10),
    publishedAt: r.published_at || r.created_at,
    prerelease: r.prerelease,
    url: r.html_url,
    body: (r.body || "").replace(/\r\n/g, "\n").trim(),
    assets: r.assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url }))
  }));

const data = { repo: REPO, releasesUrl: `https://github.com/${REPO}/releases`, releases };
const json = `${JSON.stringify(data, null, 2)}\n`;

let previous = "";
try {
  previous = await readFile(outFile, "utf8");
} catch {}

if (previous === json) {
  console.log("版本数据无变化。");
} else {
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, json, "utf8");
  console.log(`已更新 ${outFile}：共 ${releases.length} 个版本，最新 ${releases[0]?.version ?? "无"}`);
}
