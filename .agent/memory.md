# Logistics Platform — Active Workspace Memory

## State

# Project Current Execution State
- **Current Phase:** Phase 13 NEXT — No further phases defined
- **Last Completed Task:** Phase 12 agent action approval queue and dual kill switch checks
- **Next Task:** Await the next scoped phase
- **Blocking Issues:** Database seed still awaits a real `DATABASE_URL`; `.env.example` documents the required value
- **Runtime:** Bun 1.3.14 Monorepo

## Quick Commands
- Dev Server: `bun run dev`
- Run Tests: `bun test`
- Typecheck: `bun run typecheck`
- Build: `bun run build`
- Database: `bun run --filter @logistics/core prisma:generate`

## Current Task / Next Steps
- [x] 0. Scaffold: Bun workspaces root + packages (`@logistics/shared`, `@logistics/core`) + apps (`@logistics/web`, `@logistics/agent-worker`, `@logistics/mobile`). Prisma schema defined in `packages/core/prisma/schema.prisma`. Capability matrix permissions defined in `packages/core/src/auth/permissions.ts`. Zod smoke tests passing (`bun test`), typecheck passing (`bun run typecheck`), build passing (`bun run build`).
- [ ] Phase 1: Database & Core Services — implemented shipment, quote, location, flag, notification, and audit services in `packages/core/src/services/`; added DTO mappers with public-field leak test and `prisma/seed.ts` (Nigeria locations, role fixtures, agent control). `bun test`, `bun run typecheck`, and `bun run build` pass. Database execution awaits `DATABASE_URL`.
- [ ] Phase 2: Auth & Permissions — started exhaustive capability-matrix test derived from `CAPABILITIES`; NextAuth providers remain to be configured.
- [x] Phase 2: Auth & Permissions — NextAuth Credentials and Google providers use JWT sessions; credential verification and OAuth user provisioning run through `packages/core`; capability matrix suite derives every role/capability assertion from `CAPABILITIES`.
- [ ] Phase 3: Core CRUD API-first — thin quote and shipment create/list/view/update/cancel routes added; database-backed flow awaits a configured database for integration verification.
- [x] Phase 4: Location Hierarchy — public country/state/city routes added; idempotent seed includes Nigeria, FCT, Lagos, Kano, and representative cities. Runtime persistence verification awaits a real database.
- [x] Phase 5: Agent Layer — internal shared-secret worker endpoint, role-filtered registry (PUBLIC excludes create), public web proxy, and regression tests added. AI provider configuration remains environment-dependent.
- [x] Phase 6: Driver Location — GPS route and agent manual tool both use `updateShipmentLocation()` with server-set source audit tags.
- [x] Phase 7: Notifications — central dispatch records email/SMS attempts (SMS opt-in only), shipment creation trigger, scoped list/read endpoints, and narrow notification DTOs added.
- [x] Phase 8: Flag/approval state machine — explicit pending-only transition guard, audit/notification effects, reason-required rejection schema, routes, and transition test added.
- [x] Phase 9: Hardening — typed error responses remain clean and public quote/chat mutation paths have a rate-limit guard with regression coverage. Shared rate-limit storage awaits multi-instance deployment.
- [x] Phase 10: Dashboard Analytics — role-scoped server aggregation service, six dedicated analytics endpoints, and a responsive dashboard overview for shipment/flag summaries added. Additional chart cards can consume the existing endpoints without duplicating aggregation.
- [x] Phase 11: Mobile (Expo) — credential mobile-token issuance/refresh, Bearer-token actor resolution, and SecureStore-backed mobile API client added. Google mobile exchange awaits Google provider verification configuration.
- [x] Phase 12: Human-in-the-loop + kill switch — AGENT chat mutations queue for review; Manager+ review endpoints re-check the original actor before execution; web and worker independently enforce the persisted agent stop status; status/control endpoints added.
