# Fidelity Wildcard Filter Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust browser bookmarklet that allows filtering table rows/elements on digital.fidelity.com (and other sites) using wildcards, hiding non-matching elements without breaking page functionality.

**Architecture:** A self-contained, self-injecting JavaScript module packaged into a single-line bookmarklet. It injects a modern glassmorphic floating bar, hooks into DOM changes using MutationObserver, and hides non-matching rows using non-destructive CSS rules.

**Tech Stack:** Vanilla JavaScript (ES6+), Vanilla CSS (Glassmorphism), Node.js (native `--test` runner for TDD, basic build script).

---

## Proposed Changes

### Task 1: Environment Setup
**Files:**
- Create: `package.json`
- Create: `.gitignore` (Update if needed)

- [ ] **Step 1: Create package.json**
  Create `package.json` with a native test script.
  ```json
  {
    "name": "fidelity-wildcard-overlay",
    "version": "1.0.0",
    "description": "Fidelity Wildcard Filter Overlay Bookmarklet",
    "scripts": {
      "test": "node --test src/tests/*.test.js",
      "build": "node src/build.js"
    },
    "type": "module"
  }
  ```

- [ ] **Step 2: Initialize git and commit Task 1**
  Run: `git add package.json; git commit -m "chore: initialize project and package.json"`

---

### Task 2: Wildcard Matching Engine (TDD)
**Files:**
- Create: `src/matching.js`
- Create: `src/tests/matching.test.js`

