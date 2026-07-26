import { expect, test } from 'bun:test';
import { AppError } from '@logistics/core';
import { limit } from './rate-limit';

test('rate limiter rejects requests over its window allowance', () => {
  limit('test', 1, 60_000);
  expect(() => limit('test', 1, 60_000)).toThrow(AppError);
});
