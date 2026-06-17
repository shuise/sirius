import { register } from './index';

/**
 * Feature: 导出工具栏
 * 在页面左下角固定三个导出按钮（Markdown / PDF / 图片），横排排列。
 * 在页面底部增加留白，防止工具栏遮挡内容。
 */

const TOOLBAR_ID = 'sirius-toolbar';
const SPACER_ID = 'sirius-spacer';

let toolbarEl = null;
let spacerEl = null;

function buildToolbar() {
  // Spacer — add padding at bottom of page
  spacerEl = document.createElement('div');
  spacerEl.id = SPACER_ID;
  spacerEl.style.cssText = 'height:80px;';

  // Toolbar
  toolbarEl = document.createElement('div');
  toolbarEl.id = TOOLBAR_ID;
  toolbarEl.style.cssText = [
    'position:fixed',
    'left:16px',
    'bottom:16px',
    'z-index:2147483647',
    'display:flex',
    'gap:8px',
    'padding:8px 12px',
    'background:#1e293b',
    'border-radius:10px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
  ].join(';');

  const buttons = [
    { label: '⬇ MD', action: 'download-md', title: '导出 Markdown' },
    { label: '📄 PDF', action: 'export-pdf', title: '导出 PDF' },
    { label: '🖼 图片', action: 'export-image', title: '导出图片' },
  ];

  buttons.forEach(({ label, action, title }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title;
    btn.style.cssText = [
      'padding:6px 14px',
      'border:none',
      'border-radius:6px',
      'cursor:pointer',
      'font-size:13px',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
      'font-weight:500',
      'color:#fff',
      'background:#6366f1',
      'transition:background 0.15s',
      'white-space:nowrap',
    ].join(';');
    btn.addEventListener('mouseenter', () => { btn.style.background = '#4f46e5'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#6366f1'; });
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action });
    });
    toolbarEl.appendChild(btn);
  });
}

export default register({
  name: 'toolbar',
  defaultEnabled: true,
  init() {
    if (document.getElementById(TOOLBAR_ID)) return;
    buildToolbar();
    document.body.appendChild(spacerEl);
    document.body.appendChild(toolbarEl);
  },
  destroy() {
    const tb = document.getElementById(TOOLBAR_ID);
    if (tb) tb.remove();
    const sp = document.getElementById(SPACER_ID);
    if (sp) sp.remove();
    toolbarEl = null;
    spacerEl = null;
  },
});
