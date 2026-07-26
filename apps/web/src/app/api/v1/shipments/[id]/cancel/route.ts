import { CancelShipmentInputSchema } from '@logistics/shared';
import { cancelShipment } from '@logistics/core';
import { jsonError, requestBody } from '../../../../../../lib/api';
import { resolveActor } from '../../../../../../server/auth/resolve-actor';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = CancelShipmentInputSchema.safeParse(await requestBody(request));
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid cancellation request', details: parsed.error.flatten() } }, { status: 400 });
  try {
    const { id } = await context.params;
    return Response.json(await cancelShipment(await resolveActor(), id, parsed.data.reason));
  } catch (error) {
    return jsonError(error);
  }
}
