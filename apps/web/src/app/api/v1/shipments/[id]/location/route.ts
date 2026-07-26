import { UpdateLocationInputSchema } from '@logistics/shared';
import { updateShipmentLocation } from '@logistics/core';
import { jsonError, requestBody } from '../../../../../../lib/api';
import { resolveActor } from '../../../../../../server/auth/resolve-actor';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = UpdateLocationInputSchema.safeParse(await requestBody(request));
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid location update', details: parsed.error.flatten() } }, { status: 400 });
  try {
    const { id } = await context.params;
    return Response.json(await updateShipmentLocation(await resolveActor(), id, parsed.data, 'GPS'));
  } catch (error) { return jsonError(error); }
}
