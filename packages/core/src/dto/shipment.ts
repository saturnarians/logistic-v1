export type ShipmentDTO = {
  id: string;
  trackingCode: string;
  status: string;
  originCityId: string;
  destinationCityId: string;
  weightKg: number;
  priceQuoted: string;
  contactEmail: string | null;
  contactPhone: string | null;
  driverId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicTrackingDTO = Pick<ShipmentDTO, 'trackingCode' | 'status' | 'originCityId' | 'destinationCityId' | 'weightKg' | 'createdAt'> & {
  currentLat: number | null;
  currentLng: number | null;
  lastLocationAt: Date | null;
};
