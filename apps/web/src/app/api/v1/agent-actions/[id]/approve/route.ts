import { approveAgentAction } from '@logistics/core';
import { jsonError } from '../../../../../../lib/api';
import { resolveActor } from '../../../../../../server/auth/resolve-actor';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { return Response.json(await approveAgentAction(await resolveActor(request), (await context.params).id)); } catch (error) { return jsonError(error); } }
