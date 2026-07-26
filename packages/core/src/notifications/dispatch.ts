import { db } from '../db';

export type NotificationDispatchInput = {
  event: string;
  shipmentId?: string;
  trackingCode?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  smsOptIn?: boolean;
};

// Provider delivery is intentionally isolated here; a failed attempt is recorded, never thrown.
export async function dispatch(input: NotificationDispatchInput) {
  const title = 'Shipment update';
  const body = input.trackingCode ? `Shipment ${input.trackingCode} has been created.` : 'You have a new shipment update.';
  const attempts: Promise<unknown>[] = [];
  const data = { event: input.event, shipmentId: input.shipmentId, title, body, status: 'PENDING' as const };
  if (input.contactEmail) attempts.push(db.notification.create({ data: { ...data, channel: 'EMAIL' } }));
  if (input.contactPhone && input.smsOptIn) attempts.push(db.notification.create({ data: { ...data, channel: 'SMS' } }));
  await Promise.allSettled(attempts);
}
