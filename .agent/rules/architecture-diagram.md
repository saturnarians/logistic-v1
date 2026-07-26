# Architecture Diagrams — Logistics Platform

Companion to `AGENT.md`. Renders in any Mermaid-compatible viewer (GitHub, GitLab, VS Code w/ Mermaid extension, most modern editors). Each diagram covers one concern in isolation — read alongside `AGENT.md` for the capability matrix, schema, and API contract these diagrams visualize.

---

## 1. System context

Who/what talks to the platform, at the highest level.

```mermaid
graph TB
    subgraph Clients
        WebBrowser["Web Browser<br/>(Next.js, Tailwind, shadcn/ui)"]
        ExpoApp["Expo Mobile App<br/>(iOS/Android, React Native)"]
    end

    subgraph Platform["Internal platform (Bun runtime, Bun workspaces)"]
        NextApp["apps/web — Next.js 15<br/>App Router, UI + REST ingress + NextAuth"]
        AgentWorker["apps/agent-worker<br/>dedicated agent-loop process<br/>internal-only, not public"]
        Core[("packages/core<br/>services, DTOs, permissions, Prisma<br/>imported by web + agent-worker")]
    end

    subgraph External["External Services (cheapest-free-first)"]
        Postgres[("PostgreSQL<br/>Neon/Supabase free tier")]
        Groq["Groq / OpenRouter<br/>(LLM inference, free tier)"]
        Resend["Resend<br/>(email)"]
        Twilio["Twilio<br/>(SMS)"]
        Google["Google OAuth"]
        Upstash[("Upstash Redis<br/>(rate limiting)")]
    end

    WebBrowser -- "HTTPS + session cookie" --> NextApp
    ExpoApp -- "HTTPS + Bearer JWT" --> NextApp
    NextApp -- "internal HTTP + shared secret<br/>(streamed proxy)" --> AgentWorker
    NextApp -- "imports directly" --> Core
    AgentWorker -- "imports directly" --> Core
    Core -- "Prisma" --> Postgres
    AgentWorker -- "Vercel AI SDK" --> Groq
    NextApp --> Resend
    NextApp --> Twilio
    NextApp -- "OAuth verify" --> Google
    NextApp -- "rate-limit check" --> Upstash
```

**Note:** `apps/agent-worker` has no public ingress of its own — every client (web or mobile) reaches it only by first going through `apps/web`, which resolves the actor and rate-limits before forwarding.

---

## 2. Request layering (every request, regardless of caller or process)

The core discipline: thin edges, one logic layer, one data layer. Applies identically whether the caller is a REST route (`apps/web`), a server action (`apps/web`), or an agent tool (`apps/agent-worker` — a different process, same rule).

```mermaid
graph LR
    subgraph WebProcess["apps/web process"]
        Route["app/api/v1/*/route.ts"]
        Action["server/actions/*.actions.ts"]
    end

    subgraph WorkerProcess["apps/agent-worker process"]
        Tool["tools/*.tool.ts"]
    end

    subgraph Validation
        Zod["Zod schema (.strict())<br/>packages/shared/schemas"]
    end

    subgraph Authz["Authorization (checked here, not just middleware/registry)"]
        Guard["guards.ts → requireCapability()<br/>(apps/web only)"]
        Perm["packages/core/auth/permissions.ts<br/>can(actor, capability)<br/>— imported by BOTH processes"]
    end

    subgraph Logic["packages/core/services/*.ts — sole business logic + Prisma access, imported by BOTH processes"]
        Service["e.g. shipment.service.ts"]
    end

    subgraph Output
        Mapper["packages/core/dto/mappers/*.mapper.ts<br/>entity → DTO"]
    end

    Route --> Zod
    Action --> Zod
    Tool --> Zod
    Zod --> Guard --> Perm
    Zod -.->|agent-worker skips guards.ts,<br/>calls Perm directly| Perm
    Perm --> Service
    Service -- "Prisma (packages/core/db.ts)" --> DB[("PostgreSQL<br/>ONE database, TWO processes connect to it")]
    Service --> Mapper --> Response["JSON response (apps/web) / tool result (apps/agent-worker)"]
```

**Rule visualized:** if any box under "Callers" starts writing a Prisma query directly, that's the violation this diagram exists to catch — this now applies across a process boundary, not just a file boundary, which is exactly why `permissions.ts` and the services moved into `packages/core` rather than staying private to `apps/web`.

