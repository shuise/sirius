import "./style.css"
import { useState, useEffect, useRef } from "react"
import logoUrl from "data-base64:assets/logo.png"
import { getConfig, saveConfig, chat } from "./common/ai"

interface BookInfo {
  title: string
  url: string
}

interface SummaryResult {
  summary: string
  rating: number // 1-5
}

type Tab = "export" | "feature-settings" | "settings"

const CACHE_KEY = "sirius:summary-cache"

interface CacheEntry {
  result: SummaryResult
  timestamp: number
}

function readCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}")
  } catch {
    return {}
  }
}

function writeCache(url: string, entry: CacheEntry) {
  const cache = readCache()
  cache[url] = entry
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

async function callDeepSeekSummary(text: string): Promise<SummaryResult> {
  const { apiKey } = await getConfig()
  if (!apiKey) {
    throw new Error("请先在系统设置中配置 API Key")
  }

  // Sanitize text: strip control chars that could break JSON serialization
  const safeText = text
    .slice(0, 4000)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uD800-\uDFFF]/g, "")

  const prompt = `你是一个中文内容编辑助手。请阅读以下文章内容，用中文写一段200字以内的摘要，并给出1-5星的推荐指数（5星为最佳）。

请严格按以下格式返回，不要有多余内容：
摘要：<摘要内容>
推荐指数：<1-5的数字>

文章内容：
${safeText}`

  const result = await chat(
    [
      { role: "system", content: "你是一个内容摘要助手，只返回指定格式的内容。" },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3, maxTokens: 500 },
  )

  const summaryMatch = result.match(/摘要[：:]\s*(.+)/)
  const ratingMatch = result.match(/推荐指数[：:]\s*(\d+)/)

  return {
    summary: summaryMatch?.[1]?.trim() || "暂无摘要",
    rating: Math.min(5, Math.max(1, parseInt(ratingMatch?.[1] || "3", 10))),
  }
}

