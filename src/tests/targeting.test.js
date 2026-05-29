import { test, describe } from 'node:test';
import assert from 'node:assert';

// Custom selector determination helper replicating overlay.js logic
function determineSelector(element) {
  if (element.tagName === 'TABLE' || element.tagName === 'TBODY') {
    return element.id ? `#${element.id} tr` : 'table tr';
  } else {
    const classNameClean = element.className
      .replace(/\s+/g, '.')
      .replace('.fw-highlight-target', '')
      .trim();
    return element.id ? `#${element.id} > *` : (classNameClean ? `.${classNameClean} > *` : '> *');
  }
}

describe('Targeting Selector Determination', () => {
  test('returns id based tr selector for TABLE and TBODY', () => {
    const el1 = { tagName: 'TABLE', id: 'portfolio-table', className: '' };
    assert.strictEqual(determineSelector(el1), '#portfolio-table tr');

    const el2 = { tagName: 'TBODY', id: '', className: '' };
    assert.strictEqual(determineSelector(el2), 'table tr');
  });

  test('returns id based child selector for other elements when id is present', () => {
    const el = { tagName: 'DIV', id: 'holding-grid', className: 'grid fw-highlight-target' };
    assert.strictEqual(determineSelector(el), '#holding-grid > *');
  });

  test('returns class based child selector for other elements when id is absent', () => {
    const el = { tagName: 'DIV', id: '', className: 'holding-container some-other-class fw-highlight-target' };
    assert.strictEqual(determineSelector(el), '.holding-container.some-other-class > *');
  });

  test('returns fallback child selector when neither id nor class are present', () => {
    const el = { tagName: 'DIV', id: '', className: '' };
    assert.strictEqual(determineSelector(el), '> *');
  });
});
