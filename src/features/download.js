import { register } from './index';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { extractArticle } from '../extract';

/**
 * Feature 5: 一键下载全部内容为 md 文件
 * 先使用 Readability 提取文章主体，再通过 turndown 转为 Markdown。
 */

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  bulletListMarker: '-',
  hr: '---',
});

turndownService.use(gfm);

turndownService.remove('script');
turndownService.remove('noscript');
turndownService.remove('style');

function download(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fallbackMd() {
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('#sirius-toolbar, #sirius-spacer, script, noscript, style').forEach((el) => el.remove());
  return turndownService.turndown(clone);
}

export function downloadAsMarkdown() {
  const article = extractArticle();
  let bodyMd;
  let title;

  if (article && article.content) {
    title = article.title || document.title;
    bodyMd = turndownService.turndown(article.content);
  } else {
    console.warn('[Sirius] Readability extraction failed, falling back to raw body');
    title = document.title;
    bodyMd = fallbackMd();
  }

  const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_') || 'page';
  const md = `# ${title}\n\n${bodyMd}`;
  download(safeTitle + '.md', md);
}

export default register({
  name: 'download',
  defaultEnabled: true,
  init() {
    const handler = (msg) => {
      if (msg.action === 'download-md') {
        downloadAsMarkdown();
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
