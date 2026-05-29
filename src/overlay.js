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

  let currentSelector = 'tr.pos-row, tbody tr, tr, [role="row"]'; // Pre-configured selectors
  let isTargeting = false;
  let hoverTarget = null;

  // Traverses all open Shadow roots to find elements matching a selector
  function querySelectorAllDeep(selector, root = document) {
    const elements = [];
    function traverse(node) {
      if (!node) return;
      if (node.querySelectorAll) {
        node.querySelectorAll(selector).forEach(el => {
          if (!elements.includes(el)) elements.push(el);
        });
      }
      // Traverse light DOM children
      let child = node.firstElementChild;
      while (child) {
        traverse(child);
        child = child.nextElementSibling;
      }
      // Pierce Shadow DOM
      if (node.shadowRoot) {
        traverse(node.shadowRoot);
      }
    }
    traverse(root);
    return elements;
  }

  // Recursively gets all text content from an element, piercing shadow roots
  function getTextContentDeep(node) {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue;
    }
    let text = '';
    let child = node.firstChild;
    while (child) {
      text += getTextContentDeep(child);
      child = child.nextSibling;
    }
    if (node.shadowRoot) {
      text += getTextContentDeep(node.shadowRoot);
    }
    return text;
  }

  function applyFilter() {
    const pattern = input.value.trim();
    const regex = wildcardToRegex(pattern);
    const rows = querySelectorAllDeep(currentSelector);
    
    let matchedCount = 0;
    let totalCount = 0;

    rows.forEach(row => {
      // Exclude header rows or internal structures
      if (row.tagName === 'TR' && row.querySelector('th')) return;
      totalCount++;

      const text = getTextContentDeep(row);
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
  applyFilter(); // Initialize state and count on startup

  // 3. Mutation Observer to auto-filter loaded dynamic elements
  const observer = new MutationObserver((mutations) => {
    // Ignore mutations that occur inside our own overlay
    const isOverlayMutation = mutations.every(m => {
      const overlay = document.getElementById('fidelity-wildcard-overlay');
      return overlay && overlay.contains(m.target);
    });
    if (isOverlayMutation) return;
    
    applyFilter();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function cleanupTargeting() {
    if (!isTargeting) return;
    isTargeting = false;
    targetBtn.style.color = '#94a3b8';
    targetBtn.style.background = 'transparent';
    
    if (hoverTarget) {
      hoverTarget.classList.remove('fw-highlight-target');
      hoverTarget = null;
    }

    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleGlobalClick, true);
  }

  function handleMouseMove(e) {
    if (!isTargeting) return;
    const path = e.composedPath();
    
    // Resiliently detect rows or card elements in the event path
    const target = path.find(el => {
      if (!el.tagName) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'tr' || tag === 'li' || el.classList?.contains('pos-row') || el.getAttribute?.('role') === 'row';
    }) || path[0];

    if (target && target.tagName && target.id !== 'fw-search-input' && !document.getElementById('fidelity-wildcard-overlay').contains(target)) {
      if (hoverTarget && hoverTarget !== target) {
        hoverTarget.classList.remove('fw-highlight-target');
      }
      hoverTarget = target;
      hoverTarget.classList.add('fw-highlight-target');
    }
  }

  function handleGlobalClick(e) {
    if (!isTargeting) return;
    e.preventDefault();
    e.stopPropagation();

    const clickedRow = hoverTarget || e.composedPath()[0];
    if (clickedRow && clickedRow.tagName) {
      const tag = clickedRow.tagName.toLowerCase();
      const classes = Array.from(clickedRow.classList || [])
        .filter(c => c !== 'fw-highlight-target' && c !== 'fw-hidden-row')
        .join('.');

      // Dynamically lock onto this element type as the row selector
      if (tag === 'tr') {
        currentSelector = 'tr';
      } else if (classes) {
        currentSelector = `${tag}.${classes}`;
      } else {
        currentSelector = tag;
      }
    }

    cleanupTargeting();
    applyFilter();
  }

  function enableTargeting() {
    if (isTargeting) return;
    isTargeting = true;
    targetBtn.style.color = '#6366f1';
    targetBtn.style.background = 'rgba(99, 102, 241, 0.2)';

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleGlobalClick, true);
  }

  targetBtn.addEventListener('click', () => {
    if (!isTargeting) {
      enableTargeting();
    } else {
      cleanupTargeting();
    }
  });

  // 4. Close & Clean Up routine
  function destroy() {
    observer.disconnect();
    cleanupTargeting();
    const rows = querySelectorAllDeep(currentSelector);
    rows.forEach(row => {
      row.classList.remove('fw-hidden-row');
    });
    container.remove();
    style.remove();
  }
  closeBtn.addEventListener('click', destroy);

  // Expose destroy globally for re-injections
  window.destroyFidelityOverlay = destroy;
})();
