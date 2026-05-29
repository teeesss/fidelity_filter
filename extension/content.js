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



(function() {
  if (document.getElementById('fidelity-wildcard-overlay')) return;

  // Styles loaded via manifest.json content_scripts css

  // 2. Create Floating Widget
  const container = document.createElement('div');
  container.id = 'fidelity-wildcard-overlay';
  container.innerHTML = `
    <svg class="fw-search-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: rgba(128, 128, 128, 0.65); flex-shrink: 0; display: flex; align-items: center;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
    <input type="text" id="fw-search-input" placeholder="Wildcard Filtering..." autocomplete="off">
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
    if (node.tagName === 'STYLE' || node.tagName === 'SCRIPT') return '';
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

  let originalTops = new Map();

  function applyFilter() {
    const pattern = input.value.trim();
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

    let matchedCount = 0;
    let totalCount = 0;
    let accumulatedY = 0;

    // Sort the row-index groups numerically or in their original DOM order if possible
    // Standard Object keys maintain insertion order or numeric order
    const groupKeys = Object.keys(groups).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    // Evaluate and reposition each row group
    groupKeys.forEach(rowIndex => {
      const groupRows = groups[rowIndex];
      totalCount++;

      // Combine text content deeply from all elements in the row group (left + center panels)
      let combinedText = '';
      groupRows.forEach(row => {
        combinedText += ' ' + getTextContentDeep(row);
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
          if (originalTops.has(row)) {
            const orig = originalTops.get(row);
            row.style.top = orig.top;
            row.style.transform = orig.transform;
          }
        });
      }
    });

    badge.textContent = `${matchedCount} / ${totalCount}`;
  }

  input.addEventListener('input', applyFilter);
  applyFilter(); // Initialize state and count on startup

  // 3. Mutation Observer to auto-filter loaded dynamic elements and snap relative layouts
  const observer = new MutationObserver((mutations) => {
    // Ignore mutations that occur inside our own overlay
    const isOverlayMutation = mutations.every(m => {
      const overlay = document.getElementById('fidelity-wildcard-overlay');
      return overlay && overlay.contains(m.target);
    });
    if (isOverlayMutation) return;
    
    applyFilter();
    positionOverlay();
  });
  observer.observe(document.body, { childList: true, subtree: true });

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
    observer.disconnect();
    cleanupTargeting();
    window.removeEventListener('resize', positionOverlay);
    window.removeEventListener('scroll', positionOverlay);
    const rows = querySelectorAllDeep(currentSelector);
    rows.forEach(row => {
      row.classList.remove('fw-hidden-row');
      if (originalTops.has(row)) {
        const orig = originalTops.get(row);
        row.style.top = orig.top;
        row.style.transform = orig.transform;
      }
    });
    originalTops.clear();
    container.remove();
    /* style handled by chrome */
  }
  closeBtn.addEventListener('click', destroy);

  // Expose destroy globally for re-injections
  window.destroyFidelityOverlay = destroy;
})();
