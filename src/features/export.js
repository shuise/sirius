import { register } from './index';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { extractArticle } from '../extract';

/**
 * Feature 7: 一键导出为 PDF / 图片
 * - PDF: Readability 提取 → 容器渲染 → html2canvas → A4 + 边距
 * - 图片: 隐藏工具栏 → chrome.debugger 全页面截图 → 恢复工具栏
 */

// ── 工具栏隐藏/恢复 ──
function hideOwnUI() {
  const els = [];
  ['#sirius-toolbar', '#sirius-spacer'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el && el.style.display !== 'none') {
      el.dataset.siriusHidden = 'true';
      el.style.display = 'none';
      els.push(el);
    }
  });
  return () => {
    els.forEach((el) => {
      el.style.display = '';
      delete el.dataset.siriusHidden;
    });
  };
}

// ── Readability 内容渲染容器 ──
function renderArticleHtml(html) {
  const container = document.createElement('div');
  container.id = 'sirius-export-container';
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
  `;
  container.style.cssText = [
    'position:absolute',
    'left:-9999px',
    'top:0',
    'overflow:visible',
  ].join(';');
  document.body.appendChild(container);
  return container;
}

// ── PDF 导出 ──
export async function exportAsPdf(filename) {
  const article = extractArticle();
  const html = article?.content || document.body.innerHTML;

  const container = renderArticleHtml(html);
  await new Promise((r) => requestAnimationFrame(r));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    // A4 尺寸 210×297 mm，四周留 15mm 边距
    const margin = 15;
    const pageW = 210;
    const pageH = 297;
    const printableW = pageW - margin * 2; // 180mm
    const printableH = pageH - margin * 2; // 267mm

    // 将 Canvas 图片按比例缩放到 printableW 宽度
    const imgWidth = printableW;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    let heightLeft = imgHeight;
    let position = margin; // 当前页的垂直起点

    // 第一页
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    heightLeft -= printableH;

    // 后续分页
    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft); // 上移偏移
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= printableH;
    }

    pdf.save(filename || `page-${Date.now()}.pdf`);
  } finally {
    container.remove();
  }
}

// ── 图片导出 ──
export async function exportAsImage(filename) {
  const restore = hideOwnUI();
  try {
    // 用实际页面的 scrollWidth 作为目标宽度（取整，限制范围）
    const contentWidth = Math.min(
      Math.max(document.documentElement.scrollWidth, 400),
      1920,
    );

    const response = await chrome.runtime.sendMessage({
      action: 'capture-full-page',
      contentWidth,
    });

    if (response?.dataUrl) {
      const link = document.createElement('a');
      link.href = response.dataUrl;
      link.download = filename || `page-${Date.now()}.png`;
      link.click();
    }
  } finally {
    restore();
  }
}

export default register({
  name: 'export',
  defaultEnabled: true,
  init() {
    const handler = (msg, _sender, sendResponse) => {
      if (msg.action === 'export-pdf') {
        exportAsPdf(msg.filename).then(() => sendResponse({ ok: true }));
        return true;
      }
      if (msg.action === 'export-image') {
        exportAsImage(msg.filename).then(() => sendResponse({ ok: true }));
        return true;
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    this._handler = handler;
  },
  destroy() {
    if (this._handler) {
      chrome.runtime.onMessage.removeListener(this._handler);
    }
  },
});
