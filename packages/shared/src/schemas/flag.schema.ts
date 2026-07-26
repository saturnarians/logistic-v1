import { z } from 'zod';

export const FlagShipmentInputSchema = z.strictObject({
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});
export type FlagShipmentInput = z.infer<typeof FlagShipmentInputSchema>;

export const RejectFlagInputSchema = z.strictObject({
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
});
export type RejectFlagInput = z.infer<typeof RejectFlagInputSchema>;
