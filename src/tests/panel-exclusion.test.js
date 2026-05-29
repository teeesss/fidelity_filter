/**
 * panel-exclusion.test.js
 *
 * Regression tests for the "earnings panel false match" bug:
 *   When an earnings/analytics flyout is visible on the page, its date text
 *   (e.g. "Jun-01-2026") must NOT bleed into the row text used for matching.
 *
 * Root cause: getTextContentDeep() was recursing into every child element
 * indiscriminately, including Fidelity's earnings panel widgets that are
 * rendered as siblings or children of row containers.
 *
 * Fix: Skip elements whose role or className indicates they are panels,
 * tooltips, dialogs, or analytics overlays.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { matchText } from '../matching.js';

// ─── Simulate getTextContentDeep with the panel-exclusion guard ──────────────
const SKIP_ROLES    = new Set(['dialog', 'tooltip', 'alertdialog', 'status', 'complementary', 'note']);
const SKIP_CLASS_RE = /panel|popup|flyout|tooltip|earnings|analytics|drawer|overlay|modal|aside|sidebar|detail|expand/i;

function getTextContentDeep(node, isRoot = false) {
  if (!node) return '';
  if (node.tagName === 'STYLE' || node.tagName === 'SCRIPT') return '';

  if (node.nodeType === 1 /* ELEMENT_NODE */) {
    const role = node.role || null;
    if (role && SKIP_ROLES.has(role)) return '';
    const cls = node.className || '';
    if (node.tagName === 'SVG') return '';

    const isGridContainer = cls.includes('ag-') || cls.includes('pos-row');
    if (!isRoot && !isGridContainer && cls && SKIP_CLASS_RE.test(cls)) {
      return '';
    }
  }

  if (node.nodeType === 3 /* TEXT_NODE */) {
    return node.nodeValue || '';
  }

  let text = '';
  for (const child of (node.children || [])) {
    text += getTextContentDeep(child, false);
  }
  if (node.textContent && !node.children) {
    text += node.textContent;
  }
  return text;
}

// Minimal node factory used in tests
function el(tag, { role, className, textContent, children } = {}) {
  return { tagName: tag.toUpperCase(), nodeType: 1, role, className, textContent, children: children || [], nodeValue: null };
}
function txt(value) {
  return { tagName: null, nodeType: 3, nodeValue: value, children: [] };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Panel Exclusion — earnings flyout must not bleed into row text', () => {

  test('row text without a panel: plain option row matches correctly', () => {
    // Simulated row: "CIFR 27 Call Jun-26-2026"
    const rowNode = el('div', {
      className: 'ag-row',
      children: [
        el('span', { children: [txt('CIFR 27 Call')] }),
        el('span', { children: [txt('Jun-26-2026')] }),
      ]
    });

    // Build combined text as the filter engine does
    let combined = '';
    for (const child of rowNode.children) combined += getTextContentDeep(child);

    assert.ok(matchText(combined, 'jun*26'), 'Should match: date is in the actual row');
    assert.ok(matchText(combined, '*CIFR*'), 'Should match: symbol is in the row');
  });

  test('earnings panel text does NOT bleed into combined row text', () => {
    // Simulated row with an embedded earnings flyout panel
    const earningsPanel = el('div', {
      className: 'posweb-earnings-panel',   // matches SKIP_CLASS_RE
      children: [
        el('span', { children: [txt('Report date')] }),
        el('span', { children: [txt('Jun-01-2026')] }),  // ← this was the culprit
        el('span', { children: [txt('Consensus -$0.182')] }),
      ]
    });

    // Row whose own text does NOT contain "jun"
    const rowNode = el('div', {
      className: 'ag-row',
      children: [
        el('span', { children: [txt('HIVE 4 Call')] }),
        el('span', { children: [txt('Jan-21-2028')] }),  // different date
        earningsPanel,   // injected earnings widget
      ]
    });

    let combined = '';
    for (const child of rowNode.children) combined += getTextContentDeep(child);

    // "Jun-01-2026" from the earnings panel must NOT appear in combined text
    assert.ok(!combined.includes('Jun-01-2026'), 'Earnings date must be excluded');
    assert.ok(!matchText(combined, 'jun*26'),
      'Pattern jun*26 must NOT match a HIVE/Jan-21-2028 row due to earnings bleed');
  });

  test('tooltip role is excluded', () => {
    const tooltipNode = el('div', {
      role: 'tooltip',
      children: [ el('span', { children: [txt('Jun-15-2026 earnings call')] }) ]
    });
    const text = getTextContentDeep(tooltipNode);
    assert.strictEqual(text, '', 'Tooltip content must be empty string');
  });

  test('dialog role is excluded', () => {
    const dialogNode = el('div', {
      role: 'dialog',
      children: [ el('span', { children: [txt('Q3 2025 Jun-01-2026')] }) ]
    });
    const text = getTextContentDeep(dialogNode);
    assert.strictEqual(text, '', 'Dialog content must be empty string');
  });

  test('real row with jun date still matches jun*26 pattern', () => {
    // A CIFR option genuinely expiring in Jun 2026 — should still match
    const rowNode = el('div', {
      className: 'ag-row',
      children: [
        el('span', { children: [txt('CIFR 26 Call')] }),
        el('span', { children: [txt('Jun-26-2026')] }),
      ]
    });

    let combined = '';
    for (const child of rowNode.children) combined += getTextContentDeep(child, true);

    assert.ok(matchText(combined, 'jun*26'), 'Genuine Jun-2026 row must still match');
  });

  test('expanded or detailed row/cell classes are NOT skipped and match correctly', () => {
    // Simulated row with ag-row-expanded class, containing EWY stock
    const expandedRowNode = el('div', {
      className: 'ag-row ag-row-expanded ag-row-level-0',
      children: [
        el('div', {
          className: 'ag-cell ag-cell-value',
          children: [txt('EWY')]
        }),
        el('div', {
          className: 'ag-cell pos-row-cell',
          children: [txt('iShares MSCI South Korea ETF')]
        })
      ]
    });

    let combined = getTextContentDeep(expandedRowNode, true);
    assert.ok(matchText(combined, 'EWY'), 'Expanded row must still match EWY pattern');

    // Simulated detail row container (root-level call)
    const detailRowNode = el('div', {
      className: 'ag-detail-row',
      children: [
        el('span', { className: 'ag-cell-value', children: [txt('EWY Option Leg')] })
      ]
    });
    let combinedDetail = getTextContentDeep(detailRowNode, true);
    assert.ok(matchText(combinedDetail, 'EWY'), 'Detail row must still match EWY pattern');
  });

  test('nested ag-detail-row (non-root recursion) is NOT skipped', () => {
    // Simulated ag-row that has a nested ag-detail-row inside it
    const parentRow = el('div', {
      className: 'ag-row ag-row-expanded',
      children: [
        el('div', {
          className: 'ag-cell',
          children: [txt('DRAM')]
        }),
        el('div', {
          className: 'ag-detail-row', // class contains 'detail', but has 'ag-' prefix
          children: [
            el('div', {
              className: 'ag-cell',
              children: [txt('DRAM 90 Call')]
            })
          ]
        })
      ]
    });

    // Traverse starting at parentRow (isRoot = true)
    // The nested ag-detail-row will be visited with isRoot = false.
    // It should not be skipped, so "DRAM 90 Call" text must be included.
    const text = getTextContentDeep(parentRow, true);
    assert.ok(text.includes('DRAM 90 Call'), 'Nested detail row text must be scraped');
    assert.ok(matchText(text, '*90 Call*'), 'Search query matching nested leg must succeed');
  });
});
