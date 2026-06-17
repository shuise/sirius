import { register } from './index';

/**
 * Feature 1: 转化所有链接可点击
 * 很多私域平台（微信公众号等）会把 <a> 的 href 去掉或改成
 * javascript:void(0)，这里尝试从 data-* / onclick 中还原真实链接。
 */
function makeClickable() {
  const anchors = document.querySelectorAll('a[href*="javascript"], a[href=""]');
  anchors.forEach((a) => {
    // Try to recover from data-link / data-url / data-href
    const candidate =
      a.getAttribute('data-link') ||
      a.getAttribute('data-url') ||
      a.getAttribute('data-href');
    if (candidate && candidate.startsWith('http')) {
      a.href = candidate;
      a.style.cursor = 'pointer';
    }
  });

  // Also turn plain-text URLs that aren't wrapped in <a> into links
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || parent.tagName === 'A' || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
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

  const urlRegex = /(https?:\/\/[^\s<>"'()]+)/g;
  textNodes.forEach((textNode) => {
    if (urlRegex.test(textNode.textContent)) {
      const span = document.createElement('span');
      span.innerHTML = textNode.textContent.replace(
        urlRegex,
        (match) => `<a href="${match}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8;text-decoration:underline">${match}</a>`,
      );
      textNode.parentNode.replaceChild(span, textNode);
    }
  });
}

export default register({
  name: 'links',
  defaultEnabled: true,
  init() {
    makeClickable();
  },
  destroy() {
    // No easy undo for link modifications; on re-run links stay but no harm.
  },
});
