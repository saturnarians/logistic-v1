---
name: logistics-platform
description: Build/modify the logistics platform (Next.js web + Expo mobile, dashboard analytics, agent-worker service, human-in-the-loop approval, agent kill switch). Consult before any backend, schema, permissions, agent-tool, dashboard chart, mobile, or agent-control work.
---

# Logistics Platform — Agent Instructions

See `ARCHITECTURE_DIAGRAM.md` for visual diagrams (system context, request layering, auth flow, agent tool authorization, notification dispatch, ER diagram, state machines, monorepo layout, analytics data flow) — companion to this file, not a duplicate; this file has the tables/schema/rules, that file has the flow diagrams.

Stack: **Bun** (runtime + package manager + test runner — replaces Node/npm/pnpm/Jest across the whole project), Next.js 15 App Router, TS strict, Tailwind (mobile-first breakpoints), shadcn/ui, Recharts (charts), PostgreSQL, Prisma, Zod, NextAuth v5 (Google OAuth + Credentials), Zustand, TanStack Query, Vercel AI SDK (agentic tool-calling via `streamText`+`tools`), Resend, Twilio, Expo + React Native (mobile app). Dev OS: Fedora (`dnf`; install Bun via `curl -fsSL https://bun.sh/install | bash`, not via `dnf` — no Fedora package, official installer only). Monorepo: **Bun workspaces**, 3 apps + 2 shared packages — `apps/web` (Next.js, UI + REST ingress + NextAuth), `apps/agent-worker` (dedicated process running the Vercel AI SDK agent loop), `apps/mobile` (Expo); `packages/core` (services, DTOs, permissions, Prisma client — server-only, imported by `web` and `agent-worker`, never `mobile`), `packages/shared` (Zod schemas, types, client-safe API client — imported by all three).

Pages — 3 surfaces, each with multiple routes, not single pages:
- **`(auth)`**: `/login`, `/register` — Google OAuth + email/password, serves all 5 roles.
- **`(dashboard)`**: role-gated shell with multiple routes — overview (charts+tables), shipments list/detail, flags queue, drivers, users, agent chat, settings. Every dashboard page is responsive mobile-first (single column on small screens, multi-column/grid on desktop).
- **`(public)`**: `/track` (tracking-code entry → delivery details page: status, route, live location, ETA) and `/chat` (AI agent chat) — no login required to view/track/flag. Small "Staff Login" link routes to `/login`.

Mobile (Expo) is a separate app consuming the same REST API — not a webview wrapper. See "Mobile (Expo)" section below for auth/architecture differences from web.

## Dashboard analytics (overview page)

