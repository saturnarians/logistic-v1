import { auth } from '../../auth';
import type { Actor } from '@logistics/core';
import { readMobileActor } from './mobile-jwt';

export async function resolveActor(request?: Request): Promise<Actor> {
  const session = await auth();
  if (session?.user?.id && session.user.role) return { id: session.user.id, role: session.user.role };
  const mobileActor = request ? await readMobileActor(request) : null;
  return mobileActor ?? { id: 'public', role: 'PUBLIC' };
}
