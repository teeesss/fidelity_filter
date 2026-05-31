# Fidelity Positions Wildcard Filter Overlay

An ultra-premium, see-through glassmorphic Chrome Extension (Manifest V3) and bookmarklet that inserts a wildcard-enabled live search bar directly into the **Fidelity Digital Positions** dashboard. 

It enables rapid portfolio filtering using advanced wildcard patterns and multi-term union searches (e.g. `*CIFR* & *DRAM*`), snapping inline perfectly in the Positions table header.

---

## 📥 Direct Downloads & Quick Links

* **📦 [Download Extension Directory (extension/)](https://github.com/teeesss/fidelity_filter/tree/master/extension)** – Clone or download this folder to load directly as an unpacked developer extension in Chrome (`chrome://extensions/`). *(Recommended — runs automatically on every visit)*
* **🚀 [Download Bookmarklet Payload (dist/bookmarklet.txt)](https://raw.githubusercontent.com/teeesss/fidelity_filter/master/dist/bookmarklet.txt)** – Open this file, copy the single-line `javascript:...` code, and paste it directly into your browser bookmark's URL box. *(Alternative to the extension — no install required)*

---

## 🚀 Key Features

* **Glassmorphic Micro-UI:** Extremely polished design utilizing modern see-through glass aesthetics (`rgba(255, 255, 255, 0.05)` background, a 20px backdrop blur, a fine crisp dark outline, and `4px` rounded corners).
* **Relative Position Snapping:** Dynamically finds the native search buttons container (`.posweb-grid_top-buttons-search-container`) and mounts itself inline with a relative offset (`top: -50px`) so it feels completely native.
* **Union Multi-Term Search (`&`):** Allows combining search patterns to view multiple sets of rows simultaneously. Typing `*CIFR* & DR` matches any row containing `CIFR` **OR** `DR` (e.g., DRAM), enabling users to monitor multiple positions concurrently.
* **Wildcard Parsing (`*` and `?`):** Seamless support for `*` (zero-or-more characters) and `?` (exactly one character) standard wildcard filters.
* **Deep Shadow-DOM Traversal:** Automatically pierces all shadow roots and nested containers recursively to gather all textual content inside the rows.
* **ag-Grid Split Column Stacking:** Groups rows by their grid coordinate index and dynamically updates active translation heights (`translateY` transforms or `top` rules) so column groupings stack flush on top of one another when elements are hidden.

---

## 🛠️ Tech Stack & Architecture

1. **Frontend Core:** Pure Vanilla JS (ES6+) and CSS3. 
2. **Matching Engine (`src/matching.js`):** Lightweight, regex-driven parser compiling wildcard patterns and splitting them by `&` to run a logical `some` evaluation across active text content.
3. **Overlay & Rendering (`src/overlay.js`):** Deep DOM recursive text scraper, ag-Grid layout translator, and coordinate stacker.
4. **Lightweight Bundlers:** Compiles imports and inlines styling into separate outputs:
   * **Bookmarklet compiler (`src/build.js`):** Minifies and URL-encodes everything into a single `javascript:...` link in `dist/bookmarklet.txt`.
   * **Chrome Extension compiler (`extension/build-extension.js`):** Bundles resources cleanly for Manifest V3 extension environments in `extension/content.js`.

---

## ⚡ Setup & Usage

### 📦 Installation

#### Method A: Chrome Extension (Recommended)
1. Navigate to `chrome://extensions/` in your browser.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** (top-left button) and select the `extension` folder inside this repository.
4. Open [Fidelity Positions](https://digital.fidelity.com/ftgw/digital/portfolio/positions) to see the filter box automatically snapped next to the native magnifying glass!

#### Method B: Bookmarklet
1. Open the compiled output file [dist/bookmarklet.txt](https://raw.githubusercontent.com/teeesss/fidelity_filter/master/dist/bookmarklet.txt).
2. Copy the entire single-line payload starting with `javascript:`.
3. Create a new bookmark in your browser, paste the payload into the **URL / Location** field, and save it.
4. Click the bookmark when viewing your Fidelity Positions dashboard to launch the filter.

---

## 🧠 Developer Guide & Lessons Learned

> [!WARNING]
> **Chrome Extension Caching Behavior**
> Chrome caches content scripts for unpacked extensions. If you make code modifications in `extension/content.js` or `extension/content.css`, the browser **will not** reload the extension in active tabs automatically.
> You **must** manually click the **Reload (circular arrow) icon** in `chrome://extensions/` and then reload your dashboard tab for changes to take effect.

### Union Logic on Rows
* When searching for `CIFR & DRAM`, a human expects to see *both* symbols in their rows.
* Because no individual row contains both `CIFR` and `DRAM` strings at the same time, this must be evaluated as an **`OR` (union)** filter (`terms.some(term => regex.test(text))`), rather than an `AND` filter.

### Overly-Broad Class Exclusion Bug
* **Lesson Learned**: When ignoring specific floating overlay/panel/tooltip components during text extraction, avoid broad keywords like `detail` or `expand` in class filters.
* ag-Grid and Fidelity assign classes like `ag-row-expanded` or cell classes like `posweb-equity-detail` to standard row containers and cells. Excluding these keywords entirely causes crucial row content (e.g. the equity symbol) to be omitted during text scraping, leading to filtered rows disappearing the moment they are clicked or expanded. Keep component exclusion lists specific to floating panels/dialogs/drawers.

---

## 🧪 Automated Testing
Run automated unit and layout integration tests:
```powershell
npm test
```
* Tests verify robust wildcard-to-regex translations, union matches, ag-Grid dynamic vertical height shifts, and target element class selectors.
