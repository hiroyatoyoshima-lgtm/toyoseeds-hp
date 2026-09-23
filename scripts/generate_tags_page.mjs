// scripts/generate_tags_page.py の node 移植（トヨのマシンは python が Windows Store のスタブで動かないため）。
// 既存の tags/index.html の head/footer はそのまま残し、<p class="lead"> と </main> の間（タグ並び＋タグごとの一覧）だけ作り直す。
// 材料は scripts/tags.json（記事→タグ）と news/index.html（記事の日付・タイトル・区分）。
//   node scripts/generate_tags_page.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readLF = (p) => { const s = fs.readFileSync(p, "utf8"); return { text: s.replace(/\r\n/g, "\n"), crlf: s.includes("\r\n") }; };
const writeEOL = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const ROW = /<a class="news-list-row" href="([^"]+)"><time datetime="([^"]+)">([^<]+)<\/time><span class="category([^"]*)"([^>]*)>([^<]*)<\/span><strong(.*?)>(.*?)<\/strong><\/a>/gs;

const tagsAll = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "tags.json"), "utf8"));
const tags = Object.fromEntries(Object.entries(tagsAll).filter(([k]) => !k.startsWith("_")));
const news = readLF(path.join(ROOT, "news", "index.html")).text;

const rows = {};
const order = [];
for (const m of news.matchAll(ROW)) {
  const slug = m[1].replace(/^\/+|\/+$/g, "");
  rows[slug] = { iso: m[2], dot: m[3], mod: m[4], cattr: m[5], cat: m[6], tattr: m[7], title: m[8] };
  order.push(slug);
}
const missing = Object.keys(tags).filter((s) => !rows[s]);
if (missing.length) { console.error(`[中止] news/index.html に見つからない記事: ${missing.join(", ")}`); process.exit(1); }

const groups = {};
const enOf = {};
for (const slug of order) { // news は新しい順。その順のまま各タグに入る
  const list = Array.isArray(tags[slug]) ? tags[slug] : slug in tags ? [tags[slug]] : [];
  for (const tag of list) { (groups[tag.ja] ||= []).push(slug); enOf[tag.ja] = tag.en; }
}
// 本数の多いタグから。同数なら新しい記事があるほうを先に
const ordered = Object.keys(groups).sort((a, b) => (groups[b].length - groups[a].length) || (order.indexOf(groups[a][0]) - order.indexOf(groups[b][0])));

const anchor = (ja) => "tag-" + ja.replace(/^#+/, "");
const enAttr = (ja, en) => (en && en !== ja ? ` data-en="${esc(en)}"` : "");

// タグが1つだけのときは、上のタグ並びは出さない（押す先が自分しかない）
const cloud = ordered.length > 1
  ? ordered.map((t) => `<a href="#${anchor(t)}"${enAttr(t, enOf[t])}>${esc(t)}</a>`).join("")
  : "";
const cloudHtml = cloud ? `  <nav class="tag-cloud" aria-label="タグ" data-en-aria-label="Tags">${cloud}</nav>\n` : "";

const out = ordered.map((t) => {
  const items = groups[t].map((s) => {
    const r = rows[s];
    return `<a class="news-list-row" href="/${s}/"><time datetime="${r.iso}">${r.dot}</time><span class="category${r.mod}"${r.cattr}>${r.cat}</span><strong${r.tattr}>${r.title}</strong></a>`;
  }).join("");
  const n = groups[t].length;
  return `  <section class="tag-group" id="${anchor(t)}">\n` +
    `    <h2${enAttr(t, enOf[t])}>${esc(t)}</h2>\n` +
    `    <p class="tag-count" data-en="${n} post${n > 1 ? "s" : ""}">${n}本</p>\n` +
    `    <div class="news-list">${items}</div>\n` +
    `  </section>\n`;
}).join("");

const pagePath = path.join(ROOT, "tags", "index.html");
const page = readLF(pagePath);
const re = /(<p class="lead"[^>]*>[^\n]*<\/p>\n)[\s\S]*?(<\/main>)/;
if (!re.test(page.text)) { console.error("[中止] tags/index.html の差し替え位置（<p class=\"lead\">〜</main>）が見つからない"); process.exit(1); }
writeEOL(pagePath, page.text.replace(re, (_, head, tail) => head + cloudHtml + out + tail), page.crlf);
console.log(`tags/index.html を作りました（タグ ${ordered.length}／記事 ${Object.keys(tags).length}）`);
