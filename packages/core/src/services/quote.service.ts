import type { Actor } from '../auth/permissions';
import { can } from '../auth/permissions';
import { forbidden } from '../errors';
import type { QuoteInput } from '@logistics/shared';

export type QuoteDTO = QuoteInput & { estimatedPrice: string; currency: 'NGN' };

export function calculateQuote(input: QuoteInput): QuoteDTO {
  const estimatedPrice = 1000 + input.weightKg * 250;
  return { ...input, estimatedPrice: estimatedPrice.toFixed(2), currency: 'NGN' };
}

export function getQuote(actor: Actor, input: QuoteInput): QuoteDTO {
  if (!can(actor, 'shipment:quote')) throw forbidden();
  return calculateQuote(input);
}
