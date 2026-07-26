import { listAgentActions } from '@logistics/core';
import { jsonError } from '../../../../lib/api';
import { resolveActor } from '../../../../server/auth/resolve-actor';
export async function GET(request: Request) { try { return Response.json(await listAgentActions(await resolveActor(request))); } catch (error) { return jsonError(error); } }
