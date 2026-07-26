// @bun
// src/index.ts
var INTERNAL_SECRET = process.env.INTERNAL_AGENT_SECRET || "dev-internal-secret";
async function handleRequest(req) {
  const url = new URL(req.url);
  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ status: "ok", service: "agent-worker" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (url.pathname === "/internal/chat") {
    const authHeader = req.headers.get("X-Internal-Auth");
    if (authHeader !== INTERNAL_SECRET) {
      return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid internal secret" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ message: "Agent worker shell ready" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Route not found" } }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}
function createServer(port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000) {
  return Bun.serve({ port, fetch: handleRequest });
}
if (import.meta.main) {
  const server = createServer();
  console.log(`[agent-worker] Server listening on port ${server.port}`);
}
export {
  handleRequest,
  createServer
};
