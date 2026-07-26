import type { Role } from '@prisma/client';
import { db } from '../db';

export async function authenticateCredentials(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user?.passwordHash || !(await Bun.password.verify(password, user.passwordHash))) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function ensureOAuthUser(email: string, name: string | null | undefined) {
  return db.user.upsert({
    where: { email: email.toLowerCase() },
    update: { name: name ?? email },
    create: { email: email.toLowerCase(), name: name ?? email, role: 'PUBLIC' as Role },
  });
}

export async function getUserRole(id: string) {
  return db.user.findUnique({ where: { id }, select: { role: true } });
}

export async function getAuthUserByEmail(email: string) {
  return db.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, role: true } });
}
