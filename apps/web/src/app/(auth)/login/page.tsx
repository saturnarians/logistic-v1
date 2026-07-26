'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = new FormData(event.currentTarget);
    const result = await signIn('credentials', { email: form.get('email'), password: form.get('password'), redirect: false });
    if (result?.error) { setError('Invalid email or password.'); return; }
    router.push('/'); router.refresh();
  }
  return <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900"><section className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><p className="text-sm font-semibold uppercase tracking-widest text-blue-700">Logistics staff</p><h1 className="mt-3 text-3xl font-bold">Sign in</h1><form className="mt-8 space-y-4" onSubmit={submit}><label className="block text-sm font-medium">Email<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3" type="email" name="email" required /></label><label className="block text-sm font-medium">Password<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3" type="password" name="password" required /></label>{error && <p className="text-sm text-red-700">{error}</p>}<button className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800">Sign in</button></form><a className="mt-6 block text-center text-sm font-medium text-blue-700 hover:underline" href="/track">Track a delivery</a></section></main>;
}
