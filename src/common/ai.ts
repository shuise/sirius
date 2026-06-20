/**
 * 通用 AI 服务
 *
 * 所有网络请求通过 background service worker 代理发出。
 * API Key 通过侧边栏「设置」页面配置。
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

/** Send chat completions request through background */
export async function chat(
  messages: AIChatMessage[],
  opts: AICompletionOptions = {},
): Promise<string> {
  const { apiKey } = await getConfig()
  if (!apiKey) {
    throw new Error("请在系统设置中配置 API Key")
  }

  const result = await chrome.runtime.sendMessage({
    action: "ai-chat",
    messages,
    opts,
  })

  if (result?.error) {
    throw new Error(result.error)
  }

  return result?.content || ""
}

// https://weread.qq.com/r/weread-skills — 微信读书 Skill
export interface Book {
  title: string
  author: string
  link: string
}

/** Search books via WeChat Read through background */
export async function getWereadBooksInfo(bookNames: string[]): Promise<Book[]> {
  if (bookNames.length === 0) return []

  const result = await chrome.runtime.sendMessage({
    action: "weread-search",
    bookNames,
  })

  if (result?.error) {
    console.warn("[Sirius] weread search error:", result.error)
    return []
  }

  return result?.books || []
}
