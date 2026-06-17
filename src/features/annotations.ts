import { register } from "../common/feature-manager"

/**
 * Feature 6: 注释提取还原到原文中气泡处理
 */

function collectFootnoteDefs(): Map<string, string> {
  const defs = new Map<string, string>()

  const containers = document.querySelectorAll(
    '#footnotes, .footnotes, .footnote, section[role="doc-endnotes"], ol.references',
  )
  containers.forEach((container) => {
    const items = container.querySelectorAll("li, p")
    items.forEach((item) => {
      const id = item.id || ((item.querySelector("a") || {} as HTMLAnchorElement).name)
      if (id) {
        const text = item.textContent!.replace(/^[\d\s.]+/, "").replace(/↩\s*$/, "").trim()
        if (text) defs.set(id, text)
      }
      const backlink = item.querySelector('a[href^="#fnref"]') as HTMLAnchorElement | null
      if (backlink) {
        const refId = backlink.getAttribute("href")!.slice(1)
        const text = item.textContent!.replace(/^[\d\s.]+/, "").replace(/↩\s*$/, "").trim()
        if (text) defs.set(refId, text)
      }
    })
  })

  if (defs.size === 0) {
    document
      .querySelectorAll<HTMLAnchorElement | HTMLLIElement | HTMLParagraphElement>(
        'a[name^="fn"], a[id^="fn"], li[id^="fn"], p[id^="fn"]',
      )
      .forEach((el) => {
        const id = el.id || (el as HTMLAnchorElement).name || el.getAttribute("id")
        if (id) {
          const parent = el.closest("li, p, div")
          const text = (parent || el).textContent!.replace(/^[\d\s.]+/, "").replace(/↩\s*$/, "").trim()
          if (text) defs.set(id, text)
        }
      })
  }

  return defs
}

function createBubbleForLink(link: HTMLAnchorElement, noteText: string) {
  if (link.dataset.siriusAnnotation) return
  link.dataset.siriusAnnotation = "true"

  const bubble = document.createElement("span")
  bubble.className = "sirius-annotation-bubble"
  bubble.textContent = noteText
  bubble.style.cssText = [
    "display:none",
    "position:absolute",
    "z-index:99999",
    "bottom:calc(100% + 6px)",
    "left:50%",
    "transform:translateX(-50%)",
    "max-width:320px",
    "width:max-content",
    "padding:8px 12px",
    "background:#1e293b",
    "color:#f1f5f9",
    "font-size:13px",
    "line-height:1.5",
    "border-radius:8px",
    "white-space:normal",
    "word-break:break-word",
    "box-shadow:0 4px 12px rgba(0,0,0,0.25)",
    "pointer-events:none",
  ].join(";")

  const arrow = document.createElement("span")
  arrow.style.cssText = [
    "position:absolute",
    "top:100%",
    "left:50%",
    "transform:translateX(-50%)",
    "border:6px solid transparent",
    "border-top-color:#1e293b",
  ].join(";")
  bubble.appendChild(arrow)

  const wrapper = document.createElement("sup")
  wrapper.style.cssText = "position:relative;display:inline;cursor:pointer;"

  link.parentNode!.insertBefore(wrapper, link)
  wrapper.appendChild(link)
  wrapper.appendChild(bubble)

  wrapper.addEventListener("mouseenter", () => {
    bubble.style.display = "block"
  })
  wrapper.addEventListener("mouseleave", () => {
    bubble.style.display = "none"
  })
  wrapper.addEventListener("click", (e) => {
    e.preventDefault()
    bubble.style.display = bubble.style.display === "block" ? "none" : "block"
  })
}

function extractAndBubble() {
  const defs = collectFootnoteDefs()

  const footnoteLinks = document.querySelectorAll<HTMLAnchorElement>(
    'sup a[href^="#fn"], a.footnote, a[role="doc-noteref"]',
  )
  footnoteLinks.forEach((link) => {
    const href = link.getAttribute("href")
    if (!href) return
    const targetId = href.slice(1)
    const noteText = defs.get(targetId)
    if (noteText) {
      createBubbleForLink(link, noteText)
    }
  })

  processMarkdownAnnotations(defs)
}