---

## 3. Auth flow — one NextAuth config, two transports

```mermaid
sequenceDiagram
    participant Web as Web Browser
    participant Mobile as Expo App
    participant NA as NextAuth (auth.config.ts)
    participant JWT as next-auth/jwt (encode/decode)
    participant DB as Postgres (User/Account/Session)

    rect rgb(235,245,255)
    Note over Web,DB: Web login (cookie session)
    Web->>NA: POST /api/auth/callback/{google|credentials}
    NA->>DB: verify credentials / OAuth token
    DB-->>NA: User { id, role }
    NA->>Web: Set-Cookie: session (JWT inside, httpOnly)
    end

    rect rgb(255,245,235)
    Note over Mobile,DB: Mobile login (Bearer token)
    Mobile->>NA: POST /api/mobile/auth/{login|google}
    NA->>DB: same verify path (authorize() / Google provider)
    DB-->>NA: User { id, role }
    NA->>JWT: encode() — same secret, same claims shape as web
    JWT-->>Mobile: { accessToken, expiresIn }
    Mobile->>Mobile: store in Expo SecureStore
    end

    rect rgb(240,255,240)
    Note over Web,Mobile: Every subsequent request
    Web->>NextApp: request + session cookie
    Mobile->>NextApp: request + Authorization: Bearer <token>
    NextApp->>NextApp: resolveActor(request)<br/>tries cookie first, falls back to Bearer JWT decode
    NextApp->>NextApp: same Actor{id,role} either way → permissions.ts
    end
```

**Why one path, not two systems:** a bug fixed in `authorize()` or the Google verification logic is fixed for both platforms simultaneously — there's no second implementation to forget.

---

## 4. Role-scoped agent tool authorization (across the process split)

