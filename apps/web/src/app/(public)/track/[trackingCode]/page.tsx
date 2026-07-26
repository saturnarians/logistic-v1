'use client';

import { useEffect, useState } from 'react';

type Tracking = { trackingCode: string; status: string; originCityId: string; destinationCityId: string; weightKg: number; createdAt: string; currentLat: number | null; currentLng: number | null; lastLocationAt: string | null };

export default function TrackingDetails({ params }: { params: Promise<{ trackingCode: string }> }) {
  const [shipment, setShipment] = useState<Tracking | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void params.then(async ({ trackingCode }) => { const response = await fetch(`/api/v1/shipments/${encodeURIComponent(trackingCode)}`); if (!response.ok) { setError('We could not find that shipment. Check the tracking code and try again.'); return; } setShipment(await response.json()); }); }, [params]);
  return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900"><section className="mx-auto max-w-2xl"><a className="text-sm font-medium text-blue-700 hover:underline" href="/track">← Track another shipment</a>{error && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}{!shipment && !error && <p className="mt-8 text-slate-600">Loading shipment details…</p>}{shipment && <article className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm text-slate-500">Tracking code</p><h1 className="text-2xl font-bold">{shipment.trackingCode}</h1></div><span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">{shipment.status.replaceAll('_', ' ')}</span></div><dl className="mt-8 grid grid-cols-1 gap-5 border-t pt-6 sm:grid-cols-2"><Detail label="Origin" value={shipment.originCityId} /><Detail label="Destination" value={shipment.destinationCityId} /><Detail label="Weight" value={`${shipment.weightKg} kg`} /><Detail label="Created" value={new Date(shipment.createdAt).toLocaleDateString()} /><Detail label="Last location update" value={shipment.lastLocationAt ? new Date(shipment.lastLocationAt).toLocaleString() : 'Not yet available'} /></dl></article>}</section></main>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }
