# -*- coding: utf-8 -*-
"""Build portal-questions.json from WUR Portal PDF export + site questions.json."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT.parent / "_portal_raw.txt"
OUT = ROOT / "data" / "portal-questions.json"
QUESTIONS = ROOT / "data" / "questions.json"

# Prefer existing raw extract; else fail clearly
if not RAW.exists():
    raise SystemExit(f"missing {RAW}; extract Portal PDF text first")

text = RAW.read_text(encoding="utf-8")
# drop page chrome
text = re.sub(r"https://www\.timeshighereducation\.com/wur/portal/\S+", "\n", text)
text = re.sub(r"\d{4}/\d{1,2}/\d{1,2}\s+[上下]午\d{1,2}:\d{2}\s+WUR Portal", "\n", text)
text = re.sub(r"(?m)^\d+/\d+\s*$", "\n", text)

site = json.loads(QUESTIONS.read_text(encoding="utf-8"))
by_ref = {}
for q in site.get("questions") or []:
    ref = str(q.get("ref") or "")
    if ref:
        by_ref[ref] = q

# Split by indicator headers like 16.2.1 - question...
header_re = re.compile(
    r"(?m)^(\d{1,2}\.\d+(?:\.\d+)?)\s*-\s*(.+?)(?=\n\d{1,2}\.\d+(?:\.\d+)?\s*-|\Z)",
    re.S,
)

# Simpler line-based parse
lines = text.splitlines()
blocks = []
i = 0
while i < len(lines):
    m = re.match(r"^(\d{1,2}\.\d+\.\d+)\s*-\s*(.*)$", lines[i].strip())
    if not m:
        i += 1
        continue
    ref, rest = m.group(1), m.group(2).strip()
    buf = [rest] if rest else []
    i += 1
    while i < len(lines):
        if re.match(r"^\d{1,2}\.\d+\.\d+\s*-", lines[i].strip()):
            break
        if re.match(r"^SDG\s*\d+\b", lines[i].strip(), re.I):
            break
        if re.match(r"^Choose SDG\b", lines[i].strip(), re.I):
            break
        buf.append(lines[i])
        i += 1
    blocks.append((ref, "\n".join(buf)))

fields = []
seen = set()
for ref, body in blocks:
    site_q = by_ref.get(ref) or {}
    zh = ""
    en_ask = ""
    if site_q:
        zh_full = str(site_q.get("zh") or "")
        en_full = str(site_q.get("en") or "")
        zh = zh_full.split("\n", 1)[-1].strip() if "\n" in zh_full else zh_full
        en_ask = en_full.split("\n", 1)[-1].strip() if "\n" in en_full else en_full

    # English question = first non-empty lines until Yes/No/Comments/Policy
    q_lines = []
    for ln in body.splitlines():
        s = ln.strip()
        if not s or s in ("2027", "2026", "", "", "", ""):
            continue
        if re.match(r"^(Yes|No|Comments|Public|Private|Undefined|Policy created|Policy reviewed|e\.g\.)\b", s, re.I):
            break
        if s.startswith("http") or s.startswith("THE") or s.startswith("("):
            break
        q_lines.append(s)
        if len(" ".join(q_lines)) > 280:
            break
    portal_en = re.sub(r"\s+", " ", " ".join(q_lines)).strip()
    portal_en = re.sub(r"[\u0000-\u001f\u007f-\u009f\ue000-\uf8ff]+", " ", portal_en)
    portal_en = re.sub(r"\b2027\b|\b2026\b", " ", portal_en)
    portal_en = re.sub(r"\be\.g\.\s*[\d,.]+\b", " ", portal_en, flags=re.I)
    portal_en = re.sub(r"\s+", " ", portal_en).strip(" -")
    portal_en = re.sub(r"(?:[\d,]{2,}\s*)+$", "", portal_en).strip(" -")
    if not portal_en:
        portal_en = en_ask or ref

    answer_type = "yesno"
    if site_q.get("answerType") in ("continuous", "picklist", "yesno"):
        answer_type = site_q["answerType"]
    # Portal continuous cues
    if re.search(r"Policy created \(yyyy\)|Policy reviewed \(yyyy\)|Number of |Proportion |FTE|headcount", body, re.I):
        if answer_type == "yesno" and not re.search(r"\bYes\b.*\bNo\b", body, re.S):
            answer_type = "continuous"
    options = []
    if site_q.get("options"):
        options = [
            {"en": o.get("en") or "", "zh": o.get("zh") or ""} for o in site_q["options"]
        ]
    elif answer_type == "picklist":
        # crude: lines between Yes/No block that look like options
        pass

    # Detect year fields on portal
    has_policy_created = bool(re.search(r"Policy created \(yyyy\)", body, re.I))
    has_policy_reviewed = bool(re.search(r"Policy reviewed \(yyyy\)", body, re.I))
    has_public = bool(re.search(r"Public\s+Private\s+Undefined|Public Private Undefined", body, re.I))
    has_comment = "Comments, max length" in body
    has_evidence = bool(re.search(r"evidence/|THE\d|https?://", body))

    def option_select(opts):
        ens = [(o.get("en") or "").strip().lower() for o in (opts or [])]
        joined = " | ".join(ens)
        if not ens:
            return "multi"
        rules = [
            r"whole university|partial measurement|partial\b",
            r"all food outlets|selected food outlets",
            r"ad hoc|on programmed|on-going|ongoing",
            r"overall report|separate report",
            r"scope 1",
            r"\bannual\b|\bbi-annual\b|less frequent",
            r"smoking-free|designated areas",
            r"automatic free access|access to all after|access in some",
            r"permanent free access|occasional free access",
            r"more than 30|more than 15|ad-hoc only",
            r"education integrated|mandatory education|optional education",
        ]
        for rule in rules:
            if re.search(rule, joined, re.I):
                return "single"
        accessish = sum(
            1
            for e in ens
            if re.search(
                r"free access|charged access|paid access|charged\b|free access to all|free access to some",
                e,
            )
        )
        if (
            accessish >= 2
            and len(ens) <= 3
            and "mental health" not in joined
            and "promotion" not in joined
        ):
            return "single"
        return "multi"

    fid = f"portal-{ref}"
    if fid in seen:
        continue
    seen.add(fid)
    sdg = int(ref.split(".")[0])
    portal_meta = {
        "hasYesNo": answer_type in ("yesno", "picklist")
        or bool(re.search(r"(?m)^Yes\b", body)),
        "hasPublic": has_public or answer_type in ("yesno", "picklist"),
        # 連續數值題通常只要填數字，不需證據／備註
        "hasComment": False if answer_type == "continuous" else has_comment,
        "hasEvidence": False
        if answer_type == "continuous"
        else (has_evidence or answer_type in ("yesno", "picklist")),
        "hasPolicyCreated": has_policy_created,
        "hasPolicyReviewed": has_policy_reviewed,
    }
    if answer_type == "picklist":
        portal_meta["optionSelect"] = option_select(options)
    fields.append(
        {
            "id": fid,
            "ref": ref,
            "sdg": sdg,
            "en": portal_en or en_ask or ref,
            "zh": zh or portal_en or ref,
            "answerType": answer_type,
            "options": options,
            "siteQuestionId": site_q.get("id") or "",
            "portal": portal_meta,
            "aligned": bool(site_q),
        }
    )

# sort
def key(r):
    return [int(x) for x in r["ref"].split(".")]


fields.sort(key=key)
payload = {
    "source": "WUR Portal PDF export + site questions.json alignment",
    "count": len(fields),
    "alignedCount": sum(1 for f in fields if f["aligned"]),
    "fields": fields,
}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("wrote", OUT, "fields", len(fields), "aligned", payload["alignedCount"])
print("sample", fields[0]["ref"], fields[0]["en"][:80] if fields else None)
