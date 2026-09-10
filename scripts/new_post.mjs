// scripts/new_post.py の node 移植（トヨのマシンは python が Windows Store のスタブで動かないため）。処理・テンプレは py と同じ。
// 使い方: node scripts/new_post.mjs --title "ペルソナ" --body draft.txt [--date 2026-09-10] [--desc "..."] [--vol 56] [--dry-run]
//        --root は省略可（既定＝このリポジトリのルート）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);
const ROOT = opt("--root") || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TITLE = opt("--title");
const BODY = opt("--body");
const DRY = has("--dry-run");
const BASE = "https://www.toyoseeds.com";
const TOP_NEWS_ROWS = 4;
if (!TITLE || !BODY) { console.error("--title --body は必須"); process.exit(1); }

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const readLF = (p) => { const s = fs.readFileSync(p, "utf8"); return { text: s.replace(/\r\n/g, "\n"), crlf: s.includes("\r\n") }; };
const writeEOL = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");

const vols = fs.readdirSync(ROOT).map((n) => /^shachonikki_day(\d+)$/.exec(n)).filter(Boolean).map((m) => +m[1]);
const vol = opt("--vol") ? +opt("--vol") : Math.max(...vols) + 1;
const slug = `shachonikki_day${vol}`;
const prevSlug = `shachonikki_day${vol - 1}`;
if (fs.existsSync(path.join(ROOT, slug)) && !opt("--vol")) { console.error(`[中止] ${slug} はすでに存在します`); process.exit(1); }
if (!fs.existsSync(path.join(ROOT, prevSlug))) { console.error(`[中止] 前の記事 ${prevSlug} が無い`); process.exit(1); }

const dateStr = opt("--date") || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // JST
const iso = dateStr;
const dot = dateStr.replace(/-/g, ".");
const title = TITLE.trim();

