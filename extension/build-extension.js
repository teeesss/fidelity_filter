import fs from 'fs';
import path from 'path';

const overlayPath  = path.resolve('src/overlay.js');
const matchingPath = path.resolve('src/matching.js');
const extDir       = path.resolve('extension');

if (!fs.existsSync(extDir)) {
  fs.mkdirSync(extDir, { recursive: true });
}

let overlayCode  = fs.readFileSync(overlayPath,  'utf-8');
let matchingCode = fs.readFileSync(matchingPath, 'utf-8');

// Inline matching functions (strip ES module exports)
const matchFnStr = matchingCode
  .replace('export function wildcardToRegex', 'function wildcardToRegex')
  .replace('export function matchText',       'function matchText');

const importPattern = /import\s*\{\s*[\w\s,]+\s*\}\s*from\s*['"]\.\/matching\.js['"];/g;
overlayCode = overlayCode.replace(importPattern, () => matchFnStr);

// Strip inline CSS injection (handled by manifest content_scripts css instead)
const cssInjectionPattern = /\/\/ 1\. Create and inject style[\s\S]*?document\.head\.appendChild\(style\);/;
overlayCode = overlayCode.replace(cssInjectionPattern, '// Styles loaded via manifest.json content_scripts css');

// Strip style.remove() inside destroy() — Chrome handles CSS cleanup
overlayCode = overlayCode.replace('style.remove();', '/* style handled by chrome */');

// Append the chrome.runtime.onMessage listener so the popup can
// relaunch / close / query status without touching the bookmarklet source.
const messageListener = `

// ── Popup message listener (Chrome Extension only) ────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'relaunch') {
    launchOverlay();
    sendResponse({ active: true });
  } else if (msg.action === 'close') {
    if (typeof window.__fwDestroy === 'function') {
      try { window.__fwDestroy(); } catch(e) {}
      window.__fwDestroy = null;
    }
    sendResponse({ active: false });
  } else if (msg.action === 'status') {
    sendResponse({ active: !!document.getElementById('fidelity-wildcard-overlay') });
  }
  return true; // keep channel open for async sendResponse
});
`;

overlayCode += messageListener;

fs.writeFileSync(path.join(extDir, 'content.js'), overlayCode);
console.log('Build completed! Chrome Extension Content Script written to extension/content.js');

