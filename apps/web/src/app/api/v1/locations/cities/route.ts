import { listCities } from '@logistics/core';
import { jsonError } from '../../../../../lib/api';

export async function GET(request: Request) {
  const stateId = new URL(request.url).searchParams.get('stateId');
  if (!stateId) return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'stateId is required' } }, { status: 400 });
  try { return Response.json(await listCities(stateId)); } catch (error) { return jsonError(error); }
}
