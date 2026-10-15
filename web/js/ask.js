/** 依目前右側方法論，透過 Firebase 函式詢問 Gemini。金鑰不進網頁。 */
(function () {
  const form = document.querySelector("#methodAsk");
  if (!form) return;
  const answer = document.querySelector("#methodAskAnswer");
  const button = form.querySelector("button");
  const methodBody = document.querySelector("#methodBody");
  const methodTitle = document.querySelector("#methodTitle");
  const endpoint =
    "https://asia-east1-fgu-the-impact-rating.cloudfunctions.net/askMethodology";
  const ask =
    "請說明這一題在問什麼、要怎麼填，以及證據要看到什麼才算。只根據方法論，不要假設學校已經做了什麼。";

  function show(text, kind) {
    answer.hidden = false;
    answer.className = `method-ask-answer ${kind || ""}`;
    answer.textContent = text;
  }

  if (methodBody) {
    let seen = methodBody.innerText;
    new MutationObserver(() => {
      const next = methodBody.innerText;
      if (next === seen) return;
      seen = next;
      answer.hidden = true;
      answer.textContent = "";
    }).observe(methodBody, { childList: true, subtree: true, characterData: true });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const methodology = (methodBody?.innerText || "").trim();
    const title = (methodTitle?.textContent || "").trim();
    if (!methodology || methodology.length < 40) {
      show("請先點選左邊的題目，等右邊出現方法論再問。", "bad");
      return;
    }
    button.disabled = true;
    show("正在依這一題的方法論整理回答。", "busy");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.slice(0, 300),
          methodology: methodology.slice(0, 12000),
          ask: ask.slice(0, 500),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "詢問沒有成功。");
      }
      show(data.answer || "沒有取得回答。", "ok");
    } catch (err) {
      const message = String((err && err.message) || "");
      if (message === "Failed to fetch" || message.includes("NetworkError")) {
        show("詢問服務還沒接上。網頁不能直接使用 GitHub 上的 API 金鑰。", "bad");
        return;
      }
      show(message || "詢問沒有成功，請再試一次。", "bad");
    } finally {
      button.disabled = false;
    }
  });
})();
