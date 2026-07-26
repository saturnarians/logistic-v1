import { describe, expect, it } from 'bun:test';
import { SmokeTestSchema } from './index';

describe('packages/shared smoke test', () => {
  it('validates SmokeTestSchema correctly', () => {
    const validData = { status: 'ok', timestamp: Date.now() };
    const parsed = SmokeTestSchema.safeParse(validData);
    expect(parsed.success).toBe(true);

    const invalidData = { status: 'ok', timestamp: 'not-a-number', extra: true };
    const invalidParsed = SmokeTestSchema.safeParse(invalidData);
    expect(invalidParsed.success).toBe(false);
  });
});
