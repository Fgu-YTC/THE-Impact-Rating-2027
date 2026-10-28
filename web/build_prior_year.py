# -*- coding: utf-8 -*-
"""Build prior-year.json (final 2026 answers, no units) and prior-units.json."""
import json
import os
import re
from collections import defaultdict

ROOT = r"E:\奕廷\永續辦業務\大學排名\THE\2026\Impact Ranking 2026"
FINAL_DIR = os.path.join(ROOT, "最終上傳版2026")
UNIT_DIR = os.path.join(ROOT, "各單位繳交")
OUT_CONTENT = os.path.join("web", "data", "prior-year.json")
OUT_UNITS = os.path.join("web", "data", "prior-units.json")

# Same number, different question this year. Do not attach last year's row.
OFFICES = [
    "通識中心",
    "永續辦",
    "教務處",
    "學務處",
    "總務處",
    "招生處",
    "研發處",
    "國際處",
    "圖資處",
    "人事室",
    "會計室",
    "秘書室",
    "人社院",
    "健康院",
    "科技院",
    "佛學院",
    "佛教院",
    "周老師",
    "年翔",
    "瑜蓓",
    "工作表1",
]
GENERIC_SHEETS = {"目錄", "N", "example", "summary", "工作表1", "工作表2", "Sheet1"}

SKIP = {
    "6.5.2",
    "6.5.3",
    "6.5.4",
    "6.5.5",
    "6.5.6",
    "6.5.7",
    "7.4.5",
    "7.5.1",
    "17.4.4",
}

REF_RE = re.compile(r"^(\d+\.\d+\.\d+)")
FILE_REF_RE = re.compile(r"THE\s*(\d+\.\d+\.\d+)", re.I)


def text(value):
    if value is None:
        return ""
    return str(value).replace("\r", "\n").strip()


def yn(value):
    token = text(value).upper()
    if token in ("Y", "YES", "是"):
        return "yes"
    if token in ("N", "NO", "否"):
        return "no"
    return ""


def public_value(value):
    return yn(value)


def urls(value):
    found = []
    for part in re.split(r"[\s\n]+", text(value)):
        if part.lower().startswith("http"):
            found.append(part)
    return found


def ref_of(value):
    match = REF_RE.match(text(value).split("\n")[0].strip())
    return match.group(1) if match else ""


def first_line(value):
    line = text(value).split("\n")[0].strip()
    return re.sub(r"\s+", " ", line)[:160]


def blank():
    return {
        "yesNo": "",
        "public": "",
        "evidence": [],
        "files": [],
        "note": "",
        "lines": [],
        "values": [],
    }


def remember(item, row, indexes):
    value, yes, evidence, public, note = (text(row[i]) if i < len(row) else "" for i in indexes)
    if value and not ref_of(value):
        item["values"].append({"label": "", "value": value})
    got = yn(yes)
    if got and not item["yesNo"]:
        item["yesNo"] = got
    for link in urls(evidence):
        if link not in item["evidence"]:
            item["evidence"].append(link)
    pub = public_value(public)
    if pub and not item["public"]:
        item["public"] = pub
    if note and not item["note"]:
        item["note"] = note[:2000]


def consume_sheet(rows):
    """Return {ref: content} using whichever column layout the sheet uses."""
    found = {}
    current = None
    mode = None
    for row in rows:
        cells = [("" if cell is None else cell) for cell in row]
        while len(cells) < 8:
            cells.append("")
        kind = text(cells[0])
        if kind in ("Indicator", "Metric") or ref_of(cells[1]):
            mode = "official"
        elif ref_of(cells[0]):
            mode = mode or "shifted"

        if mode == "official":
            if kind == "Metric":
                current = None
                continue
            if kind == "Indicator":
                ref = ref_of(cells[1])
                current = None if ref in SKIP or not ref else found.setdefault(ref, blank())
                if current is not None:
                    remember(current, cells, (3, 4, 5, 6, 7))
                continue
            if current is None or kind:
                continue
            label = first_line(cells[2])
            if not label:
                continue
            line = {"label": label, "yesNo": yn(cells[4]), "public": public_value(cells[6]), "evidence": urls(cells[5])}
            value = text(cells[3])
            if value:
                current["values"].append({"label": label, "value": value})
            if line["yesNo"] or line["public"] or line["evidence"]:
                current["lines"].append(line)
            note = text(cells[7])
            if note and not current["note"]:
                current["note"] = note[:2000]
        elif mode == "shifted":
            ref = ref_of(cells[0])
            if ref:
                current = None if ref in SKIP else found.setdefault(ref, blank())
                if current is not None:
                    remember(current, cells, (2, 3, 4, 5, 6))
                continue
            if current is None or kind in ("Metric", "Indicator"):
                if kind == "Metric":
                    current = None
                continue
            label = first_line(cells[1])
            if not label:
                continue
            line = {"label": label, "yesNo": yn(cells[3]), "public": public_value(cells[5]), "evidence": urls(cells[4])}
            value = text(cells[2])
            if value:
                current["values"].append({"label": label, "value": value})
            if line["yesNo"] or line["public"] or line["evidence"]:
                current["lines"].append(line)
    return found


