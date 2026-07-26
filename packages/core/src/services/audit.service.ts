import type { LocationSource } from '@prisma/client';
import { db } from '../db';

export async function writeAudit(input: {
  actorId: string;
  action: string;
  shipmentId?: string;
  source?: LocationSource;
  metadata?: object;
}) {
  return db.auditLog.create({ data: input });
}
