import { QuoteInputSchema } from '@logistics/shared';
import { getQuote } from '@logistics/core';
import { clientKey, jsonError, requestBody } from '../../../../lib/api';
import { resolveActor } from '../../../../server/auth/resolve-actor';
import { limit } from '../../../../lib/rate-limit';

export async function POST(request: Request) {
  const parsed = QuoteInputSchema.safeParse(await requestBody(request));
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid quote request', details: parsed.error.flatten() } }, { status: 400 });
  try {
    const actor = await resolveActor();
    if (actor.role === 'PUBLIC') limit(`quote:${clientKey(request, actor.id)}`);
    return Response.json(getQuote(actor, parsed.data));
  } catch (error) {
    return jsonError(error);
  }
}