function IndexSidepanel() {
  const [tab, setTab] = useState<Tab>("export")
  const [states, setStates] = useState<Record<string, boolean>>({})
  const [ready, setReady] = useState(false)
  const [books, setBooks] = useState<BookInfo[]>([])
  const [summary, setSummary] = useState<SummaryResult | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState("")

  // settings state
  const [apiKey, setApiKey] = useState("")
  const [saved, setSaved] = useState(false)

  const currentUrlRef = useRef("")

  const loadStates = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs[0]
      if (!t?.id) return
      chrome.tabs.sendMessage(t.id, { action: "get-features" }, (res) => {
        if (res?.states) {
          setStates(res.states)
          setReady(true)
        } else {
          setReady(false)
        }
      })
    })
  }

  const loadBooks = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs[0]
      if (!t?.id) return
      chrome.tabs.sendMessage(t.id, { action: "get-books-from-article" }, (res) => {
        if (res?.books) {
          setBooks(res.books.slice(0, 5))
        }
      })
    })
  }

  const doLoadSummary = () => {
    setSummaryLoading(true)
    setSummaryError("")
    setSummary(null)

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const t = tabs[0]
      if (!t?.id) {
        setSummaryError("无可用页面")
        setSummaryLoading(false)
        return
      }

      chrome.tabs.sendMessage(
        t.id,
        { action: "get-article-text" },
        async (res) => {
          if (!res?.textContent) {
            setSummaryError("无法获取页面内容")
            setSummaryLoading(false)
            return
          }

          const pageUrl = res.url || t.url || ""
          currentUrlRef.current = pageUrl

          // Check cache
          const cache = readCache()
          const cached = cache[pageUrl]
          if (cached) {
            setSummary(cached.result)
            setSummaryLoading(false)
            return
          }

          // No cache — call AI
          const { apiKey } = await getConfig()
          if (!apiKey) {
            setSummaryError("请先在系统设置中配置 API Key")
            setSummaryLoading(false)
            return
          }

          try {
            const result = await callDeepSeekSummary(res.textContent)
            writeCache(pageUrl, { result, timestamp: Date.now() })
            setSummary(result)
          } catch (e) {
            setSummaryError((e as Error).message)
          }
          setSummaryLoading(false)
        },
      )
    })
  }

  // Listen for tab switches
  useEffect(() => {
    const onActivated = () => doLoadSummary()
    const onUpdated = (_tabId: number, changeInfo: { status?: string }) => {
      if (changeInfo.status === "complete") doLoadSummary()
    }

    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)

    return () => {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  }, [])

  useEffect(() => {
    loadStates()
    loadBooks()
    doLoadSummary()
    getConfig().then((cfg) => {
      setApiKey(cfg.apiKey)
    })
  }, [])

  const toggle = (name: string) => {
    const next = !states[name]
    setStates((s) => ({ ...s, [name]: next }))
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggle-feature",
          name,
          enabled: next,
        })
      }
    })
  }

  const sendAction = (action: string) => {
    chrome.runtime.sendMessage({ action })
  }

  const handleSaveKey = async () => {
    await saveConfig({ apiKey })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRetrySummary = () => {
    // Remove cache entry for current URL so it re-fetches
    if (currentUrlRef.current) {
      const cache = readCache()
      delete cache[currentUrlRef.current]
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    }
    doLoadSummary()
  }

  const renderStars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n)

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Header */}
      <header className="flex items-center justify-center gap-2 px-4 py-3 border-b border-amber-100 bg-white">
        <img src={logoUrl} alt="Sirius" className="w-7 h-7" />
        <h1 className="text-lg font-bold text-amber-900">Sirius</h1>
      </header>

      {/* Tab bar */}
      <nav className="flex border-b border-amber-100 bg-white">
        {[
          { id: "export" as Tab, label: "导出内容" },
          { id: "feature-settings" as Tab, label: "功能设置" },
          { id: "settings" as Tab, label: "系统设置" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "text-orange-600 border-b-2 border-orange-500"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === "export" && (
          <div className="pt-2 space-y-3">
            {!ready && (
              <p className="text-sm text-slate-400 text-center py-8">
                请刷新页面后重试
              </p>
            )}

            {/* AI 摘要 */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              {summaryLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="inline-block w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                  正在生成摘要...
                </div>
              ) : summaryError ? (
                <div className="text-xs text-slate-400">
                  <p>{summaryError}</p>
                  <button
                    onClick={handleRetrySummary}
                    className="mt-1 text-orange-500 underline"
                  >
                    重试
                  </button>
                </div>
              ) : summary ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">
                      内容摘要
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-orange-500">
                        {renderStars(summary.rating)}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(summary.summary)}
                        className="text-xs text-slate-400 hover:text-orange-500 transition-colors"
                        title="复制摘要"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {summary.summary}
                  </p>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => sendAction("download-md")}
              className="w-full py-3 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              ⬇ 全文导出 Markdown
            </button>
            <button
              onClick={() => sendAction("export-pdf")}
              className="w-full py-3 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              📄 全文导出 PDF
            </button>

            {/* 相关商品 */}
            {books.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  相关商品
                </h3>
                <div className="space-y-2">
                  {books.map((book, i) => (
                    <a
                      key={i}
                      href={book.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-orange-600 transition-colors no-underline"
                    >
                      <span className="text-base">📖</span>
                      <span>{book.title}</span>
                      <span className="ml-auto text-xs text-slate-400">微信读书 →</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "feature-settings" && (
          <div className="space-y-1.5">
            {!ready && (
              <p className="text-sm text-slate-400 text-center py-8">
                请刷新页面后重试
              </p>
            )}
            <div className="space-y-1.5">
              {[
                { key: "links", icon: "🔗", label: "链接可点击", desc: "还原被屏蔽的超链接" },
                { key: "books", icon: "📚", label: "《》书籍识别", desc: "识别书名号中的书籍" },
                { key: "tables", icon: "📊", label: "表格 ↔ 图表", desc: "一键切换表格/柱状图" },
                { key: "copy", icon: "📋", label: "移除复制屏蔽", desc: "解除禁止复制限制" },
                { key: "annotations", icon: "💬", label: "注释气泡", desc: "脚注 hover 气泡显示" },
                { key: "download", icon: "📥", label: "一键下载 MD", desc: "Markdown / PDF 导出" },
                { key: "export", icon: "🖼️", label: "导出引擎", desc: "PDF 导出核心模块" },
              ].map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 shadow-sm cursor-pointer"
                >
                  <span className="text-lg">{f.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700">
                      {f.label}
                    </div>
                    <div className="text-xs text-slate-400 truncate">{f.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!states[f.key]}
                    onChange={() => toggle(f.key)}
                    className="accent-orange-500 w-4 h-4"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-1">DeepSeek API 配置</h3>
              <p className="text-xs text-slate-400">
                用于书籍识别等 AI 功能。目前仅支持 DeepSeek。
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleSaveKey}
              className="w-full py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              {saved ? "已保存 ✓" : "保存"}
            </button>

            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                如何获取 API Key？
                <br />
                1. 访问 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline">platform.deepseek.com</a>
                <br />
                2. 注册并登录后进入 API Keys 页面
                <br />
                3. 创建新的 API Key 并粘贴到上方输入框
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default IndexSidepanel
