import { expect, test } from 'bun:test';
import { canTransitionFlag } from './flag.service';

test('flag transitions only resolve pending flags once', () => {
  expect(canTransitionFlag('PENDING', 'APPROVED')).toBe(true);
  expect(canTransitionFlag('PENDING', 'REJECTED')).toBe(true);
  expect(canTransitionFlag('APPROVED', 'REJECTED')).toBe(false);
  expect(canTransitionFlag('REJECTED', 'APPROVED')).toBe(false);
});
