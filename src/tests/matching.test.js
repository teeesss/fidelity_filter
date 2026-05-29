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
