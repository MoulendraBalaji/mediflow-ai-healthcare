# Changelog

All notable changes to MediFlow are documented here. This build targets the
Product Space AI Agent Hackathon and is organised by delivery phase.

## [2.0.0] — 2026-10-26

### Phase 1 — Backend foundation and boot

- Added Zod-validated environment loading (`api/src/config/env.ts`) that runs
  before every other module, searches for `.env` upward from the working
  directory, and fails fast with field-level messages. `JWT_SECRET` must be at
  least 32 characters.
- Added a single Prisma client singleton, a Pino logger, and Pino HTTP request
  logging with request IDs.
- Added the shared HTTP layer: `{ data, meta? }` success envelope,
  `{ error: { code, message, details?, requestId } }` failure envelope, Zod body
  and query parsing, `HttpError` helpers, `asyncHandler`, `privateCache`, and
  `setNoStore`.
- Added the central error handler. It maps Zod, Multer, and Prisma errors to
  stable codes, never leaks driver internals, and logs only at 5xx.
- Added an audit helper and an `AuditLog` model so sensitive read/write actions
  are recorded.
- Rewrote `api/src/index.ts`: Helmet, compression, explicit credentialed CORS
  allowlist (wildcards rejected), global/auth/AI rate limits, 1 MB JSON limits,
  `/health` and `/api/health` with DB readiness, 404 before the error handler,
  graceful shutdown, and degraded boot when the database is unreachable.
- Added `TODO`-free structured logging and removed the old `authorize.ts`
  middleware.

### Phase 2 — Authentication and authorization

- Replaced Bearer-only auth with httpOnly cookies: `mf_access` (15 minutes) and
  `mf_refresh` (7 days), `SameSite=Lax`, `Secure` in production. Bearer tokens
  remain supported for API clients.
- Added `POST /api/auth/refresh` and `POST /api/auth/logout`. Registration and
  login set both cookies; logout clears them.
- Restricted self-registration to `PATIENT`. Doctor/admin self-registration now
  returns `403`.
- Added constant-time password comparison for unknown emails to reduce account
  enumeration, plus Zod validation for email, password, date of birth, and
  gender.
- Added `resolvePatientId` and `assertPatientAccess`:
  - Patients always resolve to their own token `patientId`; supplied values are
    ignored.
  - Doctors may access a patient only through an active `AccessGrant`, an
    appointment, or a non-deleted authored record.
  - Unauthorized patient access returns **404**, not 403.
  - Admins pass patient checks; role-gated admin and clinician routes use
    `requireRole`.
- Added `AccessGrant`, `AuditLog`, `Notification`, `UserPreference`,
  `EmergencyProfile`, and `MedicationDose` models.

### Phase 3 — Safe document intake

- Split intake into two operations:
  - `POST /api/medical-records/extract` validates, parses, and returns a draft
    with no database write.
  - `POST /api/medical-records` saves a reviewed record and its medications in
    one Prisma transaction using `createMany`.
  - `POST /api/medical-records/upload` is now a no-write alias for extract.
- Added magic-byte validation for PDF, JPEG, and PNG, plus conservative
  UTF-8 text detection. Declared MIME type alone is not trusted.
- Added a 10 MB, single-file Multer memory limit and safe filename handling.
- Added PDF text extraction, plain-text support, and Groq vision extraction for
  images.
- Added strict Zod validation of model output, per-field confidence, and
  `source: "document"`.
- Blank or image-only PDFs now return `needsOcr: true` instead of invented
  content (<40 non-whitespace characters).
- Model-required extraction with no key returns a structured `503`; it never
  substitutes sample clinical data.
- `DEMO_MODE` returns clearly labelled sample extraction and never reads the
  upload. It is off by default.
- Added soft delete (`deletedAt`) for records and filtered every read.
- Added record list pagination, medication active/inactive split, dashboard
  metrics with short private caching, and deterministic timeline preview flags.

### Phase 4 — AI layer and agent safety

- Rewrote the Groq client with timeouts, bounded retries, a circuit breaker, an
  LRU response cache (10-minute TTL), a concurrency cap (`p-limit`), fast/strong
  model routing, vision messages, and SSE support.
