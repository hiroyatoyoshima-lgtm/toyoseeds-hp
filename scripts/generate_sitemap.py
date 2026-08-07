from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
BASE = "https://www.toyoseeds.com"
EXCLUDED = {"wp-content", "assets", "api", "scripts", ".git"}


def page_url(index_file: Path) -> str:
    relative = index_file.parent.relative_to(ROOT).as_posix()
    if relative == ".":
        return f"{BASE}/"
    encoded = "/".join(quote(part) for part in relative.split("/"))
    return f"{BASE}/{encoded}/"


pages = []
for index_file in ROOT.rglob("index.html"):
    relative_parts = index_file.relative_to(ROOT).parts
    if any(part in EXCLUDED for part in relative_parts):
        continue
    pages.append(page_url(index_file))

priority = {f"{BASE}/": 0, f"{BASE}/news/": 1, f"{BASE}/company/": 2, f"{BASE}/contact/": 3}
pages.sort(key=lambda url: (priority.get(url, 10), url))

body = "\n".join(f"  <url><loc>{url}</loc></url>" for url in pages)
xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{body}
</urlset>
'''
(ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
print(f"Generated sitemap.xml with {len(pages)} URLs")
