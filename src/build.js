import fs from 'fs';
import path from 'path';

const overlayPath = path.resolve('src/overlay.js');
const matchingPath = path.resolve('src/matching.js');
const distDir = path.resolve('dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Simple inliner
let overlayCode = fs.readFileSync(overlayPath, 'utf-8');
let matchingCode = fs.readFileSync(matchingPath, 'utf-8');

// Replace import { wildcardToRegex } from './matching.js' with the actual function in overlayCode
const matchFnStr = matchingCode
  .replace('export function wildcardToRegex', 'function wildcardToRegex')
  .replace('export function matchText', 'function matchText');

overlayCode = overlayCode.replace(
  "import { wildcardToRegex } from './matching.js';",
  matchFnStr
);

// Compress comments and extra whitespaces for single line bookmarklet
let minified = overlayCode
  .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1') // remove comments
  .replace(/\s+/g, ' ')                                  // collapse spaces
  .trim();

const bookmarklet = `javascript:${encodeURIComponent('(function(){' + minified + '})();')}`;

fs.writeFileSync(path.join(distDir, 'bookmarklet.js'), overlayCode);
fs.writeFileSync(path.join(distDir, 'bookmarklet.txt'), bookmarklet);

console.log('Build completed! Single-line Bookmarklet written to dist/bookmarklet.txt');
