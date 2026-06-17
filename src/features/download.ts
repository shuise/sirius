import { register } from "../common/feature-manager"
import TurndownService from "turndown"
import { gfm } from "turndown-plugin-gfm"
import { extractArticle } from "../common/extract"

/**
 * Feature 5: 一键下载为 Markdown
 */

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  bulletListMarker: "-",
  hr: "---",
})

turndownService.use(gfm)
turndownService.remove("script")
turndownService.remove("noscript")
turndownService.remove("style")

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function fallbackMd(): string {
  const clone = document.body.cloneNode(true) as HTMLBodyElement
  clone
    .querySelectorAll("#sirius-toolbar, #sirius-spacer, script, noscript, style")
    .forEach((el) => el.remove())
  return turndownService.turndown(clone)
}

export function downloadAsMarkdown() {
  const article = extractArticle()
  let bodyMd: string
  let title: string | null | undefined

  if (article && article.content) {
    title = article.title || document.title
    bodyMd = turndownService.turndown(article.content)
  } else {
    console.warn("[Sirius] Readability extraction failed, falling back to raw body")
    title = document.title
    bodyMd = fallbackMd()
  }

  const safeTitle = (title || "page").replace(/[<>:"/\\|?*]/g, "_")
  const md = `# ${title}\n\n${bodyMd}`
  download(safeTitle + ".md", md)
}

register({
  name: "download",
  defaultEnabled: true,
  init() {
    const handler = (msg: { action: string }) => {
      if (msg.action === "download-md") {
        downloadAsMarkdown()
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    Object.assign(this, { _handler: handler })
  },
  destroy() {
    const handler = (this as unknown as { _handler?: (...args: unknown[]) => void })._handler
    if (handler) {
      chrome.runtime.onMessage.removeListener(handler)
    }
  },
})
