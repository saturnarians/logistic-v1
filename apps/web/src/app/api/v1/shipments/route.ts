import { CreateShipmentInputSchema } from '@logistics/shared';
import { createShipment, listShipments } from '@logistics/core';
import { jsonError, requestBody } from '../../../../lib/api';
import { resolveActor } from '../../../../server/auth/resolve-actor';

export async function GET() {
  try {
    return Response.json(await listShipments(await resolveActor()));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const parsed = CreateShipmentInputSchema.safeParse(await requestBody(request));
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid shipment request', details: parsed.error.flatten() } }, { status: 400 });
  try {
    return Response.json(await createShipment(await resolveActor(), parsed.data), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