- [ ] **Step 1: Write failing matching tests**
  Create `src/tests/matching.test.js` with failing test cases for wildcard translation.
  ```javascript
  import { test, describe } from 'node:test';
  import assert from 'node:assert';
  import { wildcardToRegex, matchText } from '../matching.js';

  describe('Wildcard Matching', () => {
    test('converts simple wildcard patterns to regex', () => {
      const regex1 = wildcardToRegex('*jun*2026');
      assert.ok(regex1.test('Fidelity holdings June 2026'));
      assert.ok(regex1.test('JUN 2026 option'));
      assert.ok(!regex1.test('JUN 2025'));

      const regex2 = wildcardToRegex('CIFR?602*');
      assert.ok(regex2.test('CIFR260220C28'));
      assert.ok(!regex2.test('CIFR2260220C28'));
    });

    test('matchText checks matches correctly', () => {
      assert.strictEqual(matchText('Fidelity June 2026', '*jun*2026'), true);
      assert.strictEqual(matchText('Fidelity July 2026', '*jun*2026'), false);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL with module loading error or missing exports.

- [ ] **Step 3: Implement minimal matching logic**
  Create `src/matching.js`.
  ```javascript
  export function wildcardToRegex(pattern) {
    if (!pattern) return /^.*$/;
    // Escape all special regex characters except * and ?
    let escaped = pattern.replace(/[\\^$+.|()[\]{}]/g, '\\$&');
    // Replace wildcards with regex equivalents
    escaped = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(escaped, 'i');
  }

  export function matchText(text, pattern) {
    const regex = wildcardToRegex(pattern);
    return regex.test(text);
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS

- [ ] **Step 5: Commit Task 2**
  Run: `git add src/matching.js src/tests/matching.test.js; git commit -m "feat: implement wildcard matching engine with tests"`

---

### Task 3: Mock Fidelity Page for Local Testing
**Files:**
- Create: `src/mock/index.html`

- [ ] **Step 1: Create mock Fidelity holdings HTML**
  Create `src/mock/index.html` containing simulated table structures typical of digital.fidelity.com holdings page to verify overlay rendering and row removal.
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Mock Fidelity Holdings</title>
    <style>
      body { font-family: sans-serif; background: #0f172a; color: #f1f5f9; padding: 2rem; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #334155; padding: 8px; text-align: left; }
      tr:nth-child(even) { background: #1e293b; }
      .pos-row { cursor: pointer; }
      .pos-row:hover { background: #475569; }
    </style>
  </head>
  <body>
    <h1>Digital Fidelity Holdings (Mock)</h1>
    <p>Simulated holdings environment for testing the wildcard overlay bookmarklet.</p>
    
    <table id="holdings-table">
      <thead>
        <tr>
          <th>Symbol / Description</th>
          <th>Price</th>
          <th>Quantity</th>
          <th>Total Value</th>
        </tr>
      </thead>
      <tbody>
        <tr class="pos-row">
          <td>CIFR260220C28 (CIFR FEB 20 26 $28 CALL)</td>
          <td>$2.45</td>
          <td>-10</td>
          <td>-$2,450.00</td>
        </tr>
        <tr class="pos-row">
          <td>CIFR260620C30 (CIFR JUN 20 26 $30 CALL)</td>
          <td>$3.10</td>
          <td>-5</td>
          <td>-$1,550.00</td>
        </tr>
        <tr class="pos-row">
          <td>AAPL260618C180 (AAPL JUN 18 26 $180 CALL)</td>
          <td>$12.50</td>
          <td>2</td>
          <td>$2,500.00</td>
        </tr>
        <tr class="pos-row">
          <td>MSFT260116P400 (MSFT JAN 16 26 $400 PUT)</td>
          <td>$18.20</td>
          <td>-1</td>
          <td>-$1,820.00</td>
        </tr>
      </tbody>
    </table>
    
    <button onclick="addDynamicRow()" style="margin-top:1rem; padding: 8px 16px;">Add Dynamic Row (June Option)</button>
    <script>
      function addDynamicRow() {
        const tbody = document.querySelector('#holdings-table tbody');
        const tr = document.createElement('tr');
        tr.className = 'pos-row';
        tr.innerHTML = `
          <td>NVDA260618C120 (NVDA JUN 18 26 $120 CALL)</td>
          <td>$8.40</td>
          <td>-5</td>
          <td>-$4,200.00</td>
        `;
        tbody.appendChild(tr);
      }
    </script>
  </body>
  </html>
  ```

- [ ] **Step 2: Commit Task 3**
  Run: `git add src/mock/index.html; git commit -m "feat: create mock holdings HTML page for testing"`

---

### Task 4: UI Overlay and Content Filtering Core
**Files:**
- Create: `src/overlay.js`

- [ ] **Step 1: Write overlay core logic**
  Create `src/overlay.js` containing UI injection, matching translation, hide/show routines, and MutationObserver to automatically re-filter on DOM updates.
  ```javascript
  import { wildcardToRegex } from './matching.js';

  (function() {
    if (document.getElementById('fidelity-wildcard-overlay')) return;

    // 1. Create and inject style
    const style = document.createElement('style');
    style.id = 'fw-overlay-styles';
    style.innerHTML = `
      #fidelity-wildcard-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        background: rgba(30, 41, 59, 0.75);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #f1f5f9;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 320px;
        animation: fw-slide-in 0.3s ease-out;
      }
      @keyframes fw-slide-in {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      #fw-search-input {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        color: #fff;
        padding: 6px 10px;
        font-size: 13px;
        outline: none;
        flex: 1;
        transition: border 0.2s;
      }
      #fw-search-input:focus {
        border-color: #6366f1;
      }
      #fw-match-count {
        background: rgba(99, 102, 241, 0.2);
        color: #818cf8;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: bold;
        white-space: nowrap;
      }
      .fw-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 14px;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s, color 0.2s;
      }
      .fw-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
      .fw-hidden-row {
        display: none !important;
      }
      .fw-highlight-target {
        outline: 2px solid #6366f1 !important;
        cursor: crosshair !important;
      }
    `;
    document.head.appendChild(style);

    // 2. Create Floating Widget
    const container = document.createElement('div');
    container.id = 'fidelity-wildcard-overlay';
    container.innerHTML = `
      <span style="font-size: 16px; user-select: none;">🔍</span>
      <input type="text" id="fw-search-input" placeholder="Filter (*jun*2026)..." autocomplete="off">
      <span id="fw-match-count">0 / 0</span>
      <button id="fw-target-btn" class="fw-btn" title="Target specific table">🎯</button>
      <button id="fw-close-btn" class="fw-btn" title="Close and restore rows">✕</button>
    `;
    document.body.appendChild(container);

    const input = document.getElementById('fw-search-input');
    const badge = document.getElementById('fw-match-count');
    const closeBtn = document.getElementById('fw-close-btn');
    const targetBtn = document.getElementById('fw-target-btn');

    let currentSelector = 'tr.pos-row, tbody tr'; // Fidelity default selectors

    function applyFilter() {
      const pattern = input.value.trim();
      const regex = wildcardToRegex(pattern);
      const rows = document.querySelectorAll(currentSelector);
      
      let matchedCount = 0;
      let totalCount = 0;

      rows.forEach(row => {
        if (row.tagName === 'TR' && row.querySelector('th')) return;
        totalCount++;

        const text = row.textContent || '';
        if (!pattern || regex.test(text)) {
          row.classList.remove('fw-hidden-row');
          matchedCount++;
        } else {
          row.classList.add('fw-hidden-row');
        }
      });

      badge.textContent = `${matchedCount} / ${totalCount}`;
    }

    input.addEventListener('input', applyFilter);

    // 3. Mutation Observer to auto-filter loaded dynamic elements
    const observer = new MutationObserver(() => {
      applyFilter();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 4. Close & Clean Up routine
    function destroy() {
      observer.disconnect();
      document.querySelectorAll('.fw-hidden-row').forEach(row => {
        row.classList.remove('fw-hidden-row');
      });
      container.remove();
      style.remove();
    }
    closeBtn.addEventListener('click', destroy);

    window.destroyFidelityOverlay = destroy;
  })();
  ```

- [ ] **Step 2: Commit Task 4**
  Run: `git add src/overlay.js; git commit -m "feat: implement bookmarklet UI overlay and filter core"`

---

### Task 5: Manual Selector Targeting tool
**Files:**
- Modify: `src/overlay.js`

- [ ] **Step 1: Implement manual targeting mode**
  Update `src/overlay.js` to handle manual click selection of a table or container grid, dynamically updating the selector so filtering works on any custom site layout.
  Add this logic in `src/overlay.js` targeting the `targetBtn`:
  ```javascript
  let isTargeting = false;

  function enableTargeting() {
    isTargeting = true;
    targetBtn.style.color = '#6366f1';
    targetBtn.style.background = 'rgba(99, 102, 241, 0.2)';
    
    const elements = document.querySelectorAll('table, tbody, ul, ol, div.grid, div.holding-container');
    elements.forEach(el => el.classList.add('fw-highlight-target'));

    function selectElement(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const targeted = e.currentTarget;
      if (targeted.tagName === 'TABLE' || targeted.tagName === 'TBODY') {
        currentSelector = `#${targeted.id || ''} tr, table tr`;
        if (targeted.id) currentSelector = `#${targeted.id} tr`;
      } else {
        currentSelector = `#${targeted.id || ''} > *, .${targeted.className.replace(/\s+/g, '.')} > *`;
      }

      cleanupTargeting();
      applyFilter();
    }

    function cleanupTargeting() {
      isTargeting = false;
      targetBtn.style.color = '#94a3b8';
      targetBtn.style.background = 'transparent';
      elements.forEach(el => {
        el.classList.remove('fw-highlight-target');
        el.removeEventListener('click', selectElement);
      });
    }

    elements.forEach(el => {
      el.addEventListener('click', selectElement);
    });
  }

  targetBtn.addEventListener('click', () => {
    if (!isTargeting) {
      enableTargeting();
    }
  });
  ```

- [ ] **Step 2: Commit Task 5**
  Run: `git add src/overlay.js; git commit -m "feat: add manual selector targeting picker tool"`

---

### Task 6: Bookmarklet Compiler Build Script
**Files:**
- Create: `src/build.js`

- [ ] **Step 1: Write the compiler script**
  Create `src/build.js`. This script reads `src/matching.js` and `src/overlay.js`, inline-bundles them together, minifies whitespaces/comments, and outputs the clickable bookmarklet string to `dist/bookmarklet.txt` and `dist/bookmarklet.js` as a drop-in file.
  ```javascript
  import fs from 'fs';
  import path from 'path';

  const overlayPath = path.resolve('src/overlay.js');
  const matchingPath = path.resolve('src/matching.js');
  const distDir = path.resolve('dist');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  let overlayCode = fs.readFileSync(overlayPath, 'utf-8');
  let matchingCode = fs.readFileSync(matchingPath, 'utf-8');

  const matchFnStr = matchingCode
    .replace('export function wildcardToRegex', 'function wildcardToRegex')
    .replace('export function matchText', 'function matchText');

  overlayCode = overlayCode.replace(
    "import { wildcardToRegex } from './matching.js';",
    matchFnStr
  );

  let minified = overlayCode
    .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1') // remove comments
    .replace(/\s+/g, ' ')                                  // collapse spaces
    .trim();

  const bookmarklet = `javascript:${encodeURIComponent('(function(){' + minified + '})();')}`;

  fs.writeFileSync(path.join(distDir, 'bookmarklet.js'), overlayCode);
  fs.writeFileSync(path.join(distDir, 'bookmarklet.txt'), bookmarklet);

  console.log('Build completed! Single-line Bookmarklet written to dist/bookmarklet.txt');
  ```

- [ ] **Step 2: Run build script**
  Run: `npm run build`
  Expected: Success output and creation of `dist/bookmarklet.txt`.

- [ ] **Step 3: Commit Task 6**
  Run: `git add src/build.js; git commit -m "feat: add lightweight build bundler for bookmarklet output"`

---

### Task 7: Full Manual E2E Validation
**Files:**
- Modify: `src/mock/index.html`

- [ ] **Step 1: Inject overlay onto mock page directly for local verification**
  Append a script to `src/mock/index.html` loading the built script so you can open it in the browser and fully dogfood the interactions (typing wildcards, dynamic additions, close cleanup, styling).
  Add this to the end of `src/mock/index.html` (before `</body>`):
  ```html
  <script type="module" src="../overlay.js"></script>
  ```

- [ ] **Step 2: Commit local verification settings**
  Run: `git add src/mock/index.html; git commit -m "test: link overlay script to mock page for manual validation"`
