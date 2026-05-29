function wildcardToRegex(pattern) {
  if (!pattern) return /^.*$/;
  // Escape all special regex characters except * and ?
  let escaped = pattern.replace(/[\\^$+.|()[\]{}]/g, '\\$&');
  // Replace wildcards with regex equivalents
  escaped = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(escaped, 'i');
}

function matchText(text, pattern) {
  if (!pattern) return true;
  const terms = pattern.split('&').map(p => p.trim()).filter(Boolean);
  if (terms.length === 0) return true;
  return terms.some(term => {
    const regex = wildcardToRegex(term);
    return regex.test(text);
  });
}



function launchOverlay() {
  // Cleanly destroy any prior instance before re-mounting
  if (typeof window.__fwDestroy === 'function') {
    try { window.__fwDestroy(); } catch(e) {}
  }
  const existing = document.getElementById('fidelity-wildcard-overlay');
  if (existing) existing.remove();

  // Styles loaded via manifest.json content_scripts css

  // 2. Create Floating Widget
  const container = document.createElement('div');
  container.id = 'fidelity-wildcard-overlay';
  container.innerHTML = `
    <svg class="fw-search-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: rgba(128, 128, 128, 0.65); flex-shrink: 0; display: flex; align-items: center;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
    <input type="text" id="fw-search-input" placeholder="Wildcard Filtering..." autocomplete="off">
    <button id="fw-clear-btn" class="fw-btn" title="Clear search" style="display: none; font-size: 13px; line-height: 1; padding: 0 2px; margin-right: 2px;">×</button>
    <span id="fw-match-count">0/0</span>
    <button id="fw-close-btn" class="fw-btn" title="Close and restore rows">✕</button>
  `;
  document.body.appendChild(container);

  // Dynamic positioning relative to native search bar
  function positionOverlay() {
    const parent = document.querySelector('.posweb-grid_top-buttons-search-container');
    if (parent) {
      const searchWrapper = parent.querySelector('.posweb-grid_top-search');
      if (searchWrapper) {
        if (container.parentNode !== parent) {
          parent.insertBefore(container, searchWrapper);
        }
        container.classList.add('inline');
        // Clear fallback inline styles so stylesheet relative rules take over
        container.style.position = '';
        container.style.top = '';
        container.style.left = '';
        container.style.right = '';
        container.style.margin = '';
        return;
      }
    }
    
    // Viewport fallback
    if (container.parentNode !== document.body) {
      document.body.appendChild(container);
    }
    container.classList.remove('inline');
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.left = 'auto';
  }

  // Position it immediately and on resize/scroll
  setTimeout(positionOverlay, 0);
  window.addEventListener('resize', positionOverlay);
  window.addEventListener('scroll', positionOverlay);

  const input = document.getElementById('fw-search-input');
  const badge = document.getElementById('fw-match-count');
  const closeBtn = document.getElementById('fw-close-btn');
  const targetBtn = document.getElementById('fw-target-btn');
  const clearBtn = document.getElementById('fw-clear-btn');

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

  // Recursively gets all text content from an element, piercing shadow roots.
  // Skips overlay panels, earnings flyouts, tooltips and dialogs so that
  // date text inside those widgets does not cause false wildcard matches.
  const SKIP_ROLES    = new Set(['dialog','tooltip','alertdialog','status','complementary','note']);
  const SKIP_CLASS_RE = /panel|popup|flyout|tooltip|earnings|analytics|drawer|overlay|modal|aside|sidebar/i;

  function getTextContentDeep(node, isRoot = false) {
    if (!node) return '';
    if (node.tagName === 'STYLE' || node.tagName === 'SCRIPT') return '';
    if (node.nodeType === Node.ELEMENT_NODE) {
      const role = node.getAttribute ? node.getAttribute('role') : null;
      if (role && SKIP_ROLES.has(role)) return '';
      const cls = typeof node.className === 'string' ? node.className : '';
      if (node.tagName === 'SVG' || node.tagName === 'svg') return '';

      // Skip elements that match panel/tooltip/dialog indicators,
      // but NOT the root row itself, and NOT standard grid rows/cells.
      const isGridContainer = cls.includes('ag-') || cls.includes('pos-row');
      if (!isRoot && !isGridContainer && cls && SKIP_CLASS_RE.test(cls)) {
        return '';
      }
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue;
    }
    let text = '';
    let child = node.firstChild;
    while (child) {
      text += getTextContentDeep(child, false);
      child = child.nextSibling;
    }
    if (node.shadowRoot) {
      text += getTextContentDeep(node.shadowRoot, false);
    }
    return text;
  }

  let originalTops = new Map();

  function applyFilter() {
    const pattern = input.value.trim();
    if (clearBtn) {
      clearBtn.style.display = input.value ? 'flex' : 'none';
    }
    // Always clear the position cache before each pass.
    // ag-Grid recycles row elements, so entries from a previous pass
    // may point to stale positions on freshly-rendered rows.
    originalTops.clear();
    const rows = querySelectorAllDeep(currentSelector);
    
    // Group rows by row-index (essential for ag-Grid split column layouts)
    const groups = {};
    rows.forEach(row => {
      // Exclude header rows or internal structures
      if (row.tagName === 'TR' && row.querySelector('th')) return;
      if (row.className && row.className.includes('ag-header-row')) return;
      
      const rowIndex = row.getAttribute('row-index') || row.getAttribute('row-id') || row.id || 'single';
      if (!groups[rowIndex]) {
        groups[rowIndex] = [];
      }
      groups[rowIndex].push(row);
    });

    const groupKeys = Object.keys(groups);
    const totalCount = groupKeys.length;

    if (!pattern) {
      rows.forEach(row => {
        row.classList.remove('fw-hidden-row');
        // originalTops was cleared at the top of this call, so we can't restore from
        // it here. Instead, strip any inline top/transform we wrote during filtering
        // so ag-Grid resumes control of its own row positions.
        row.style.top = '';
        row.style.transform = '';
      });
      badge.textContent = `${totalCount} / ${totalCount}`;
      return;
    }

    let matchedCount = 0;
    let accumulatedY = 0;

    // Sort the row-index groups numerically or in their original DOM order if possible
    // Standard Object keys maintain insertion order or numeric order
    const sortedGroupKeys = groupKeys.sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    // Evaluate and reposition each row group
    sortedGroupKeys.forEach(rowIndex => {
      const groupRows = groups[rowIndex];

      // Combine text content deeply from all elements in the group (e.g. left + center grid panels)
      let combinedText = '';
      groupRows.forEach(row => {
        combinedText += ' ' + getTextContentDeep(row, true);
      });
      combinedText = combinedText.replace(/\s+/g, ' ').trim();

      const isMatch = !pattern || matchText(combinedText, pattern);

      // Determine height of this row group (from first row in group)
      let groupHeight = 38; // standard fallback
      const firstRow = groupRows[0];
      if (firstRow) {
        const heightStyle = firstRow.style.height || window.getComputedStyle(firstRow).height;
        const parsedHeight = parseFloat(heightStyle);
        if (!isNaN(parsedHeight) && parsedHeight > 0) {
          groupHeight = parsedHeight;
        }
      }

      if (isMatch) {
        matchedCount++;
        groupRows.forEach(row => {
          row.classList.remove('fw-hidden-row');
          
          // Save original absolute positioning and transforms
          if (!originalTops.has(row)) {
            originalTops.set(row, {
              top: row.style.top,
              transform: row.style.transform
            });
          }
          
          // Apply new vertical coordinate based on dynamic layout system (top or translateY)
          const styleAttr = row.getAttribute('style') || '';
          if (styleAttr.includes('transform:') || styleAttr.includes('translateY') || row.style.transform) {
            if (row.style.transform && row.style.transform.includes('translateY')) {
              row.style.transform = row.style.transform.replace(/translateY\([-\d.]+px\)/, `translateY(${accumulatedY}px)`);
            } else if (styleAttr.includes('translateY')) {
              // Direct replacement in style attribute if style.transform isn't fully synced
              const newStyle = styleAttr.replace(/translateY\([-\d.]+px\)/, `translateY(${accumulatedY}px)`);
              row.setAttribute('style', newStyle);
            } else {
              row.style.transform = `translateY(${accumulatedY}px)`;
            }
          } else {
            row.style.top = accumulatedY + 'px';
          }
        });
        accumulatedY += groupHeight;
      } else {
        groupRows.forEach(row => {
          row.classList.add('fw-hidden-row');
          // Strip any inline position overrides we may have written in a prior pass
          // so ag-Grid's own styles take over when this row becomes visible again.
          row.style.top = '';
          row.style.transform = '';
        });
      }
    });

    badge.textContent = `${matchedCount} / ${totalCount}`;
  }

  input.addEventListener('input', applyFilter);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      applyFilter();
      input.focus();
    });
  }
  applyFilter(); // Initialize state and count on startup

  // 3. Mutation Observer to auto-filter loaded dynamic elements and snap relative layouts
  // Debounced so ag-Grid row-expansion animations (which fire dozens of rapid mutations)
  // don't spam applyFilter and cause flickering.
  let _mutationTimer = null;
  const observer = new MutationObserver((mutations) => {
    const overlay = document.getElementById('fidelity-wildcard-overlay');

    // Skip mutations that are entirely inside our own overlay widget.
    const isOverlayOnly = mutations.every(m => overlay && overlay.contains(m.target));
    if (isOverlayOnly) return;

    // Skip attribute-only mutations on ag-Grid rows — these are row-expand/collapse
    // animations that don't change which rows exist; re-filtering here causes the flicker.
    const isAgGridAttributeOnly = mutations.every(m =>
      m.type === 'attributes' &&
      m.target &&
      typeof m.target.className === 'string' &&
      m.target.className.includes('ag-')
    );
    if (isAgGridAttributeOnly) return;

    // Debounce: wait until the DOM settles before re-filtering.
    clearTimeout(_mutationTimer);
    _mutationTimer = setTimeout(() => {
      applyFilter();
      positionOverlay();
    }, 150);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'row-index'] });

  function cleanupTargeting() {
    if (!isTargeting) return;
    isTargeting = false;
    if (targetBtn) {
      targetBtn.style.color = '#94a3b8';
      targetBtn.style.background = 'transparent';
    }
    
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
    
    // Filter all elements in the path that match our row container criteria
    const rowMatches = path.filter(el => {
      if (!el.tagName) return false;
      const tag = el.tagName.toLowerCase();
      const classes = Array.from(el.classList || []).join(' ').toLowerCase();
      
      // Exclude overlay elements
      if (el.id === 'fidelity-wildcard-overlay' || el.id === 'fw-search-input') return false;
      
      return tag === 'tr' || 
             tag === 'li' || 
             el.getAttribute?.('role') === 'row' ||
             el.getAttribute?.('role') === 'listitem' ||
             tag.includes('row') || 
             tag.includes('holding') ||
             classes.includes('row') || 
             classes.includes('holding') ||
             classes.includes('position');
    });

    // Select the highest/outermost matched element (last in the matching list closest to body)
    const target = rowMatches.length > 0 ? rowMatches[rowMatches.length - 1] : null;

    if (target && target.tagName && !document.getElementById('fidelity-wildcard-overlay').contains(target)) {
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

      // Build a robust selector that targets all rows of this type
      currentSelector = classes ? `${tag}.${classes}` : tag;
    }

    cleanupTargeting();
    applyFilter();
  }

  function enableTargeting() {
    if (isTargeting) return;
    isTargeting = true;
    if (targetBtn) {
      targetBtn.style.color = '#6366f1';
      targetBtn.style.background = 'rgba(99, 102, 241, 0.2)';
    }

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleGlobalClick, true);
  }

  if (targetBtn) {
    targetBtn.addEventListener('click', () => {
      if (!isTargeting) {
        enableTargeting();
      } else {
        cleanupTargeting();
      }
    });
  }

  // 4. Close & Clean Up routine
  function destroy() {
    clearTimeout(_mutationTimer);
    observer.disconnect();
    cleanupTargeting();
    window.removeEventListener('resize', positionOverlay);
    window.removeEventListener('scroll', positionOverlay);
    const rows = querySelectorAllDeep(currentSelector);
    rows.forEach(row => {
      row.classList.remove('fw-hidden-row');
      // Strip any inline positions we wrote — ag-Grid manages its own layout after this
      row.style.top = '';
      row.style.transform = '';
    });
    originalTops.clear();
    container.remove();
    /* style handled by chrome */
  }
  closeBtn.addEventListener('click', destroy);

  // Expose destroy so popup and bookmarklet can reach it
  window.destroyFidelityOverlay = destroy;
  window.__fwDestroy = destroy;
}

// Bootstrap on initial page load
if (!document.getElementById('fidelity-wildcard-overlay')) {
  launchOverlay();
}


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
