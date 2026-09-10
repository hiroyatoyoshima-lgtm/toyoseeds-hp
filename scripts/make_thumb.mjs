// 社長日記の note 見出し画像（thumb.jpg・1280×670）を記事本文から自動生成する。
//
//   node scripts/make_thumb.mjs 56            # shachonikki_day56/thumb.jpg を作る（既にあれば何もしない）
//   node scripts/make_thumb.mjs 56 --dry      # API を呼ばず、記事の読み取りと画像プロンプトの組み立てだけ確認
//   node scripts/make_thumb.mjs 56 --force    # 既存の thumb.jpg を作り直す
//
// 必要なもの: 環境変数 OPENAI_API_KEY（GitHub Actions では Secrets）。画像の縮小に sharp（Actions 側で入れる）。
// 手順: 記事HTML → 見出しコピー（OpenAI テキストモデル・JSON）→ 画像生成（OpenAI 画像モデル・1536×1024）
//       → 1.91:1 に中央トリミングして 1280×670 の JPEG（品質85）で保存。
// 画像のトンマナは Codex の imagegen で作っていた prompt（note-thumbnails/day56-prompt.txt）をそのまま型にしている。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const vol = Number(args.find((a) => /^\d+$/.test(a)));
const DRY = args.includes("--dry");
const FORCE = args.includes("--force");
if (!vol) { console.error("vol 番号を指定してください（例: node scripts/make_thumb.mjs 56）"); process.exit(2); }

const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || "high"; // 日本語の可読性のため high 既定
const W = 1280, H = 670;

const slug = `shachonikki_day${vol}`;
const dir = path.join(ROOT, slug);
const out = path.join(dir, "thumb.jpg");
if (!fs.existsSync(path.join(dir, "index.html"))) { console.error(`[中止] ${slug}/index.html が無い`); process.exit(2); }
if (fs.existsSync(path.join(dir, "note-thumb.jpg")) && !FORCE) { console.log(`[skip] ${slug}/note-thumb.jpg が既にある`); process.exit(0); }
if (fs.existsSync(out) && !FORCE) { console.log(`[skip] ${slug}/thumb.jpg が既にある`); process.exit(0); }

// ---- 記事を読む ----
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const unesc = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const h1 = unesc(/<h1>([\s\S]*?)<\/h1>/.exec(html)[1].trim());
const title = h1.replace(/^vol\d+\s*/, "");
const bodyHtml = /<div class="wp-content">([\s\S]*?)<\/div>\s*<div class="post-like">/.exec(html)?.[1] ?? "";
const bodyText = unesc(bodyHtml.replace(/<figure[\s\S]*?<\/figure>/g, "").replace(/<br\s*\/?>/g, "\n").replace(/<\/p>/g, "\n\n").replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim();
console.log(`vol${vol} ${title}（本文 ${bodyText.length} 字）`);

// ---- 1. 見出しコピーと場面（テキストモデル・JSON）----
const COPY_SYSTEM = `あなたは ToyoSeeds（福岡の小さな会社）の社長日記の、note用サムネイルのコピーと絵柄を決める編集者です。
記事を読んで、次のJSONだけを返してください（前置き・コードフェンス不要）。
{
  "headline": "サムネの大見出し。日本語。12〜22文字。記事の核心を一文で。読者に説明せず事実を言い切る。句点で終える。",
  "subtitle": "小見出し。日本語。8〜18文字。見出しを補う一言。",
  "article_truth": "English. 1-2 sentences stating what the article actually says, including what must NOT be implied (e.g. do not imply something the author does not claim).",
  "scene": "English. One paragraph describing an editorial illustration that is STRUCTURAL about the article's idea: who/what is on the left, center, right; a single thin connecting line if there is a relation; one tiny Japanese label (max 6 chars) if useful, given in the text. Everyday adults, ordinary clothes, restrained expressions. No text in the scene other than the label.",
  "avoid": "English. Comma-separated list of motifs to avoid for this specific article (clichés that would misread it)."
}
ルール: 見出しは記事に無いことを足さない。教訓・説教にしない。数字や固有名詞は記事のとおり。`;

async function openai(pathname, payload) {
  const res = await fetch(`https://api.openai.com/v1/${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

function buildImagePrompt(c) {
  return `Create a finished Japanese note.com article thumbnail landscape 1.91:1, for Day${vol} ${title}. Article truth: ${c.article_truth} Main exact headline large readable normal Japanese Gothic: '${c.headline}' split into two well balanced lines across top. Smaller exact subtitle '${c.subtitle}'. Small footer 'ToyoSeeds / 社長日記　Day${vol} ${title}'. Editorial illustration in clean economical ink line with flat muted slate blue and subdued warm rust accent, plain white background. Below headline, asymmetrical horizontal narrative: ${c.scene} Both people (if any) everyday adults, restrained expressions, no idealized glossy anime or excessive shading. Clear composition with generous empty space. Avoid watercolor, beige texture, generic AI brush font, overly bold giant numerals, primary colors, sparkles, hearts, handshake, phone chat app UI, decorative plants, invented slogans, ${c.avoid}. Main headline dominant and legible at 320px width. No crowded fine detail. Produce polished final thumbnail with all text integrated, and no other readable words besides the headline, subtitle, footer and the tiny label.`;
}

const main = async () => {
  let copy;
  if (DRY) {
    copy = { headline: `（${title}の見出し・dry-run）`, subtitle: "（小見出し）", article_truth: "(dry-run)", scene: "(dry-run scene)", avoid: "(dry-run)" };
  } else {
    if (!process.env.OPENAI_API_KEY) { console.error("[中止] OPENAI_API_KEY が無い"); process.exit(3); }
    const r = await openai("chat/completions", {
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: COPY_SYSTEM },
        { role: "user", content: `# vol${vol} ${title}\n\n${bodyText}` },
      ],
    });
    const raw = r.choices[0].message.content.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    copy = JSON.parse(raw);
    for (const k of ["headline", "subtitle", "article_truth", "scene", "avoid"]) if (!copy[k]) throw new Error(`コピーJSONに ${k} が無い: ${raw}`);
  }
  const prompt = buildImagePrompt(copy);
  console.log(`headline: ${copy.headline}\nsubtitle: ${copy.subtitle}`);
  fs.mkdirSync(path.join(ROOT, ".thumb-log"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, ".thumb-log", `day${vol}-prompt.txt`), `${IMAGE_MODEL} (${IMAGE_QUALITY})\n${prompt}\n`);
  if (DRY) { console.log("\n--- image prompt ---\n" + prompt); return; }

  // ---- 2. 画像生成 ----
  const img = await openai("images/generations", { model: IMAGE_MODEL, prompt, size: "1536x1024", quality: IMAGE_QUALITY, n: 1 });
  const png = Buffer.from(img.data[0].b64_json, "base64");

  // ---- 3. 1.91:1 に中央トリミング → 1280×670 JPEG ----
  const require = createRequire(import.meta.url);
  let sharp;
  try { sharp = require("sharp"); } catch { console.error("[中止] sharp が無い（npm i sharp、または NODE_PATH を通す）"); process.exit(4); }
  await sharp(png).resize(W, H, { fit: "cover", position: "centre" }).jpeg({ quality: 85, progressive: true }).toFile(out);
  console.log(`saved ${slug}/thumb.jpg (${fs.statSync(out).size} bytes)`);
};

main().catch((e) => { console.error("[失敗]", e.message); process.exit(1); });
