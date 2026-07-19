/**
 * RTL Chatbot Fix - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
  // ─── Elements ──────────────────────────────────────────────────
  const enabledToggle = document.getElementById('enabledToggle');
  const thresholdSlider = document.getElementById('thresholdSlider');
  const thresholdValue = document.getElementById('thresholdValue');
  const scanBtn = document.getElementById('scanBtn');
  const fontSelect = document.getElementById('fontSelect');
  const statusText = document.getElementById('statusText');

  // ─── Load saved settings ───────────────────────────────────────
  chrome.storage.local.get(['enabled', 'rtlThreshold', 'rtlFont'], (result) => {
    if (result.enabled !== undefined) {
      enabledToggle.checked = result.enabled;
      if (statusText) statusText.textContent = result.enabled ? 'فعال و آماده' : 'غیرفعال';
    }
    if (result.rtlFont) fontSelect.value = result.rtlFont;
    if (result.rtlThreshold !== undefined) {
      const percent = Math.round(result.rtlThreshold * 100);
      thresholdSlider.value = percent;
      thresholdValue.textContent = percent + '٪';
    }
  });

  // ─── Enabled Toggle ────────────────────────────────────────────
  enabledToggle.addEventListener('change', () => {
    const enabled = enabledToggle.checked;
    if (statusText) statusText.textContent = enabled ? 'فعال و آماده' : 'غیرفعال';

    chrome.storage.local.set({ enabled });

    // Send message to content script
    getCurrentTab().then((tab) => {
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: enabled ? 'enable' : 'disable',
        }).catch(() => {
          // Content script might not be loaded on this page
        });
      }
    });
  });

  // ─── Font preference ───────────────────────────────────────────
  fontSelect.addEventListener('change', () => {
    const rtlFont = fontSelect.value;
    chrome.storage.local.set({ rtlFont });
    getCurrentTab().then(tab => tab?.id && chrome.tabs.sendMessage(tab.id, { action: 'setFont', value: rtlFont }).catch(() => {}));
  });

  // ─── Threshold Slider ──────────────────────────────────────────
  thresholdSlider.addEventListener('input', () => {
    const value = parseInt(thresholdSlider.value);
    thresholdValue.textContent = value + '٪';
  });

  thresholdSlider.addEventListener('change', () => {
    const value = parseInt(thresholdSlider.value);
    const threshold = value / 100;

    chrome.storage.local.set({ rtlThreshold: threshold });

    getCurrentTab().then((tab) => {
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'setThreshold',
          value: threshold,
        }).catch(() => {});
      }
    });
  });

  // ─── Scan Button ───────────────────────────────────────────────
  scanBtn.addEventListener('click', () => {
    // Visual feedback
    scanBtn.textContent = 'در حال اسکن...';
    scanBtn.style.opacity = '0.7';

    getCurrentTab().then((tab) => {
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'scan' })
          .then(() => {
            scanBtn.textContent = '✓ اسکن انجام شد';
            scanBtn.style.opacity = '1';
            scanBtn.style.background = '#00b894';
            setTimeout(() => {
              scanBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 1 0 4.95 11.95l2.3 2.3a.5.5 0 0 0 .7-.7l-2.3-2.3A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2z"/>
                </svg>
                اسکن مجدد صفحه
              `;
              scanBtn.style.background = '#6C5CE7';
            }, 1500);
          })
          .catch(() => {
            scanBtn.innerHTML = '⚠ این صفحه پشتیبانی نمی‌شود';
            scanBtn.style.opacity = '1';
            scanBtn.style.background = '#d63031';
            setTimeout(() => {
              scanBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 1 0 4.95 11.95l2.3 2.3a.5.5 0 0 0 .7-.7l-2.3-2.3A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2z"/>
                </svg>
                اسکن مجدد صفحه
              `;
              scanBtn.style.background = '#6C5CE7';
            }, 2000);
          });
      }
    });
  });

  // ─── Helper: Get current active tab ────────────────────────────
  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  }
});
