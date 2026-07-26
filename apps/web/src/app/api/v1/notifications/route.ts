import { listNotifications } from '@logistics/core';
import { jsonError } from '../../../../lib/api';
import { resolveActor } from '../../../../server/auth/resolve-actor';

export async function GET() {
  try {
    const actor = await resolveActor();
    if (actor.role === 'PUBLIC') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    return Response.json(await listNotifications(actor.id));
  } catch (error) { return jsonError(error); }
}
