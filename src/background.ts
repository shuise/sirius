console.log("[Sirius] background service worker started")

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1"
const DEEPSEEK_MODEL = "deepseek-chat"
const STORAGE_KEY = "sirius:ai-config"

function sanitize(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uD800-\uDFFF]/g, "")
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Sirius] extension installed")

  chrome.contextMenus.create({
    id: "sirius-discuss",
    title: "发送到 Sirius 讨论",
    contexts: ["selection"],
  })
})

// Handle context menu click — open sidePanel synchronously (user gesture required)
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "sirius-discuss" && info.selectionText && tab?.id) {
    // Must call sidePanel.open synchronously in the gesture handler
    chrome.sidePanel.open({ tabId: tab.id })
    chrome.tabs.sendMessage(tab.id, { action: "activate" })
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: "open-discussion",
        text: info.selectionText,
        url: tab.url,
        title: tab.title,
      })
    }, 300)
  }
})

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id })
    chrome.tabs.sendMessage(tab.id, { action: "activate" })
  }
})

// Forward export actions to the active tab's content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const forwardActions = ["download-md", "export-pdf", "get-article-text"]
  if (forwardActions.includes(msg.action)) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, msg)
      }
    })
    sendResponse({ ok: true })
    return true
  }

  switch (msg.action) {
    case "ai-chat":
      handleAIChat(msg.messages, msg.opts)
        .then(sendResponse)
        .catch((e) => sendResponse({ error: e.message }))
      return true

    case "weread-search":
      handleWereadSearch(msg.bookNames)
        .then(sendResponse)
        .catch((e) => sendResponse({ error: e.message }))
      return true
  }
})

/** Proxy DeepSeek chat completion through background */
async function handleAIChat(
  messages: { role: string; content: string }[],
  opts: { temperature?: number; maxTokens?: number } = {},
) {
  const result = await chrome.storage.sync.get([STORAGE_KEY])
  const { apiKey } = (result[STORAGE_KEY] as { apiKey?: string }) || {}
  if (!apiKey) {
    throw new Error("请在设置中配置 API Key")
  }

  // Sanitize all message contents before JSON serialization
  const clean = messages.map((m) => ({
    role: m.role,
    content: sanitize(m.content),
  }))

  const response = await fetch(`${DEEPSEEK_ENDPOINT}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: clean,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 4096,
    }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => "")
    const detail = err.length > 500 ? err.slice(0, 500) + "..." : err
    throw new Error(`DeepSeek API error (${response.status}): ${detail}`)
  }

  const data = await response.json()
  return { content: data.choices?.[0]?.message?.content || "" }
}

/** Proxy WeChat Read search through background */
async function handleWereadSearch(bookNames: string[]) {
  const results: { title: string; author: string; link: string }[] = []

  for (const name of bookNames) {
    if (results.length >= 5) break
    try {
      const url = `https://weread.qq.com/web/search?q=${encodeURIComponent(name)}`
      const resp = await fetch(url, { headers: { Accept: "application/json" } })
      const data = await resp.json()

      const books: any[] = data?.books || []
      const matched = books.find((b: any) => {
        const bt: string = b?.bookInfo?.title || ""
        return bt.includes(name) || name.includes(bt)
      })

      if (matched) {
        const info = matched.bookInfo || {}
        const bookId: string = info.bookId || ""
        results.push({
          title: info.title || name,
          author: (info.author || "").replace(/\/.*$/, "").trim(),
          link: bookId
            ? `https://weread.qq.com/web/bookDetail/${bookId}`
            : `https://weread.qq.com/web/search?q=${encodeURIComponent(name)}`,
        })
      }
    } catch {
      // skip
    }
  }

  return { books: results }
}
