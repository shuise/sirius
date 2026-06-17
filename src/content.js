import './features/links';
import './features/books';
import './features/tables';
import './features/copy';
import './features/download';
import './features/annotations';
import './features/export';
import './features/toolbar';
import { getAllFeatures, getFeature, updatePageState } from './features/index';

console.log('[Sirius] content script loaded');

const activeFeatures = new Map();

function initAll() {
  updatePageState();
  getAllFeatures().forEach((feat) => {
    try {
      const enabled = localStorage.getItem(`sirius:${feat.name}`) !== 'false';
      if (enabled) {
        feat.init();
        activeFeatures.set(feat.name, true);
      }
    } catch (e) {
      console.warn(`[Sirius] feature "${feat.name}" init error:`, e);
    }
  });
}

function enableFeature(name) {
  if (activeFeatures.get(name)) return;
  const feat = getFeature(name);
  if (feat) {
    try {
      feat.init();
      activeFeatures.set(name, true);
      localStorage.setItem(`sirius:${name}`, 'true');
    } catch (e) {
      console.warn(`[Sirius] enable "${name}" error:`, e);
    }
  }
}

function disableFeature(name) {
  if (!activeFeatures.get(name)) return;
  const feat = getFeature(name);
  if (feat) {
    try {
      feat.destroy();
      activeFeatures.set(name, false);
      localStorage.setItem(`sirius:${name}`, 'false');
    } catch (e) {
      console.warn(`[Sirius] disable "${name}" error:`, e);
    }
  }
}

function getStates() {
  const states = {};
  getAllFeatures().forEach((feat) => {
    states[feat.name] = !!activeFeatures.get(feat.name);
  });
  return states;
}

// Listen for messages from popup (only manager messages)
// Feature-specific actions (download-md, export-pdf, export-image) are handled
// by each feature module's own onMessage listener.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.action) {
    case 'get-features':
      sendResponse({ states: getStates() });
      break;
    case 'toggle-feature':
      if (msg.enabled) {
        enableFeature(msg.name);
      } else {
        disableFeature(msg.name);
      }
      sendResponse({ states: getStates() });
      break;
    default:
      sendResponse({ ok: false });
  }
});

// DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}
