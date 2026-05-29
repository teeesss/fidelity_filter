import { test, describe } from 'node:test';
import assert from 'node:assert';

// Simulated applyFilter translation & restoration logic to test correctness
function simulateLayoutFilter(groups, pattern, regex, originalTops) {
  let matchedCount = 0;
  let totalCount = 0;
  let accumulatedY = 0;

  const results = {};

  const groupKeys = Object.keys(groups).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  groupKeys.forEach(rowIndex => {
    const groupRows = groups[rowIndex];
    totalCount++;

    let combinedText = '';
    groupRows.forEach(row => {
      combinedText += ' ' + row.textContent;
    });

    const isMatch = !pattern || regex.test(combinedText);

    let groupHeight = 38;
    const firstRow = groupRows[0];
    if (firstRow && firstRow.style && firstRow.style.height) {
      const parsed = parseFloat(firstRow.style.height);
      if (!isNaN(parsed) && parsed > 0) {
        groupHeight = parsed;
      }
    }

    results[rowIndex] = {
      isMatch,
      rows: []
    };

    if (isMatch) {
      matchedCount++;
      groupRows.forEach(row => {
        if (!originalTops.has(row)) {
          originalTops.set(row, {
            top: row.style.top,
            transform: row.style.transform
          });
        }

        let newTransform = row.style.transform;
        let newTop = row.style.top;

        if (row.style.transform && row.style.transform.includes('translateY')) {
          newTransform = `translateY(${accumulatedY}px)`;
        } else if (row.style.transform || row.hasTransformAttr) {
          newTransform = `translateY(${accumulatedY}px)`;
        } else {
          newTop = `${accumulatedY}px`;
        }

        results[rowIndex].rows.push({
          element: row,
          hidden: false,
          top: newTop,
          transform: newTransform
        });
      });
      accumulatedY += groupHeight;
    } else {
      groupRows.forEach(row => {
        let restoredTop = row.style.top;
        let restoredTransform = row.style.transform;
        if (originalTops.has(row)) {
          const orig = originalTops.get(row);
          restoredTop = orig.top;
          restoredTransform = orig.transform;
        }

        results[rowIndex].rows.push({
          element: row,
          hidden: true,
          top: restoredTop,
          transform: restoredTransform
        });
      });
    }
  });

  return { matchedCount, totalCount, accumulatedY, results };
}

describe('Dynamic ag-Grid Stacking Math & Restoration', () => {
  test('accumulates heights correctly for matched groups and leaves original positions intact for hidden ones', () => {
    const originalTops = new Map();

    const row1_pinned = { textContent: 'HIMS JUN 2026', style: { height: '38px', transform: 'translateY(0px)', top: '' }, hasTransformAttr: true };
    const row1_center = { textContent: '$10.00 qty 5', style: { height: '38px', transform: 'translateY(0px)', top: '' }, hasTransformAttr: true };

    const row2_pinned = { textContent: 'AAPL JAN 2025', style: { height: '38px', transform: 'translateY(38px)', top: '' }, hasTransformAttr: true };
    const row2_center = { textContent: '$180.00 qty 10', style: { height: '38px', transform: 'translateY(38px)', top: '' }, hasTransformAttr: true };

    const row3_pinned = { textContent: 'CIFR JUN 2026', style: { height: '48px', transform: 'translateY(76px)', top: '' }, hasTransformAttr: true };
    const row3_center = { textContent: '$28.00 qty 2', style: { height: '48px', transform: 'translateY(76px)', top: '' }, hasTransformAttr: true };

    const groups = {
      '0': [row1_pinned, row1_center],
      '1': [row2_pinned, row2_center],
      '2': [row3_pinned, row3_center]
    };

    // Filter pattern: '*jun*' (should match row 1 and row 3, hide row 2)
    const regex = /jun/i;
    const filterResult = simulateLayoutFilter(groups, 'jun', regex, originalTops);

    assert.strictEqual(filterResult.matchedCount, 2);
    assert.strictEqual(filterResult.totalCount, 3);

    // Group 0 matches, height 38px, should be translateY(0px)
    assert.strictEqual(filterResult.results['0'].rows[0].transform, 'translateY(0px)');
    assert.strictEqual(filterResult.results['0'].rows[0].hidden, false);

    // Group 1 hidden, should retain original tops/transforms
    assert.strictEqual(filterResult.results['1'].rows[0].hidden, true);
    assert.strictEqual(filterResult.results['1'].rows[0].transform, 'translateY(38px)');

    // Group 2 matches, should sit right under Group 0! Accumulated Y should be 38px
    assert.strictEqual(filterResult.results['2'].rows[0].transform, 'translateY(38px)');
    assert.strictEqual(filterResult.results['2'].rows[0].hidden, false);
    
    // The next row would sit at 38px (Group 0 height) + 48px (Group 2 height) = 86px
    assert.strictEqual(filterResult.accumulatedY, 86);
  });
});
