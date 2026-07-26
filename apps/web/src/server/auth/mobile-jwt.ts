import { decode, encode } from 'next-auth/jwt';
import type { Actor } from '@logistics/core';

const secret = process.env.AUTH_SECRET || 'development-auth-secret';
const salt = 'authjs.session-token';

export const issueMobileToken = (actor: Actor) => encode({ secret, salt, token: { sub: actor.id, id: actor.id, role: actor.role }, maxAge: 60 * 15 });
export async function readMobileActor(request: Request): Promise<Actor | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const payload = await decode({ secret, salt, token });
  return typeof payload?.id === 'string' && typeof payload.role === 'string' ? { id: payload.id, role: payload.role as Actor['role'] } : null;
}