- Added explicit `AiUnavailableError` handling so missing keys and upstream
  failures degrade predictably.
- Rewrote all five agents:
  - **Intake** — deterministic parsing plus optional model extraction.
  - **Timeline** — deterministic chronology, active-medication overlap,
    duplicate flags, care gaps; optional narrative only.
  - **Navigator** — deterministic red-flag screening runs first. Urgency and
    recommendations are fixed by code; a model may only rewrite the explanation.
    "Chest pain, can't breathe" returns an emergency pathway without an LLM.
  - **Companion** — deterministic reminder derivation. The old adherence score
    is now `careEngagementScore` and is never described as measured adherence.
  - **Insight** — deterministic counts and risk signals, optional prose.
- Added mandatory disclaimers to navigator and insight responses.
- Added `AgentActivity` logging for every agent run, including failure and
  duration.
- Added an AI status endpoint that reports configured models and availability.

### Phase 5 — API surface

- Rewrote medical record, agent, activity, appointment, reminder, facility, and
  provider routes against the shared envelope and access middleware.
- Appointments now expose real offered slots (09:00–16:30), provider/facility
  resolution, `urgency`, reschedule, cancel, and status transitions.
- Reminders support list, create, generated suggestions, stats, acknowledge, and
  delete. No delivery channel is implied anywhere.
- Provider routes include the linked-patient panel, scoped pre-consultation
  summary, cached translation, prescription explanation, and provider-side
  navigation/insight.
- Analytics are cached for 60 seconds. Other read endpoints use 10–30 second
  private caches.
- Added `/api/agents/status` and `/api/health`.

### Phase 6 — Data, configuration, and deployment

- Rewrote `prisma/schema.prisma` with enums for roles, record types,
  appointment status, urgency, reminder types/status, agent names/status, and
  access scope; JSON columns; soft delete; composite indexes; and a
  nullable, non-unique `Patient.email`.
- Added the initial committed migration under `prisma/migrations/0001_init`.
- Rewrote `prisma/seed.ts` for the new schema: facilities, providers, patients,
  an admin, records and medications, appointments, reminders, an emergency
  profile, and an access grant. Demo password comes from `DEMO_PASSWORD`.
- Rewrote `.env.example` with documented safety, auth, AI, and CORS settings.
- Rewrote the root `Dockerfile` as a four-stage build (API build, app build, API
  production, standalone app production). The API container applies committed
  migrations before start.
- Rewrote `docker-compose.yml` (Postgres + API + app, health checks) and
  `docker-compose.dev.yml` (hot reload, migrate + seed).
- Updated root, API, and app scripts, including `typecheck` and Prisma schema
  flags.

### Phase 7 — Frontend defects and foundation

- Replaced Bearer/localStorage auth with cookie-only axios
  (`withCredentials: true`), a single-flight refresh retry, and typed envelope
  unwrapping (`ApiError`).
- Added TanStack Query, a typed API client covering every resource, and complete
  frontend contract types.
- Added `AuthProvider`, `usePatientScope`, role-aware home routing, and safe
  post-login redirects.
- Added `middleware.ts` that gates protected routes by cookie presence and
  redirects signed-in users away from auth pages. The API remains authoritative.
- Added `AppShell` in `_app.tsx`, mobile navigation, and role-specific nav.
- Added public, auth, and patient-scope-empty layouts; deleted the old
  `Layout.tsx`.
- Added `_document.tsx` with runtime Google Fonts links (no build-time font
  fetch) and `_error.tsx` / `404.tsx`.
- Rebuilt the frontend on a strict TypeScript config with the `@/*` alias.

### Phase 8 — Clinical Editorial UI rebuild

- Replaced the previous visual system with flat editorial tokens: warm paper
  `#F7F4EE`, ink `#191E25`, pine `#1E5A47`, clay/ochre/crimson accents,
  Fraunces + Instrument Sans + JetBrains Mono, hairline rules, and square-ish
  corners.
- Removed glass, blur, gradient, floating-orb, brand-gradient, hover-lift, and
  heavy-border patterns. Static checks find zero matches for the banned classes.
