import { flagsSummary, shipmentsByStatus } from '@logistics/core';
import { resolveActor } from '../../server/auth/resolve-actor';

export default async function DashboardOverview() {
  const actor = await resolveActor();
  const status = actor.role === 'PUBLIC' ? [] : await shipmentsByStatus(actor);
  const flags = actor.role === 'PUBLIC' || actor.role === 'AGENT' || actor.role === 'DRIVER' ? [] : await flagsSummary(actor);
  return <main className="mx-auto max-w-5xl p-4 md:p-8"><h1 className="text-2xl font-semibold">Overview</h1><section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"><MetricCard title="Shipments by status" rows={status.map(row => [row.status, row.count])} /><MetricCard title="Flags" rows={flags.map(row => [row.status, row.count])} /></section></main>;
}

function MetricCard({ title, rows }: { title: string; rows: [string, number][] }) {
  return <section className="rounded-lg border p-4"><h2 className="font-medium">{title}</h2><ul className="mt-3 space-y-2">{rows.map(([label, count]) => <li className="flex justify-between" key={label}><span>{label}</span><strong>{count}</strong></li>)}</ul></section>;
}
