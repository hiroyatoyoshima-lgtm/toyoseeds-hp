#!/usr/bin/env python3
"""公開済みの記事から、note に貼り付ける用のテキストを作る。

使い方:
    python3 scripts/export_note.py 55          # 社長日記 vol55
    python3 scripts/export_note.py 55 -o out/  # ファイルにも保存
    python3 scripts/export_note.py --slug goma-diary/vol2

note 側の操作:
    1. 出力された1行目をタイトル欄に貼る
    2. 残りを本文に貼る
    3. ［画像：…］の行を消して、その位置に画像をアップロードする
"""
import argparse
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://www.toyoseeds.com"
FOOTER = """―――

初出：ToyoSeeds 社長日記
{url}

ToyoSeeds合同会社（福岡）
AI・データ活用事業／宿泊・インバウンド事業
{base}/

Instagram: https://www.instagram.com/toyo_seeds/"""


def to_text(body):
    """記事本文の HTML を note 用のプレーンテキストにする。"""
    out = []
    for block in re.findall(r"<(p|figure)\b[^>]*>(.*?)</\1>", body, re.S):
        tag, inner = block
        if tag == "figure":
            src = re.search(r'src="([^"]+)"', inner)
            cap = re.search(r"<figcaption>(.*?)</figcaption>", inner, re.S)
            out.append(f"［画像：{src.group(1) if src else '?'}］")
            if cap:
                out.append(html.unescape(re.sub(r"<[^>]+>", "", cap.group(1))).strip())
            continue
        text = re.sub(r"<br\s*/?>\s*", "\n", inner)
        text = re.sub(r'<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', r"\2（\1）", text, flags=re.S)
        text = html.unescape(re.sub(r"<[^>]+>", "", text)).strip()
        if text:
            out.append(text)
    return "\n\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vol", nargs="?", type=int, help="社長日記の vol 番号")
    ap.add_argument("--slug", help="社長日記以外の記事フォルダ（例 goma-diary/vol2）")
    ap.add_argument("-o", "--out-dir", help="テキストファイルとしても保存する先")
    args = ap.parse_args()

    slug = args.slug or (f"shachonikki_day{args.vol}" if args.vol else None)
    if not slug:
        sys.exit("vol番号か --slug を指定してください")
    path = ROOT / slug / "index.html"
    if not path.exists():
        sys.exit(f"[中止] 記事が見つかりません: {slug}/index.html")

    s = path.read_text(encoding="utf-8")
    title = html.unescape(re.search(r"<h1>(.*?)</h1>", s, re.S).group(1).strip())
    body = re.search(r'<div class="wp-content">(.*?)</div>\s*</article>', s, re.S).group(1)

    text = f"{title}\n\n{to_text(body)}\n\n{FOOTER.format(url=f'{BASE}/{slug}/', base=BASE)}\n"
    print(text)

    images = re.findall(r'<img [^>]*src="([^"]+)"', body)
    if images:
        print("―――（以下は貼り付け不要のメモ）", file=sys.stderr)
        print("アップロードする画像:", file=sys.stderr)
        for src in images:
            print(f"  {ROOT}{src}", file=sys.stderr)

    if args.out_dir:
        out = Path(args.out_dir).expanduser()
        out.mkdir(parents=True, exist_ok=True)
        dest = out / f"{slug.replace('/', '_')}_note.txt"
        dest.write_text(text, encoding="utf-8")
        print(f"保存しました: {dest}", file=sys.stderr)


if __name__ == "__main__":
    main()
