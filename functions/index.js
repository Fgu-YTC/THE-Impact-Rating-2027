const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const geminiKey = defineSecret("GEMINI_API_KEY");
const ALLOWED = new Set([
  "https://fgu-ytc.github.io",
  "http://127.0.0.1:8765",
  "http://localhost:8765",
]);

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
    timeoutSeconds: 60,
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
    const ask = String(body.ask || "").trim().slice(0, 500);
    const title = String(body.title || "").trim().slice(0, 300);
    const methodology = String(body.methodology || "").trim().slice(0, 12000);
    if (!ask || !methodology) {
      res.status(400).json({ error: "請先點選題目，再寫下想問的問題。" });
      return;
    }

    const prompt = [
      "你是 THE Impact Rankings 2027 的填報助手。",
      "只根據下面這題的方法論回答。用繁體中文，分成短段落。",
      "不要編造這所大學已經做了什麼、有沒有政策，或證據夠不夠。",
      "方法論沒寫到的部分，直接說方法論沒有寫。",
      "不要詢問或記錄填寫人的姓名。",
      "",
      `題目：${title}`,
      "",
      "方法論：",
      methodology,
      "",
      `問題：${ask}`,
    ].join("\n");

    let payload;
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey.value(),
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
          }),
        }
      );
      payload = await response.json();
      if (!response.ok) {
        res.status(502).json({ error: "Gemini 這次沒有回答，請再試一次。" });
        return;
      }
    } catch (err) {
      res.status(502).json({ error: "連不到 Gemini，請再試一次。" });
      return;
    }

    const answer = (payload.candidates || [])
      .flatMap((item) => (item.content && item.content.parts) || [])
      .map((part) => part.text || "")
      .join("")
      .trim();
    res.json({ answer: answer || "沒有取得回答。" });
  }
);
