import { AppError } from '@logistics/core';

const hits = new Map<string, { count: number; resetAt: number }>();

// ponytail: per-process limiter; replace with shared Upstash storage when multiple web instances run.
export function limit(key: string, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const current = hits.get(key);
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  entry.count += 1;
  hits.set(key, entry);
  if (entry.count > max) throw new AppError('RATE_LIMITED', 'Too many requests. Please try again shortly.', 429);
}
