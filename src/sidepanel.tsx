import "./style.css"
import { useState, useEffect, useRef } from "react"
import logoUrl from "data-base64:assets/logo.png"
import { getConfig, saveConfig, chat } from "./common/ai"
import md from "md.js"

/** Render markdown content from AI responses */
function MarkdownRenderer({ content }: { content: string }) {
  const html = md(content)
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
}

interface BookInfo {
  title: string
  url: string
}

interface SummaryResult {
  summary: string
  rating: number // 1-5
}

interface DiscussMessage {
  role: "user" | "assistant"
  content: string
}

type Tab = "export" | "discuss" | "settings"

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

function sanitize(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uD800-\uDFFF]/g, "")
}

async function callDeepSeekSummary(text: string): Promise<SummaryResult> {
  const { apiKey } = await getConfig()
  if (!apiKey) {
    throw new Error("请先在系统设置中配置 API Key")
  }

  const safeText = sanitize(text).slice(0, 4000)

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

  // discuss state — keyed by page URL
  const [discussSessions, setDiscussSessions] = useState<Record<string, DiscussMessage[]>>({})
  const discussSessionsRef = useRef(discussSessions)
  discussSessionsRef.current = discussSessions
  const [discussInput, setDiscussInput] = useState("")
  const [discussLoading, setDiscussLoading] = useState(false)
  const discussEndRef = useRef<HTMLDivElement>(null)
  const articleTextRef = useRef("")
  const pageTitleRef = useRef("")

  const currentUrlRef = useRef("")

  // Safe wrapper for tabs.sendMessage — consumes lastError to avoid uncaught errors
  const sendMsg = (tabId: number, msg: Record<string, unknown>, cb?: (res: any) => void) => {
    chrome.tabs.sendMessage(tabId, msg, (res) => {
      if (chrome.runtime.lastError) {
        // Receiving end doesn't exist — silently ignore
        cb?.(null)
        return
      }
      cb?.(res)
    })
  }

  const queryActiveTab = (cb: (tab: chrome.tabs.Tab | null) => void) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      cb(tabs[0] || null)
    })
  }

  // Activate content script and load states
  const tryActivate = (cb?: () => void) => {
    queryActiveTab((t) => {
      if (!t?.id) return
      sendMsg(t.id, { action: "activate" }, (res) => {
        if (res?.states) {
          setStates(res.states)
          setReady(true)
          cb?.()
        } else {
          setReady(false)
        }
      })
    })
  }

  const loadStates = () => {
    queryActiveTab((t) => {
      if (!t?.id) return
      sendMsg(t.id, { action: "get-features" }, (res) => {
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
    queryActiveTab((t) => {
      if (!t?.id) return
      sendMsg(t.id, { action: "get-books-from-article" }, (res) => {
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

    queryActiveTab(async (t) => {
      if (!t?.id) {
        setSummaryError("无可用页面")
        setSummaryLoading(false)
        return
      }

      sendMsg(
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
          pageTitleRef.current = res.title || t.title || ""
          articleTextRef.current = sanitize(res.textContent)

          const cache = readCache()
          const cached = cache[pageUrl]
          if (cached) {
            setSummary(cached.result)
            setSummaryLoading(false)
            return
          }

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
    const onActivated = () => {
      tryActivate(() => {
        loadStates()
        loadBooks()
        doLoadSummary()
      })
    }
    const onUpdated = (_tabId: number, changeInfo: { status?: string }) => {
      if (changeInfo.status === "complete") {
        tryActivate(() => {
          loadStates()
          loadBooks()
          doLoadSummary()
        })
      }
    }

    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)

    return () => {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  }, [])

  // Listen for open-discussion message from background
  useEffect(() => {
    const handler = (msg: { action: string; text?: string }) => {
      if (msg.action === "open-discussion" && msg.text) {
        setTab("discuss")
        // handleDiscussSend will add the user message — don't duplicate here
        handleDiscussSend(msg.text)
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll discuss
  useEffect(() => {
    discussEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [discussSessions, currentUrlRef.current])

  const loadAll = () => {
    tryActivate(() => {
      loadStates()
      loadBooks()
      doLoadSummary()
    })
  }

  useEffect(() => {
    loadAll()
    getConfig().then((cfg) => {
      setApiKey(cfg.apiKey)
    })
  }, [])

  const toggle = (name: string) => {
    const next = !states[name]
    setStates((s) => ({ ...s, [name]: next }))
    queryActiveTab((t) => {
      if (t?.id) {
        sendMsg(t.id, { action: "toggle-feature", name, enabled: next })
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
    if (currentUrlRef.current) {
      const cache = readCache()
      delete cache[currentUrlRef.current]
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    }
    doLoadSummary()
  }

  const handleDiscussSend = async (text?: string) => {
    const msg = sanitize(text || discussInput).trim()
    if (!msg || discussLoading) return

    const url = currentUrlRef.current || "default"
    setDiscussInput("")

    // Add user message to session
    setDiscussSessions((prev) => ({
      ...prev,
      [url]: [...(prev[url] || []), { role: "user", content: msg }],
    }))
    setDiscussLoading(true)

    try {
      // Include page article text as shared context for all queries
      const sharedContext = articleTextRef.current
        ? `以下是当前页面的正文内容，供你参考上下文：\n\n${articleTextRef.current.slice(0, 2000)}`
        : null

      const currentMsgs = (discussSessionsRef.current[url] || []).concat({ role: "user", content: msg })

      const basePrompt = sharedContext
        ? `你是一个知识丰富的助手，请用中文回答用户的问题。回答时必须严格遵循以下要求：

1. **只讲事实，不输出个人观点** — 回答必须基于社会背景、媒体报道、国家政策、领导人观点等客观事实。不要添加主观评价、个人建议或推测性内容。如果某个问题没有可靠的事实依据，请如实说明"目前没有查到相关资料"
2. **每条回答必须配有来源链接** — 每条回答末尾必须附上 2~5 个相关的参考来源链接，**全部以 Markdown 无序列表格式书写**，每条链接一行，格式为：减号空格方括号标题方括号圆括号URL圆括号。链接必须真实有效，只使用来自 Wikipedia、MDN、GitHub、权威新闻媒体等可信站点的链接，不要编造链接。如果不确定链接是否有效，宁可不放
3. **注重排版** — 回答正文不能只是一段话。合理使用分段、有序/无序列表、引用块（>）、粗体（**关键术语**）等 Markdown 排版元素，让回答层次清晰、结构分明
4. **配图片** — 如果问题涉及概念、人物、数据等，请用 Markdown 图片语法配上相关的说明图片（!\[描述\](图片URL)），图片来自可靠的公共 CDN 或维基百科等
5. **简明扼要** — 直接回答问题，不罗嗦

${sharedContext}`
        : "你是一个知识丰富的助手，请用中文回答用户的问题。回答时必须严格遵循以下要求：\n\n1. **只讲事实，不输出个人观点** — 回答必须基于社会背景、媒体报道、国家政策、领导人观点等客观事实。不要添加主观评价、个人建议或推测性内容\n2. **每条回答必须配有来源链接** — 每条回答末尾必须附上 2~5 个相关的参考来源链接，**全部以 Markdown 无序列表格式书写**，每条链接一行，格式如：- [标题文字](https://...)。链接必须真实有效，不要编造链接\n3. **注重排版** — 合理使用分段、列表、引用块（>）、粗体等 Markdown 排版元素，让回答层次清晰\n4. **配图片** — 涉及概念、人物、数据时用 Markdown 图片语法配上说明图片\n5. **简明扼要** — 直接回答问题"

      const result = await chat(
        [
          { role: "system", content: basePrompt },
          ...currentMsgs.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        { temperature: 0.7, maxTokens: 2000 },
      )
      setDiscussSessions((prev) => ({
        ...prev,
        [url]: [...(prev[url] || []), { role: "assistant", content: result }],
      }))
    } catch (e) {
      setDiscussSessions((prev) => ({
        ...prev,
        [url]: [
          ...(prev[url] || []),
          { role: "assistant", content: `错误: ${sanitize((e as Error).message)}` },
        ],
      }))
    }
    setDiscussLoading(false)
  }

  const renderStars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n)

  const exportSessionAsMd = () => {
    const url = currentUrlRef.current || "unknown"
    const pageTitle = (pageTitleRef.current || url).replace(/[<>:"/\\|?*]/g, "_").slice(0, 80)
    const lines = [`# Sirius 讨论 - ${url}`, "", ...currentMessages.map((m) => `## ${m.role === "user" ? "你" : "AI"}\n\n${m.content}\n`)]
    const md = lines.join("\n")
    const blob = new Blob([md], { type: "text/markdown" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${pageTitle}-discuss.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const deleteDiscussMessage = (index: number) => {
    const url = currentUrlRef.current || "default"
    setDiscussSessions((prev) => {
      const msgs = prev[url] || []
      const next = msgs.filter((_, i) => i !== index)
      if (next.length === 0) {
        const { [url]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [url]: next }
    })
  }

  // Current session messages for the active page
  const currentMessages = discussSessions[currentUrlRef.current] || []

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
          { id: "discuss" as Tab, label: "讨论" },
          { id: "settings" as Tab, label: "设置" },
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
              <div className="text-center py-8">
                <p className="text-sm text-slate-400 mb-2">请先点击扩展图标激活</p>
                <button
                  onClick={loadAll}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
                >
                  激活
                </button>
              </div>
            )}

            {ready && (
              <>
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
                        <h3 className="text-sm font-semibold text-slate-700">内容摘要</h3>
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
                      <p className="text-xs text-slate-600 leading-relaxed">{summary.summary}</p>
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
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">相关商品</h3>
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
              </>
            )}
          </div>
        )}

        {tab === "discuss" && (
          <div className="flex flex-col h-full -m-3">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {currentMessages.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">
                  在页面上选中文字，右键选择「发送到 Sirius 讨论」
                </p>
              )}
              {currentMessages.map((m, i) => (
                <div
                  key={i}
                  className={`flex group ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="relative max-w-[85%]">
                    <div
                      className={`rounded-lg px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-orange-500 text-white"
                          : "bg-white text-slate-700 shadow-sm"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <MarkdownRenderer content={m.content} />
                      ) : (
                        m.content
                      )}
                    </div>
                    <button
                      onClick={() => deleteDiscussMessage(i)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-400 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {discussLoading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-lg px-3 py-2 text-sm text-slate-400 shadow-sm flex items-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                    思考中...
                  </div>
                </div>
              )}
              <div ref={discussEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-amber-100 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={discussInput}
                  onChange={(e) => setDiscussInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDiscussSend()}
                  placeholder="输入你的问题..."
                  className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
                <button
                  onClick={() => handleDiscussSend()}
                  disabled={discussLoading || !discussInput.trim()}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  发送
                </button>
                {currentMessages.length > 0 && (
                  <button
                    onClick={exportSessionAsMd}
                    className="px-3 py-2 rounded-lg bg-white border border-amber-300 text-sm text-slate-600 hover:bg-amber-50 transition-colors"
                    title="导出会话"
                  >
                    📥
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="space-y-3">
            {/* Feature toggles */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">功能开关</h3>
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
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <span className="text-lg">{f.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700">{f.label}</div>
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

            {/* API Key */}
            <div className="bg-white rounded-lg p-4 shadow-sm space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">DeepSeek API 配置</h3>
                <p className="text-xs text-slate-400">用于摘要和讨论功能。</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">API Key</label>
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
                  1. 访问{" "}
                  <a
                    href="https://platform.deepseek.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 underline"
                  >
                    platform.deepseek.com
                  </a>
                  <br />
                  2. 注册并登录后进入 API Keys 页面
                  <br />
                  3. 创建新的 API Key 并粘贴到上方输入框
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default IndexSidepanel
