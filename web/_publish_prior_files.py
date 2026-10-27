# -*- coding: utf-8 -*-
"""Stage final-2026 evidence files and rewrite prior-year.json download links for a GitHub Release."""
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_prior_year as b

REPO = "Fgu-YTC/THE-Impact-Rating-2027"
TAG = "prior-year-2026"
STAGE = os.path.join(os.path.dirname(b.OUT_CONTENT), "_prior_release")
FILE_REF = re.compile(r"THE\s*(\d+\.\d+\.\d+)", re.I)


def asset_name(ref, local_path, index):
    ext = os.path.splitext(local_path)[1].lower() or ".bin"
    ext = re.sub(r"[^a-z0-9.]", "", ext) or ".bin"
    return f"{ref}__{index}{ext}"


def collect():
    found = {}
    for dirpath, _dirs, names in os.walk(b.FINAL_DIR):
        for name in names:
            if name.startswith("~$") or name.startswith("."):
                continue
            if name.lower().endswith(".xlsx"):
                continue
            match = FILE_REF.search(name)
            if not match:
                continue
            ref = match.group(1)
            if ref in b.SKIP:
                continue
            found.setdefault(ref, []).append(os.path.join(dirpath, name))
    return found


def main():
    if os.path.isdir(STAGE):
        shutil.rmtree(STAGE)
    os.makedirs(STAGE, exist_ok=True)
    prior = json.load(open(b.OUT_CONTENT, encoding="utf-8"))
    mapping = collect()
    staged = []
    for ref, paths in sorted(mapping.items(), key=lambda item: [int(part) for part in item[0].split(".")]):
        entries = []
        for index, local in enumerate(paths, 1):
            asset = asset_name(ref, local, index)
            dest = os.path.join(STAGE, asset)
            shutil.copy2(local, dest)
            staged.append(dest)
            url = f"https://github.com/{REPO}/releases/download/{TAG}/{asset}"
            entries.append(
                {
                    "name": b.file_label(os.path.basename(local), ref),
                    "url": url,
                }
            )
        prior.setdefault(ref, {})["files"] = entries
    with open(b.OUT_CONTENT, "w", encoding="utf-8") as handle:
        json.dump(prior, handle, ensure_ascii=False, indent=2)
    print(f"staged {len(staged)} -> {STAGE}")
    print(f"tag {TAG}")


if __name__ == "__main__":
    main()
