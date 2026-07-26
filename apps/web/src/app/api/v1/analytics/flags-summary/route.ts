import { flagsSummary } from '@logistics/core'; import { jsonError } from '../../../../../lib/api'; import { resolveActor } from '../../../../../server/auth/resolve-actor';
export async function GET() { try { return Response.json(await flagsSummary(await resolveActor())); } catch (error) { return jsonError(error); } }
