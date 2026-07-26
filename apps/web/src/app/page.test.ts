import { describe, expect, it } from 'bun:test';
import { SmokeTestSchema } from '@logistics/shared';
import { can } from '@logistics/core';

describe('apps/web smoke test', () => {
  it('imports shared and core packages correctly', () => {
    const testData = SmokeTestSchema.safeParse({ status: 'web-ok', timestamp: Date.now() });
    expect(testData.success).toBe(true);

    const isAllowed = can({ id: '1', role: 'ADMIN' }, 'shipment:create');
    expect(isAllowed).toBe(true);
  });
});
