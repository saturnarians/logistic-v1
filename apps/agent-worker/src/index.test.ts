import { describe, expect, it } from 'bun:test';
import { handleRequest } from './index';
import { toolNamesFor } from './registry';

describe('apps/agent-worker HTTP server', () => {
  it('returns 200 on /health', async () => {
    const res = await handleRequest(new Request('http://worker/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.service).toBe('agent-worker');
  });

  it('rejects /internal/chat without header', async () => {
    const res = await handleRequest(new Request('http://worker/internal/chat', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('never exposes createShipment to public actors', () => {
    expect(toolNamesFor({ id: 'public', role: 'PUBLIC' })).not.toContain('createShipment');
  });
});
