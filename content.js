/**
 * RTL Chatbot Fix - Content Script
 * 
 * Detects RTL text in chatbot responses and applies proper RTL styling.
 * Supports: Persian (Farsi), Arabic, Kurdish, Urdu, Hebrew, and more.
 * 
 * Works on: ChatGPT, Claude, Gemini, Copilot, Perplexity, Poe, and many more.
 */

(function () {
  'use strict';

  // ─── Configuration ────────────────────────────────────────────────

  const CONFIG = {
    enabled: true,
    debug: false,
    // How much of the text should be RTL to trigger full RTL mode (0-1)
    rtlThreshold: 0.3,
    rtlFont: 'system',
    // Minimum text length to consider
    minTextLength: 5,
    // How often to scan for new content (ms)
    scanInterval: 1000,
  };

  // ─── RTL Unicode Ranges ───────────────────────────────────────────

  const RTL_RANGES = [
    [0x0590, 0x05ff], // Hebrew
    [0x0600, 0x06ff], // Arabic (includes Persian, Kurdish, Urdu, Pashto)
    [0x0700, 0x074f], // Syriac
    [0x0750, 0x077f], // Arabic Supplement
    [0x0780, 0x07bf], // Thaana
    [0x07c0, 0x07ff], // NKo
    [0x0800, 0x083f], // Samaritan
    [0x0840, 0x085f], // Mandaic
    [0x0860, 0x086f], // Syriac Supplement
    [0x0870, 0x089f], // Arabic Extended-B
    [0x08a0, 0x08ff], // Arabic Extended-A
    [0xfb50, 0xfdff], // Arabic Presentation Forms-A
    [0xfe70, 0xfeff], // Arabic Presentation Forms-B
    [0x10e60, 0x10e7f], // Rumi Numeral Symbols
    [0x1ec70, 0x1ecbf], // Indic Siyaq Numbers
    [0x1ed00, 0x1ed4f], // Ottoman Siyaq Numbers
  ];

  // ─── RTL Detection ────────────────────────────────────────────────

  function isRTLChar(code) {
    for (const [start, end] of RTL_RANGES) {
      if (code >= start && code <= end) return true;
    }
    return false;
  }

  function analyzeText(text) {
    if (!text || text.length < CONFIG.minTextLength) return null;

    let rtlCount = 0;
    let ltrCount = 0;
    let totalAlpha = 0;

    for (const char of text) {
      const code = char.codePointAt(0);
      if (isRTLChar(code)) {
        rtlCount++;
        totalAlpha++;
      } else if (
        (code >= 0x0041 && code <= 0x005a) || // A-Z
        (code >= 0x0061 && code <= 0x007a)    // a-z
      ) {
        ltrCount++;
        totalAlpha++;
      }
    }

    if (totalAlpha === 0) return null;

    const rtlRatio = rtlCount / totalAlpha;

    return {
      rtlCount,
      ltrCount,
      totalAlpha,
      rtlRatio,
      isPredominantlyRTL: rtlRatio >= CONFIG.rtlThreshold,
      fullText: text,
    };
  }

  function hasRTL(text) {
    for (const char of text) {
      if (isRTLChar(char.codePointAt(0))) return true;
    }
    return false;
  }

  // ─── CSS Class Application ────────────────────────────────────────

  const RTL_CLASS = 'rtl-chatbot-fix-applied';
  const RTL_CONTAINER_CLASS = 'rtl-chatbot-container';

  /**
   * Apply RTL styling to an element.
   * Uses CSS classes for better performance and consistency.
   */
  function applyRTL(element, analysis) {
    if (element.classList.contains(RTL_CLASS)) return; // Already applied

    element.classList.add(RTL_CLASS);

    // Store original styles to allow reverting
    const origDirection = element.style.direction;
    const origTextAlign = element.style.textAlign;

    element.dataset.rtlOrigDirection = origDirection || '';
    element.dataset.rtlOrigTextAlign = origTextAlign || '';

    // Apply RTL styles
    element.style.direction = 'rtl';
    element.style.textAlign = 'right';
    element.style.unicodeBidi = 'embed';
    element.dataset.rtlFont = CONFIG.rtlFont;
    element.classList.add(`rtl-font-${CONFIG.rtlFont}`);

    if (CONFIG.debug) {
      element.style.outline = '2px dashed #00b894';
    }
  }

  /**
   * Revert RTL styling from an element.
   */
  function revertRTL(element) {
    if (!element.classList.contains(RTL_CLASS)) return;

    element.classList.remove(RTL_CLASS);
    if (element.dataset.rtlFont) element.classList.remove(`rtl-font-${element.dataset.rtlFont}`);
    delete element.dataset.rtlFont;
    element.style.direction = element.dataset.rtlOrigDirection || '';
    element.style.textAlign = element.dataset.rtlOrigTextAlign || '';
    element.style.unicodeBidi = '';
    element.style.outline = '';

    delete element.dataset.rtlOrigDirection;
    delete element.dataset.rtlOrigTextAlign;
  }

  // ─── Element Processing ───────────────────────────────────────────

  /**
   * Determine if an element is a "leaf" text container that should be checked.
   * We want to avoid processing large container elements and focus on
   * individual message/response bubbles.
   */
  function isTextContainer(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;

    const tag = element.tagName.toLowerCase();

    // Skip obviously non-content elements
    const skipTags = new Set([
      'script', 'style', 'noscript', 'iframe', 'svg', 'img',
      'input', 'textarea', 'select', 'button', 'link', 'meta',
      'br', 'hr', 'code', 'pre',
    ]);
    if (skipTags.has(tag)) return false;

    // Skip elements that are too small
    const rect = element.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 10) return false;

    // Skip hidden elements
    if (rect.width === 0 && rect.height === 0) return false;

    return true;
  }

  /**
   * Find message/response bubbles within a root element.
   * Uses common selectors for known chatbot platforms.
   */
  function findMessageElements(root) {
    const messages = [];

    // Generic: look for elements with significant text content
    // that are reasonable "leaf" containers.

    // Common chatbot message selectors
    const selectors = [
      // ChatGPT
      '[data-message-author-role]',
      '.markdown',
      '.prose',
      '.whitespace-pre-wrap',
      // Claude
      '[data-testid="user-message"]',
      '[data-testid="assistant-message"]',
      '.claude-message',
      '.font-claude-message',
      // Gemini
      '.response-content',
      '.model-response',
      '.chat-turn',
      // General
      '[data-message-content]',
      '[data-role="assistant"]',
      '[data-role="user"]',
      '.message-content',
      '.chat-message',
      '.conversation-item',
      '[class*="message"]',
      '[class*="response"]',
      '[class*="bubble"]',
    ];

    for (const selector of selectors) {
      try {
        const found = root.querySelectorAll(selector);
        found.forEach((el) => {
          if (isTextContainer(el) && !messages.includes(el)) {
            messages.push(el);
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    }

    return messages;
  }

  /**
   * Find all candidate text elements in the page.
   * Looks for elements that could contain chatbot messages.
   */
  function findAllCandidates(root) {
    const candidates = [];

    // First try known selectors
    const knownMessages = findMessageElements(root);
    if (knownMessages.length > 0) {
      return knownMessages;
    }

    // Fallback: walk the DOM tree and find leaf text containers
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (!isTextContainer(node)) {
            return NodeFilter.FILTER_SKIP;
          }

          const tag = node.tagName.toLowerCase();

          // Prefer block-level elements that likely contain message text
          const blockTags = new Set([
            'p', 'div', 'section', 'article', 'li', 'td', 'th',
            'blockquote', 'dd', 'dt', 'figcaption', 'h1', 'h2',
            'h3', 'h4', 'h5', 'h6',
          ]);

          if (blockTags.has(tag)) {
            // Check if it has direct text content
            const directText = getDirectText(node);
            if (directText.length >= CONFIG.minTextLength) {
              return NodeFilter.FILTER_ACCEPT;
            }
          }

          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    while (walker.nextNode()) {
      candidates.push(walker.currentNode);
    }

    return candidates;
  }

  /**
   * Get direct text content of an element (excluding nested children's full text).
   */
  function getDirectText(element) {
    let text = '';
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      }
    }
    return text.trim();
  }

  /**
   * Get all text content of an element.
   */
  function getFullText(element) {
    return (element.textContent || '').trim();
  }

  // ─── Main Processing Logic ────────────────────────────────────────

  /**
   * Process a single element to detect and apply RTL if needed.
   */
  function processElement(element) {
    if (!isTextContainer(element)) return;

    const text = getFullText(element);

    if (!text || text.length < CONFIG.minTextLength) return;

    const analysis = analyzeText(text);

    if (!analysis) return;

    if (analysis.isPredominantlyRTL) {
      applyRTL(element, analysis);
    } else if (element.classList.contains(RTL_CLASS)) {
      // Text changed - no longer predominantly RTL
      revertRTL(element);
    }

    // Even if not predominantly RTL, check child paragraphs
    // for mixed content scenarios
    if (analysis.rtlCount > 0 && !analysis.isPredominantlyRTL) {
      processMixedContent(element, analysis);
    }
  }

  /**
   * Handle mixed content: paragraphs that contain some RTL text but
   * are not predominantly RTL overall.
   */
  function processMixedContent(element, parentAnalysis) {
    const paragraphs = element.querySelectorAll('p, li, div > span');

    paragraphs.forEach((p) => {
      if (p.classList.contains(RTL_CLASS)) return;

      const text = getFullText(p);
      if (text.length < CONFIG.minTextLength) return;

      const analysis = analyzeText(text);
      if (analysis && analysis.isPredominantlyRTL) {
        applyRTL(p, analysis);
      }
    });
  }

  /**
   * Scan the entire page for chatbot messages and fix RTL display.
   */
  function scanAndFix(root = document.body) {
    if (!CONFIG.enabled) return;

    const startTime = performance.now();

    const candidates = findAllCandidates(root);
    candidates.forEach(processElement);

    if (CONFIG.debug) {
      const duration = (performance.now() - startTime).toFixed(2);
      console.log(
        `[RTL Chatbot Fix] Scanned ${candidates.length} elements in ${duration}ms`
      );
    }
  }

  // ─── Mutation Observer ────────────────────────────────────────────

  let observer = null;
  let scanTimeout = null;

  /**
   * Debounced scan to avoid excessive processing during rapid DOM changes.
   */
  function debouncedScan() {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => scanAndFix(), 200);
  }

  /**
   * Start observing DOM mutations to catch new chatbot responses.
   */
  function startObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      let shouldScan = false;

      for (const mutation of mutations) {
        // Check added nodes
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = (node.textContent || '').trim();
              if (text.length > 0) {
                shouldScan = true;
                break;
              }
            }
          }
        }

        // Check character data changes (text updates in streaming)
        if (mutation.type === 'characterData' && mutation.target.textContent) {
          shouldScan = true;
        }

        if (shouldScan) break;
      }

      if (shouldScan) {
        debouncedScan();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: false,
    });
  }

  /**
   * Stop the mutation observer.
   */
  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (scanTimeout) {
      clearTimeout(scanTimeout);
      scanTimeout = null;
    }
  }

  // ─── Streaming Text Support ───────────────────────────────────────

  /**
   * Some chatbots stream responses word-by-word. We need to handle this
   * by periodically re-scanning visible message elements.
   */
  let streamMonitorInterval = null;

  function startStreamMonitor() {
    if (streamMonitorInterval) return;
    streamMonitorInterval = setInterval(() => {
      // Only scan elements that are visible and might be receiving streams
      const candidates = findMessageElements(document.body);
      candidates.forEach((el) => {
        if (!el.classList.contains(RTL_CLASS)) {
          processElement(el);
        }
      });
    }, CONFIG.scanInterval);
  }

  function stopStreamMonitor() {
    if (streamMonitorInterval) {
      clearInterval(streamMonitorInterval);
      streamMonitorInterval = null;
    }
  }

  // ─── Message Listener ─────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'enable':
        CONFIG.enabled = true;
        scanAndFix();
        startObserver();
        startStreamMonitor();
        sendResponse({ status: 'enabled' });
        break;

      case 'disable':
        CONFIG.enabled = false;
        stopObserver();
        stopStreamMonitor();
        // Revert all RTL styling
        document.querySelectorAll(`.${RTL_CLASS}`).forEach(revertRTL);
        sendResponse({ status: 'disabled' });
        break;

      case 'toggle':
        CONFIG.enabled = !CONFIG.enabled;
        if (CONFIG.enabled) {
          scanAndFix();
          startObserver();
          startStreamMonitor();
        } else {
          stopObserver();
          stopStreamMonitor();
          document.querySelectorAll(`.${RTL_CLASS}`).forEach(revertRTL);
        }
        sendResponse({ status: CONFIG.enabled ? 'enabled' : 'disabled' });
        break;

      case 'getStatus':
        sendResponse({ enabled: CONFIG.enabled });
        break;

      case 'scan':
        scanAndFix();
        sendResponse({ scanned: true });
        break;

      case 'setFont':
        CONFIG.rtlFont = ['system', 'vazirmatn', 'sahel', 'iransans', 'tahoma'].includes(message.value) ? message.value : 'system';
        document.querySelectorAll(`.${RTL_CLASS}`).forEach(revertRTL);
        scanAndFix();
        sendResponse({ font: CONFIG.rtlFont });
        break;

      case 'setThreshold':
        CONFIG.rtlThreshold = parseFloat(message.value) || 0.3;
        // Re-scan with new threshold
        document.querySelectorAll(`.${RTL_CLASS}`).forEach(revertRTL);
        scanAndFix();
        sendResponse({ threshold: CONFIG.rtlThreshold });
        break;

      default:
        break;
    }
  });

  // ─── Initialization ───────────────────────────────────────────────

  function init() {
    // Load saved state
    chrome.storage.local.get(['enabled', 'rtlThreshold', 'rtlFont'], (result) => {
      if (result.enabled !== undefined) {
        CONFIG.enabled = result.enabled;
      }
      if (result.rtlThreshold !== undefined) {
        CONFIG.rtlThreshold = result.rtlThreshold;
      }
      if (result.rtlFont) CONFIG.rtlFont = result.rtlFont;

      if (CONFIG.enabled) {
        // Initial scan
        scanAndFix();

        // Start observing for new content
        startObserver();

        // Start monitoring for streaming content
        startStreamMonitor();

        // Re-scan periodically for missed elements
        setInterval(() => {
          if (CONFIG.enabled) scanAndFix();
        }, 3000);
      }
    });

    if (CONFIG.debug) {
      console.log('[RTL Chatbot Fix] Initialized');
      console.log('[RTL Chatbot Fix] Supported RTL ranges:', RTL_RANGES.length);
    }
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
