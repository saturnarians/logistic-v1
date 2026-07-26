import {
  cancelShipment, createShipment, flagShipment, getQuote, getShipment, updateShipment, updateShipmentLocation,
  submitForApproval,
  type Actor,
} from '@logistics/core';
import {
  CancelShipmentInputSchema, CreateShipmentInputSchema, FlagShipmentInputSchema, QuoteInputSchema,
  UpdateLocationInputSchema, UpdateShipmentInputSchema,
} from '@logistics/shared';

type Tool = (actor: Actor, input: unknown) => Promise<unknown> | unknown;
const valid = <T>(schema: { safeParse: (input: unknown) => { success: boolean; data?: T } }, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error('Invalid tool input');
  return result.data as T;
};
const object = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid tool input');
  return input as Record<string, unknown>;
};
const string = (input: Record<string, unknown>, key: string) => {
  if (typeof input[key] !== 'string' || !(input[key] as string).trim()) throw new Error('Invalid tool input');
  return input[key] as string;
};

export const tools: Record<string, Tool> = {
  getQuote: (actor, input) => getQuote(actor, valid(QuoteInputSchema, input)),
  trackShipment: (actor, input) => getShipment(actor, string(object(input), 'trackingCode')),
  flagShipment: (actor, input) => { const value = object(input); return flagShipment(actor, string(value, 'trackingCode'), valid(FlagShipmentInputSchema, value)); },
  createShipment: (actor, input) => actor.role === 'AGENT' ? submitForApproval(actor, 'createShipment', valid(CreateShipmentInputSchema, input)) : createShipment(actor, valid(CreateShipmentInputSchema, input)),
  updateShipment: (actor, input) => { const value = object(input); return actor.role === 'AGENT' ? submitForApproval(actor, 'updateShipment', value) : updateShipment(actor, string(value, 'id'), valid(UpdateShipmentInputSchema, value.data)); },
  cancelShipment: (actor, input) => { const value = object(input); return actor.role === 'AGENT' ? submitForApproval(actor, 'cancelShipment', value) : cancelShipment(actor, string(value, 'id'), valid(CancelShipmentInputSchema, { reason: string(value, 'reason') }).reason); },
  updateLocation: (actor, input) => { const value = object(input); return updateShipmentLocation(actor, string(value, 'id'), valid(UpdateLocationInputSchema, value.location), 'MANUAL'); },
};
