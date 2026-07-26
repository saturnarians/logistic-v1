import { AgentControlInputSchema } from '@logistics/shared';
import { setAgentStatus } from '@logistics/core';
import { jsonError, requestBody } from '../../../../../lib/api';
import { resolveActor } from '../../../../../server/auth/resolve-actor';
export async function POST(request: Request) {
  const parsed = AgentControlInputSchema.safeParse(await requestBody(request));
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid agent control request' } }, { status: 400 });
  try { return Response.json(await setAgentStatus(await resolveActor(request), parsed.data.action, parsed.data.reason)); } catch (error) { return jsonError(error); }
}
