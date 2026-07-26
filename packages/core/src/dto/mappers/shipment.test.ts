import { describe, expect, it } from 'bun:test';
import { toPublicTrackingDTO, toShipmentDTO } from './shipment';

const shipment = {
  id: 'internal-id', trackingCode: 'TRACK-1', status: 'IN_TRANSIT', originCityId: 'origin', destinationCityId: 'destination',
  weightKg: 4, priceQuoted: { toString: () => '2250.00' }, contactEmail: 'customer@example.com', contactPhone: '+2348000000000',
  driverId: 'driver-id', currentLat: 6.5, currentLng: 3.3, lastLocationAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'),
};

describe('shipment mappers', () => {
  it('does not leak private shipment fields through public tracking', () => {
    const dto = toPublicTrackingDTO(shipment);
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('priceQuoted');
    expect(dto).not.toHaveProperty('contactEmail');
    expect(dto).not.toHaveProperty('driverId');
  });

  it('formats Decimal values in internal DTOs', () => {
    expect(toShipmentDTO(shipment).priceQuoted).toBe('2250.00');
  });
});
