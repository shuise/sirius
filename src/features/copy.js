import { register } from './index';

/**
 * Feature 4: 移除复制屏蔽
 * 有些网站通过 CSS user-select: none、禁止 copy 事件、或者覆盖 selection
 * 来阻止复制。这里解除这些限制。
 */
function removeCopyBlocker() {
  // 1. Remove user-select:none from body and common container classes
  const style = document.createElement('style');
  style.id = 'sirius-copy-style';
  style.textContent = `
    body, body * {
      -webkit-user-select: text !important;
      user-select: text !important;
    }
  `;
  document.head.appendChild(style);

  // 2. Remove copy event listeners by adding a capturing listener that allows
  document.addEventListener(
    'copy',
    (e) => {
      e.stopPropagation();
    },
    true,
  );

  // 3. Remove cut event listeners similarly
  document.addEventListener(
    'cut',
    (e) => {
      e.stopPropagation();
    },
    true,
  );

  // 4. Remove contextmenu prevention
  document.addEventListener(
    'contextmenu',
    (e) => {
      e.stopPropagation();
    },
    true,
  );
}

export default register({
  name: 'copy',
  defaultEnabled: true,
  init() {
    removeCopyBlocker();
  },
  destroy() {
    const s = document.getElementById('sirius-copy-style');
    if (s) s.remove();
  },
});
