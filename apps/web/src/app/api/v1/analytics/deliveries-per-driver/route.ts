import { deliveriesPerDriver } from '@logistics/core'; import { jsonError } from '../../../../../lib/api'; import { resolveActor } from '../../../../../server/auth/resolve-actor';
export async function GET() { try { return Response.json(await deliveriesPerDriver(await resolveActor())); } catch (error) { return jsonError(error); } }
