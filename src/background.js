console.log('[Sirius] background service worker started');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Sirius] extension installed');
});

// Forward toolbar messages to the active tab's content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const forwardActions = ['download-md', 'export-pdf', 'export-image'];
  if (forwardActions.includes(msg.action)) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, msg);
      }
    });
    sendResponse({ ok: true });
    return true;
  }

  // Full page screenshot via Chrome DevTools Protocol
  if (msg.action === 'capture-full-page') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ error: 'no active tab' });
        return;
      }

      const targetWidth = Math.round(msg.contentWidth || 1024);

      try {
        // 1. Attach debugger
        await chrome.debugger.attach({ tabId: tab.id }, '1.3');

        // 2. Emulate width only (height auto = full page)
        await chrome.debugger.sendCommand(
          { tabId: tab.id },
          'Emulation.setDeviceMetricsOverride',
          {
            width: targetWidth,
            height: 1080, // initial height doesn't matter for fullPage capture
            deviceScaleFactor: 2,
            mobile: false,
          },
        );

        // 3. Small settle delay
        await new Promise((r) => setTimeout(r, 200));

        // 4. Capture full page as single continuous image
        const result = await chrome.debugger.sendCommand(
          { tabId: tab.id },
          'Page.captureScreenshot',
          { format: 'png', fullPage: true },
        );

        // 5. Reset device metrics
        await chrome.debugger
          .sendCommand({ tabId: tab.id }, 'Emulation.clearDeviceMetricsOverride')
          .catch(() => {});

        await chrome.debugger.detach({ tabId: tab.id });

        if (result?.data) {
          sendResponse({ dataUrl: `data:image/png;base64,${result.data}` });
        } else {
          sendResponse({ error: 'capture failed' });
        }
      } catch (err) {
        console.error('[Sirius] debugger capture error:', err);
        try {
          await chrome.debugger
            .sendCommand({ tabId: tab.id }, 'Emulation.clearDeviceMetricsOverride')
            .catch(() => {});
          await chrome.debugger.detach({ tabId: tab.id });
        } catch {}
        sendResponse({ error: err.message });
      }
    });
    return true;
  }
});
