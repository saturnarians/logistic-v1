import type { Prisma } from '@prisma/client';
import type { Actor } from '../auth/permissions';
import { db } from '../db';
import { forbidden, notFound } from '../errors';
import { notify } from './notification.service';
import { can } from '../auth/permissions';
import { createShipment, updateShipment, cancelShipment } from './shipment.service';
import { CreateShipmentInputSchema, UpdateShipmentInputSchema, CancelShipmentInputSchema } from '@logistics/shared';
import { AppError } from '../errors';

export async function submitForApproval(actor: Actor, toolName: string, input: unknown) {
  if (actor.role !== 'AGENT') throw forbidden();
  const action = await db.agentAction.create({ data: { actorId: actor.id, toolName, input: input as Prisma.InputJsonValue } });
  const reviewers = await db.user.findMany({ where: { role: { in: ['MANAGER', 'ADMIN', 'SUPER_ADMIN'] } }, select: { id: true } });
  await Promise.all(reviewers.map(user => notify({ event: 'agent-action:pending', title: 'Agent action pending', body: `Review ${toolName}.`, userId: user.id })));
  return action;
}

export async function listAgentActions(actor: Actor) {
  if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(actor.role)) throw forbidden();
  return db.agentAction.findMany({ where: { status: 'PENDING_APPROVAL' }, orderBy: { createdAt: 'asc' } });
}

export async function rejectAgentAction(actor: Actor, id: string, reason: string) {
  if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(actor.role)) throw forbidden();
  const action = await db.agentAction.findUnique({ where: { id } });
  if (!action) throw notFound('Agent action not found');
  return db.agentAction.update({ where: { id }, data: { status: 'REJECTED', reviewedById: actor.id, reviewReason: reason } });
}

export async function approveAgentAction(reviewer: Actor, id: string) {
  if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(reviewer.role)) throw forbidden();
  const action = await db.agentAction.findUnique({ where: { id } });
  if (!action?.actorId) throw notFound('Agent action not found');
  const user = await db.user.findUnique({ where: { id: action.actorId }, select: { id: true, role: true } });
  if (!user) throw new AppError('ACTOR_REVOKED', 'Original actor is no longer available', 409);
  const actor: Actor = user;
  const capability = action.toolName === 'createShipment' ? 'shipment:create' : action.toolName === 'updateShipment' ? 'shipment:update' : action.toolName === 'cancelShipment' ? 'shipment:cancel' : null;
  if (!capability || !can(actor, capability)) throw new AppError('ACTOR_REVOKED', 'Original actor no longer has permission', 409);
  const input = action.input as Record<string, unknown>;
  try {
    if (action.toolName === 'createShipment') { const parsed = CreateShipmentInputSchema.safeParse(input); if (!parsed.success) throw new Error(); await createShipment(actor, parsed.data); }
    if (action.toolName === 'updateShipment') { const parsed = UpdateShipmentInputSchema.safeParse(input.data); if (!parsed.success || typeof input.id !== 'string') throw new Error(); await updateShipment(actor, input.id, parsed.data); }
    if (action.toolName === 'cancelShipment') { const parsed = CancelShipmentInputSchema.safeParse({ reason: input.reason }); if (!parsed.success || typeof input.id !== 'string') throw new Error(); await cancelShipment(actor, input.id, parsed.data.reason); }
  } catch {
    await db.agentAction.update({ where: { id }, data: { status: 'FAILED', reviewedById: reviewer.id } });
    throw new AppError('ACTION_FAILED', 'Queued action could not be executed', 409);
  }
  return db.agentAction.update({ where: { id }, data: { status: 'EXECUTED', reviewedById: reviewer.id } });
}
