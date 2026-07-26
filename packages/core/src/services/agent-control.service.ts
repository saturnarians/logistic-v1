import type { Actor } from '../auth/permissions';
import { can } from '../auth/permissions';
import { db } from '../db';
import { forbidden } from '../errors';
import { writeAudit } from './audit.service';

export async function agentStatus() {
  return db.agentControl.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' }, select: { status: true } });
}

export async function setAgentStatus(actor: Actor, action: 'start' | 'stop', reason?: string) {
  if (!can(actor, 'agent:control')) throw forbidden();
  const control = await db.agentControl.upsert({ where: { id: 'singleton' }, update: { status: action === 'start' ? 'RUNNING' : 'STOPPED', reason, updatedById: actor.id }, create: { id: 'singleton', status: action === 'start' ? 'RUNNING' : 'STOPPED', reason, updatedById: actor.id } });
  await writeAudit({ actorId: actor.id, action: `agent:${action}`, metadata: { reason } });
  return control;
}