def sheet_rows(ws):
    return [tuple(row) for row in ws.iter_rows(min_row=1, max_col=8, values_only=True)]


def load_final():
    import openpyxl

    name = next(
        n
        for n in os.listdir(FINAL_DIR)
        if n.endswith(".xlsx") and not n.startswith("~$") and "V5" in n
    )
    wb = openpyxl.load_workbook(os.path.join(FINAL_DIR, name), read_only=True, data_only=True)
    merged = {}
    for sheet in wb.sheetnames:
        if not str(sheet).upper().startswith("SDG"):
            continue
        for ref, item in consume_sheet(sheet_rows(wb[sheet])).items():
            merged[ref] = item
    return merged


def attach_files(content):
    files = defaultdict(list)
    for dirpath, _dirs, names in os.walk(FINAL_DIR):
        for name in names:
            if name.startswith("~$") or name.startswith("."):
                continue
            match = FILE_REF_RE.search(name)
            if not match:
                continue
            ref = match.group(1)
            if ref in SKIP:
                continue
            if name not in files[ref]:
                files[ref].append(name)
    for ref, names in files.items():
        item = content.setdefault(ref, blank())
        item["files"] = names


def scrub(value):
    out = text(value)
    for name in sorted(OFFICES, key=len, reverse=True):
        out = out.replace(name, "")
    return re.sub(r"[\s/、,，._\-]+", " ", out).strip(" /、,，._-")


def file_label(name, ref):
    ext = os.path.splitext(name)[1]
    body = os.path.splitext(name)[0]
    body = re.sub(rf"THE\s*{re.escape(ref)}", "", body, flags=re.I)
    body = scrub(body)
    for token in ("證據檔案", "證據連結內容", "證據"):
        body = body.replace(token, "")
    body = re.sub(r"\s+", " ", body).strip()
    if not body:
        return f"{ref}{ext}"
    return f"{ref} {body}{ext}"


def prune(item):
    if item["note"]:
        item["note"] = scrub(item["note"])
        if len(item["note"]) < 12:
            item["note"] = ""
    if item["values"]:
        seen = []
        for entry in item["values"]:
            value = scrub(entry["value"])
            if not re.search(r"\d", value):
                continue
            entry = {"label": entry["label"], "value": value}
            if any(entry["label"] == old["label"] and entry["value"] == old["value"] for old in seen):
                continue
            seen.append(entry)
        item["values"] = seen
    item["evidence"] = list(dict.fromkeys(item["evidence"]))
    files = []
    seen_files = set()
    for entry in item.get("files") or []:
        if isinstance(entry, dict):
            key = entry.get("path") or entry.get("url") or entry.get("name")
            if not key or key in seen_files:
                continue
            seen_files.add(key)
            files.append(entry)
        else:
            name = str(entry)
            if name in seen_files:
                continue
            seen_files.add(name)
            files.append(name)
    item["files"] = files
    kept = []
    for line in item["lines"]:
        if line["yesNo"] or line["public"] or line["evidence"]:
            kept.append(line)
    item["lines"] = kept
    useful = any(
        [
            item["yesNo"],
            item["public"],
            item["evidence"],
            item["files"],
            item["note"],
            item["lines"],
            item["values"],
        ]
    )
    if not useful:
        return None
    return {key: value for key, value in item.items() if value}


def unit_from_filename(name):
    stem = os.path.splitext(os.path.basename(name))[0]
    if "目前缺" in stem:
        return ""
    if "各處室" in stem:
        return ""
    marker = "填報_"
    if marker in stem:
        stem = stem.split(marker, 1)[1]
    stem = re.sub(r"20\d{6}.*$", "", stem)
    stem = re.sub(r"[_-]?(V\d+|v\d+|mail).*$", "", stem)
    stem = stem.strip("-_ ")
    if "-" in stem:
        stem = stem.split("-", 1)[0]
    return stem.strip()


def note_chunks(value, size=12):
    compact = "".join(ch for ch in text(value) if not ch.isspace())
    return {compact[i : i + size] for i in range(0, max(0, len(compact) - size + 1))}


def match_score(final, unit):
    points = 0
    conflict = False
    final_yes = final.get("yesNo") or ""
    unit_yes = unit.get("yesNo") or ""
    if final_yes and unit_yes:
        if final_yes == unit_yes:
            points += 1
        else:
            points -= 4
            conflict = True
    final_public = final.get("public") or ""
    unit_public = unit.get("public") or ""
    if final_public and unit_public:
        points += 1 if final_public == unit_public else -2
    shared_links = set(final.get("evidence") or []) & set(unit.get("evidence") or [])
    points += 6 * len(shared_links)
    final_values = {(entry.get("label") or "", entry.get("value") or "") for entry in final.get("values") or []}
    unit_values = {(entry.get("label") or "", entry.get("value") or "") for entry in unit.get("values") or []}
    points += 5 * len({pair for pair in final_values & unit_values if pair[1]})
    final_note = note_chunks(final.get("note") or "")
    unit_note = note_chunks(unit.get("note") or "")
    if final_note and unit_note:
        overlap = len(final_note & unit_note) / max(1, min(len(final_note), len(unit_note)))
        if overlap >= 0.35:
            points += 8
        elif overlap >= 0.15:
            points += 3
    final_lines = {
        (line.get("label") or "", line.get("yesNo") or "")
        for line in final.get("lines") or []
        if line.get("yesNo")
    }
    unit_lines = {
        (line.get("label") or "", line.get("yesNo") or "")
        for line in unit.get("lines") or []
        if line.get("yesNo")
    }
    points += 3 * len(final_lines & unit_lines)
    return points, conflict


