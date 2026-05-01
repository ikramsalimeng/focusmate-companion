// browser-api.js
// Cross-browser compatibility layer for Chrome and Firefox
const isFirefox = typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined';
const isChrome = typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';

const browserAPI = (() => {
  if (isFirefox) return browser;
  if (isChrome) return chrome;
  console.warn('[Focusmate Companion] No browser API detected');
  return null;
})();

function isExtensionContextValid() {
  try {
    return browserAPI?.runtime?.id !== undefined;
  } catch (err) {
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.browserAPI = browserAPI;
  window.isExtensionContextValid = isExtensionContextValid;
  window.isFirefoxBrowser = isFirefox;
  window.isChromeBrowser = isChrome;
}
