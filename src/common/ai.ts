/**
 * 通用 AI 服务
 *
 * 目前仅支持 DeepSeek API。
 * API Key 通过侧边栏「系统设置」页面配置。
 */

export interface AIConfig {
  apiKey: string
}

export interface AIChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AICompletionOptions {
  temperature?: number
  maxTokens?: number
}

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1"
const DEEPSEEK_MODEL = "deepseek-chat"

const STORAGE_KEY = "sirius:ai-config"

export function getConfig(): Promise<AIConfig> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      const stored = result[STORAGE_KEY] as AIConfig | undefined
      resolve(stored || { apiKey: "" })
    })
  })
}

export function saveConfig(config: AIConfig): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: config }, resolve)
  })
}

export async function chat(
  messages: AIChatMessage[],
  opts: AICompletionOptions = {},
): Promise<string> {
  const { apiKey } = await getConfig()
  if (!apiKey) {
    throw new Error("请在系统设置中配置 API Key")
  }

  const response = await fetch(`${DEEPSEEK_ENDPOINT}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 4096,
    }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => "")
    // Truncate response body for readable error messages
    const detail = err.length > 500 ? err.slice(0, 500) + "..." : err
    throw new Error(`DeepSeek API error (${response.status}): ${detail}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ""
}

// https://weread.qq.com/r/weread-skills — 微信读书 Skill
// 通过微信读书搜索 API 查询书籍，确保真实有效，返回书名、作者、链接
export interface Book {
  title: string
  author: string
  link: string
}

export async function getWereadBooksInfo(bookNames: string[]): Promise<Book[]> {
  const results: Book[] = []

  for (const name of bookNames) {
    if (results.length >= 5) break
    try {
      const url = `https://weread.qq.com/web/search?q=${encodeURIComponent(name)}`
      const resp = await fetch(url, { headers: { Accept: "application/json" } })
      const data = await resp.json()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const books: any[] = data?.books || []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // 查询失败则跳过
    }
  }

  return results
}
