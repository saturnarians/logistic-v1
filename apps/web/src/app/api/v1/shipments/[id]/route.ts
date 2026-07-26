import { UpdateShipmentInputSchema } from '@logistics/shared';
import { getShipment, updateShipment } from '@logistics/core';
import { jsonError, requestBody } from '../../../../../lib/api';
import { resolveActor } from '../../../../../server/auth/resolve-actor';

type ShipmentRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: ShipmentRouteContext) {
  try {
    const { id } = await context.params;
    return Response.json(await getShipment(await resolveActor(), id));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: ShipmentRouteContext) {
  const parsed = UpdateShipmentInputSchema.safeParse(await requestBody(request));
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid shipment update', details: parsed.error.flatten() } }, { status: 400 });
  try {
    const { id } = await context.params;
    return Response.json(await updateShipment(await resolveActor(), id, parsed.data));
  } catch (error) {
    return jsonError(error);
  }
}