function processMarkdownAnnotations(defs: Map<string, string>) {
  const defByIndex = new Map<number, string>()
  defs.forEach((text, id) => {
    const m = id.match(/(\d+)$/)
    if (m) {
      const num = parseInt(m[1], 10)
      if (!defByIndex.has(num)) {
        defByIndex.set(num, text)
      }
    }
  })

  const textNodes: Text[] = []
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = (node as Text).parentElement
        if (
          !parent ||
          parent.closest(".sirius-annotation-bubble") ||
          parent.tagName === "SCRIPT" ||
          parent.tagName === "STYLE" ||
          parent.tagName === "SUP"
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

  const annotationRegex = /\[\^(\d+)\]/g
  textNodes.forEach((textNode) => {
    if (!annotationRegex.test(textNode.textContent || "")) return
    annotationRegex.lastIndex = 0

    const fragment = document.createDocumentFragment()
    let remaining = textNode.textContent || ""
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = annotationRegex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(remaining.slice(lastIndex, match.index)))
      }

      const num = parseInt(match[1], 10)
      const noteText = defByIndex.get(num)

      if (noteText) {
        const sup = document.createElement("sup")
        sup.style.cssText = "position:relative;display:inline;cursor:pointer;color:#6366f1;font-weight:600;"

        const linkSpan = document.createElement("span")
        linkSpan.textContent = `[${num}]`
        sup.appendChild(linkSpan)

        const bubble = document.createElement("span")
        bubble.className = "sirius-annotation-bubble"
        bubble.textContent = noteText
        bubble.style.cssText = [
          "display:none",
          "position:absolute",
          "z-index:99999",
          "bottom:calc(100% + 6px)",
          "left:50%",
          "transform:translateX(-50%)",
          "max-width:320px",
          "width:max-content",
          "padding:8px 12px",
          "background:#1e293b",
          "color:#f1f5f9",
          "font-size:13px",
          "line-height:1.5",
          "border-radius:8px",
          "white-space:normal",
          "word-break:break-word",
          "box-shadow:0 4px 12px rgba(0,0,0,0.25)",
          "pointer-events:none",
        ].join(";")

        const arrow = document.createElement("span")
        arrow.style.cssText = [
          "position:absolute",
          "top:100%",
          "left:50%",
          "transform:translateX(-50%)",
          "border:6px solid transparent",
          "border-top-color:#1e293b",
        ].join(";")
        bubble.appendChild(arrow)
        sup.appendChild(bubble)

        sup.addEventListener("mouseenter", () => {
          bubble.style.display = "block"
        })
        sup.addEventListener("mouseleave", () => {
          bubble.style.display = "none"
        })
        sup.addEventListener("click", (e) => {
          e.preventDefault()
          bubble.style.display = bubble.style.display === "block" ? "none" : "block"
        })

        fragment.appendChild(sup)
      } else {
        const sup = document.createElement("sup")
        sup.style.cssText = "color:#6366f1;font-weight:600;"
        sup.textContent = `[${num}]`
        sup.title = `注释 ${num}`
        fragment.appendChild(sup)
      }

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < remaining.length) {
      fragment.appendChild(document.createTextNode(remaining.slice(lastIndex)))
    }

    textNode.parentNode!.replaceChild(fragment, textNode)
  })
}

register({
  name: "annotations",
  defaultEnabled: true,
  init() {
    extractAndBubble()
  },
  destroy() {
    document.querySelectorAll(".sirius-annotation-bubble").forEach((b) => b.remove())
    document.querySelectorAll("[data-sirius-annotation]").forEach((el) => {
      delete (el as HTMLElement).dataset.siriusAnnotation
    })
  },
})
