# -*- coding: utf-8 -*-
"""Link Portal-only numeric rows to Excel continuous sub-labels under parent indicators."""
import json
import re
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent
portal_path = ROOT / "data" / "portal-questions.json"
site_path = ROOT / "data" / "questions.json"
excel_path = ROOT.parent / "Impact 2027-data collection support v1.xlsx"

portal = json.loads(portal_path.read_text(encoding="utf-8"))
site = json.loads(site_path.read_text(encoding="utf-8"))
by_ref = {str(q.get("ref")): q for q in site["questions"]}

wb = load_workbook(excel_path, data_only=True)
excel_subs = {}
excel_inds = set()
for name in wb.sheetnames:
    if not name.strip().upper().startswith("SDG"):
        continue
    ws = wb[name]
    cur = None
    for r in range(1, ws.max_row + 1):
        a = ws.cell(r, 1).value
        b = ws.cell(r, 2).value
        c = ws.cell(r, 3).value
        a = str(a).strip() if a is not None else ""
        b = str(b).strip() if b is not None else ""
        c = str(c).strip() if c is not None else ""
        if a.lower() == "indicator" and b:
            cur = b
            excel_inds.add(b)
            excel_subs.setdefault(cur, [])
            continue
        if a.lower() == "metric":
            cur = None
            continue
        if cur and c and not a:
            excel_subs[cur].append(re.sub(r"\s+", " ", c).strip())

MANUAL_ZH = {
    "Number of low income students receiving financial aid": "領取助學金的低收入學生人數",
    "Number of graduates from agriculture and aquaculture courses including sustainability aspects": "含永續內容之農漁養殖課程畢業生人數",
    "Number of graduates": "畢業生人數",
    "Number of graduates in health professions": "健康專業領域畢業生人數",
    "Number of graduates who gained a qualification that entitled them to teach at primary school level": "取得可於小學任教資格之畢業生人數",
    "Number of first-generation students starting a degree": "開始攻讀學位的第一代學生人數",
    "Number of first generation students starting a degree": "開始攻讀學位的第一代學生人數",
    "Number of students": "學生人數",
    "Number of students starting a degree": "開始攻讀學位的學生人數",
    "Number of first-generation women starting a degree": "開始攻讀學位的第一代女性人數",
    "Number of female senior academic staff": "女性資深教學研究人員人數",
    "Number of academic staff": "教學研究人員人數",
    "Number of employees": "員工人數",
    "University floor space": "大學樓地板面積",
    "University floor space m²": "大學樓地板面積（平方公尺）",
    "Total energy used from low-carbon sources": "低碳能源使用總量",
    "Total energy used from low-carbon sources GJ": "低碳能源使用總量（GJ）",
    "University expenditure": "大學支出",
    "University expenditure TWD": "大學支出（新台幣）",
    "Number of students with work placements for more than a month": "實習超過一個月的學生人數",
    "Number of employees on contracts of over 24 months": "合約超過24個月的員工人數",
    "Number of international students from developing countries": "來自開發中國家的國際學生人數",
    "Number of students with disability": "身心障礙學生人數",
    "Number of employees with disability": "身心障礙員工人數",
    "University expenditure on arts and heritage": "藝術與遺產支出",
    "University expenditure on arts and heritage TWD": "藝術與遺產支出（新台幣）",
    "Number of total graduates from law and enforcement related courses": "法律與執法相關課程畢業生總數",
}


def clean_title(en):
    s = re.sub(r"\s+", " ", en or "").strip()
    s = re.sub(r"\s+TWD(?:\s*[\d,]+)+", " TWD", s, flags=re.I).strip()
    s = re.sub(r"\s+GJ(?:\s*[\d,]+)*", " GJ", s, flags=re.I).strip()
    s = re.sub(r"\s+\d{1,3}(?:[.,]\d{3})+(?:\s.*)?$", "", s).strip()
    s = re.sub(r"\s+\d+\s+\d+\.\d+.*$", "", s).strip()
    s = re.sub(r"\s+\d+/\d+\s*$", "", s).strip()
    s = re.sub(r"\s+\d+\s*$", "", s).strip()
    s = re.sub(r"\s+e\.g\..*$", "", s, flags=re.I).strip()
    s = re.split(
        r"\s+(?:Good Health|Clean Water|Affordable|Quality Education|Gender|Decent Work|Industry|Reduced|Sustainable Cities|Climate|Life |Peace |Partnership)",
        s,
        maxsplit=1,
    )[0].strip()
    s = re.sub(r"\s+\d+\.\d+(?:\.\d+)?\s+.*$", "", s).strip()
    return s


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def parent_candidates(ref):
    parts = ref.split(".")
    out = []
    if len(parts) == 3:
        base = ".".join(parts[:2])
        prefer = f"{base}.1"
        if prefer in excel_subs:
            out.append(prefer)
        for k in sorted(excel_subs):
            if k.startswith(base + ".") and k not in out and k in excel_inds:
                out.append(k)
    return out


