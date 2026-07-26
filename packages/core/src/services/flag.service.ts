import type { FlagShipmentInput } from '@logistics/shared';
import type { Actor } from '../auth/permissions';
import { can } from '../auth/permissions';
import { db } from '../db';
import { AppError, forbidden, notFound } from '../errors';
import { writeAudit } from './audit.service';
import { notify } from './notification.service';

export function canTransitionFlag(from: 'PENDING' | 'APPROVED' | 'REJECTED', to: 'APPROVED' | 'REJECTED') {
  return from === 'PENDING' && (to === 'APPROVED' || to === 'REJECTED');
}

export async function flagShipment(actor: Actor, trackingCode: string, input: FlagShipmentInput) {
  if (!can(actor, 'shipment:flag')) throw forbidden();
  const shipment = await db.shipment.findUnique({ where: { trackingCode } });
  if (!shipment) throw notFound('Shipment not found');
  if (actor.role === 'PUBLIC') {
    if (!shipment.contactEmail && !shipment.contactPhone) throw notFound('Shipment not found');
    const emailMatches = Boolean(input.contactEmail && shipment.contactEmail?.toLowerCase() === input.contactEmail.toLowerCase());
    const phoneMatches = Boolean(input.contactPhone && shipment.contactPhone === input.contactPhone);
    if (!emailMatches && !phoneMatches) throw forbidden('Unable to verify shipment contact');
  }
  const pending = await db.flag.findFirst({ where: { shipmentId: shipment.id, status: 'PENDING' } });
  if (pending) throw new AppError('PENDING_FLAG_EXISTS', 'A pending flag already exists for this shipment', 409);
  const flag = await db.flag.create({ data: { shipmentId: shipment.id, raisedById: actor.id, reason: input.reason } });
  await writeAudit({ actorId: actor.id, shipmentId: shipment.id, action: 'shipment:flagged' });
  return flag;
}

async function resolveFlag(actor: Actor, id: string, status: 'APPROVED' | 'REJECTED') {
  if (!can(actor, status === 'APPROVED' ? 'flag:approve' : 'flag:reject')) throw forbidden();
  const flag = await db.flag.findUnique({ where: { id } });
  if (!flag) throw notFound('Flag not found');
  if (!canTransitionFlag(flag.status, status)) throw new AppError('INVALID_TRANSITION', 'Flag is already resolved', 409);
  return db.$transaction(async (tx) => {
    const updated = await tx.flag.update({ where: { id }, data: { status, resolvedById: actor.id, resolvedAt: new Date() } });
    if (status === 'APPROVED') await tx.shipment.update({ where: { id: flag.shipmentId }, data: { status: 'SOFT_DELETED' } });
    await writeAudit({ actorId: actor.id, shipmentId: flag.shipmentId, action: `flag:${status.toLowerCase()}` });
    await notify({ event: `flag:${status.toLowerCase()}`, title: 'Shipment flag updated', body: `Your shipment flag was ${status.toLowerCase()}.`, userId: flag.raisedById, shipmentId: flag.shipmentId });
    return updated;
  });
}

export const approveFlag = (actor: Actor, id: string) => resolveFlag(actor, id, 'APPROVED');
export const rejectFlag = (actor: Actor, id: string, _reason: string) => resolveFlag(actor, id, 'REJECTED');
