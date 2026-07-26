import type { PublicTrackingDTO, ShipmentDTO } from '../shipment';

type ShipmentRecord = {
  id: string;
  trackingCode: string;
  status: string;
  originCityId: string;
  destinationCityId: string;
  weightKg: number;
  priceQuoted: { toString(): string };
  contactEmail: string | null;
  contactPhone: string | null;
  driverId: string | null;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toShipmentDTO(shipment: ShipmentRecord): ShipmentDTO {
  return {
    id: shipment.id,
    trackingCode: shipment.trackingCode,
    status: shipment.status,
    originCityId: shipment.originCityId,
    destinationCityId: shipment.destinationCityId,
    weightKg: shipment.weightKg,
    priceQuoted: shipment.priceQuoted.toString(),
    contactEmail: shipment.contactEmail,
    contactPhone: shipment.contactPhone,
    driverId: shipment.driverId,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
  };
}

export function toPublicTrackingDTO(shipment: ShipmentRecord): PublicTrackingDTO {
  return {
    trackingCode: shipment.trackingCode,
    status: shipment.status,
    originCityId: shipment.originCityId,
    destinationCityId: shipment.destinationCityId,
    weightKg: shipment.weightKg,
    currentLat: shipment.currentLat,
    currentLng: shipment.currentLng,
    lastLocationAt: shipment.lastLocationAt,
    createdAt: shipment.createdAt,
  };
}
