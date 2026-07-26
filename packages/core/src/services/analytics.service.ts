import type { Actor } from '../auth/permissions';
import { can } from '../auth/permissions';
import { db } from '../db';
import { forbidden } from '../errors';

function shipmentScope(actor: Actor) {
  if (can(actor, 'shipment:view:all')) return {};
  if (actor.role === 'DRIVER') return { driverId: actor.id };
  if (actor.role === 'AGENT') return { createdById: actor.id };
  throw forbidden();
}

export async function shipmentsByStatus(actor: Actor) {
  const rows = await db.shipment.groupBy({ by: ['status'], _count: { _all: true }, where: shipmentScope(actor) });
  return rows.map(row => ({ status: row.status, count: row._count._all }));
}

export async function shipmentVolume(actor: Actor, interval: 'day' | 'week' = 'day') {
  if (!can(actor, 'shipment:view:all')) throw forbidden();
  const rows = await db.shipment.findMany({ select: { createdAt: true } });
  return bucket(rows, interval, row => row.createdAt);
}

export async function deliveriesPerDriver(actor: Actor) {
  if (!can(actor, 'shipment:view:all')) throw forbidden();
  const rows = await db.shipment.groupBy({ by: ['driverId'], _count: { _all: true }, where: { driverId: { not: null } } });
  const users = await db.user.findMany({ where: { id: { in: rows.flatMap(row => row.driverId ? [row.driverId] : []) } }, select: { id: true, name: true } });
  const names = new Map(users.map(user => [user.id, user.name]));
  return rows.map(row => ({ driverId: row.driverId!, driverName: names.get(row.driverId!) || 'Unknown', count: row._count._all }));
}

export async function flagsSummary(actor: Actor) {
  if (!can(actor, 'flag:approve')) throw forbidden();
  const rows = await db.flag.groupBy({ by: ['status'], _count: { _all: true } });
  return rows.map(row => ({ status: row.status, count: row._count._all }));
}

export async function revenue(actor: Actor, interval: 'day' | 'week' = 'day') {
  if (!can(actor, 'pricing:override')) throw forbidden();
  const rows = await db.shipment.findMany({ select: { createdAt: true, priceQuoted: true } });
  return bucket(rows, interval, row => row.createdAt, row => Number(row.priceQuoted));
}

export async function shipmentsByDestination(actor: Actor) {
  if (!can(actor, 'shipment:view:all')) throw forbidden();
  const rows = await db.shipment.findMany({ select: { destinationCity: { select: { state: { select: { name: true } } } } } });
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.destinationCity.state.name, (counts.get(row.destinationCity.state.name) || 0) + 1);
  return [...counts].map(([state, count]) => ({ state, count }));
}

function bucket<T>(rows: T[], interval: 'day' | 'week', date: (row: T) => Date, value: (row: T) => number = () => 1) {
  const values = new Map<string, number>();
  for (const row of rows) {
    const current = date(row);
    const key = interval === 'week' ? `${current.getUTCFullYear()}-W${Math.ceil((current.getUTCDate() + 6) / 7)}` : current.toISOString().slice(0, 10);
    values.set(key, (values.get(key) || 0) + value(row));
  }
  return [...values].map(([period, count]) => ({ period, count }));
}
