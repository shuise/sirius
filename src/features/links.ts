import { register } from "../common/feature-manager"

/**
 * Feature 1: 转化所有链接可点击
 * 还原被屏蔽的超链接，纯文本 URL 自动转为可点击链接。
 */
function makeClickable() {
  const anchors = document.querySelectorAll('a[href*="javascript"], a[href=""]')
  anchors.forEach((a) => {
    const candidate =
      a.getAttribute("data-link") ||
      a.getAttribute("data-url") ||
      a.getAttribute("data-href")
    if (candidate && candidate.startsWith("http")) {
      a.setAttribute("href", candidate)
      ;(a as HTMLElement).style.cursor = "pointer"
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
          parent.tagName === "A" ||
          parent.tagName === "SCRIPT" ||
          parent.tagName === "STYLE"
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

  const urlRegex = /(https?:\/\/[^\s<>"'()]+)/g
  textNodes.forEach((textNode) => {
    if (urlRegex.test(textNode.textContent || "")) {
      const span = document.createElement("span")
      span.innerHTML = (textNode.textContent || "").replace(
        urlRegex,
        (match) =>
          `<a href="${match}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8;text-decoration:underline">${match}</a>`,
      )
      textNode.parentNode?.replaceChild(span, textNode)
    }
  })
}

register({
  name: "links",
  defaultEnabled: true,
  init() {
    makeClickable()
  },
  destroy() {
    // No easy undo for link modifications
  },
})
