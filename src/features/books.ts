import { register } from "../common/feature-manager"
import { getWereadBooksInfo } from "../common/ai"

/**
 * Feature 2: 识别《》中的书籍，通过微信读书验证后展示
 */

export interface BookInfo {
  title: string
  url: string
}

let extractedBooks: BookInfo[] = []

function processBookTitles() {
  extractedBooks = []

  const textNodes: Text[] = []
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = (node as Text).parentElement
        if (
          !parent ||
          parent.tagName === "SCRIPT" ||
          parent.tagName === "STYLE" ||
          parent.tagName === "A"
        ) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    } as NodeFilter,
  )
  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text)
  }

  const seen = new Set<string>()
  const bookRegex = /《([^》]+)》/g
  textNodes.forEach((textNode) => {
    if (bookRegex.test(textNode.textContent || "")) {
      bookRegex.lastIndex = 0
      const span = document.createElement("span")
      span.innerHTML = (textNode.textContent || "").replace(
        bookRegex,
        (match, title) => {
          const trimmed = title.trim()
          const encoded = encodeURIComponent(trimmed)
          const link = `https://www.amazon.com/s?k=${encoded}&i=stripbooks`

          if (!seen.has(trimmed)) {
            seen.add(trimmed)
            extractedBooks.push({ title: trimmed, url: link })
          }

          return `<a href="${link}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8;text-decoration:none;border-bottom:1px dashed #1a73e8;cursor:pointer" title="在 Amazon 搜索：${trimmed}">📖《${trimmed}》</a>`
        },
      )
      textNode.parentNode?.replaceChild(span, textNode)
    }
  })
}

export function getRawBooks(): BookInfo[] {
  return extractedBooks
}

/**
 * 通过微信读书查询验证书籍，确保真实有效
 * 返回已验证的书籍列表（最多 5 本）
 */
export async function verifyBooks(
  titles: string[],
  signal?: AbortSignal,
): Promise<BookInfo[]> {
  const books = await getWereadBooksInfo(titles)
  return books.slice(0, 5).map((b) => ({ title: b.title, url: b.link }))
}

register({
  name: "books",
  defaultEnabled: true,
  init() {
    processBookTitles()
  },
  destroy() {
    extractedBooks = []
  },
})