def link_sub(f, pref, idx, en_lab, zh_lab, site_q):
    site_zh = ""
    site_en = en_lab
    if site_q and idx is not None and idx < len(site_q.get("options") or []):
        opt = site_q["options"][idx]
        site_en = opt.get("en") or en_lab
        site_zh = opt.get("zh") or ""
    f["parentRef"] = pref
    f["valueKey"] = f"v{idx}"
    f["excelSubLabel"] = en_lab
    f["siteQuestionId"] = (site_q or {}).get("id") or ""
    f["en"] = site_en or en_lab or f.get("en")
    f["zh"] = (
        site_zh
        or zh_lab
        or MANUAL_ZH.get(site_en)
        or MANUAL_ZH.get(en_lab)
        or MANUAL_ZH.get(f.get("en"))
        or site_en
        or en_lab
    )
    f["answerType"] = "continuous"
    f["options"] = [{"en": f["en"], "zh": f["zh"]}]
    f["aligned"] = bool(f["siteQuestionId"])
    f["subField"] = True
    f.setdefault("portal", {})
    f["portal"].update(
        {
            "hasYesNo": False,
            "hasPublic": False,
            "hasComment": False,
            "hasEvidence": False,
            "hasPolicyCreated": False,
            "hasPolicyReviewed": False,
        }
    )


# Restore true Excel indicators from site questions
for f in portal["fields"]:
    ref = str(f.get("ref") or "")
    if ref in by_ref and ref in excel_inds:
        q = by_ref[ref]
        en = str(q.get("en") or "").split("\n", 1)[0].strip()
        zh = str(q.get("zh") or "").split("\n", 1)[0].strip()
        if en:
            f["en"] = en
        if zh:
            f["zh"] = zh
        f["siteQuestionId"] = q.get("id") or f.get("siteQuestionId") or ""
        f["aligned"] = True
        for key in ("subField", "parentRef", "valueKey", "excelSubLabel"):
            f.pop(key, None)
        if q.get("answerType") == "continuous" and q.get("options"):
            f["answerType"] = "continuous"
            f["options"] = [
                {"en": o.get("en") or "", "zh": o.get("zh") or ""} for o in q["options"]
            ]

# Portal-only refs = Excel continuous sub rows
for f in portal["fields"]:
    ref = str(f.get("ref") or "")
    if ref in excel_inds:
        continue
    title = clean_title(f.get("en") or "")
    f["en"] = title or f.get("en")
    linked = False

    for pref in parent_candidates(ref):
        labels = excel_subs.get(pref) or []
        site_q = by_ref.get(pref)
        cands = [(i, lab, lab) for i, lab in enumerate(labels)]
        if site_q:
            for i, o in enumerate(site_q.get("options") or []):
                cands.append((i, o.get("en") or "", o.get("zh") or o.get("en") or ""))
        best = None
        for i, en_lab, zh_lab in cands:
            if not norm(title):
                continue
            if norm(title) == norm(en_lab):
                score = 100
            elif norm(title) in norm(en_lab) or norm(en_lab) in norm(title):
                score = 60 if abs(len(norm(title)) - len(norm(en_lab))) < 12 else 40
            else:
                continue
            if best is None or score > best[0]:
                best = (score, i, en_lab, zh_lab, pref, site_q)
        if best and best[0] >= 60:
            _, i, en_lab, zh_lab, pref, site_q = best
            link_sub(f, pref, i, en_lab, zh_lab, site_q)
            linked = True
            break

    if linked:
        continue

    # exact label match within same SDG
    sdg = ref.split(".")[0]
    best = None
    for pref, labels in excel_subs.items():
        if not pref.startswith(sdg + "."):
            continue
        site_q = by_ref.get(pref)
        for i, lab in enumerate(labels):
            if norm(title) == norm(lab):
                best = (pref, i, lab, site_q)
                break
        if best:
            break
    if best:
        pref, i, lab, site_q = best
        zh = lab
        if site_q and i < len(site_q.get("options") or []):
            zh = site_q["options"][i].get("zh") or lab
        link_sub(f, pref, i, lab, MANUAL_ZH.get(lab) or zh, site_q)
        continue

    f["subField"] = True
    title = clean_title(f.get("en") or "")
    f["en"] = title or f.get("en")
    f["zh"] = MANUAL_ZH.get(title) or MANUAL_ZH.get(f.get("en")) or title
    f["aligned"] = False
    f["siteQuestionId"] = ""
    for key in ("parentRef", "valueKey", "excelSubLabel"):
        f.pop(key, None)
    f["options"] = [{"en": f["en"], "zh": f["zh"]}]

