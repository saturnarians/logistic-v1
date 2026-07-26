import { db } from '../db';
import { notFound } from '../errors';
import { dispatch } from '../notifications/dispatch';

export async function notify(input: {
  event: string;
  title: string;
  body: string;
  userId?: string;
  shipmentId?: string;
}) {
  return db.notification.create({ data: { ...input, channel: 'INTERNAL' } });
}

export async function notifyShipmentCreated(shipment: {
  id: string;
  trackingCode: string;
  contactEmail: string | null;
  contactPhone: string | null;
}) {
  await dispatch({
    event: 'shipment:created', shipmentId: shipment.id, trackingCode: shipment.trackingCode,
    contactEmail: shipment.contactEmail, contactPhone: shipment.contactPhone,
  });
}

export const listNotifications = (userId: string) =>
  db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }).then(items => items.map(toNotificationDTO));

export async function markNotificationRead(userId: string, id: string) {
  const notification = await db.notification.findFirst({ where: { id, userId } });
  if (!notification) throw notFound();
  return toNotificationDTO(await db.notification.update({ where: { id }, data: { status: 'READ', readAt: new Date() } }));
}

function toNotificationDTO(notification: Awaited<ReturnType<typeof db.notification.update>>) {
  return {
    id: notification.id, event: notification.event, title: notification.title, body: notification.body,
    channel: notification.channel, status: notification.status, readAt: notification.readAt, createdAt: notification.createdAt,
  };
}