Mini + large charts, mixed with tables, per role — all via Recharts, all responsive (stack to 1-column on mobile, grid on desktop via Tailwind `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).

| Widget | Chart type | Size | Roles | Data |
|---|---|---|---|---|
| Shipments by status | Pie | mini | all | count grouped by `ShipmentStatus` |
| Shipment volume over time | Line | large | MANAGER+ | daily/weekly count, date-ranged |
| Deliveries per driver | Bar | large | MANAGER+ | count grouped by `driverId`, top N |
| Flags pending vs resolved | Pie | mini | MANAGER+ | count grouped by `FlagStatus` |
| Revenue over time | Line | large | ADMIN+ | sum `priceQuoted` by period |
| Shipments by destination state | Bar | mini | MANAGER+ | count grouped by `destinationCity.state` |
| Recent shipments | Table | — | all (scoped) | latest N, role-filtered same as list endpoint |
| Pending flags queue | Table | — | MANAGER+ | `status:PENDING`, sortable |
| Active drivers + current shipment | Table | — | MANAGER+ | joined `driver` + assigned `shipment` |
| My assigned shipments | Table | — | DRIVER | own only |

Rule: every chart/table above is a thin component consuming a TanStack Query hook hitting a dedicated `/api/v1/analytics/*` endpoint (server aggregates via Prisma `groupBy`/`aggregate`) — never fetch full shipment lists client-side and aggregate in the browser. Chart components take pre-aggregated DTOs as props; no business logic in chart components (SRP, same as every other UI piece).

## Rules (apply always, no exceptions)

1. Routes/actions/agent-tools = thin. All logic + Prisma in `packages/core/services/` — the one place both `apps/web` and `apps/agent-worker` import from.
2. Services never return Prisma entities across a boundary. Entity → mapper → DTO → response. Never `return prisma.x.findMany()` in a route.
3. `permissions.ts` capability object is sole authz source. Checked in services, not just middleware/agent registry.
4. Row-level scoping (driver sees own shipments) ≠ role capability. Both required, separate mechanisms.
5. No MCP. No WebSocket/SSE (poll via TanStack Query). No multi-role-per-user. No separate log tables per channel. No multi-tenant. No payments. Don't build until the specific trigger condition (below) occurs.
6. Cheapest-free-first: hosted free Postgres > local; Groq/OpenRouter free > paid inference; Vercel logs > paid observability. Upgrade only on hit limit.
7. No service imports Resend/Twilio directly — only `notifications/dispatch.ts`. Failed send never rolls back the triggering transaction.
8. Public/unauthenticated users: can get quote, track, flag (w/ contact verification). CANNOT create shipments — `shipment:create` excludes PUBLIC always. Booking is staff-mediated (Agent+ creates on customer's behalf).
9. Public agent-chat tool set: `getQuote`, `trackShipment`, `flagShipment` ONLY. `createShipment` must never appear in the Public tool registry entry.
10. DTOs are narrow per-consumer (public tracking DTO ≠ internal dashboard DTO) — do not collapse into one parameterized function with role-conditional fields.
11. TanStack Query = all server/DB data. Zustand = ephemeral UI-only state (modal open, active panel). Never put fetched entities in Zustand.
12. Zod `.strict()` on all input schemas (mass-assignment defense). `.safeParse()` in routes, never `.parse()`.
13. Same Zod schema + same service function backs: REST route, server action, agent tool — for any given operation. No divergent validation paths.
14. Error response shape always: `{ error: { code, message, details? } }`. Never leak stack traces or raw exceptions.
15. Money = `Decimal`, never `Float`.
16. Mobile-first: design every dashboard/public page at smallest breakpoint first, add `md:`/`lg:` overrides for larger screens — never the reverse.
17. Charts are presentation-only components; all aggregation happens server-side (Prisma `groupBy`/`aggregate` in `analytics.service.ts`), returned as ready-to-render DTOs. No client-side reduction of raw lists into chart data.
18. Mobile app (Expo) never runs a separate auth system — it authenticates through NextAuth itself (same `authorize()`/Google verification, JWT encoded/decoded via `next-auth/jwt` with the same secret and claims), transported as a Bearer token instead of a cookie, stored in Expo SecureStore. One `auth.config.ts`, two transports.
19. Any type/schema/validation logic needed by both web and mobile lives in `packages/shared`, imported by both — never copy-pasted into each app.
20. Bun everywhere: `bun install` (never `npm install`/`pnpm install`), `bun run <script>` / `bunx <tool>` for one-offs, `bun test` for unit+integration (Bun's built-in test runner — no separate Jest/Vitest config to maintain). Playwright still runs standalone for e2e (Bun doesn't drive browsers) but is invoked via `bunx playwright test`. Prisma CLI via `bunx prisma`.
21. `apps/agent-worker` is reachable ONLY from `apps/web` (internal network / shared secret header, never public internet) — `apps/web` remains the single authenticated ingress for both web and mobile clients; it resolves the actor, rate-limits, then forwards to agent-worker. Agent-worker tools still re-check `permissions.ts` themselves (defense in depth persists across the process boundary — the boundary moved, the discipline didn't).
22. AGENT-role bookings/updates/cancellations made *through the agent chat* queue for MANAGER+ approval before executing (`AgentAction`, `PENDING_APPROVAL`) — this is a safety net on natural-language interpretation, not a duplicate authorization check, so it never applies to MANAGER+ callers or to direct UI/API use. The kill switch (`AgentControl`) is a separate, coarser control — it stops the entire agent for everyone regardless of role, checked independently in both `apps/web` and `apps/agent-worker` so one broken check can't bring the agent back to life alone.

## YAGNI triggers (build only when condition hits)

| Deferred | Build when |
|---|---|
| MCP | External process boundary needed (3rd-party courier's own MCP server, or exposing tools to external AI client). Note: `apps/agent-worker` being its own process does NOT trigger this — its tools are plain functions calling `packages/core` directly over a trusted internal link, not a protocol-level integration with an external tool provider. Don't reach for MCP just because there's now a network hop. |
| WebSocket/SSE notifications | 30–60s poll latency is a reported real problem |
| Multi-role-per-user | Explicit product requirement emerges |
| Split notification tables | Provider-specific metadata actually diverges |
| Multi-tenant | Multiple operating companies onboard |
| Payments | Billing flow explicitly requested |
| Native push notifications (Expo push tokens) | In-app polling proves insufficient for drivers in practice — start with same polling pattern as web |
| Configurable per-tool approval rules (admin UI to toggle which tools require approval) | The fixed default (AGENT-tier create/update/cancel only) needs to change often enough in practice to justify a config surface — until then it's a hardcoded list in the tool files, not a settings table |

## Roles & capability matrix

Hierarchy: `PUBLIC < AGENT < DRIVER < MANAGER < ADMIN < SUPER_ADMIN` (Agent/Driver are peers with different capabilities, not ranked vs each other).

```typescript
export const CAPABILITIES = {
  'shipment:quote': ['PUBLIC','AGENT','MANAGER','ADMIN','SUPER_ADMIN'],
  'shipment:create': ['AGENT','MANAGER','ADMIN','SUPER_ADMIN'], // never PUBLIC
  'shipment:update': ['AGENT','MANAGER','ADMIN','SUPER_ADMIN'], // edit details (weight/destination/contact info) — never driver reassignment, that's a separate capability below
  'shipment:cancel': ['AGENT','MANAGER','ADMIN','SUPER_ADMIN'], // terminal state, requires reason, never PUBLIC
  'shipment:track': ['PUBLIC','AGENT','DRIVER','MANAGER','ADMIN','SUPER_ADMIN'], // DRIVER = own assigned only
  'shipment:flag': ['PUBLIC','AGENT','MANAGER','ADMIN','SUPER_ADMIN'], // PUBLIC requires contact verification
  'shipment:location:update': ['DRIVER','MANAGER','ADMIN','SUPER_ADMIN'], // DRIVER = own assigned only
  'shipment:view:all': ['MANAGER','ADMIN','SUPER_ADMIN'],
  'flag:approve': ['MANAGER','ADMIN','SUPER_ADMIN'],
  'flag:reject': ['MANAGER','ADMIN','SUPER_ADMIN'],
  'driver:reassign': ['MANAGER','ADMIN','SUPER_ADMIN'],
  'user:manage': ['ADMIN','SUPER_ADMIN'],
  'pricing:override': ['ADMIN','SUPER_ADMIN'],
  'admin:manage': ['SUPER_ADMIN'],
  'system:config': ['SUPER_ADMIN'],
  'agent:control': ['ADMIN','SUPER_ADMIN'], // stop/start the AI agent system-wide
  'agent:action:review': ['MANAGER','ADMIN','SUPER_ADMIN'], // approve/reject queued agent-initiated actions
} as const satisfies Record<string, readonly Role[]>;

export function can(actor: Actor, cap: keyof typeof CAPABILITIES): boolean {
  return CAPABILITIES[cap].includes(actor.role);
}
```

Public flag verification: unauth caller supplies `contactEmail` OR `contactPhone`; must exactly match (email case-insensitive) shipment's stored value. No contact on file → 404, public flag impossible (staff must flag instead). Mismatch → generic 403 (never reveal which field failed — brute-force defense). Logged-in Agent+ skip verification (session suffices).

## Public agent tool tiers

- **PUBLIC**: `getQuote`, `trackShipment`, `flagShipment` — none require approval (read-only or already downstream-gated by the flag lifecycle itself).
- **AGENT** (+ above): `createShipment`, `updateShipment`, `cancelShipment` (reason required) — **⚠️ require human approval when the calling actor's role is exactly `AGENT`** (see Human-in-the-loop section). Same tools called by MANAGER+ execute immediately — no self-approval loop needed, since Manager+ already holds review authority.
- **DRIVER**: `updateLocation` (own assigned), `viewAssignedShipments` — no approval (high-frequency, low-risk, already scoped to own shipments).
- **MANAGER** (+ Agent/Driver tools): `approveFlag`, `rejectFlag`, `reassignDriver`, `viewAllShipments` — no additional approval layer (Manager+ already is the approval authority elsewhere in the system).
- **ADMIN/SUPER_ADMIN** (+ above): `manageUsers`, `overridePricing`; SUPER_ADMIN adds `manageAdmins`, system config

Tool filtering happens in `apps/agent-worker/src/registry.ts`/`authorize.ts` before `streamText()` call — model never sees ungranted tools. This is UX/accuracy, NOT the security boundary; the `permissions.ts` (now in `packages/core`) check inside each tool/service is the real boundary, and it runs regardless of which process called it.

## Human-in-the-loop (agent action approval)

**Scope:** applies only to AI-agent-mediated mutations, specifically when the requesting actor's role is exactly `AGENT` calling `createShipment`/`updateShipment`/`cancelShipment`. Direct UI/API use by an Agent is unaffected — this gate exists specifically because natural-language intent can be misread by the model; it is not a general re-authorization layer and does not duplicate `permissions.ts`.

**Flow:** the tool does NOT call the service directly for a gated action. Instead:

1. Tool calls `agentActionService.submitForApproval({ toolName, input, actorId })` (in `packages/core`) — creates an `AgentAction` row, `status: PENDING_APPROVAL`.
2. Tool returns a result to the model like *"Submitted for staff review — reference {id}, you'll be notified once processed"* — never a fabricated success message.
3. `notificationService.notify('agent-action:pending')` fires an INTERNAL notification to MANAGER+ (same dispatch mechanism as everything else).
4. A Manager+ reviews the pending queue (`GET /api/v1/agent-actions`, dashboard page `agent-actions`), sees the proposed `toolName`+`input`, and calls approve or reject.
5. **Approve:** re-checks `can(originalActor, capability)` (in case the original actor's role/permissions changed since the request was queued — reject execution if so, don't silently use the reviewer's own permissions instead), re-validates `input` against the same Zod schema the tool would have used, calls the real `packages/core` service function with the **original requester's actor**, not the reviewer's — the action is attributed to whoever asked for it, the reviewer's identity is recorded separately in `reviewedById`. Sets `status: EXECUTED`, notifies the original requester.
6. **Reject:** requires a `reason` (same discipline as shipment cancellation). Sets `status: REJECTED`, notifies the original requester with the reason.

**Why re-check permission at approval time, not just at submission time:** the gap between submission and review could be hours; if the requester's role was demoted or account disabled in that window, approving on stale authority would be a real privilege-escalation path — treat it with the same seriousness as the mobile-token/agent-worker trust-boundary threats already in the threat table.

## Agent kill switch (system-wide stop/start)

A single `AgentControl` singleton row (`packages/core`) gates the entire AI agent, independent of any individual role/tool check — this is an operational safety control, not a capability.

- **Capability:** `agent:control` (ADMIN+ only — deliberately excludes MANAGER, this is an operational/infra-adjacent control, not a day-to-day management action).
- **Check point (defense in depth, both layers, not just one):** `apps/web`'s `/api/agent/chat` proxy checks `AgentControl.status` first — if `STOPPED`, returns a fixed "AI assistant is temporarily unavailable" response immediately, never forwards to `apps/agent-worker` at all (cheapest possible stop — no LLM call, no tool registry touched). `apps/agent-worker`'s `/internal/chat` ALSO checks the same flag independently before running `streamText()` — redundant on purpose, so a misconfigured/bypassed proxy still can't reach a live agent loop.
- **Endpoints:** `GET /api/v1/agent/status` (public — the chat UI needs this to show a banner/disable input) returns `{status}` only, no internals. `POST /api/v1/agent/control` (`agent:control`) takes `{action:'start'|'stop', reason?}`, updates the singleton row, audit-logs it, and fires an internal notification to other Admins/Super Admins (so a stop isn't silent).
- **This is a soft/logical stop, not a process kill** — `apps/agent-worker` keeps running as a deployed service; `STOPPED` just means it refuses to start new `streamText()` calls. Actually terminating/restarting the process itself is an infra concern (Vercel/hosting platform's own start/stop controls), out of scope for this app-level switch — don't conflate the two.
- **UI:** a toggle in dashboard settings (Admin+), with current status, who last changed it, when, and why — reusing `AuditLog`, not a separate history table.

## Folder structure (monorepo)

```
apps/
  web/                          # Next.js 15 — UI, REST ingress, NextAuth, thin routes/actions only
    src/
      app/
        (auth)/{login,register}/page.tsx
        (public)/{track,chat}/page.tsx
        (dashboard)/
          layout.tsx  page.tsx              # overview: charts+tables, see analytics section
          shipments/page.tsx  shipments/[trackingCode]/page.tsx
          flags/page.tsx  drivers/page.tsx  users/page.tsx  chat/page.tsx  settings/page.tsx
          agent-actions/page.tsx   # Manager+ pending approval queue
          settings/agent-control/page.tsx   # Admin+ start/stop toggle
        api/
          auth/[...nextauth]/route.ts
          mobile/auth/{login,google,refresh}/route.ts   # JWT issuance for Expo, see Mobile section
          v1/
            shipments/route.ts  shipments/[trackingCode]/{route,location/route,flag/route}.ts
            flags/[id]/{approve,reject}/route.ts
            quotes/route.ts  users/route.ts  drivers/route.ts
            notifications/route.ts
            locations/{countries,states,cities}/route.ts
            analytics/{shipments-by-status,volume,deliveries-per-driver,flags-summary,revenue,by-destination}/route.ts
            agent/{status,control}/route.ts
            agent-actions/route.ts  agent-actions/[id]/{approve,reject}/route.ts
          agent/chat/route.ts    # THIN: resolveActor + rate-limit, then proxies (streamed) to agent-worker — no agent logic lives here anymore
      server/                    # what's LEFT in apps/web after extraction: web-specific only
        actions/{shipment,flag}.actions.ts       # server actions still call packages/core services directly (same process, no need to hop through agent-worker)
        auth/{auth.config,guards,mobile-jwt}.ts  # NextAuth config lives here (needs Next.js request context); permissions.ts itself moved to packages/core (see below) since agent-worker needs it too
        agent-proxy/forward.ts   # the one function that streams a request to apps/agent-worker's internal endpoint and pipes the response back
      lib/errors/app-error.ts  lib/result.ts
      store/{ui,tracking}.store.ts
      hooks/{useShipments,useDrivers,useAgentChat,useNotifications,useAnalytics}.ts
      components/
        ui/                     # shadcn primitives
        charts/{PieCard,LineCard,BarCard}.tsx   # thin Recharts wrappers, DTO-in only
        shipment/  agent-chat/  notifications/  location/
      middleware.ts
  agent-worker/                  # NEW — dedicated process running the Vercel AI SDK agent loop
    src/
      index.ts                   # entry point: internal HTTP endpoint (e.g. POST /internal/chat), verifies the shared-secret header from apps/web before doing anything else
      tools/{createShipment,updateShipment,cancelShipment,getQuote,trackShipment,flagShipment,updateLocation,approveFlag,reassignDriver}.tool.ts
      # createShipment/updateShipment/cancelShipment check `actor.role === 'AGENT'` internally:
      #   if AGENT → call agentActionService.submitForApproval() instead of the real service (see Human-in-the-loop section)
      #   if MANAGER+ → call the real packages/core service directly, same as always
      registry.ts                # role → allowed tool names
      authorize.ts                # filters tool set before streamText() — same logic as before, just relocated
    package.json                 # own deploy unit; depends on packages/core + packages/shared
  mobile/                       # Expo app
    App.tsx
    app/                        # expo-router: (auth)/, (dashboard)/, (public)/ mirrors web routes conceptually
    src/
      screens/{Login,Track,ShipmentDetail,Dashboard,Chat,Settings}.tsx
      api/client.ts             # thin fetch wrapper, attaches Bearer token from SecureStore — calls apps/web, never agent-worker directly
      hooks/                    # same names/shapes as web hooks, same packages/shared schemas
      store/auth.store.ts       # Zustand — holds decoded token/actor, not the token itself
    app.json
packages/
  core/                         # SERVER-ONLY — imported by apps/web and apps/agent-worker, NEVER apps/mobile (contains Prisma/DB access, must never reach a client bundle)
    db.ts                       # Prisma client singleton — one client, both processes connect to the same Postgres
    services/{shipment,quote,location,flag,user,notification,audit,analytics,agentAction,agentControl}.service.ts
    dto/{shipment,quote,user,notification,analytics}.dto.ts  dto/mappers/{shipment,notification}.mapper.ts
    notifications/email/{resend.client.ts, templates/*.tsx}  notifications/sms/twilio.client.ts  notifications/dispatch.ts
    auth/permissions.ts          # ⭐ capability matrix — needed by both apps/web's guards AND agent-worker's tools, hence here not in apps/web
  shared/                       # CLIENT-SAFE — imported by all three apps, no server secrets
    schemas/{shipment,user,location,flag,notification}.schema.ts   # Zod, one source for web/mobile forms + API validation
    types/                      # inferred TS types from schemas
    api-client/                 # typed fetch functions, platform-agnostic (web hooks + mobile hooks + agent-worker's own outbound calls if any)
```

**Why the split:** `packages/core` exists because `permissions.ts` and every service function must be identical for whichever process calls them — duplicating them into `apps/agent-worker` would reintroduce exactly the two-implementations-drift risk the original service layer was built to prevent (DRY, DIP). `packages/shared` stays separate and stays client-safe on purpose: it's the one package `apps/mobile` is allowed to import, so nothing with DB credentials can ever accidentally end up in a mobile bundle.

Layering, updated for the split: `apps/web`'s `route.ts`/`*.actions.ts` and `apps/agent-worker`'s `*.tool.ts` are all still thin — none of them contain business logic. All of them call into `packages/core/services/*.ts` (logic + Prisma) → Postgres. The only new hop: `apps/web`'s agent chat route no longer runs the agent loop itself, it forwards (streamed) to `apps/agent-worker`, which runs the loop and calls `packages/core` directly — same layering principle, just spread across two processes instead of one. Mobile still only ever talks to `apps/web` — it has no direct line to `agent-worker` or the database.

## Prisma schema

```prisma
enum Role { PUBLIC AGENT DRIVER MANAGER ADMIN SUPER_ADMIN }
enum ShipmentStatus { PENDING ASSIGNED IN_TRANSIT DELIVERED CANCELLED SOFT_DELETED }
enum FlagStatus { PENDING APPROVED REJECTED }
enum LocationSource { GPS MANUAL }
enum NotificationChannel { EMAIL SMS INTERNAL }
enum NotificationStatus { PENDING SENT FAILED READ }
enum AgentStatus { RUNNING STOPPED }
enum AgentActionStatus { PENDING_APPROVAL APPROVED REJECTED EXECUTED FAILED }

model User {
  id String @id @default(cuid())
  email String @unique
  passwordHash String? // null if OAuth-only
  role Role
  name String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  accounts Account[]
  sessions Session[]
  shipmentsCreated Shipment[] @relation("CreatedBy")
  shipmentsAsDriver Shipment[] @relation("AssignedDriver")
  shipmentsCancelled Shipment[] @relation("CancelledBy")
  flagsRaised Flag[] @relation("FlagRaisedBy")
  flagsResolved Flag[] @relation("FlagResolvedBy")
  auditLogs AuditLog[]
  notifications Notification[]
  agentActionsRequested AgentAction[] @relation("AgentActionActor")
  agentActionsReviewed AgentAction[] @relation("AgentActionReviewer")
  agentControlChanges AgentControl[]
  @@index([role])
}

model Account { // NextAuth
  id String @id @default(cuid())
  userId String
  type String
  provider String
  providerAccountId String
  refresh_token String? @db.Text
  access_token String? @db.Text
  expires_at Int?
  token_type String?
  scope String?
  id_token String? @db.Text
  session_state String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session { // NextAuth
  id String @id @default(cuid())
  sessionToken String @unique
  userId String
  expires DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Country {
  id String @id @default(cuid())
  name String @unique
  isoCode String @unique
  states State[]
}
model State {
  id String @id @default(cuid())
  name String
  countryId String
  country Country @relation(fields: [countryId], references: [id])
  cities City[]
  @@unique([countryId, name])
}
model City {
  id String @id @default(cuid())
  name String
  stateId String
  state State @relation(fields: [stateId], references: [id])
  shipmentsOrigin Shipment[] @relation("OriginCity")
  shipmentsDestination Shipment[] @relation("DestinationCity")
  @@unique([stateId, name])
  @@index([name])
}

model Shipment {
  id String @id @default(cuid())
  trackingCode String @unique @default(cuid()) // public-facing ID; never expose internal id
  status ShipmentStatus @default(PENDING)
  originCityId String
  originCity City @relation("OriginCity", fields: [originCityId], references: [id])
  destinationCityId String
  destinationCity City @relation("DestinationCity", fields: [destinationCityId], references: [id])
  weightKg Float
  priceQuoted Decimal @db.Decimal(10, 2)
  contactEmail String? // for public flag verification; optional
  contactPhone String?
  createdById String
  createdBy User @relation("CreatedBy", fields: [createdById], references: [id])
  driverId String?
  driver User? @relation("AssignedDriver", fields: [driverId], references: [id])
  cancelReason String? // required by service layer when status → CANCELLED, nullable in schema since most rows never cancel
  cancelledById String?
  cancelledBy User? @relation("CancelledBy", fields: [cancelledById], references: [id])
  cancelledAt DateTime?
  currentLat Float?
  currentLng Float?
  lastLocationAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  flags Flag[]
  auditLogs AuditLog[]
  notifications Notification[]
  @@index([status])
  @@index([driverId])
  @@index([createdById])
  @@index([trackingCode])
}

model Flag {
  id String @id @default(cuid())
  shipmentId String
  shipment Shipment @relation(fields: [shipmentId], references: [id])
  status FlagStatus @default(PENDING)
  reason String?
  raisedById String
  raisedBy User @relation("FlagRaisedBy", fields: [raisedById], references: [id])
  resolvedById String?
  resolvedBy User? @relation("FlagResolvedBy", fields: [resolvedById], references: [id])
  resolvedAt DateTime?
  createdAt DateTime @default(now())
  @@index([shipmentId, status]) // enforce max 1 PENDING flag/shipment via this index + transaction
}

model AuditLog {
  id String @id @default(cuid())
  actorId String
  actor User @relation(fields: [actorId], references: [id])
  shipmentId String?
  shipment Shipment? @relation(fields: [shipmentId], references: [id])
  action String
  source LocationSource?
  metadata Json?
  createdAt DateTime @default(now())
  @@index([actorId])
  @@index([shipmentId])
  @@index([createdAt])
}

model Notification {
  id String @id @default(cuid())
  userId String? // null = unauth recipient, email/SMS only, no bell
  user User? @relation(fields: [userId], references: [id])
  shipmentId String?
  shipment Shipment? @relation(fields: [shipmentId], references: [id])
  channel NotificationChannel
  status NotificationStatus @default(PENDING)
  event String // e.g. "shipment:created", "flag:approved" — matches AuditLog.action vocabulary
  title String
  body String
  sentAt DateTime?
  readAt DateTime?
  createdAt DateTime @default(now())
  @@index([userId, status])
  @@index([shipmentId])
}

model AgentControl { // singleton row — one fixed id, checked before every agent invocation
  id String @id @default("singleton")
  status AgentStatus @default(RUNNING)
  reason String?
  updatedById String?
  updatedBy User? @relation(fields: [updatedById], references: [id])
  updatedAt DateTime @updatedAt
}

model AgentAction {
  id String @id @default(cuid())
  actorId String? // who was chatting when the gated tool was called; null only if somehow PUBLIC reached a gated tool (shouldn't happen — gated tools require AGENT role)
  actor User? @relation("AgentActionActor", fields: [actorId], references: [id])
  toolName String // e.g. "createShipment" — must match a real registry tool name
  input Json // the validated Zod input the tool was about to execute with
  status AgentActionStatus @default(PENDING_APPROVAL)
  resultSummary String? // set on EXECUTED/FAILED — short human-readable outcome, not a raw stack trace
  requestedAt DateTime @default(now())
  reviewedById String?
  reviewedBy User? @relation("AgentActionReviewer", fields: [reviewedById], references: [id])
  reviewedAt DateTime?
  reviewReason String? // required for REJECTED, same discipline as shipment cancellation
  @@index([status])
  @@index([actorId])
}
```

Notes: soft-delete via `ShipmentStatus.SOFT_DELETED`, not `deletedAt`+middleware. `role` on `User` directly, no join table (single role/user in v1). One `Notification` table for all 3 channels (not split) — split only if provider metadata diverges. `AgentControl` uses a fixed singleton `id` rather than a settings key-value table — there is exactly one thing to toggle in v1; if more system-wide toggles appear later, revisit as a proper settings table (YAGNI — don't build the generic version for one flag).

## API contract (v1, base `/api/v1`)

All bodies are DTOs, validated with matching Zod schema, `.strict()`. Error shape always `{error:{code,message,details?}}`.

| Endpoint | Capability | Notes |
|---|---|---|
| `POST /quotes` | `shipment:quote` | Req: `{originCityId,destinationCityId,weightKg}`. Resp: `{...,estimatedPrice,currency:"NGN"}`. No DB write. |
| `POST /shipments` | `shipment:create` (never PUBLIC) | Req adds `priceQuoted`,`contactEmail?`,`contactPhone?`. Server re-quotes, `422` on price mismatch (anti-tamper). Resp id = `trackingCode`. |
| `GET /shipments/:trackingCode` | `shipment:track` (PUBLIC any code; DRIVER own only; MANAGER+ all) | Public response uses separate narrower mapper `toPublicTrackingDTO` — no driver name/price/user IDs. `404` unknown code, `403` driver not assigned. |
| `GET /shipments` | `shipment:view:all` (MANAGER+); DRIVER/AGENT get implicit `actor.id` scoping, not a capability check | Query: `status,driverId,page,pageSize(≤100)`. |
| `PATCH /shipments/:id` | `shipment:update` (AGENT+, general fields); driver reassign specifically = `driver:reassign` (MANAGER+ only) | Req: any of `{weightKg,destinationCityId,contactEmail,contactPhone}`; `driverId` field requires `driver:reassign` separately even for AGENT+ callers who have `shipment:update`. `409` illegal transition, `403` if AGENT attempts `driverId` change. |
| `POST /shipments/:id/cancel` | `shipment:cancel` (AGENT+, never PUBLIC) | Req: `{reason}` (required, min length enforced by Zod). Sets `status→CANCELLED`, `cancelledById`, `cancelledAt`. `409` if already `DELIVERED`/`CANCELLED`/`SOFT_DELETED` (terminal states can't be re-cancelled). Triggers notification to customer same as other status changes. |
| `POST /shipments/:id/location` | `shipment:location:update` | `source` always server-set `"GPS"`, never client-supplied. `429` rate-limited (Upstash). |
| `POST /shipments/:trackingCode/flag` | `shipment:flag` | Unauth: requires `contactEmail`/`contactPhone` match. `400` neither supplied, `403` mismatch (generic msg), `404` no contact on file, `409` pending flag exists. |
| `POST /flags/:id/approve` | `flag:approve` | Soft-deletes shipment same transaction. `409` if not PENDING. |
| `POST /flags/:id/reject` | `flag:reject` | `409` if not PENDING. |
| `GET /locations/{countries,states,cities}` | none (public reference data) | `staleTime: Infinity` client-side. |
| `GET /notifications` | any authenticated | Scoped to `actor.id`. Poll via TanStack (`refetchInterval` 30–60s). |
| `PATCH /notifications/:id` | owner only | `404` for both not-found and not-owned (no enumeration). |
| `GET /analytics/shipments-by-status` | any authenticated (row-scoped for AGENT/DRIVER) | Resp: `{status,count}[]` — feeds Pie widget. |
| `GET /analytics/volume` | `shipment:view:all` | Query `from,to,interval(day\|week)`. Resp: `{period,count}[]` — feeds Line widget. |
| `GET /analytics/deliveries-per-driver` | `shipment:view:all` | Resp: `{driverId,driverName,count}[]` — feeds Bar widget. |
| `GET /analytics/flags-summary` | `flag:approve` | Resp: `{status,count}[]`. |
| `GET /analytics/revenue` | `pricing:override` | Query `from,to,interval`. Resp: `{period,total}[]` — Decimal as string. |
| `GET /analytics/by-destination` | `shipment:view:all` | Resp: `{state,count}[]`. |
| `POST /agent/chat` (apps/web, public-facing) | none extra — `resolveActor()` + rate limit at this layer | Client never specifies tools — resolved server-side from role. Checks `AgentControl.status` FIRST — if `STOPPED`, returns the fixed unavailable message immediately, never forwards. Otherwise resolves the actor, checks the public-mutation rate limit, then streams a forwarded request to `apps/agent-worker`'s internal endpoint, piping the streamed response straight back to the caller. |
| `GET /agent/status` | none (public) | Resp: `{status:'RUNNING'\|'STOPPED'}`. Chat UI polls/checks this to disable input and show a banner when stopped. |
| `POST /agent/control` | `agent:control` (ADMIN+) | Req: `{action:'start'\|'stop', reason?}`. Updates `AgentControl` singleton, audit-logs, notifies other Admins/Super Admins. |
| `GET /agent-actions` | `agent:action:review` (MANAGER+) | Query `status` (defaults `PENDING_APPROVAL`), `page,pageSize`. Resp: pending/reviewed agent-initiated actions awaiting or having received human review. |
| `POST /agent-actions/:id/approve` | `agent:action:review` (MANAGER+) | Re-checks `can(originalActor, capability)` before executing — `409` if original actor no longer holds the capability (role changed since request was queued). Executes with the **original requester's actor**, not the reviewer's. Sets `EXECUTED`/`FAILED`. |
| `POST /agent-actions/:id/reject` | `agent:action:review` (MANAGER+) | Req: `{reason}` (required). Sets `REJECTED`, notifies original requester. |
| `POST /internal/chat` (apps/agent-worker, NOT public) | shared-secret header required (`X-Internal-Auth` or equivalent); reachable only from `apps/web`'s network/deploy context | Also checks `AgentControl.status` independently (redundant with the `apps/web` proxy's check, on purpose — defense in depth). Req: `{messages, actor}` — `actor` is passed through from `apps/web`'s already-resolved session/JWT, agent-worker does not re-authenticate the end user, it trusts the internal caller's identity assertion (this is why the shared-secret + network isolation matters — if that boundary is ever weak, an attacker could forge `actor.role`). Resolves tools via `registry.ts`, calls `streamText()`; gated tools (`createShipment`/`updateShipment`/`cancelShipment` when `actor.role === 'AGENT'`) call `agentActionService.submitForApproval()` instead of the real service — see Human-in-the-loop section. |
| `POST /mobile/auth/login` | none (issues token) | Req: `{email,password}`. Runs the same NextAuth Credentials `authorize()`, then `encode()`s a JWT (from `next-auth/jwt`) with identical claims/secret as the web session. Resp: `{accessToken,expiresIn}`. |
| `POST /mobile/auth/google` | none (issues token) | Req: `{idToken}` (from Expo `AuthSession`). Verified through NextAuth's own Google provider path, then same `encode()` as above. |
| `POST /mobile/auth/refresh` | valid (not-yet-expired) access token | Re-`encode()`s a fresh token via the same NextAuth JWT config before expiry — not a separate refresh-token system. |

## Mobile (Expo)

Native app via Expo, consuming the same `apps/web` REST API — no separate backend, no duplicated business logic, **full dashboard parity with web from v1** (all roles, all analytics widgets, all tables — not a Driver-only subset).

- **One auth system, two transports.** Mobile does NOT run a separate custom auth stack — it uses NextAuth itself. Cookies don't survive reliably across Expo app restarts, so mobile exchanges credentials via a thin route that calls the *same* NextAuth `authorize()` (Credentials provider) or Google ID-token verification NextAuth already does, then returns the session as a signed JWT using `next-auth/jwt`'s `encode()` — the same secret, same claims shape, same role embedding as the web session's JWT. Verifying a mobile Bearer token server-side uses `decode()`/`getToken()` from the same package. Net effect: one auth config (`auth.config.ts`) is the source of truth for both platforms; mobile is a client of it, not a second implementation.
- Access token short-lived (e.g. 15min); refresh handled by re-encoding a fresh token via the same NextAuth JWT callback before expiry, not a bespoke refresh-token system. Store in Expo `SecureStore`, never `AsyncStorage`.
- Google sign-in on mobile: Expo native `AuthSession`/Google flow gets an ID token, exchanged server-side at `/api/mobile/auth/google`, which runs the token through NextAuth's own Google provider verification path before issuing the JWT — same trust boundary as web OAuth, not a parallel one.
- Full dashboard parity: same 6 chart types + 4 tables as web (see Dashboard analytics section), rendered with a native chart lib (`victory-native` or `react-native-svg-charts` — Recharts is DOM/web-only) consuming the *same* `/api/v1/analytics/*` endpoints and DTOs. One aggregation source, two renderers — same principle as shared Zod schemas.
- `Actor{id,role}` resolution: one `resolveActor(request)` helper checks session cookie first, falls back to `Authorization: Bearer` JWT (decoded via the shared NextAuth JWT config) — every existing service/route/guard works unmodified regardless of which platform called it.
- Shared Zod schemas (`packages/shared/schemas`) validate forms identically on both platforms — one schema, two renderers, same rule as auth.
- **Bun caveat:** `bun install` manages dependencies for `apps/mobile` same as the rest of the monorepo, but Expo's own CLI/Metro bundler processes are still invoked through `bunx expo <cmd>` — if any Expo tooling command misbehaves under Bun specifically, that's the one place in this stack where falling back to `npx expo <cmd>` for that single command is acceptable (isolated tooling quirk, not a reason to abandon Bun project-wide).

## Notification dispatch

One entry point: `notificationService.notify(event)` called by services after DB commit → `dispatch.ts` decides fan-out (email if `contactEmail`, SMS if `contactPhone` + opt-in, internal row if staff role relevant). SMS off by default (cost). Failed send → `status:FAILED`, never rolls back triggering transaction. Retry/alerting = hardening phase, not blocker.

## Phases (build in order, each has exit criterion)

0. Scaffold: install Bun (Fedora: official installer, not `dnf`), Bun workspaces root `package.json` with `workspaces: ["apps/*","packages/*"]`. `bunx create-next-app` for `apps/web` + TS strict, Tailwind+shadcn init via `bunx shadcn@latest init`. `packages/core` and `packages/shared` scaffolded as plain TS packages (no framework) with their own minimal `package.json`. `apps/agent-worker` scaffolded as a bare Bun HTTP server (e.g. `Bun.serve`) — empty shell for now, real logic added in Phase 5. `apps/mobile` scaffolded via `bunx create-expo-app`. Prisma lives in `packages/core`, connected via `bunx prisma` (hosted free Postgres). Zod smoke test via `bun test`. lint/tsc/husky pre-commit. Root script to run `apps/web` + `apps/agent-worker` concurrently in dev (Bun workspace filter scripts, e.g. `bun run --filter apps/web dev` alongside `bun run --filter apps/agent-worker dev`). Exit: clean `bun run build` + `bun run typecheck` + CI across all 3 apps + 2 packages, using Bun end to end (no stray `npm`/`npx` in any script).
1. Schema+DTO: full schema, mappers, poisoned-entity unit test per mapper (assert sensitive fields never leak) written FIRST. Exit: mapper suite green.
2. Auth+permissions: NextAuth (Google+Credentials), `permissions.ts`, `guards.ts`. Exhaustive capability-matrix unit test FIRST (100% branch coverage). Exit: test suite green, both login methods produce correct-role session.
3. Core CRUD API-first: write `api-spec` entry before route. Services → routes → TanStack hooks → Zustand UI state. Covers create, update (`shipment:update`, AGENT+), cancel (`shipment:cancel`, AGENT+, reason required, explicit transition function — same pattern as Phase 8's flag transitions, don't reinvent it twice), list, view. Integration test every role×endpoint, including AGENT successfully updating/cancelling and PUBLIC/DRIVER rejected on both. Exit: full create/update/cancel/list/view via real UI+DB.
4. Location hierarchy: seed Nigeria (states+FCT+cities). Cascading endpoints. Exit: shipment form persists FK city refs, not free text.
5. Agent layer, split across two apps: build `apps/agent-worker`'s `/internal/chat` endpoint (shared-secret check first, then registry/authorize/streamText, tools importing `packages/core` directly) — PUBLIC tier first (`getQuote,trackShipment,flagShipment`, no `createShipment`), then AGENT tier adds `createShipment,updateShipment,cancelShipment`. Then build `apps/web`'s `/api/agent/chat` as a thin proxy: resolve actor, rate-limit, forward+stream to agent-worker. Test: assert PUBLIC tool list excludes `createShipment`. Test: a request to agent-worker's `/internal/chat` without the shared-secret header is rejected outright, before any tool/model logic runs. Exit: public chat (via the full `apps/web` → `apps/agent-worker` hop) completes quote→track→flag; creation attempt as PUBLIC has no tool available (test-verified); direct requests to agent-worker bypassing apps/web are rejected.
6. Driver location: single `updateShipmentLocation()` service, GPS endpoint (rate-limited) + manual agent tool converge on it, `source` tagged, audit logged. Exit: identical AuditLog shape both paths; test rejects unassigned driver.
7. Notifications: `dispatch.ts`, Resend templates, Twilio (opt-in), notifications endpoints+hook+bell. Test: contact-email-only shipment → exactly 1 email attempt, 0 SMS. Test: cross-user mark-read → 404. Exit: shipment creation triggers correct notification set per contact-info combination.
8. Flag/approval state machine: explicit transition function, not booleans. Test: illegal transitions rejected at service layer. Test: public flag verification full matrix (email match/phone match/mismatch-generic-403/no-contact-404). Exit: full lifecycle test incl. notification firing.
9. Hardening: rate limits all public mutation endpoints, typed `AppError`→clean JSON errors (no stack traces), CI gate order (`bun run lint`→`bun run typecheck`→`bun test` [unit]→`bun test` [integration]→`bun run build`), `bunx playwright test` happy-path per role, security pass vs threat table below. Exit: CI green on clean clone; malformed/malicious payloads → clean 400 never 500.
10. Dashboard analytics: `analytics.service.ts` (Prisma `groupBy`/`aggregate`), 6 endpoints above, chart components (`PieCard`/`LineCard`/`BarCard`, thin/DTO-in), overview page assembling widgets per role, mobile-first responsive grid. Test: each analytics endpoint returns correctly-shaped aggregate for a seeded dataset, role-scoping applied (Agent sees own-created only, Manager+ sees all). Exit: overview page renders correct widget set per role, verified responsive at mobile/tablet/desktop breakpoints.
11. Mobile (Expo): `packages/shared` extraction (move Zod schemas out of `apps/web` into shared, update web imports — no logic change, pure relocation), `/api/mobile/auth/*` routes wrapping existing NextAuth `authorize()`/Google verification with JWT `encode()`, `resolveActor()` dual-transport path (cookie or Bearer, same NextAuth JWT decode), Expo app scaffold with full route parity to web dashboard (overview+charts, shipments, flags, drivers, users, chat, settings — gated by the same capability matrix), native chart components (`victory-native`) consuming the same `/api/v1/analytics/*` endpoints, SecureStore token handling. Test: `resolveActor()` resolves an identical `Actor` from a session cookie and from a valid Bearer JWT; expired/invalid JWT rejected same as expired session; each role sees the same widget/table set on mobile as on web (assert against the Dashboard analytics table). Exit: any of the 5 roles can log in on Expo (Google or credentials) and see full dashboard parity with web, including working charts; a Driver's GPS update from mobile lands in the same `AuditLog`/`Shipment` rows the web app would produce.
12. Human-in-the-loop + kill switch: `AgentControl`/`AgentAction` models, `agentControl.service.ts`/`agentAction.service.ts` in `packages/core`, `/api/v1/agent/{status,control}` + `/api/v1/agent-actions/*` endpoints, gated-tool branching in `createShipment`/`updateShipment`/`cancelShipment` tools (AGENT role → queue; MANAGER+ → direct), dual kill-switch check (both `apps/web` proxy and `apps/agent-worker`'s own endpoint), dashboard `agent-actions` queue page (Manager+) and `settings/agent-control` toggle (Admin+), mobile parity for both. Test: an AGENT-role chat request to create a shipment produces a `PENDING_APPROVAL` row and does NOT create a real `Shipment` row until approved. Test: approval re-checks the original actor's current permission and rejects (409) if it changed since submission. Test: setting `AgentControl.status = STOPPED` causes both `apps/web`'s proxy AND a direct (test-only) call to `apps/agent-worker`'s internal endpoint to refuse, independently of each other. Exit: full loop verified — Agent requests a booking via chat → Manager sees it queued → approves → real shipment exists, attributed to the original Agent, notification sent; separately, an Admin can stop the agent and every chat entry point (web + mobile) immediately reflects "unavailable" with no LLM call made.

Rule: check YAGNI table before adding anything not in a phase's own exit criterion.

## Threat table (verify in phase 9, design for throughout)

| Threat | Mitigation |
|---|---|
| Role escalation via API | `permissions.ts` check inside every service, independent of route/middleware |
| Role escalation via agent | Tool filtered at registry (model never sees it) + service-layer capability check as backstop |
| IDOR (driver views others' shipment) | Row-level `actor.id` scoping in service, separate from capability check |
| Sensitive field leak | DTO mapper layer only; poisoned-entity test per mapper |
| Price tampering | Server re-quotes & compares before persist (`422` on mismatch) |
| Fake GPS provenance | `source` always server-set, never client-supplied |
| Double-flag race | Composite index + transaction check pre-insert |
| Illegal state transition | Explicit transition-table function, not booleans |
| Public mutation abuse (quote/flag spam) | Rate limit per-IP/user via Upstash |
| Credential stuffing | bcrypt/argon2 (cost≥12), generic login error (no email-exists hint) |
| OAuth misconfig | Callback URLs locked to exact prod/dev origins in Google Console |
| Stack trace leak | Typed `AppError` → shared handler → clean shape; raw exceptions server-log only |
| SQL injection | N/A — Prisma parameterizes; never `$queryRawUnsafe` with interpolation |
| Mass assignment | Zod `.strict()`/`.pick()` on every input schema; never spread raw body into Prisma `data:` |
| Agent escalating via update endpoint (sneaking a `driverId` change into a general `shipment:update` call) | `driverId` checked as a separate field-level capability (`driver:reassign`, MANAGER+) inside the same service function, independent of the general `shipment:update` check — Zod schema also `.strict()`s so an AGENT-authored body can't even shape-match if `driverId` is present without the extra permission check catching it |
| Forged `actor.role` in the internal `apps/web → apps/agent-worker` call (agent-worker trusts the caller's identity assertion instead of re-authenticating) | `agent-worker`'s `/internal/chat` endpoint only reachable via internal network/deploy config, never a public route; shared-secret header required and checked before the request body is even parsed; if the secret or network isolation is ever misconfigured, this is a full role-escalation path — treat this boundary with the same seriousness as a public auth endpoint, not as "internal, so it's fine" |
| Agent-worker becoming a second, drifted implementation of business logic | It imports `packages/core` directly rather than reimplementing services — there is exactly one `shipment.service.ts`, one `permissions.ts`, used by both processes; a test that imports the same service module from both an `apps/web` test and an `apps/agent-worker` test would catch accidental forking if one ever got copy-pasted instead of imported |
| Contact-info brute force via flag endpoint | Generic 403 (never reveals which field failed); same rate limit as other public mutations |
| SMS cost abuse | Opt-in only, never default-on |
| Notification enumeration | Mark-read returns 404 for both not-found and not-owned |
| Mobile token theft (JWT stolen from device) | Short-lived access token (~15min); SecureStore only, never AsyncStorage; re-encoded (not indefinitely reused) before each expiry via the same NextAuth JWT config, limiting replay window |
| Mobile auth divergence from web (two auth implementations drifting apart) | Mobile has no separate auth implementation — same NextAuth `authorize()`/Google verification/JWT config, only the transport (Bearer vs cookie) differs; `resolveActor()` tested against both paths identically |
| Stale-permission approval (original requester's role was demoted/revoked between submission and review, but the reviewer approves anyway on old authority) | `can(originalActor, capability)` re-checked at approval time, not just at submission time — `409` if it no longer holds, never silently substitutes the reviewer's own permissions |
| Reviewer approving their own agent-initiated request | Doesn't structurally arise in v1 — gated tools only queue when `actor.role === 'AGENT'`, and `agent:action:review` starts at MANAGER, a different (senior) role; if this ever changes, add an explicit `reviewedById !== actorId` check before it does |
| Kill switch bypassed via a misconfigured/removed proxy check | `AgentControl.status` checked independently in BOTH `apps/web`'s proxy and `apps/agent-worker`'s own internal endpoint — a broken/bypassed check in one layer doesn't make the agent live again on its own |
| Silent agent shutdown (Admin stops it, nobody else notices) | Every stop/start is audit-logged and triggers an internal notification to other Admins/Super Admins — never a silent flag flip |

## Anti-drift pattern

Where the same fact must exist in two places (capability matrix vs its tests; Zod schema vs OpenAPI shape), write a test that derives one from the other — never hand-maintain two lists and trust they match.
