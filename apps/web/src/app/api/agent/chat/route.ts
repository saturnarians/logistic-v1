import { resolveActor } from '../../../../server/auth/resolve-actor';
import { agentStatus } from '@logistics/core';
import { clientKey } from '../../../../lib/api';
import { limit } from '../../../../lib/rate-limit';

const workerUrl = process.env.AGENT_WORKER_URL || 'http://localhost:4000';

export async function POST(request: Request) {
  if ((await agentStatus()).status === 'STOPPED') return Response.json({ error: { code: 'AGENT_STOPPED', message: 'AI assistant is temporarily unavailable' } }, { status: 503 });
  const messages = await request.json().catch(() => null);
  if (!messages || typeof messages !== 'object') return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid chat request' } }, { status: 400 });
  const actor = await resolveActor();
  if (actor.role === 'PUBLIC') {
    try { limit(`agent-chat:${clientKey(request, actor.id)}`, 10); }
    catch (error) { return Response.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' } }, { status: 429 }); }
  }
  const response = await fetch(`${workerUrl}/internal/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-Auth': process.env.INTERNAL_AGENT_SECRET || 'dev-internal-secret' },
    body: JSON.stringify({ ...(messages as object), actor }),
  });
  return new Response(response.body, { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' } });
}
