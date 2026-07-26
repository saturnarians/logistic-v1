import { z } from 'zod';
import { RoleEnum } from '../roles';

export const LoginInputSchema = z.strictObject({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RegisterInputSchema = z.strictObject({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: RoleEnum.optional(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const MobileGoogleAuthSchema = z.strictObject({
  idToken: z.string().min(1),
});
export type MobileGoogleAuthInput = z.infer<typeof MobileGoogleAuthSchema>;
