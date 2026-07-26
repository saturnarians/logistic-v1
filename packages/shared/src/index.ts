import { z } from 'zod';
export { RoleEnum, type Role } from './roles';

export const SmokeTestSchema = z.strictObject({
  status: z.string(),
  timestamp: z.number(),
});
export type SmokeTest = z.infer<typeof SmokeTestSchema>;

export const ShipmentStatusEnum = z.enum([
  'PENDING',
  'ASSIGNED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
  'SOFT_DELETED',
]);
export type ShipmentStatus = z.infer<typeof ShipmentStatusEnum>;

export const FlagStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);
export type FlagStatus = z.infer<typeof FlagStatusEnum>;

export const AgentStatusEnum = z.enum([
  'RUNNING',
  'STOPPED',
]);
export type AgentStatus = z.infer<typeof AgentStatusEnum>;

export const AgentActionStatusEnum = z.enum([
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'FAILED',
]);
export type AgentActionStatus = z.infer<typeof AgentActionStatusEnum>;

export * from './schemas/shipment.schema';
export * from './schemas/user.schema';
export * from './schemas/flag.schema';
export * from './schemas/agent.schema';
