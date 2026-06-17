import { Readability } from "@mozilla/readability"

/**
 * Shared article extraction layer.
 * Uses Readability to extract clean article content from the page.
 */
export interface Article {
  title: string | null | undefined
  content: string | null | undefined
  textContent: string | null | undefined
  excerpt: string | null | undefined
  byline: string | null | undefined
}

export function extractArticle(): Article | null {
  const doc = document.cloneNode(true) as Document
  const reader = new Readability(doc, {
    debug: false,
    keepClasses: false,
  })
  return reader.parse()
}
