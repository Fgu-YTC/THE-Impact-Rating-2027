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

const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBusy(status, payload) {
  const message = String((payload && payload.error && payload.error.message) || "");
  return status === 429 || status === 503 || /high demand|try again later|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(message);
}

async function askModel(apiKey, model, prompt, maxOutputTokens) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens },
      }),
    }
  );
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
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
    const audience = String(body.audience || "").trim() === "admin" ? "admin" : "fill";
    const style =
      audience === "admin"
        ? [
            "這是給管理人員看的說明，可以寫完整。",
            "用繁體中文，四行標題各自起一段：要填什麼、哪些算、哪些不算、證據要看到什麼。",
            "可補充年份、單位、全時當量、排除條件，以及方法論怎麼計分。分數是評分方式，不要把它寫成表單選項。",
            "若這一題寫「見」同一份 SDG 裡的某一節，簡短引用那個定義。",
          ]
        : [
            "這是給填寫者看的短摘要。用繁體中文，一整段，120 字以內。",
            "只講這一題要勾或填什麼，以及證據要看到什麼。",
            "不要加標題，不要寫評分百分比，不要展開其他定義。",
          ];

    const prompt = [
      "你是 THE Impact Rankings 2027 的填報助手。",
      `下面只有 SDG ${sdg} 的方法論，以及不屬於任何 SDG 的共用章節（例如附件）。`,
      "不要補上其他 SDG 的內容。先讀這些，再只談這一題要怎麼填。",
      ...style,
      "不要用星號、井號或 Markdown。",
      "Yes/No 只表示有或沒有。選項才用來區分免費、付費或其他作法。",
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

    let payload = null;
    let failed = null;
    try {
      for (const model of MODELS) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const result = await askModel(
            geminiKey.value(),
            model,
            prompt,
            audience === "admin" ? 1600 : 500
          );
          if (result.ok) {
            payload = result.payload;
            failed = null;
            break;
          }
          failed = result;
          if (!isBusy(result.status, result.payload) || attempt === 1) break;
          await sleep(1500);
        }
        if (payload) break;
        if (failed && !isBusy(failed.status, failed.payload)) break;
      }
    } catch (err) {
      res.status(502).json({ error: "連不到 Gemini，請再試一次。" });
      return;
    }
    if (!payload) {
      const detail = String((failed && failed.payload && failed.payload.error && (failed.payload.error.message || failed.payload.error.status)) || "")
        .replace(/AIza[\w-]+/g, "")
        .slice(0, 180);
      const busy = failed && isBusy(failed.status, failed.payload);
      res.status(502).json({
        error: busy
          ? "Gemini 目前較忙，請稍後再按一次。"
          : detail
            ? `Gemini 沒有回答：${detail}`
            : "Gemini 這次沒有回答，請再試一次。",
      });
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

const PRIOR_URL_OK = /^https:\/\/github\.com\/Fgu-YTC\/THE-Impact-Rating-2027\/releases\/download\/prior-year-2026\//;

/** 代理去年證據下載，讓瀏覽器存成原檔名（GitHub release 資產名僅 ASCII） */
exports.priorDownload = onRequest(
  {
    region: "asia-east1",
    cors: true,
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    const name = String((req.query && req.query.name) || "").trim().slice(0, 180);
    const url = String((req.query && req.query.url) || "").trim();
    if (!name || !url || !PRIOR_URL_OK.test(url)) {
      res.status(400).send("bad request");
      return;
    }
    try {
      const upstream = await fetch(url, { redirect: "follow" });
      if (!upstream.ok) {
        res.status(502).send("upstream");
        return;
      }
      const ascii = name.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_") || "evidence.bin";
      const star = encodeURIComponent(name).replace(/['()]/g, escape);
      res.setHeader(
        "Content-Type",
        upstream.headers.get("content-type") || "application/octet-stream"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${ascii}"; filename*=UTF-8''${star}`
      );
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.status(200).send(buf);
    } catch (err) {
      res.status(502).send("download failed");
    }
  }
);
