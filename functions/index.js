const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const geminiKey = defineSecret("GEMINI_API_KEY");
const GUIDE_URL =
  "https://fgu-ytc.github.io/THE-Impact-Rating-2027/data/methodology-zh.json";
const ALLOWED = new Set([
  "https://fgu-ytc.github.io",
  "http://127.0.0.1:8765",
  "http://localhost:8765",
]);
let packPromise = null;

function splitShared(body) {
  const text = String(body || "");
  const match = text.match(/(?:^|\n)附件\s*1\b/);
  if (!match || match.index == null) return { chapter: text.trim(), shared: "" };
  const at = match.index + (match[0].startsWith("\n") ? 1 : 0);
  return { chapter: text.slice(0, at).trim(), shared: text.slice(at).trim() };
}

function loadPack() {
  if (!packPromise) {
    packPromise = fetch(GUIDE_URL)
      .then((response) => {
        if (!response.ok) throw new Error("guide");
        return response.json();
      })
      .then((data) => {
        const chapters = {};
        let shared = "";
        const bySdg = data.bySdg || {};
        for (const key of Object.keys(bySdg)) {
          const item = bySdg[key] || {};
          const split = key === "17" ? splitShared(item.body) : { chapter: String(item.body || "").trim(), shared: "" };
          if (split.shared) shared = split.shared;
          chapters[key] = [item.title || `SDG ${key}`, split.chapter].filter(Boolean).join("\n");
        }
        return { chapters, shared };
      })
      .catch((err) => {
        packPromise = null;
        throw err;
      });
  }
  return packPromise;
}

function sdgOf(ref, title, sdg) {
  const direct = String(sdg || "").match(/^(\d{1,2})$/);
  if (direct) return direct[1];
  const fromRef = String(ref || "").match(/^(\d{1,2})\b/);
  if (fromRef) return fromRef[1];
  const fromTitle = String(title || "").match(/(\d{1,2})\.\d+/);
  return fromTitle ? fromTitle[1] : "";
}

function fieldHint(answerType, options) {
  const choice = options.length ? options.join("、") : "畫面上的選項";
  if (answerType === "yesno") {
    return "表單欄位只有：Yes/No、Comments、Evidence（網址或檔案）、Public。沒有別的選項可勾。";
  }
  if (answerType === "picklist") {
    return `表單欄位是：Yes/No、可複選的選項（${choice}）、Comments、Evidence（網址或檔案）、Public。方法論裡的分數是評分方式，不是要填進表單的選項。不要另造「無計劃」這類選項。`;
  }
  if (answerType === "continuous") {
    return "表單只填數字。單位、年份、全時當量以方法論為準。這一題沒有 Yes/No、證據或 Public。";
  }
  return "先分辨這一題是填 Yes/No、勾選項，還是填數字。分數是評分方式，不要把它寫成填寫者要選的項目，也不要另造方法論沒有的選項。";
}

function applyCors(req, res) {
  const origin = req.get("origin") || "";
  if (ALLOWED.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

exports.askMethodology = onRequest(
  {
    region: "asia-east1",
    secrets: [geminiKey],
    timeoutSeconds: 120,
    memory: "256MiB",
    maxInstances: 5,
  },
  async (req, res) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "只接受提交問題。" });
      return;
    }
    const body = req.body || {};
    const title = String(body.title || "").trim().slice(0, 300);
    const ref = String(body.ref || "").trim().slice(0, 40);
    const sdg = sdgOf(ref, title, body.sdg);
    const answerType = String(body.answerType || "").trim().slice(0, 40);
    const options = (Array.isArray(body.options) ? body.options : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 12);
    const section = String(body.methodology || "").trim().slice(0, 8000);
    if (!title && !ref) {
      res.status(400).json({ error: "請先點選題目。" });
      return;
    }

    let pack;
    try {
      pack = await loadPack();
    } catch (err) {
      res.status(502).json({ error: "方法論暫時讀不到，請再試一次。" });
      return;
    }
    const chapter = sdg && pack.chapters[sdg];
    if (!chapter) {
      res.status(400).json({ error: "這題對不到所屬的 SDG，請再點一次題目。" });
      return;
    }
    const guide = [chapter, pack.shared].filter(Boolean).join("\n\n").slice(0, 20000);

    const prompt = [
      "你是 THE Impact Rankings 2027 的填報助手。",
      `下面只有 SDG ${sdg} 的方法論，以及不屬於任何 SDG 的共用章節（例如附件）。`,
      "不要補上其他 SDG 的內容。先讀這些，再只教填寫者這一題的表單要怎麼填。",
      "目的是讓填寫者知道每個欄位怎麼下筆，不是解釋方法論，也不是介紹其他題。",
      "若這一題寫「見」同一份 SDG 裡的某一節，沿用那一節的定義。",
      "用繁體中文，四行標題各自起一段：要填什麼、哪些算、哪些不算、證據要看到什麼。",
      "不要用星號、井號或 Markdown。",
      "Yes/No 只表示有或沒有。選項才用來區分免費、付費或其他作法。",
      "不要把「得 1 分」「得 0.25 分」寫成填寫者要選的項目。",
      "寫出方法論有寫的年份、單位、全時當量與排除條件。",
      "不要假設這所大學已經做了什麼。方法論沒寫的，直接說方法論沒有寫。",
      "不要詢問或記錄填寫人的姓名。",
      "",
      `題號：${ref || "見題目"}`,
      `題目：${title}`,
      fieldHint(answerType, options),
      "",
      "畫面上這一題的摘錄，只用來對應題號：",
      section || "（無）",
      "",
      `SDG ${sdg} 方法論與共用章節：`,
      guide,
    ].join("\n");

    let payload;
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey.value(),
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1400 },
          }),
        }
      );
      payload = await response.json();
      if (!response.ok) {
        const detail = String((payload && payload.error && (payload.error.message || payload.error.status)) || "")
          .replace(/AIza[\w-]+/g, "")
          .slice(0, 180);
        res.status(502).json({
          error: detail ? `Gemini 沒有回答：${detail}` : "Gemini 這次沒有回答，請再試一次。",
        });
        return;
      }
    } catch (err) {
      res.status(502).json({ error: "連不到 Gemini，請再試一次。" });
      return;
    }

    const answer = (payload.candidates || [])
      .flatMap((item) => (item.content && item.content.parts) || [])
      .map((part) => (part.thought ? "" : part.text || ""))
      .join("")
      .replace(/\*\*/g, "")
      .replace(/^#{1,6}\s*/gm, "")
      .trim();
    res.json({ answer: answer || "沒有取得回答。" });
  }
);