# Hard links for remaining Portal-only rows that are Excel continuous sub-labels
HARD = {
    # portalRef: (parentRef, valueIndex)
    "4.4.3": ("4.4.1", 0),  # Number of students / starting a degree – prefer v0 if title matches later
    "5.2.3": ("5.2.1", 0),
    "5.2.4": ("5.2.1", 1),
    "5.2.5": ("4.4.1", 0),
    "5.4.3": ("5.4.1", 0),
    "5.4.4": ("8.3.1", 0),
    "7.5.1": ("7.5.1", 0),  # portal 7.5.1 may collide; treat as first value of site 7.5.1 if same ref
    "7.5.2": ("7.5.1", 1),
    "8.3.2": ("8.3.1", 1),
    "8.3.3": ("8.3.1", 0),
    "9.4.3": ("8.3.1", 0),
    "11.3.2": ("11.3.1", 1),
    "16.4.2": ("16.4.1", 1),
}

for f in portal["fields"]:
    if f.get("aligned") and f.get("parentRef"):
        continue
    if not f.get("subField") and f.get("aligned"):
        continue
    ref = str(f.get("ref") or "")
    title = clean_title(f.get("en") or "")
    # Prefer title match against known parents under same metric
    matched = False
    for pref in parent_candidates(ref) + (
        [HARD[ref][0]] if ref in HARD else []
    ):
        site_q = by_ref.get(pref)
        if not site_q:
            continue
        for i, o in enumerate(site_q.get("options") or []):
            en_lab = o.get("en") or ""
            if norm(title) == norm(en_lab) or (
                norm(title) and norm(en_lab) and (norm(title) in norm(en_lab) or norm(en_lab) in norm(title))
            ):
                link_sub(f, pref, i, en_lab, o.get("zh") or "", site_q)
                matched = True
                break
        if matched:
            break
    if matched:
        continue
    if ref in HARD:
        pref, idx = HARD[ref]
        site_q = by_ref.get(pref)
        if site_q and idx < len(site_q.get("options") or []):
            o = site_q["options"][idx]
            link_sub(f, pref, idx, o.get("en") or title, o.get("zh") or "", site_q)

# Special: portal 7.5.1 is both a real site indicator AND may appear as sub parse.
# If site has 7.5.1 as continuous with options, keep as parent indicator not sub of itself.
for f in portal["fields"]:
    ref = str(f.get("ref") or "")
    if ref in by_ref and ref in excel_inds:
        continue
    if ref == "7.5.1" and by_ref.get("7.5.1") and f.get("parentRef") == "7.5.1" and f.get("valueKey") == "v0":
        # This portal card is the first value row under metric 7.5; keep as sub of 7.5.1
        pass

# Final bilingual polish for all subFields
for f in portal["fields"]:
    if not f.get("subField"):
        continue
    en = clean_title(f.get("en") or "")
    # strip leftover metric glue
    en = re.sub(r"\s+TWD(?:\s+TWD)*(?:\.\d+.*)?$", " TWD", en, flags=re.I).strip()
    en = re.sub(r"\s+Proportion of .*$", "", en).strip()
    en = re.sub(r"\s+Sustainable practices.*$", "", en).strip()
    f["en"] = en or f.get("en")
    zh = f.get("zh") or ""
    if (not zh) or zh == f.get("en") or re.search(r"\d{3,}", zh) or "TWD" in str(zh) or "Proportion" in str(zh):
        if f.get("parentRef") and f.get("valueKey") and by_ref.get(f["parentRef"]):
            q = by_ref[f["parentRef"]]
            try:
                idx = int(str(f["valueKey"]).lstrip("v"))
            except ValueError:
                idx = -1
            if 0 <= idx < len(q.get("options") or []):
                f["en"] = q["options"][idx].get("en") or f["en"]
                f["zh"] = q["options"][idx].get("zh") or f["zh"]
        if not f.get("zh") or f.get("zh") == f.get("en"):
            f["zh"] = MANUAL_ZH.get(f["en"]) or MANUAL_ZH.get(en) or zh or en
    f["options"] = [{"en": f["en"], "zh": f["zh"]}]

portal["alignedCount"] = sum(1 for f in portal["fields"] if f.get("aligned"))
portal["subFieldCount"] = sum(1 for f in portal["fields"] if f.get("subField"))
portal_path.write_text(json.dumps(portal, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("aligned", portal["alignedCount"], "subFields", portal["subFieldCount"])
for f in portal["fields"]:
    if str(f.get("ref", "")).startswith("3.2") or not f.get("aligned"):
        print(
            f["ref"],
            "aligned=",
            f.get("aligned"),
            "sub=",
            f.get("subField"),
            "parent=",
            f.get("parentRef"),
            "key=",
            f.get("valueKey"),
            "en=",
            f.get("en"),
            "zh=",
            f.get("zh"),
        )
