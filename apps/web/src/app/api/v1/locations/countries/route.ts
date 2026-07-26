import { listCountries } from '@logistics/core';
import { jsonError } from '../../../../../lib/api';

export async function GET() {
  try { return Response.json(await listCountries()); } catch (error) { return jsonError(error); }
}
