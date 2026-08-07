#!/usr/bin/env python3
"""Download WordPress upload assets while preserving their public paths."""

from __future__ import annotations

import argparse
import concurrent.futures
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ALLOWED_HOSTS = {"toyoseeds.com", "www.toyoseeds.com"}
UPLOAD_PREFIX = "/wp-content/uploads/"


def target_for(url: str, root: Path) -> Path:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"Unsupported media URL: {url}")
    if not parsed.path.startswith(UPLOAD_PREFIX):
        raise ValueError(f"URL is outside WordPress uploads: {url}")
    relative = urllib.parse.unquote(parsed.path.lstrip("/"))
    target = (root / relative).resolve()
    root_resolved = root.resolve()
    if root_resolved not in target.parents:
        raise ValueError(f"Unsafe media path: {url}")
    return target


def download(url: str, target: Path) -> str:
    if target.exists() and target.stat().st_size > 0:
        return "skipped"
    target.parent.mkdir(parents=True, exist_ok=True)
    parsed = urllib.parse.urlparse(url)
    encoded_path = urllib.parse.quote(urllib.parse.unquote(parsed.path), safe="/%")
    request_url = urllib.parse.urlunparse(parsed._replace(path=encoded_path))
    request = urllib.request.Request(request_url, headers={"User-Agent": "ToyoSeeds migration/1.0"})
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                body = response.read()
            if not body:
                raise RuntimeError("empty response")
            target.write_bytes(body)
            return "downloaded"
        except (urllib.error.URLError, TimeoutError, RuntimeError) as error:
            last_error = error
            time.sleep(1.0 * (attempt + 1))
    raise RuntimeError(f"{url}: {last_error}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--urls", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    urls = [line.strip() for line in args.urls.read_text(encoding="utf-8").splitlines() if line.strip()]
    downloaded = skipped = failed = 0
    failures: list[str] = []
    def worker(url: str) -> str:
        return download(url, target_for(url, args.out))

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(worker, url): url for url in urls}
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            try:
                result = future.result()
                downloaded += result == "downloaded"
                skipped += result == "skipped"
            except Exception as error:  # keep the migration moving and report every miss
                failed += 1
                failures.append(f"{futures[future]}: {error}")
            if index % 25 == 0 or index == len(urls):
                print(f"{index}/{len(urls)} downloaded={downloaded} skipped={skipped} failed={failed}", flush=True)
    failure_path = args.out / "migration-media-failures.txt"
    failure_path.write_text("\n".join(failures) + ("\n" if failures else ""), encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
