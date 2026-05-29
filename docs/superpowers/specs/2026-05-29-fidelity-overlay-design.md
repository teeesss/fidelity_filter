# Fidelity Wildcard Filter Overlay Specification

## Goal
To build a highly robust, beautiful, and non-destructive browser bookmarklet that allows users to filter holdings and tables on `digital.fidelity.com` (and other websites) using wildcards (e.g., `*jun*2026`), hiding all non-matching rows while keeping the page fully functional.

## Architecture
The bookmarklet is a self-contained, self-injecting JavaScript module packaged into a `javascript:` URL scheme. When clicked, it builds a floating widget, attaches event listeners, and tracks the DOM to dynamically hide/show rows using non-destructive CSS rules.

### Key Components

1. **Floating GUI Overlay**
   - Positioned in the top-right of the viewport with a high `z-index` (e.g., `2147483647`).
   - Styled with modern CSS glassmorphism (translucent white/dark background, blur, rounded corners, subtle shadows).
   - Contains:
     - Search Input field (with a placeholder like `*jun*2026`).
     - Status/Counter badge (e.g., `12 / 48 matches`).
     - Manual Target button (`🎯 Target`).
     - Close button (`✕`).

2. **Wildcard Matching Engine**
   - Translates user input containing `*` and `?` into a JavaScript `RegExp`.
   - Escapes special regex characters except `*` and `?`.
   - Replaces `*` with `.*` and `?` with `.`.
   - Performs case-insensitive matching across the entire text content of target elements/rows.

3. **DOM Targeting & Observer Engine**
   - Contains pre-configured selectors for Fidelity (e.g., table rows, list items, holdings grids).
   - Dynamically tracks DOM mutations with `MutationObserver` so that if Fidelity loads more content or updates the table (e.g., when clicking pages or tabs), the filter automatically reapplies.
   - Provides a manual `Target` picker: clicking it puts the browser in selection mode, highlighting elements under the cursor; clicking an element locks it in as the container, and the bookmarklet filters its immediate child items.

4. **Non-Destructive Filter Application**
   - Hides non-matching rows by adding a custom CSS class or setting `display: none`.
   - Restores matching rows by removing the CSS class or setting `display: ""`.
   - Avoids deleting elements, preventing app breakage.

---

## Technical Details

### Wildcard Conversion Algorithm
```javascript
function wildcardToRegex(pattern) {
  // Escape special regex characters: \ ^ $ + . | ( ) [ ] { }
  let escaped = pattern.replace(/[\\^$+.|()[\]{}]/g, '\\$&');
  // Convert wildcards
  escaped = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(escaped, 'i');
}
```

### UI Floating Bar HTML Structure
```html
<div id="fidelity-wildcard-overlay" style="...">
  <div class="overlay-drag-handle">🔍</div>
  <input type="text" id="fw-search-input" placeholder="Filter holdings (e.g., *jun*2026)...">
  <span id="fw-match-count">0 matches</span>
  <button id="fw-target-btn" title="Click to manually target a specific table">🎯 Target</button>
  <button id="fw-close-btn">✕</button>
</div>
```

---

## Verification Plan

### Automated Verification
- We will write local unit tests in `src/tests/` to verify the wildcard-to-regex translation logic and matching behavior across various mock table structures.

### Manual Verification
- Test in a clean HTML page with mock table structures representing Fidelity.com's layout.
- Verify element targeting mode, wildcard filter updates, and clean cleanup upon close.
- Verify that standard page interactions (clicking links, inputs) continue to work flawlessly inside the table rows.
