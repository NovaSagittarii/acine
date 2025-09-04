import { expect, test } from 'vitest';
import { displayRepeatRange } from './ActionEditor.util';

test('equal', () => {
  expect(displayRepeatRange(10, 10)).toBe('10 times');
});

test('l <= 0', () => {
  for (let r = -2; r <= 5; ++r) {
    expect(displayRepeatRange(0, r)).toBe('never');
  }
});

test('l >= 5 >= r', () => {
  for (let r = -1; r <= 5; ++r) {
    expect(displayRepeatRange(10, r)).toBe('at least 10 times');
  }
});

test('1 <= l < r', () => {
  for (let l = 1; l <= 10; ++l) {
    for (let r = l + 1; r <= 10; ++r) {
      expect(displayRepeatRange(l, r)).toBe(`${l} to ${r} times`);
    }
  }
});
