# -*- coding: utf-8 -*-
"""Split methodology PDFs into per-indicator / per-metric sections keyed by ref."""
from __future__ import annotations

import json
import re
from pathlib import Path

from zhconv import convert

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(__file__).resolve().parent / "data"
QPATH = DATA / "questions.json"


def pdf_text(path: Path) -> str:
    import pdfplumber

    with pdfplumber.open(path) as pdf:
        return "\n".join((p.extract_text() or "") for p in pdf.pages)


def find_occurrences(text: str, ref: str) -> list[tuple[int, int]]:
    """Return (start, end_of_match) for each heading-like occurrence of ref.
    Avoid matching 4.4 inside 4.4.1; prefer line-start headings.
    """
    esc = re.escape(ref)
    # Line start (optional bullet), then exact ref not followed by .digit
    pat = re.compile(rf"(?m)^[ \t]*(?:[#•\-\*]+\s*)?{esc}(?!\.\d)\b")
    return [(m.start(), m.end()) for m in pat.finditer(text)]


def pick_best(text: str, ref: str, all_starts: list[int]) -> tuple[int, int] | None:
    """Choose the best occurrence: skip early changelog if a later one exists;
    prefer the longest slice until next known ref.
    """
    occs = find_occurrences(text, ref)
    if not occs:
        return None

    candidates = []
    for start, mend in occs:
        # end at next known ref start after this
        end = len(text)
        for s in all_starts:
            if s > start:
                end = min(end, s)
                break
        # also cap
        end = min(end, start + 6000)
        body = text[start:end].strip()
        # score: later in doc (skip front-matter 新增指南), longer body
        score = start + len(body) * 2
        # penalize changelog / TOC-ish
        head = body[:120]
        if re.search(r"新增指南|Added guidance|What’s new|What's new", head, re.I):
            score -= 50000
        if len(body) < 40:
            score -= 10000
        candidates.append((score, start, end, body))

    candidates.sort(key=lambda x: x[0], reverse=True)
    best = candidates[0]
    return best[1], best[2]


def split_by_refs(text: str, refs: list[str]) -> dict[str, str]:
    # Precompute all candidate starts for ordering
    all_starts: list[int] = []
    for ref in refs:
        for start, _ in find_occurrences(text, ref):
            all_starts.append(start)
    all_starts = sorted(set(all_starts))

    out: dict[str, str] = {}
    for ref in refs:
        picked = pick_best(text, ref, all_starts)
        if not picked:
            continue
        start, end = picked
        body = text[start:end].strip()
        body = re.sub(r"\n{3,}", "\n\n", body)
        if len(body) > 5000:
            body = body[:5000].rstrip() + "…"
        if len(body) >= 40:
            out[ref] = body
    return out


def main():
    qdata = json.loads(QPATH.read_text(encoding="utf-8"))
    refs = set()
    for m in qdata.get("metrics", []):
        if m.get("ref"):
            refs.add(str(m["ref"]))
    for q in qdata.get("questions", []):
        if q.get("ref"):
            refs.add(str(q["ref"]))
        if q.get("metricRef"):
            refs.add(str(q["metricRef"]))
    refs = sorted(refs, key=lambda r: [int(x) if x.isdigit() else x for x in r.split(".")])

    zh_pdf = ROOT / "Chinese_THE_Impact_Rankings_METHODOLOGY_2027.pdf"
    en_pdf = ROOT / "THE.SustainabilityImpactRatings.METHODOLOGY.2027.v1.2.pdf"

    print("refs", len(refs))
    zh_text = pdf_text(zh_pdf)
    en_text = pdf_text(en_pdf)
    print("zh len", len(zh_text), "en len", len(en_text))

    zh_map = split_by_refs(zh_text, refs)
    en_map = split_by_refs(en_text, refs)

    zh_map = {k: convert(v, "zh-tw") for k, v in zh_map.items()}

    def fill_missing(ref_map: dict[str, str], all_refs: list[str]) -> None:
        """Indicators without a PDF section inherit parent metric / sibling text.
        e.g. 17.3.2–17.3.16 share the same guidance as 17.3 / 17.3.1.
        """
        for ref in all_refs:
            if ref in ref_map and len(ref_map[ref]) >= 40:
                continue
            parts = ref.split(".")
            if len(parts) == 3:
                parent = f"{parts[0]}.{parts[1]}"
                sibling = f"{parent}.1"
                donor = ref_map.get(sibling) or ref_map.get(parent)
                if donor:
                    note = f"（本指標與 {parent} 共用方法論說明）\n" if "發布" in (donor[:80] + ref) or parent == "17.3" else ""
                    # bilingual-safe short note only for zh-like; keep EN plain
                    if any("\u4e00" <= ch <= "\u9fff" for ch in donor[:30]):
                        note = f"（本指標與 {parent} 共用方法論說明）\n"
                    else:
                        note = f"(This indicator shares methodology guidance with {parent}.)\n"
                    ref_map[ref] = note + donor
            elif len(parts) == 2:
                # metric missing: try first child
                child = f"{ref}.1"
                if child in ref_map:
                    ref_map[ref] = ref_map[child]

    fill_missing(zh_map, refs)
    fill_missing(en_map, refs)

    # Preserve existing bySdg packs if present
    prev_zh = json.loads((DATA / "methodology-zh.json").read_text(encoding="utf-8"))
    prev_en = json.loads((DATA / "methodology-en.json").read_text(encoding="utf-8"))
    by_sdg_zh = prev_zh.get("bySdg") or {k: v for k, v in prev_zh.items() if k != "byRef"}
    by_sdg_en = prev_en.get("bySdg") or {k: v for k, v in prev_en.items() if k != "byRef"}

    out_zh = {"bySdg": by_sdg_zh, "byRef": zh_map}
    out_en = {"bySdg": by_sdg_en, "byRef": en_map}

    (DATA / "methodology-zh.json").write_text(
        json.dumps(out_zh, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DATA / "methodology-en.json").write_text(
        json.dumps(out_en, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("zh byRef", len(zh_map), "en byRef", len(en_map))
    for sample in ["4.4", "4.4.1", "5.2", "5.2.1", "6.2.2", "17.3", "17.3.1", "2.4", "9.3", "10.2", "16.4"]:
        print(
            sample,
            "zh",
            len(zh_map.get(sample, "")),
            "en",
            len(en_map.get(sample, "")),
            "|",
            (zh_map.get(sample, "")[:40] or en_map.get(sample, "")[:40]).replace("\n", " "),
        )


if __name__ == "__main__":
    main()
