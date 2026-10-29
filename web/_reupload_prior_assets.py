# -*- coding: utf-8 -*-
"""Re-upload prior-year release assets; keep CJK filenames (no spaces)."""
import json
import mimetypes
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

REPO = "Fgu-YTC/THE-Impact-Rating-2027"
TAG = "prior-year-2026"
STAGE = Path(__file__).resolve().parent / "data" / "_prior_release"
PRIOR_JSON = Path(__file__).resolve().parent / "data" / "prior-year.json"


def gh_json(args):
    raw = subprocess.check_output(["gh", *args], text=True, encoding="utf-8")
    return json.loads(raw)


def gh_token():
    return subprocess.check_output(["gh", "auth", "token"], text=True, encoding="utf-8").strip()


def main():
    files = sorted(p for p in STAGE.iterdir() if p.is_file())
    if not files:
        raise SystemExit("no staged files")

    token = gh_token()
    rel = gh_json(["api", f"repos/{REPO}/releases/tags/{TAG}"])
    rid = rel["id"]
    print(f"release {rid}, staged {len(files)}")

    for asset in rel.get("assets") or []:
        print(f"delete {asset['name']}")
        subprocess.check_call(
            ["gh", "api", "-X", "DELETE", f"repos/{REPO}/releases/assets/{asset['id']}"]
        )

    uploaded = {}
    for path in files:
        asset_name = path.name
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        url = (
            f"https://uploads.github.com/repos/{REPO}/releases/{rid}/assets"
            f"?name={urllib.parse.quote(asset_name, safe='')}"
        )
        print(f"upload {asset_name}")
        req = urllib.request.Request(
            url,
            data=path.read_bytes(),
            method="POST",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "Content-Type": mime,
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        with urllib.request.urlopen(req, timeout=300) as resp:
            info = json.loads(resp.read().decode("utf-8"))
        got = info.get("name")
        if got != asset_name:
            print(f"  WARN name mismatch: got {got!r}", file=sys.stderr)
        else:
            print("  ok")
        uploaded[asset_name] = {
            "name": got or asset_name,
            "url": info.get("browser_download_url"),
        }

    prior = json.loads(PRIOR_JSON.read_text(encoding="utf-8"))
    for item in prior.values():
        if not isinstance(item, dict) or not item.get("files"):
            continue
        next_files = []
        for entry in item["files"]:
            if not isinstance(entry, dict):
                continue
            hit = uploaded.get(entry.get("name") or "")
            if hit:
                next_files.append({"name": hit["name"], "url": hit["url"]})
            else:
                next_files.append(entry)
        item["files"] = next_files
    PRIOR_JSON.write_text(json.dumps(prior, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"updated {PRIOR_JSON}")


if __name__ == "__main__":
    main()
