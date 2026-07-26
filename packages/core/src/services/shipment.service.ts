import { Prisma } from '@prisma/client';
import type { CreateShipmentInput, UpdateLocationInput, UpdateShipmentInput } from '@logistics/shared';
import type { LocationSource } from '@prisma/client';
import { can, type Actor } from '../auth/permissions';
import { db } from '../db';
import { toPublicTrackingDTO, toShipmentDTO } from '../dto/mappers/shipment';
import { forbidden, notFound, AppError } from '../errors';
import { writeAudit } from './audit.service';
import { calculateQuote } from './quote.service';
import { notifyShipmentCreated } from './notification.service';

export async function createShipment(actor: Actor, input: CreateShipmentInput) {
  if (!can(actor, 'shipment:create')) throw forbidden();
  const quote = calculateQuote(input);
  if (new Prisma.Decimal(input.priceQuoted).cmp(quote.estimatedPrice) !== 0) {
    throw new AppError('PRICE_MISMATCH', 'Quoted price no longer matches the current estimate', 422);
  }
  const shipment = await db.shipment.create({
    data: { ...input, priceQuoted: new Prisma.Decimal(input.priceQuoted), createdById: actor.id },
  });
  await writeAudit({ actorId: actor.id, shipmentId: shipment.id, action: 'shipment:created' });
  await notifyShipmentCreated(shipment);
  return toShipmentDTO(shipment);
}

export async function getShipment(actor: Actor, trackingCode: string) {
  if (!can(actor, 'shipment:track')) throw forbidden();
  const shipment = await db.shipment.findUnique({ where: { trackingCode } });
  if (!shipment || shipment.status === 'SOFT_DELETED') throw notFound('Shipment not found');
  if (actor.role === 'DRIVER' && shipment.driverId !== actor.id) throw forbidden();
  return actor.role === 'PUBLIC' ? toPublicTrackingDTO(shipment) : toShipmentDTO(shipment);
}

export async function listShipments(actor: Actor) {
  const where = can(actor, 'shipment:view:all') ? {} : actor.role === 'DRIVER' ? { driverId: actor.id } : { createdById: actor.id };
  const shipments = await db.shipment.findMany({ where, orderBy: { createdAt: 'desc' } });
  return shipments.map(toShipmentDTO);
}

export async function updateShipment(actor: Actor, id: string, input: UpdateShipmentInput) {
  if (!can(actor, 'shipment:update')) throw forbidden();
  if (input.driverId !== undefined && !can(actor, 'driver:reassign')) throw forbidden();
  const shipment = await db.shipment.findUnique({ where: { id } });
  if (!shipment) throw notFound('Shipment not found');
  const updated = await db.shipment.update({ where: { id }, data: input });
  await writeAudit({ actorId: actor.id, shipmentId: id, action: 'shipment:updated' });
  return toShipmentDTO(updated);
}

export async function cancelShipment(actor: Actor, id: string, reason: string) {
  if (!can(actor, 'shipment:cancel')) throw forbidden();
  const shipment = await db.shipment.findUnique({ where: { id } });
  if (!shipment) throw notFound('Shipment not found');
  if (['DELIVERED', 'CANCELLED', 'SOFT_DELETED'].includes(shipment.status)) {
    throw new AppError('INVALID_TRANSITION', 'Shipment cannot be cancelled in its current state', 409);
  }
  const updated = await db.shipment.update({
    where: { id },
    data: { status: 'CANCELLED', cancelReason: reason, cancelledById: actor.id, cancelledAt: new Date() },
  });
  await writeAudit({ actorId: actor.id, shipmentId: id, action: 'shipment:cancelled' });
  return toShipmentDTO(updated);
}

export async function updateShipmentLocation(actor: Actor, id: string, input: UpdateLocationInput, source: LocationSource = 'GPS') {
  if (!can(actor, 'shipment:location:update')) throw forbidden();
  const shipment = await db.shipment.findUnique({ where: { id } });
  if (!shipment) throw notFound('Shipment not found');
  if (actor.role === 'DRIVER' && shipment.driverId !== actor.id) throw forbidden();
  const updated = await db.shipment.update({
    where: { id },
    data: { currentLat: input.lat, currentLng: input.lng, lastLocationAt: new Date() },
  });
  await writeAudit({ actorId: actor.id, shipmentId: id, action: 'shipment:location:updated', source });
  return toShipmentDTO(updated);
}
