import { markNotificationRead } from '@logistics/core';
import { jsonError } from '../../../../../lib/api';
import { resolveActor } from '../../../../../server/auth/resolve-actor';

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await resolveActor();
    if (actor.role === 'PUBLIC') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    return Response.json(await markNotificationRead(actor.id, (await context.params).id));
  } catch (error) { return jsonError(error); }
}