Three layers now, not two: the proxy boundary (`apps/web`'s internal-call authentication), registry filtering (what the model can even attempt), and the service-layer capability check (the actual security boundary — unchanged by the process split, just relocated to `packages/core`).

```mermaid
sequenceDiagram
    participant User
    participant WebProxy as apps/web: /api/agent/chat<br/>(thin proxy)
    participant Worker as apps/agent-worker: /internal/chat
    participant Registry as registry.ts (in agent-worker)
    participant Authorize as authorize.ts (in agent-worker)
    participant AISDK as Vercel AI SDK (streamText)
    participant ToolFile as tools/*.tool.ts (in agent-worker)
    participant Perm as packages/core/permissions.ts (can())
    participant Service as packages/core/services/*.ts

    User->>WebProxy: message (cookie or Bearer JWT)
    WebProxy->>WebProxy: resolveActor(request) → { id, role }
    WebProxy->>WebProxy: rate-limit check (Upstash)
    WebProxy->>Worker: POST /internal/chat<br/>{ messages, actor }<br/>+ X-Internal-Auth shared-secret header
    Worker->>Worker: verify shared-secret header FIRST<br/>— reject before touching body/model if missing/wrong
    Worker->>Registry: getToolsForRole(actor.role)
    Registry-->>Authorize: role's allowed tool names
    Authorize-->>Worker: filtered tools object<br/>(e.g. PUBLIC never receives createShipment)
    Worker->>AISDK: streamText({ tools: filteredTools, messages })
    AISDK->>ToolFile: model decides to call e.g. createShipment
    ToolFile->>Perm: can(actor, 'shipment:create')
    alt allowed
        Perm-->>ToolFile: true
        ToolFile->>Service: shipmentService.create(input, actor)
        Service-->>ToolFile: result
        ToolFile-->>AISDK: tool result
    else somehow reached anyway (defense in depth)
        Perm-->>ToolFile: false
        ToolFile-->>AISDK: 403 — never trust registry filtering alone,<br/>even across a process boundary
    end
    AISDK-->>Worker: streamed tokens
    Worker-->>WebProxy: streamed response
    WebProxy-->>User: streamed response (piped straight through)
```

**Public tier tools (v1):** `getQuote`, `trackShipment`, `flagShipment` only — `createShipment`/`updateShipment`/`cancelShipment` never appear in this branch's registry entry, by construction, not by convention.

**New failure mode introduced by the split (and its mitigation):** `agent-worker` trusts `apps/web`'s `actor` assertion instead of re-verifying the end user's session itself — that trust is only safe because `apps/agent-worker` has no public ingress and the shared-secret header is checked before anything else runs. If either of those two facts ever stops being true, this diagram's trust boundary breaks.

---

## 5. Human-in-the-loop — agent action approval

Applies only when a gated tool (`createShipment`/`updateShipment`/`cancelShipment`) is called by an actor whose role is exactly `AGENT`. MANAGER+ callers skip this entirely (see note below the diagram).

```mermaid
sequenceDiagram
    participant Model as LLM (via streamText)
    participant Tool as tools/createShipment.tool.ts
    participant AAService as agentActionService (packages/core)
    participant DB as Postgres (AgentAction)
    participant Notif as notificationService
    participant Manager as Manager+ (dashboard: agent-actions queue)
    participant RealService as shipmentService.create() (packages/core)

    Model->>Tool: call createShipment(input)
    Tool->>Tool: actor.role === 'AGENT'?
    alt AGENT — gated
        Tool->>AAService: submitForApproval({toolName, input, actorId})
        AAService->>DB: insert AgentAction (status: PENDING_APPROVAL)
        AAService->>Notif: notify('agent-action:pending') → INTERNAL, to MANAGER+
        AAService-->>Tool: { id }
        Tool-->>Model: "Submitted for staff review — ref {id}"
        Note over Model: Never fabricates a success result —<br/>the shipment does NOT exist yet
        Manager->>DB: GET /api/v1/agent-actions (status=PENDING_APPROVAL)
        Manager->>AAService: POST /agent-actions/:id/approve
        AAService->>AAService: can(originalActor, 'shipment:create')?
        alt still permitted
            AAService->>RealService: create(input, originalActor)
            RealService-->>AAService: real Shipment
            AAService->>DB: update AgentAction (status: EXECUTED)
            AAService->>Notif: notify original requester — approved
        else permission revoked since submission
            AAService->>DB: update AgentAction (status: FAILED)
            AAService-->>Manager: 409 — original actor no longer authorized
        end
    else MANAGER+ — not gated
        Tool->>RealService: create(input, actor)
        RealService-->>Tool: real Shipment (immediate, no queue)
    end
```

**Why MANAGER+ skips the queue:** this gate exists to catch natural-language misinterpretation risk specific to less-senior, customer-facing staff using the agent — it is not a second authorization check (that's `permissions.ts`'s job, unchanged). A Manager approving their own request would be a meaningless loop; the design avoids that by simply not queuing Manager+ actions in the first place, rather than adding a same-person-can't-approve rule to work around it.

---

## 6. Agent kill switch — dual independent check

```mermaid
flowchart TD
    Start(["Any chat message,<br/>web or mobile"]) --> WebProxy["apps/web: /api/agent/chat"]
    WebProxy --> CheckA{"AgentControl.status<br/>== STOPPED?"}
    CheckA -- yes --> RefuseA["Return fixed 'unavailable' message<br/>immediately — NO forward to agent-worker,<br/>NO LLM call made"]
    CheckA -- no --> Forward["Forward to apps/agent-worker<br/>/internal/chat + shared-secret header"]
    Forward --> Worker["apps/agent-worker"]
    Worker --> CheckB{"AgentControl.status<br/>== STOPPED?<br/>(checked AGAIN, independently)"}
    CheckB -- yes --> RefuseB["Reject — even if reached directly,<br/>bypassing apps/web somehow"]
    CheckB -- no --> Proceed["registry → authorize → streamText → tools"]

    Admin["Admin/Super Admin"] -->|"POST /agent/control<br/>{action:'stop', reason}"| Control["Update AgentControl singleton"]
    Control --> AuditLog[("AuditLog entry")]
    Control --> NotifyAdmins["Internal notification<br/>to other Admins/Super Admins<br/>— never a silent flip"]
```

**Why check twice:** a single check point means one misconfiguration (a proxy bug, a bypassed route, direct network access to agent-worker despite the intent that it stay internal-only) makes the "stopped" agent live again. Two independent checks mean both would have to fail simultaneously — a materially different, much less likely failure mode.

---

## 7. Notification dispatch — one seam, three channels

```mermaid
graph TB
    Event["Business event<br/>e.g. flag.service.ts approve()"]
    Notify["notificationService.notify(event)"]
    Dispatch["notifications/dispatch.ts<br/>(ONLY file that imports Resend/Twilio)"]

    Event -- "after DB transaction commits" --> Notify --> Dispatch

    Dispatch --> HasEmail{"contactEmail<br/>on file?"}
    HasEmail -- yes --> Resend["Resend API<br/>React Email template"]
    HasEmail -- no --> SkipEmail["skip"]

    Dispatch --> HasPhone{"contactPhone<br/>on file AND opted in?"}
    HasPhone -- yes --> Twilio["Twilio API<br/>SMS"]
    HasPhone -- no --> SkipSMS["skip (default off — cost)"]

    Dispatch --> IsStaffRelevant{"staff role should<br/>be notified?"}
    IsStaffRelevant -- yes --> InternalRow["Notification row<br/>channel: INTERNAL"]
    IsStaffRelevant -- no --> SkipInternal["skip"]

    Resend --> LogSent["status: SENT"]
    Resend -.->|failure| LogFailed["status: FAILED<br/>(never rolls back the business transaction)"]
    Twilio --> LogSent
    Twilio -.->|failure| LogFailed

    InternalRow --> Bell["Client bell icon<br/>polls GET /api/v1/notifications<br/>via TanStack Query (30-60s)"]
```

---

## 8. Data model (ER diagram)

```mermaid
erDiagram
    User ||--o{ Shipment : "creates (CreatedBy)"
    User ||--o{ Shipment : "drives (AssignedDriver)"
    User ||--o{ Shipment : "cancels (CancelledBy)"
    User ||--o{ Flag : "raises"
    User ||--o{ Flag : "resolves"
    User ||--o{ AuditLog : "acts"
    User ||--o{ Notification : "receives (nullable)"
    User ||--o{ Account : "OAuth link"
    User ||--o{ Session : "web session"
    User ||--o{ AgentAction : "requests (via chat)"
    User ||--o{ AgentAction : "reviews (approve/reject)"
    User ||--o{ AgentControl : "changes status"

    Country ||--o{ State : contains
    State ||--o{ City : contains
    City ||--o{ Shipment : "origin"
    City ||--o{ Shipment : "destination"

    Shipment ||--o{ Flag : "flagged"
    Shipment ||--o{ AuditLog : "logged"
    Shipment ||--o{ Notification : "triggers"

    User {
        string id PK
        string email UK
        string passwordHash "nullable, OAuth-only"
        Role role
        string name
    }
    Shipment {
        string id PK
        string trackingCode UK "public-facing, never expose id"
        ShipmentStatus status
        string originCityId FK
        string destinationCityId FK
        float weightKg
        decimal priceQuoted
        string contactEmail "nullable"
        string contactPhone "nullable"
        string driverId FK "nullable"
        string cancelReason "nullable"
        string cancelledById FK "nullable"
    }
    Flag {
        string id PK
        string shipmentId FK
        FlagStatus status
        string reason
    }
    Notification {
        string id PK
        string userId FK "nullable — unauth recipients"
        string shipmentId FK "nullable"
        NotificationChannel channel
        NotificationStatus status
    }
    AuditLog {
        string id PK
        string actorId FK
        string shipmentId FK "nullable"
        string action
        LocationSource source "nullable"
    }
    AgentAction {
        string id PK
        string actorId FK "who was chatting"
        string toolName "e.g. createShipment"
        json input
        AgentActionStatus status
        string reviewedById FK "nullable"
        string reviewReason "nullable, required if REJECTED"
    }
    AgentControl {
        string id PK "fixed 'singleton'"
        AgentStatus status
        string reason "nullable"
        string updatedById FK
    }
```

---

## 9. Shipment state machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: shipment:create (AGENT+)
    PENDING --> ASSIGNED: driver:reassign (MANAGER+)
    ASSIGNED --> IN_TRANSIT: location update (DRIVER)
    IN_TRANSIT --> DELIVERED: status update (MANAGER+)
    PENDING --> CANCELLED: shipment:cancel (AGENT+, reason required)
    ASSIGNED --> CANCELLED: shipment:cancel (AGENT+, reason required)
    IN_TRANSIT --> CANCELLED: shipment:cancel (AGENT+, reason required)
    PENDING --> SOFT_DELETED: flag:approve (MANAGER+)
    ASSIGNED --> SOFT_DELETED: flag:approve (MANAGER+)
    DELIVERED --> [*]
    CANCELLED --> [*]
    SOFT_DELETED --> [*]

    note right of CANCELLED
        Terminal. 409 if already
        DELIVERED/CANCELLED/SOFT_DELETED
    end note
    note right of SOFT_DELETED
        Terminal. Reached only via
        the Flag approval workflow,
        never directly.
    end note
```

---

## 10. Flag approval state machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: shipment:flag<br/>(PUBLIC w/ contact match, or AGENT+)
    PENDING --> APPROVED: flag:approve (MANAGER+)<br/>→ side effect: Shipment.status = SOFT_DELETED
    PENDING --> REJECTED: flag:reject (MANAGER+)
    APPROVED --> [*]
    REJECTED --> [*]

    note left of PENDING
        Composite index (shipmentId, status)
        enforces max 1 PENDING flag/shipment
        via transaction check pre-insert
    end note
```

---

## 11. Monorepo layout

```mermaid
graph TB
    Root["logistics-platform/ (Bun workspaces root)"]
    Root --> Web["apps/web<br/>Next.js 15, App Router<br/>UI + REST ingress + NextAuth"]
    Root --> Worker["apps/agent-worker<br/>Bun HTTP server<br/>internal-only, not public"]
    Root --> Mobile["apps/mobile<br/>Expo, React Native"]
    Root --> Core["packages/core<br/>SERVER-ONLY: services, DTOs,<br/>permissions.ts, Prisma client"]
    Root --> Shared["packages/shared<br/>CLIENT-SAFE: Zod schemas,<br/>types, API client"]

    Web -- "imports (business logic)" --> Core
    Worker -- "imports (business logic)" --> Core
    Web -.->|imports| Shared
    Worker -.->|imports| Shared
    Mobile -.->|imports| Shared
    Mobile -. "NEVER imports<br/>(no DB creds in mobile bundle)" .-x Core

    Web --> WebApp["app/ — 3 route groups:<br/>(auth) (dashboard) (public)<br/>+ /api/agent/chat (thin proxy)"]
    Web --> WebServer["server/ — actions, auth.config,<br/>guards, agent-proxy/forward.ts"]
    Web --> WebComponents["components/ — ui, charts, shipment, agent-chat"]

    Worker --> WorkerEntry["index.ts — POST /internal/chat<br/>verifies shared-secret header first"]
    Worker --> WorkerTools["tools/*.tool.ts, registry.ts, authorize.ts"]

    Mobile --> MobileScreens["src/screens/ — mirrors web route groups,<br/>full dashboard parity"]
    Mobile --> MobileApi["src/api/client.ts — Bearer token wrapper<br/>calls apps/web ONLY, never agent-worker"]
    Mobile --> MobileCharts["victory-native chart components<br/>consuming same analytics DTOs as web Recharts"]

    Core --> CoreDb["db.ts — ONE Prisma client,<br/>both apps/web and apps/agent-worker connect to same Postgres"]
    Core --> CoreServices["services/ — shipment, quote, location,<br/>flag, user, notification, audit, analytics,<br/>agentAction, agentControl"]
    Core --> CorePerm["auth/permissions.ts — ⭐ capability matrix,<br/>needed by both processes hence lives here"]

    Shared --> SharedSchemas["schemas/ — one Zod source"]
    Shared --> SharedClient["api-client/ — typed fetch fns,<br/>platform-agnostic"]
```

**Why `packages/core` is server-only and `packages/shared` isn't:** `packages/core` holds the Prisma client and DB credentials — if `apps/mobile` ever imported it, database credentials would ship inside a mobile app bundle. `packages/shared` deliberately contains nothing that isn't safe to ship to a client, which is what makes it the one package all three apps can import without a security review every time.

---

## 12. Dashboard analytics data flow

```mermaid
graph LR
    Prisma["Prisma groupBy/aggregate<br/>(analytics.service.ts)"]
    Endpoint["/api/v1/analytics/*<br/>(6 endpoints)"]
    DTO["Pre-aggregated DTO<br/>e.g. {status,count}[]"]
    Hook["useAnalytics.ts<br/>(TanStack Query)"]

    Prisma --> Endpoint --> DTO --> Hook

    Hook --> WebChart["Web: PieCard/LineCard/BarCard<br/>(Recharts, thin wrapper)"]
    Hook --> MobileChart["Mobile: victory-native<br/>(same DTO shape)"]

    WebChart --> WebUI["Dashboard overview page<br/>(responsive grid, mobile-first)"]
    MobileChart --> MobileUI["Expo dashboard screen<br/>(full parity with web)"]
```

**Rule visualized:** charts never receive raw Prisma rows — only the pre-aggregated DTO. No client-side reduction, on either platform.
