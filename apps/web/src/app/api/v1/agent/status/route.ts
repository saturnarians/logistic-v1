import { agentStatus } from '@logistics/core';
export const GET = async () => Response.json(await agentStatus());
