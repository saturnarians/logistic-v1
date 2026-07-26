import { describe, expect, it } from 'bun:test';
import { SmokeTestSchema } from '@logistics/shared';

describe('apps/mobile smoke test', () => {
  it('imports @logistics/shared correctly', () => {
    const res = SmokeTestSchema.safeParse({ status: 'ok', timestamp: 123 });
    expect(res.success).toBe(true);
  });
});
