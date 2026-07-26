'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TrackPage() {
  const router = useRouter();
  const [trackingCode, setTrackingCode] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = trackingCode.trim();
    if (code) router.push(`/track/${encodeURIComponent(code)}`);
  };
  return <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900"><section className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><p className="text-sm font-semibold uppercase tracking-widest text-blue-700">Logistics</p><h1 className="mt-3 text-3xl font-bold">Track your delivery</h1><p className="mt-2 text-slate-600">Enter the tracking code from your shipment confirmation.</p><form className="mt-8 space-y-4" onSubmit={submit}><label className="block text-sm font-medium" htmlFor="tracking-code">Tracking code</label><input id="tracking-code" value={trackingCode} onChange={event => setTrackingCode(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3 uppercase outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="e.g. cm..." required /><button className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800">Track shipment</button></form><a className="mt-6 block text-center text-sm font-medium text-blue-700 hover:underline" href="/login">Staff login</a></section></main>;
}
