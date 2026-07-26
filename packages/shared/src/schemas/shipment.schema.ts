import { z } from 'zod';

export const QuoteInputSchema = z.strictObject({
  originCityId: z.string().min(1),
  destinationCityId: z.string().min(1),
  weightKg: z.number().positive(),
});
export type QuoteInput = z.infer<typeof QuoteInputSchema>;

export const CreateShipmentInputSchema = z.strictObject({
  originCityId: z.string().min(1),
  destinationCityId: z.string().min(1),
  weightKg: z.number().positive(),
  priceQuoted: z.number().positive(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});
export type CreateShipmentInput = z.infer<typeof CreateShipmentInputSchema>;

export const UpdateShipmentInputSchema = z.strictObject({
  weightKg: z.number().positive().optional(),
  destinationCityId: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  driverId: z.string().optional(),
});
export type UpdateShipmentInput = z.infer<typeof UpdateShipmentInputSchema>;

export const CancelShipmentInputSchema = z.strictObject({
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});
export type CancelShipmentInput = z.infer<typeof CancelShipmentInputSchema>;

export const UpdateLocationInputSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type UpdateLocationInput = z.infer<typeof UpdateLocationInputSchema>;