// 本文: 空行で段落、段落内改行は <br>。裸URLはリンクにする。
function buildBody(text) {
  const blocks = [];
  for (const raw of text.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/)) {
    const block = raw.trim();
    if (!block) continue;
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean).map((l) =>
      esc(l).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
    );
    blocks.push("<p>" + lines.join("<br>\n") + "</p>");
  }
  return blocks.join("\n\n");
}
const plain = (h) => h.replace(/<br>\s*/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const bodyHtml = buildBody(fs.readFileSync(BODY, "utf8"));
const desc = opt("--desc") || plain(bodyHtml).slice(0, 110) + "…";
const prevRead = readLF(path.join(ROOT, prevSlug, "index.html"));
const prevTitle = /<h1>([\s\S]*?)<\/h1>/.exec(prevRead.text)[1].trim();

const article = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>vol${vol} ${esc(title)}｜ToyoSeeds合同会社</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${BASE}/${slug}/">
<meta property="og:type" content="article">
<meta property="og:title" content="vol${vol} ${esc(title)}｜ToyoSeeds合同会社">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${BASE}/${slug}/">
<meta property="og:image" content="${BASE}/assets/og-image-v3.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../assets/content-v2.css">
</head>
<body>
<header class="content-header">
  <a class="brand" href="/">Toyo<span>Seeds</span></a>
  <nav aria-label="主要メニュー">
    <a href="/">ホーム</a><a href="/news/">News</a><a href="/#company">会社概要</a><a class="nav-contact" href="/contact/">お問い合わせ</a>
  </nav>
</header>
<main class="article-shell">
  <a class="back-link" href="/news/">← News一覧へ</a>
  <article class="article-card">
    <header class="article-title">
      <span class="category">社長日記</span>
      <time datetime="${iso}">${dot}</time>
      <h1>vol${vol} ${esc(title)}</h1>
    </header>
    <div class="wp-content">${bodyHtml}</div>
    <div class="post-like">
      <button type="button" class="like-btn" data-slug="${slug}" aria-pressed="false" aria-label="スキ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.3 4.8 6.6 4.5c2-.2 3.7.8 4.6 2.3 1-1.5 2.7-2.5 4.7-2.3 3.3.3 5.2 3.5 3.9 6.8-1.8 4.6-7.8 9.2-7.8 9.2z"/></svg>スキ</button>
      <span class="like-count" aria-live="polite"></span>
    </div>
  </article>
  <aside class="post-cta">
    <p>ToyoSeeds合同会社は、福岡でAI・データ活用と、宿泊・インバウンドの2つの事業を営んでいます。</p>
    <a href="/#services">ToyoSeedsの事業を見る →</a>
  </aside>
  <nav class="article-nav" aria-label="記事の前後移動"><a href="/${prevSlug}/"><small>← 前の記事</small><strong>${esc(prevTitle)}</strong></a></nav>
  <a class="button" href="/news/">社長日記・お知らせ一覧へ</a>
</main>
<footer class="content-footer">
  <a class="brand brand--footer" href="/">Toyo<span>Seeds</span></a>
  <div><a href="/privacy-policy/">プライバシーポリシー</a><span>© ToyoSeeds LLC.</span></div>
</footer>
<script defer src="/likes.js"></script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
`;

const topRow = `      <a class="news-row" href="/${slug}/" style="display:grid;grid-template-columns:130px 110px 1fr;gap:24px;align-items:baseline;padding:22px 8px;border-top:1px solid #DDE1EA;color:#1A2142" style-hover="background:#F7F8FB;color:var(--c-primary)">
        <span style="font-size:15.2px;color:#5A6180;font-variant-numeric:tabular-nums">${dot}</span>
        <span style="font-size:12.9px;font-weight:800;letter-spacing:.1em;color:var(--c-tag-ink);background:var(--c-tag-bg);border-radius:999px;padding:4px 12px;text-align:center">社長日記</span>
        <span style="font-size:17.4px;font-weight:600">vol${vol} ${esc(title)}</span>
      </a>
`;

const changes = [];
function replaceOnce(rel, oldS, newS) {
  const p = path.join(ROOT, rel);
  const { text, crlf } = readLF(p);
  const n = text.split(oldS).length - 1;
  if (n !== 1) { console.error(`[中止] ${rel} に想定箇所が ${n} 件（1件のはず）`); process.exit(1); }
  changes.push(rel);
  if (!DRY) writeEOL(p, text.replace(oldS, newS), crlf);
}

// 1. 記事本体（新規ファイルは LF）
changes.push(`${slug}/index.html`);
if (!DRY) { fs.mkdirSync(path.join(ROOT, slug), { recursive: true }); fs.writeFileSync(path.join(ROOT, slug, "index.html"), article, "utf8"); }

// 2. news 一覧の先頭
replaceOnce("news/index.html", '<div class="news-list">',
  `<div class="news-list"><a class="news-list-row" href="/${slug}/"><time datetime="${iso}">${dot}</time><span class="category">社長日記</span><strong>vol${vol} ${esc(title)}</strong></a>`);

// 3. トップ News 欄（先頭に足して最古を落とす）
{
  const p = path.join(ROOT, "index.html");
  let { text, crlf } = readLF(p);
  const rowRe = /      <a class="news-row" href="\/[^"]+\/"[\s\S]*?\n      <\/a>\n/g;
  let rows = [...text.matchAll(rowRe)];
  if (!rows.length) { console.error("[中止] トップの News 欄が見つからない"); process.exit(1); }
  text = text.slice(0, rows[0].index) + topRow + text.slice(rows[0].index);
  rows = [...text.matchAll(rowRe)];
  for (const extra of rows.slice(TOP_NEWS_ROWS).reverse()) text = text.slice(0, extra.index) + text.slice(extra.index + extra[0].length);
  changes.push(`index.html（残す${Math.min(rows.length, TOP_NEWS_ROWS)}件／落とす${Math.max(rows.length - TOP_NEWS_ROWS, 0)}件）`);
  if (!DRY) writeEOL(p, text, crlf);
}

// 4. sitemap
replaceOnce("sitemap.xml", "</urlset>", `  <url><loc>${BASE}/${slug}/</loc></url>\n</urlset>`);

// 5. 前の記事に「次の記事 →」
if (prevRead.text.includes("次の記事")) console.log(`[skip] ${prevSlug} には次の記事リンクが既にある`);
else replaceOnce(`${prevSlug}/index.html`, "</a></nav>",
  `</a><a href="/${slug}/"><small>次の記事 →</small><strong>vol${vol} ${esc(title)}</strong></a></nav>`);

console.log(`vol${vol} ${title}（${dot}）… ${DRY ? "変更予定（--dry-run）" : "更新しました"}`);
for (const c of changes) console.log("  - " + c);
console.log("desc: " + desc);
