import { Readability } from '@mozilla/readability';

/**
 * 使用 Readability 提取页面主体内容。
 * 返回 { title, content(HTML), textContent }，content 可直接用于 turndown 或注入 DOM。
 * 提取失败时返回 null。
 */
export function extractArticle() {
  // Readability 会修改传入的 document，用 clone
  const doc = document.cloneNode(true);
  const reader = new Readability(doc, {
    debug: false,
    // 不需要保留 class，生成的 HTML 应尽量干净
    keepClasses: false,
  });
  const article = reader.parse();
  return article; // { title, content, textContent, length, excerpt, byline, ... } or null
}
