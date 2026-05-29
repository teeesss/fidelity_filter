/**
 * nested-row-exclusion.test.js
 *
 * Tests for the nested row exclusion feature.
 * When expanding parent rows or detail panels, nested rows inside the detail drawer/table
 * must NOT be processed, filtered, or positioned by the wildcard overlay engine.
 * They should be left completely alone to render naturally.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

function isNestedRow(row) {
  let parent = row.parentElement;
  while (parent) {
    const cls = typeof parent.className === 'string' ? parent.className : '';
    const role = parent.getAttribute?.('role') || '';
    
    if (cls.includes('ag-detail-row') || 
        cls.includes('posweb-earnings-panel') || 
        cls.includes('posweb-detail') || 
        cls.includes('detail-pane') ||
        cls.includes('ag-detail-cell') ||
        role === 'dialog' || 
        role === 'tooltip' ||
        (parent.tagName === 'TABLE' && parent.closest('.ag-detail-row'))
    ) {
      return true;
    }
    
    if (parent !== row && (parent.classList?.contains('ag-row') || parent.classList?.contains('pos-row') || parent.tagName === 'TR')) {
      if (parent.getAttribute?.('role') === 'row' || parent.classList?.contains('ag-row') || parent.classList?.contains('pos-row')) {
        return true;
      }
    }
    
    parent = parent.parentElement;
  }
  return false;
}

// Minimal node factory for testing DOM structures
function el(tag, { className, role, parentElement, classList } = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    className: className || '',
    parentElement: parentElement || null,
    getAttribute: (attr) => (attr === 'role' ? role : null),
    classList: classList || {
      contains: (cls) => (className || '').split(' ').includes(cls)
    }
  };
  return node;
}

describe('Nested Row Exclusion', () => {
  test('root-level rows are NOT classified as nested', () => {
    const rootRow = el('div', { className: 'ag-row', role: 'row' });
    assert.strictEqual(isNestedRow(rootRow), false, 'Root level ag-row must not be nested');

    const rootTr = el('tr', { className: 'pos-row' });
    assert.strictEqual(isNestedRow(rootTr), false, 'Root level pos-row tr must not be nested');
  });

  test('rows inside ag-detail-row are classified as nested', () => {
    const detailContainer = el('div', { className: 'ag-detail-row' });
    const innerRow = el('div', { className: 'ag-row', role: 'row', parentElement: detailContainer });
    
    assert.strictEqual(isNestedRow(innerRow), true, 'Row inside ag-detail-row must be nested');
  });

  test('rows inside dialogs or tooltips are classified as nested', () => {
    const tooltip = el('div', { role: 'tooltip' });
    const tooltipRow = el('tr', { parentElement: tooltip });
    
    assert.strictEqual(isNestedRow(tooltipRow), true, 'Row inside a tooltip must be nested');
  });

  test('nested trs inside nested table under ag-detail-row are classified as nested', () => {
    const detailContainer = el('div', { className: 'ag-detail-row' });
    
    // Simulate standard document.closest by embedding relationships
    const table = el('table', { parentElement: detailContainer });
    // Let table know it is nested under ag-detail-row
    table.closest = (selector) => {
      if (selector === '.ag-detail-row') return detailContainer;
      return null;
    };
    
    const nestedTr = el('tr', { parentElement: table });
    
    assert.strictEqual(isNestedRow(nestedTr), true, 'Table tr nested inside ag-detail-row must be nested');
  });

  test('row inside another ag-row or pos-row is classified as nested', () => {
    const parentRow = el('div', { className: 'ag-row', role: 'row' });
    const innerRow = el('div', { className: 'ag-row', role: 'row', parentElement: parentRow });
    
    assert.strictEqual(isNestedRow(innerRow), true, 'Row inside another ag-row must be nested');
  });
});
