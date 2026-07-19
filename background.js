/**
 * RTL Chatbot Fix - Background Service Worker
 *
 * Handles extension lifecycle, install/update events,
 * and manages global state across tabs.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  rtlThreshold: 0.3,
      rtlFont: 'system',
};

// ─── Install ─────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.local.set(DEFAULT_SETTINGS);

    // Open a welcome/onboarding page (optional)
    // chrome.tabs.create({ url: 'https://github.com/rtl-chatbot-fix' });
  } else if (details.reason === 'update') {
    // Handle updates - preserve existing settings
    chrome.storage.local.get(['enabled', 'rtlThreshold'], (result) => {
      const updates = {};
      if (result.enabled === undefined) updates.enabled = DEFAULT_SETTINGS.enabled;
      if (result.rtlThreshold === undefined) updates.rtlThreshold = DEFAULT_SETTINGS.rtlThreshold;
      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates);
      }
    });
  }
});

// ─── Tab Updates ─────────────────────────────────────────────────

// When a tab navigates to a supported site, notify the content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.local.get(['enabled'], (result) => {
      if (result.enabled !== false) {
        // Tab loaded - content script will auto-initialize
      }
    });
  }
});

// ─── Message Handling ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getSettings':
      chrome.storage.local.get(['enabled', 'rtlThreshold'], (result) => {
        sendResponse({
          enabled: result.enabled ?? DEFAULT_SETTINGS.enabled,
          rtlThreshold: result.rtlThreshold ?? DEFAULT_SETTINGS.rtlThreshold,
        });
      });
      return true; // Async response

    default:
      break;
  }
});
