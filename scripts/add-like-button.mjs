#!/usr/bin/env node
// 既存の社長日記（shachonikki_dayNN / sahchonikki_dayNN）に「スキ」ボタンと likes.js を差し込む。
// 何度実行しても二重には入らない。新規記事は new_post.py が最初から付けるので、これは過去分の一括用。
//
//   node scripts/add-like-button.mjs            # 実行
//   node scripts/add-like-button.mjs --dry-run  # 変更せず対象だけ表示
import {readdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const SLUG_RE = /^(shachonikki|sahchonikki)_day\d+$/;
const INSIGHTS = '<script defer src="/_vercel/insights/script.js"></script>';
const LIKES_SCRIPT = '<script defer src="/likes.js"></script>';

export function likeBlock(slug) {
  return [
    '    <div class="post-like">',
    `      <button type="button" class="like-btn" data-slug="${slug}" aria-pressed="false" aria-label="スキ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.3 4.8 6.6 4.5c2-.2 3.7.8 4.6 2.3 1-1.5 2.7-2.5 4.7-2.3 3.3.3 5.2 3.5 3.9 6.8-1.8 4.6-7.8 9.2-7.8 9.2z"/></svg>スキ</button>`,
    '      <span class="like-count" aria-live="polite"></span>',
    '    </div>',
  ].join('\n');
}

export function addLikeButton(html, slug) {
  if (html.includes('class="post-like"')) return null; // 済み
  const closeAt = html.indexOf('</article>');
  if (closeAt < 0) throw new Error('</article> が見つかりません');
  // 「  </article>」の行頭インデントの前に差し込む
  const lineStart = html.lastIndexOf('\n', closeAt) + 1;
  let out = html.slice(0, lineStart) + likeBlock(slug) + '\n' + html.slice(lineStart);
  if (!out.includes(LIKES_SCRIPT)) {
    if (out.includes(INSIGHTS)) out = out.replace(INSIGHTS, LIKES_SCRIPT + '\n' + INSIGHTS);
    else out = out.replace('</body>', LIKES_SCRIPT + '\n</body>');
  }
  return out;
}

function main() {
  const slugs = readdirSync(ROOT).filter((n) => SLUG_RE.test(n) && existsSync(join(ROOT, n, 'index.html')));
  let changed = 0;
  let skipped = 0;
  for (const slug of slugs.sort()) {
    const file = join(ROOT, slug, 'index.html');
    const html = readFileSync(file, 'utf8');
    const out = addLikeButton(html, slug);
    if (out === null) { skipped++; continue; }
    if (!DRY) writeFileSync(file, out, 'utf8');
    changed++;
    console.log(`${DRY ? '(dry) ' : ''}${slug}`);
  }
  console.log(`[add-like-button] 追加 ${changed} / 済み ${skipped}${DRY ? '（DRY RUN）' : ''}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
