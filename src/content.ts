import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle",
}

// Import features (side effects - they register themselves)
import "./features/links"
import "./features/books"
import "./features/tables"
import "./features/copy"
import "./features/download"
import "./features/annotations"
import "./features/export"

import { getAllFeatures, getFeature, updatePageState } from "./common/feature-manager"
import { getRawBooks, verifyBooks } from "./features/books"
import { extractArticle } from "./common/extract"
import { getWereadBooksInfo } from "./common/ai"

console.log("[Sirius] content script loaded")

const activeFeatures = new Map<string, boolean>()

function initAll() {
  updatePageState()
  getAllFeatures().forEach((feat) => {
    try {
      const enabled = localStorage.getItem(`sirius:${feat.name}`) !== "false"
      if (enabled) {
        feat.init()
        activeFeatures.set(feat.name, true)
      }
    } catch (e) {
      console.warn(`[Sirius] feature "${feat.name}" init error:`, e)
    }
  })
}

function enableFeature(name: string) {
  if (activeFeatures.get(name)) return
  const feat = getFeature(name)
  if (feat) {
    try {
      feat.init()
      activeFeatures.set(name, true)
      localStorage.setItem(`sirius:${name}`, "true")
    } catch (e) {
      console.warn(`[Sirius] enable "${name}" error:`, e)
    }
  }
}

function disableFeature(name: string) {
  if (!activeFeatures.get(name)) return
  const feat = getFeature(name)
  if (feat) {
    try {
      feat.destroy()
      activeFeatures.set(name, false)
      localStorage.setItem(`sirius:${name}`, "false")
    } catch (e) {
      console.warn(`[Sirius] disable "${name}" error:`, e)
    }
  }
}

function getStates(): Record<string, boolean> {
  const states: Record<string, boolean> = {}
  getAllFeatures().forEach((feat) => {
    states[feat.name] = !!activeFeatures.get(feat.name)
  })
  return states
}

// Listen for messages
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.action) {
    case "get-features":
      sendResponse({ states: getStates() })
      break
    case "toggle-feature":
      if (msg.enabled) {
        enableFeature(msg.name)
      } else {
        disableFeature(msg.name)
      }
      sendResponse({ states: getStates() })
      break
    case "get-books":
      sendResponse({ books: getRawBooks() })
      break
    case "get-article-text": {
      const article = extractArticle()
      sendResponse({
        url: location.href,
        title: article?.title || document.title,
        textContent: article?.textContent || document.body.innerText,
      })
      break
    }
    case "verify-books": {
      const titles: string[] = msg.titles || []
      verifyBooks(titles).then((verified) => {
        sendResponse({ books: verified })
      })
      return true // async
    }
    case "get-books-from-article": {
      const article = extractArticle()
      const bodyText = article?.textContent || document.body.innerText
      // Parse 《》 book titles
      const seen = new Set<string>()
      const bookRegex = /《([^》]+)》/g
      let match: RegExpExecArray | null
      const titles: string[] = []
      while ((match = bookRegex.exec(bodyText)) !== null) {
        const t = match[1].trim()
        if (t && !seen.has(t)) {
          seen.add(t)
          titles.push(t)
        }
      }
      if (titles.length === 0) {
        sendResponse({ books: [] })
        break
      }
      getWereadBooksInfo(titles).then((books) => {
        sendResponse({
          books: books.slice(0, 5).map((b) => ({ title: b.title, url: b.link })),
        })
      })
      return true // async
    }
    default:
      sendResponse({ ok: false })
  }
})

// DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAll)
} else {
  initAll()
}
