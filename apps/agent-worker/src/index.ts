const INTERNAL_SECRET = process.env.INTERNAL_AGENT_SECRET || 'dev-internal-secret';
import { authorizedToolNames } from './authorize';
import { tools } from './tools';
import { agentStatus, type Actor } from '@logistics/core';

function error(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function handleRequest(req: Request) {
    const url = new URL(req.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'agent-worker' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/internal/chat') {
      const authHeader = req.headers.get('X-Internal-Auth');
      if (authHeader !== INTERNAL_SECRET) {
      return error('UNAUTHORIZED', 'Invalid internal secret', 401);
      }
      if ((await agentStatus()).status === 'STOPPED') return error('AGENT_STOPPED', 'AI assistant is temporarily unavailable', 503);
      const body = await req.json().catch(() => null) as { actor?: Actor; messages?: unknown } | null;
      if (!body?.actor || !Array.isArray(body.messages)) return error('VALIDATION_ERROR', 'Invalid chat request', 400);
      // The model receives only these pre-filtered names; services re-check authorization on execution.
      if (!process.env.OPENAI_API_KEY) return error('AGENT_UNAVAILABLE', 'Agent model is not configured', 503);
      try {
        const { streamText } = await import('ai');
        const { openai } = await import('@ai-sdk/openai');
        const actor = body.actor;
        const selectedTools = Object.fromEntries(authorizedToolNames(actor).flatMap(name => {
          const execute = tools[name];
          return execute ? [[name, {
            description: name,
            inputSchema: { type: 'object', properties: {}, additionalProperties: true },
            execute: (input: unknown) => execute(actor, input),
          }]] : [];
        }));
        const stream = streamText as (options: unknown) => { toTextStreamResponse(): Response };
        return stream({ model: openai('gpt-4o-mini'), messages: body.messages, tools: selectedTools }).toTextStreamResponse();
      } catch {
        return error('AGENT_UNAVAILABLE', 'AI assistant is temporarily unavailable', 503);
      }
    }

    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Route not found' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
}

export function createServer(port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000) {
  return Bun.serve({ port, fetch: handleRequest });
}

if (import.meta.main) {
  const server = createServer();
  console.log(`[agent-worker] Server listening on port ${server.port}`);
}
