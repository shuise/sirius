import { register } from './index';

/**
 * Feature 2: 通过前端正则解析《》，查找 amazon 书籍
 * 识别中文书名号中的内容，调用 Amazon Product Advertising API 太复杂，
 * 改为直接生成 Amazon 搜索链接，并添加 📖 emoji。
 */
function processBookTitles() {
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'A') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  // Match 《book title》 pattern
  const bookRegex = /《([^》]+)》/g;
  textNodes.forEach((textNode) => {
    if (bookRegex.test(textNode.textContent)) {
      bookRegex.lastIndex = 0;
      const span = document.createElement('span');
      span.innerHTML = textNode.textContent.replace(
        bookRegex,
        (match, title) => {
          const encoded = encodeURIComponent(title.trim());
          const link = `https://www.amazon.com/s?k=${encoded}&i=stripbooks`;
          return `<a href="${link}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8;text-decoration:none;border-bottom:1px dashed #1a73e8;cursor:pointer" title="在 Amazon 搜索：${title.trim()}">📖《${title.trim()}》</a>`;
        },
      );
      textNode.parentNode.replaceChild(span, textNode);
    }
  });
}

export default register({
  name: 'books',
  defaultEnabled: true,
  init() {
    processBookTitles();
  },
  destroy() {
    // Re-run will double-process; page refresh recovers.
  },
});
