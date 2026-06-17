import { register } from "../common/feature-manager"
import html2canvas from "html2canvas"
import { jsPDF } from "jspdf"
import { extractArticle } from "../common/extract"

/**
 * Feature 7: 导出 PDF
 */

function renderArticleHtml(html: string): HTMLDivElement {
  const container = document.createElement("div")
  container.id = "sirius-export-container"
  container.innerHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, "Noto Sans SC", "Segoe UI", sans-serif;
            font-size: 16px;
            line-height: 1.8;
            color: #1e293b;
            padding: 40px 20px;
          }
          img { max-width: 100%; height: auto; }
          table { border-collapse: collapse; width: 100%; margin: 16px 0; word-break: break-word; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
          th { background: #f1f5f9; }
          pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
          code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; word-break: break-word; }
          blockquote { border-left: 4px solid #6366f1; padding: 8px 16px; margin: 16px 0; background: #eef2ff; }
          h1, h2, h3, h4 { margin-top: 24px; margin-bottom: 12px; word-break: break-word; }
          p { margin-bottom: 12px; word-break: break-word; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `
  container.style.cssText = [
    "position:absolute",
    "left:-9999px",
    "top:0",
    "overflow:visible",
  ].join(";")
  document.body.appendChild(container)
  return container
}

export async function exportAsPdf(filename?: string) {
  const article = extractArticle()
  const html = article?.content || document.body.innerHTML

  const container = renderArticleHtml(html)
  await new Promise((r) => requestAnimationFrame(r))

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    })

    const margin = 15
    const pageW = 210
    const pageH = 297
    const printableW = pageW - margin * 2
    const printableH = pageH - margin * 2

    const imgWidth = printableW
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    const pdf = new jsPDF("p", "mm", "a4")
    const imgData = canvas.toDataURL("image/jpeg", 0.95)
    let heightLeft = imgHeight
    let position = margin

    pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight)
    heightLeft -= printableH

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft)
      pdf.addPage()
      pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight)
      heightLeft -= printableH
    }

    pdf.save(filename || `page-${Date.now()}.pdf`)
  } finally {
    container.remove()
  }
}

register({
  name: "export",
  defaultEnabled: true,
  init() {
    const handler = (
      msg: { action: string; filename?: string },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (resp: { ok: boolean }) => void,
    ) => {
      if (msg.action === "export-pdf") {
        exportAsPdf(msg.filename).then(() => sendResponse({ ok: true }))
        return true
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
