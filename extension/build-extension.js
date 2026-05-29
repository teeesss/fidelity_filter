import fs from 'fs';
import path from 'path';

const overlayPath = path.resolve('src/overlay.js');
const matchingPath = path.resolve('src/matching.js');
const extDir = path.resolve('extension');

if (!fs.existsSync(extDir)) {
  fs.mkdirSync(extDir, { recursive: true });
}

let overlayCode = fs.readFileSync(overlayPath, 'utf-8');
let matchingCode = fs.readFileSync(matchingPath, 'utf-8');

// Replace import with actual implementation
const matchFnStr = matchingCode
  .replace("import { wildcardToRegex } from './matching.js';", '')
  .replace('export function wildcardToRegex', 'function wildcardToRegex')
  .replace('export function matchText', 'function matchText');

overlayCode = overlayCode.replace(
  "import { wildcardToRegex } from './matching.js';",
  () => matchFnStr
);

// Strip inline CSS injection code for Chrome Extension
// The pattern matches everything from the style injection comment/declaration to document.head.appendChild(style);
const cssInjectionPattern = /\/\/ 1\. Create and inject style[\s\S]*?document\.head\.appendChild\(style\);/;
overlayCode = overlayCode.replace(cssInjectionPattern, '// Styles loaded via manifest.json content_scripts css');

// Also strip style.remove() inside the destroy() block
overlayCode = overlayCode.replace('style.remove();', '/* style handled by chrome */');

fs.writeFileSync(path.join(extDir, 'content.js'), overlayCode);

console.log('Build completed! Chrome Extension Content Script written to extension/content.js');
