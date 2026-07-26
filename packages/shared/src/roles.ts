import { z } from 'zod';

export const RoleEnum = z.enum([
  'PUBLIC',
  'AGENT',
  'DRIVER',
  'MANAGER',
  'ADMIN',
  'SUPER_ADMIN',
]);
export type Role = z.infer<typeof RoleEnum>;
