console.log("[Sirius] background service worker started")

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Sirius] extension installed")
})

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id })
  }
})

// Forward export actions to the active tab's content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const forwardActions = ["download-md", "export-pdf", "get-article-text"]
  if (forwardActions.includes(msg.action)) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, msg)
      }
    })
    sendResponse({ ok: true })
    return true
  }
})