def load_units():
    import openpyxl

    found = {}

    def take(label, rows):
        if not label or label in GENERIC_SHEETS:
            return
        for ref, item in consume_sheet(rows).items():
            if ref in SKIP:
                continue
            kept = prune(item)
            if kept:
                found.setdefault(ref, {}).setdefault(label, []).append(kept)

    for name in os.listdir(UNIT_DIR):
        path = os.path.join(UNIT_DIR, name)
        if name.startswith("~$"):
            continue
        if os.path.isdir(path):
            books = [os.path.join(path, n) for n in os.listdir(path) if n.endswith(".xlsx") and not n.startswith("~$")]
            label = name
        elif name.endswith(".xlsx"):
            books = [path]
            label = unit_from_filename(name)
        else:
            continue
        for book in books:
            wb = openpyxl.load_workbook(book, read_only=True, data_only=True)
            data_sheets = [s for s in wb.sheetnames if s not in GENERIC_SHEETS or s == "工作表1"]
            named = [s for s in data_sheets if s not in GENERIC_SHEETS]
            if len(named) > 1:
                for sheet in named:
                    take(sheet, sheet_rows(wb[sheet]))
            else:
                for sheet in data_sheets:
                    take(label or (sheet if sheet not in GENERIC_SHEETS else ""), sheet_rows(wb[sheet]))
    return found


def unit_priority(name):
    """When scores tie, prefer the consolidating office, then the usual office list."""
    if name in ("永續辦", "永續發展辦公室"):
        return (0, name)
    try:
        return (1, OFFICES.index(name))
    except ValueError:
        return (2, name)


def normalize_unit_name(name):
    """Map informal / alternate workbook labels to current office names."""
    aliases = {
        "樂管院": "健康院",
        "佛學院": "佛教院",
        "永續發展辦公室": "永續辦",
        "周老師": "永續辦",
        "年翔": "永續辦",
        "瑜蓓": "永續辦",
    }
    return aliases.get(name, name)


def pick_one_unit(ranked):
    """Fallback: a single unit. Prefer higher score, then no conflict, then 永續辦 / office order."""
    if not ranked:
        return ""
    ranked = sorted(ranked, key=lambda item: (-item[0], item[1], unit_priority(item[2])))
    return ranked[0][2]


def confirmed_units(final, answers):
    """Units whose workbook matched the final upload.

    Keep every non-conflicting match with score >= 4 (last year often had
    two-plus units on the same indicator). If none qualify, keep the best one.
    """
    chosen = {}
    for ref, item in final.items():
        options = answers.get(ref) or {}
        if not options:
            continue
        ranked = []
        for name, copies in options.items():
            best = max((match_score(item, copy) for copy in copies), key=lambda pair: pair[0])
            ranked.append((best[0], best[1], normalize_unit_name(name)))
        ranked = sorted(ranked, key=lambda item: (-item[0], item[1], unit_priority(item[2])))
        keep = []
        seen = set()
        for score, conflict, name in ranked:
            if conflict or score < 4 or not name or name in seen:
                continue
            # skip personal drafts that are not real offices
            if name in ("周老師", "年翔", "瑜蓓", "工作表1"):
                continue
            seen.add(name)
            keep.append(name)
        if not keep:
            name = pick_one_unit(ranked)
            name = normalize_unit_name(name) if name else ""
            if name and name not in ("周老師", "年翔", "瑜蓓", "工作表1"):
                keep = [name]
        if keep:
            chosen[ref] = keep
    return chosen


def main():
    content = load_final()
    attach_files(content)
    cleaned = {}
    for ref, item in content.items():
        if ref in SKIP:
            continue
        originals = list(item.get("files") or [])
        kept = prune(item)
        if kept:
            labels = list(dict.fromkeys(file_label(name, ref) for name in originals))
            if labels:
                kept["files"] = labels
            elif "files" in kept:
                del kept["files"]
            cleaned[ref] = kept
    units = confirmed_units(cleaned, load_units())
    os.makedirs(os.path.dirname(OUT_CONTENT), exist_ok=True)
    with open(OUT_CONTENT, "w", encoding="utf-8") as handle:
        json.dump(cleaned, handle, ensure_ascii=False, indent=2)
    with open(OUT_UNITS, "w", encoding="utf-8") as handle:
        json.dump(units, handle, ensure_ascii=False, indent=2)
    print("content", len(cleaned), "units", len(units))


if __name__ == "__main__":
    main()
