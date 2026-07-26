import { listStates } from '@logistics/core';
import { jsonError } from '../../../../../lib/api';

export async function GET(request: Request) {
  const countryId = new URL(request.url).searchParams.get('countryId');
  if (!countryId) return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'countryId is required' } }, { status: 400 });
  try { return Response.json(await listStates(countryId)); } catch (error) { return jsonError(error); }
}