- Built UI primitives (`Button`, `Field`, `Alert`, `Layout`) and clinical
  components (`InsightPanel`, `AgentActivityLog`, `MedicationList`).
- Rebuilt all pages:
  - Landing, login, register, forgot password.
  - Dashboard, timeline, upload, appointments, navigator, reminders, facilities,
    translate.
  - Doctor portal, admin, privacy, terms, 404, error.
- Upload now follows extract → review (confidence, OCR warning, demo label) →
  save, with no write before confirmation.
- Appointments use API-returned slots and send `urgency`; the provider supplies
  the facility.
- Reminder and translation screens explicitly state that nothing is sent and
  nothing is saved to the chart.
- Admin analytics use accessible CSS bars instead of adding a chart dependency.

### Phase 9 — Documentation and verification

- Rewrote `README.md` for cookie auth, the extract/save split, the response
  envelope, authorization rules, safety posture, scripts, Docker, and the
  current page/API inventory.
- Added this changelog.
- Verified `npx tsc --noEmit` for both workspaces and a full `npm run build`
  (API `tsc` + Next production build, 17 static pages).
- Verified zero matches for the banned UI classes across `app/src`.

---

## Skipped or deferred

These items were intentionally not delivered in this build. None of them are
silently stubbed with fake data.

### Verification blocked by environment

- **Live database verification.** The configured PostgreSQL host was
  unreachable from the development environment (`P1001`). Migrations, seeding,
  and live endpoint checks could not be executed here. Verification was limited
  to TypeScript, the Next.js production build, and static review. Run
  `npm run db:migrate` and `npm run db:seed` against a reachable database before
  accepting the runtime checklist in the README.
- **No automated test suite.** No unit, integration, or end-to-end tests were
  added; the acceptance checks remain manual. This was not replaced with
  snapshot tests that would give false confidence.

### Product scope deliberately deferred

- **File storage.** Uploads are processed in memory and only metadata
  (`fileName`, `filePath`) is saved. No object storage, local upload directory,
  virus scanning, or download endpoint was added.
- **Scanned-PDF OCR.** Text-based PDFs are parsed; image-only PDFs return
  `needsOcr: true`. Image files use Groq vision when a key is configured. There
  is no local OCR fallback.
- **Password reset delivery.** `POST /api/auth/forgot-password` only
  acknowledges the request. No mail transport, reset token, or reset form was
  implemented.
- **Notifications and scheduling.** Reminders are database rows. No cron,
  queue, email, SMS, push, or browser notification delivery exists.
- **Access-grant management.** `AccessGrant.scope` is modelled but not enforced
  per action, and there is no patient-facing grant management UI. Clinician
  access is relationship-based.
- **Staff provisioning.** Self-registration is patient-only. There is no admin
  UI or API to create doctors/admins; they are created by the seed or directly
  in the database.
- **Audit viewer.** Audit rows are written, but there is no audit-log API or UI.
- **OpenAPI schema.** The API is documented in the README only; no generated
  OpenAPI/Swagger document is shipped.
- **Internationalisation.** Translation is on demand only. The interface itself
  is English; no i18n framework or locale switcher was added.
- **Charts.** `recharts` was not added. Admin analytics use accessible CSS bars.
- **Distributed rate limiting / cache.** Rate limits and the LLM cache are
  in-process. A multi-instance deployment needs a shared store.
- **Streaming UI.** The Groq client supports SSE, but no frontend screen consumes
  a stream yet.
- **Production hardening.** No WAF, secret manager integration, backup policy,
  HIPAA/GDPR certification, or clinical validation was performed. This remains
  demonstration software.

---

## Compatibility notes

- The API is ESM (`"type": "module"`); relative imports require `.js`.
- Prisma CLI commands must run from the repository root (or via the root
  scripts) because the schema lives at `prisma/schema.prisma`.
- `NEXT_PUBLIC_API_URL` is inlined at build time. Rebuild the app image when it
  changes.
- `Bearer` auth still works, but the web app never stores tokens in JavaScript.
