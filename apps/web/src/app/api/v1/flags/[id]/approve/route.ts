import { approveFlag } from '@logistics/core';
import { jsonError } from '../../../../../../lib/api';
import { resolveActor } from '../../../../../../server/auth/resolve-actor';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json(await approveFlag(await resolveActor(), (await context.params).id)); }
  catch (error) { return jsonError(error); }
}
