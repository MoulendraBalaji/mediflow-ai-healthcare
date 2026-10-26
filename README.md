<div align="center">

# MediFlow

### Clinical record, care navigation, and an AI layer that shows its work

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-green.svg)]()
[![AI](https://img.shields.io/badge/AI-Groq-orange.svg)]()
[![Hackathon](https://img.shields.io/badge/Hackathon-Product%20Space-purple.svg)]()

</div>

---

MediFlow is a healthcare navigation and care-coordination platform built for the **Product Space AI Agent Hackathon**. It turns an uploaded medical document into a reviewable record, puts that record on a timeline, and gives patients and clinicians a small set of purpose-built agents for intake, triage, reminders, and summaries.

The design is **Clinical Editorial**: warm paper, ink type, hairline rules, and no glassmorphism or decorative gradients.

> **Demonstration software, not a medical device.** MediFlow does not diagnose, prescribe, or replace a clinician. Every AI-assisted screen carries a disclaimer. If extraction or a model call fails, the UI says so instead of inventing clinical content.

---

## What it does

- **Document intake** — upload a PDF, image, or text file; extract medications, allergies, and record metadata; review every field with a confidence marker; then save.
- **Longitudinal timeline** — a deterministic chronology of records, medications, and visits, with duplicate-medication and care-gap flags.
- **Care navigator** — deterministic red-flag screening runs *before* any model call. "Chest pain, can't breathe" returns an emergency pathway even with no API key.
- **Reminders** — medication, appointment, refill, and follow-up reminders. MediFlow records them in the app; it does **not** send email, SMS, or push notifications.
- **Translation and plain-language explanations** — on-demand only. Nothing is written back to the chart.
- **Clinician portal** — a linked-patient panel and a pre-consultation summary, scoped to patients the clinician actually has a relationship with.
- **Admin analytics** — operational counts, compliance bars, AI health, and recent activity.
- **Facility directory** — searchable facilities and an emergency list, with a configurable emergency number.

---

## Safety posture

These are product rules, not marketing copy:

1. **No fabricated clinical data.** Intake never fills missing medications, allergies, or diagnoses with guesses. If a document cannot be read, the API returns a structured error or `needsOcr: true`.
2. **No model-only triage.** Red flags are detected by code. A model may rewrite the explanation, but it cannot change the urgency or the recommendation list.
3. **No hidden writes.** `/medical-records/extract` is a draft operation with no database write. Only `/medical-records` saves, in a single transaction.
4. **Patient scoping by default.** A patient's requests always resolve to their own `patientId`; a body or query value is ignored. A clinician without a grant, appointment, or prior record for that patient receives **404**, not 403.
5. **Honest degradation.** Without a Groq key, rule-based results are clearly labelled. Extraction that requires a model fails loudly rather than returning sample data.
6. **Demo mode is explicit.** `DEMO_MODE=true` returns clearly labelled sample extraction and never reads the upload. It is off by default.
7. **No notification theatre.** Reminder screens state that nothing is sent. Translation screens state that nothing is saved.

---

## Quick start

### Prerequisites

- Node.js **>= 18** (tested with Node 24)
- PostgreSQL **>= 14** (or Docker)
- A Groq API key is **optional**

### 1. Install

```bash
git clone https://github.com/your-org/mediflow.git
cd mediflow
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

At minimum, set `DATABASE_URL` and a `JWT_SECRET` of 32+ characters:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

See [Environment variables](#environment-variables) for the complete list.

### 3. Create the schema

```bash
npm run db:generate
npm run db:migrate:dev -- --name init   # first run creates prisma/migrations
npm run db:seed
```

For an existing deployment, use `npm run db:migrate` (runs `prisma migrate deploy`).

### 4. Run

```bash
npm run dev
```

- API: <http://localhost:3001> (`GET /health`)
- App: <http://localhost:3000>

The API reads `.env` from the repository root. If the database is unreachable at boot, the API still starts in degraded mode and `/health` returns `503` with `db: "down"`.

### Demo accounts

`npm run db:seed` creates facilities, providers, patients, one access grant, and demo records. Account emails:

| Role | Email |
|---|---|
| Patient | `robert.anderson@mediflow.dev` |
| Patient | `jennifer.martinez@mediflow.dev` |
| Patient | `marcus.johnson@mediflow.dev` |
| Doctor | `john.smith@mediflow.dev` |
| Doctor | `sarah.johnson@mediflow.dev` |
| Doctor | `michael.chen@mediflow.dev` |
| Admin | `admin@mediflow.dev` |

Passwords come from `DEMO_PASSWORD` in `.env`. The seed script will use a local fallback only when `NODE_ENV !== 'production'`; set the variable explicitly and never use demo credentials in production.

---

## Environment variables

| Variable | Required | Description | Default |
|---|:---:|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string | — |
| `JWT_SECRET` | Yes | Access/refresh signing secret, 32+ characters | — |
| `NODE_ENV` | No | `development`, `production`, or `test` | `development` |
| `PORT` | No | API port | `3001` |
| `CORS_ORIGINS` | No | Comma-separated browser origins. Wildcards are rejected because cookies are credentialed. | `http://localhost:3000` |
| `ACCESS_TOKEN_TTL` | No | Access JWT lifetime | `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | No | Refresh JWT lifetime in days | `7` |
| `GROQ_API_KEY` | No | Groq API key. Empty means labelled rule-based fallbacks. | `""` |
| `GROQ_BASE_URL` | No | OpenAI-compatible Groq base URL | `https://api.groq.com/openai/v1` |
| `GROQ_FAST_MODEL` | No | Model for short rewrites | `llama-3.1-8b-instant` |
| `GROQ_STRONG_MODEL` | No | Model for extraction/summaries | `llama-3.3-70b-versatile` |
| `GROQ_VISION_MODEL` | No | Model for image documents | `meta-llama/llama-4-scout-17b-16e-instruct` |
| `AI_TIMEOUT_MS` | No | Per-call model timeout | `12000` |
| `DEMO_MODE` | No | Return clearly labelled sample extraction instead of reading the upload | `false` |
| `DEMO_PASSWORD` | No | Password used only by `prisma/seed.ts` | — |
| `EMERGENCY_NUMBER` | No | Number shown by the navigator and facility screens | `112` |
| `NEXT_PUBLIC_API_URL` | App build | Browser-visible API origin | `http://localhost:3001` |

> `NEXT_PUBLIC_API_URL` is inlined at build time. Rebuild the frontend when it changes.

---

## Architecture

```
Browser (Next.js)
   │  httpOnly cookies mf_access / mf_refresh
   ▼
Express API ──► auth + access middleware ──► route
                                      ├── deterministic services (triage, timeline, reminders)
                                      └── Groq client (retry, breaker, LRU, concurrency cap)
                                                     │
                                                     ▼
                                              PostgreSQL (Prisma)
```

### Authentication

- Login and registration set two `httpOnly` cookies: `mf_access` (15 min) and `mf_refresh` (7 days). Both use `SameSite=Lax`, and `Secure` in production. The browser never reads a token from JavaScript.
- An `Authorization: Bearer <access token>` header is still accepted for API clients.
- `POST /api/auth/refresh` rotates the access cookie from the refresh cookie. `POST /api/auth/logout` clears both.
- Self-registration creates **patients only**. Clinician and admin accounts must be provisioned by an administrator.
- The Next.js `middleware.ts` checks only for cookie presence to redirect early; the API remains the authority on every request.

### Authorization

| Caller | Patient-scoped access |
|---|---|
| `PATIENT` | Always their own `patientId`; supplied values are ignored. |
| `DOCTOR` | An active `AccessGrant`, **or** an appointment with that patient, **or** a non-deleted medical record they authored. Otherwise **404**. |
| `ADMIN` | Operational analytics and administration endpoints. |

Missing or unauthorized patient access returns `404` so the API does not reveal whether a patient exists.

### Response envelope

Successful responses:

```json
{ "data": { }, "meta": { "total": 12, "limit": 20, "offset": 0 } }
```

`meta` is optional and resource-specific (pagination, `cached`, `needsOcr`, `disclaimer`, and so on).

Errors:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Enter a valid record date",
    "details": {},
    "requestId": "..."
  }
}
```

`X-Request-Id` is returned on every response and is included in structured logs.

### Caching and limits

- Read endpoints send `Cache-Control: private, max-age=10–30` and `Vary: Cookie`.
- The analytics endpoint caches for 60 seconds.
- LLM responses use an in-process LRU with a 10-minute TTL. Cached translations return well under 50 ms.
- Rate limits: 300 requests / 15 min globally, 30 / 15 min on auth, 60 / 15 min on AI routes.
- Uploads are capped at 10 MB and validated by magic bytes as well as declared MIME type.

---

## Project structure

```
mediflow/
├── api/                                # Express + TypeScript (ESM)
│   ├── src/
│   │   ├── index.ts                    # boot, security middleware, route mounts, shutdown
│   │   ├── config/env.ts               # Zod-validated environment
│   │   ├── agents/                     # intake, navigator, timeline, companion, insight
│   │   ├── routes/                     # auth, medical records, agents, appointments,
│   │   │                               # reminders, facilities, providers, activity
│   │   ├── services/
│   │   │   ├── intakeService.ts        # file validation, parsing, extraction contract
│   │   │   ├── groqService.ts          # retry, circuit breaker, LRU, SSE, vision
│   │   │   └── agentRuns.ts            # activity logging
│   │   ├── middleware/                 # auth, access, request id, errors
│   │   ├── lib/                        # prisma, logger, http envelope, audit
│   │   └── utils/                      # JWT/cookies, file helpers
│   └── package.json
├── app/                                # Next.js 14 Pages Router
│   ├── src/
│   │   ├── pages/                      # landing, auth, clinical and admin screens
│   │   ├── components/                 # AppShell, public/auth layouts, UI primitives
│   │   ├── lib/                        # typed API client, auth, types, formatting
│   │   ├── styles/globals.css          # editorial tokens and utilities
│   │   └── middleware.ts               # cookie-presence route gate
│   └── package.json
├── prisma/
│   ├── schema.prisma                   # PostgreSQL schema and enums
│   ├── migrations/                     # committed SQL migrations
│   └── seed.ts                         # demo data (explicitly labelled)
├── Dockerfile                          # multi-stage API + standalone app
├── docker-compose.yml                  # postgres + api + app
├── docker-compose.dev.yml              # hot-reload development stack
└── package.json                        # npm workspaces
```

### Database models

`User`, `Patient`, `Provider`, `Facility`, `MedicalRecord`, `Medication`, `Appointment`, `Reminder`, `AgentActivity`, `AccessGrant`, `AuditLog`, `Notification`, `UserPreference`, `EmergencyProfile`, `MedicationDose`.

Highlights:

- Enums for roles, record types, appointment status, urgency, reminder types/status, agent names/status, and access scope.
- Soft delete on `MedicalRecord` (`deletedAt`) and every read filters deleted rows.
- Composite indexes for patient timelines, provider schedules, reminders, and agent activity.
- `Patient.email` is a nullable convenience copy; login identity is `User.email`.

---

## API reference

All endpoints are under `/api` except health. Every response uses the envelope above. Unless marked public, endpoints require an authenticated cookie or Bearer token.

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health`, `/api/health` | Liveness + database readiness. `503` when the DB is down. |

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create a patient account and set cookies |
| `POST` | `/api/auth/login` | Sign in and set cookies |
| `POST` | `/api/auth/refresh` | Rotate the access cookie |
| `POST` | `/api/auth/logout` | Clear auth cookies |
| `GET` | `/api/auth/session` | Current user and linked patient/provider |
| `POST` | `/api/auth/forgot-password` | Acknowledge a reset request; no email is sent in this build |

### Medical records

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/medical-records/extract` | Upload + extract a draft. **No database write.** |
| `POST` | `/api/medical-records/upload` | Alias for `/extract` (compatibility) |
| `POST` | `/api/medical-records` | Save a reviewed record + medications in one transaction |
| `GET` | `/api/medical-records/patient/:patientId` | Paginated record list |
| `GET` | `/api/medical-records/:id` | Single record with medications |
| `DELETE` | `/api/medical-records/:id` | Soft delete |
| `GET` | `/api/medical-records/medications/:patientId` | Active and historical medication lists |
| `GET` | `/api/medical-records/:patientId/dashboard-metrics` | Cached dashboard counts |
| `GET` | `/api/medical-records/:patientId/timeline-preview` | Deterministic timeline preview |

`/extract` accepts `multipart/form-data` with a single `file`. It returns extracted fields with per-field confidence, `needsOcr` when a PDF has fewer than 40 non-whitespace characters, and `source: "document"`. If the model is required but unavailable, it returns an error; it never substitutes sample clinical data.

### Agents

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/agents/status` | AI configuration and availability |
| `POST` | `/api/agents/timeline/analyze` | Timeline analysis and flags |
| `POST` | `/api/agents/navigator/recommend` | Red-flag-first care navigation |
| `POST` | `/api/agents/companion/generate` | Reminder suggestions |
| `POST` | `/api/agents/insight/generate` | Patient insight |
| `GET` | `/api/agents/insights/latest/:patientId` | Most recent stored insight |
| `GET` | `/api/agents/insight/analytics` | Hospital-wide analytics (admin) |

### Appointments

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/appointments/patient/:patientId` | Patient appointments |
| `GET` | `/api/appointments/providers/available` | Providers available for booking |
| `GET` | `/api/appointments/slots` | Real offered slots (09:00–16:30) |
| `POST` | `/api/appointments` | Book (accepts `urgency`) |
| `GET` | `/api/appointments/:id` | Appointment detail |
| `PATCH` | `/api/appointments/:id/reschedule` | Reschedule |
| `PATCH` | `/api/appointments/:id/cancel` | Cancel |

### Reminders

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reminders/patient/:patientId` | List reminders |
| `POST` | `/api/reminders` | Create a reminder |
| `POST` | `/api/reminders/generate/:patientId` | Generate suggestions from the record |
| `GET` | `/api/reminders/stats/:patientId` | Counts by status/type |
| `PATCH` | `/api/reminders/:id/acknowledge` | Acknowledge |
| `DELETE` | `/api/reminders/:id` | Delete |

No email, SMS, or push delivery occurs.

### Facilities, providers, and activity

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/facilities` | Directory with filters |
| `GET` | `/api/facilities/nearby` | Nearby facilities |
| `GET` | `/api/facilities/emergency/list` | Emergency-capable facilities |
| `GET` | `/api/facilities/:id` | Facility detail |
| `GET` | `/api/providers` | Provider directory |
| `GET` | `/api/providers/me/patients` | Linked patients for the signed-in clinician |
| `GET` | `/api/providers/patient/:patientId/summary` | Pre-consultation summary |
| `POST` | `/api/providers/translate` | Translate text (cached; no chart write) |
| `POST` | `/api/providers/explain-prescription` | Plain-language explanation |
| `POST` | `/api/providers/navigator` | Provider-side navigation |
| `POST` | `/api/providers/insight/:patientId` | Provider-side patient insight |
| `GET` | `/api/agent-activity` | Activity log for a patient |
| `GET` | `/api/agent-activity/:id` | Activity detail |

---

## AI agents

| Agent | Deterministic core | Optional model work |
|---|---|---|
| **Intake** | File magic-byte checks, text extraction, field normalisation, confidence thresholds | Structured extraction and vision OCR for images |
| **Timeline** | Chronology, active-medication overlap, duplicate groups, care gaps | Plain-language narrative |
| **Navigator** | Red-flag rules, urgency floor, department mapping, mandatory disclaimer | Rewrites the explanation only |
| **Companion** | Reminder derivation from meds/appointments, `careEngagementScore` (never called adherence) | Friendlier reminder wording |
| **Insight** | Counts, risk signals, operational analytics | Summary prose |

The Groq client adds request timeouts, bounded retries, a circuit breaker, an LRU response cache, and a concurrency cap. Failures surface as labelled fallbacks or structured errors — never as invented clinical facts and never as an unhandled 500.

---

## Design system

The frontend uses flat editorial tokens rather than a component-library theme:

- Paper `#F7F4EE`, ink `#191E25`, pine `#1E5A47`, with clay, ochre, and crimson accents.
- Fraunces (display), Instrument Sans (body), JetBrains Mono (data), loaded from Google Fonts at runtime.
- Hairline rules, square-ish corners, generous vertical rhythm, no shadows, gradients, blur, glass, floating orbs, or hover lifts.
- A single `AppShell` for authenticated pages, plus public and auth layouts.

The UI deliberately has zero matches for `backdrop-blur`, `glass`, `floating-orb`, `gradient-mesh`, `bg-clip-text`, `from-brand`, `shadow-brand`, `hover:-translate-y`, and `border-3`.

---

## Docker

The root `Dockerfile` has four stages: API build, app build, API production, and standalone Next.js production.

### Full stack

```bash
docker compose up --build
```

- App: <http://localhost:3000>
- API: <http://localhost:3001>
- PostgreSQL: `localhost:5432`

The API container runs `prisma migrate deploy` before starting. The full-stack compose file **does not seed**; run the seed explicitly after the stack is healthy:

```bash
docker compose exec api npx prisma db seed --schema prisma/schema.prisma
```

### Development stack

```bash
docker compose -f docker-compose.dev.yml up --build
```

The dev API applies migrations, seeds, then runs `tsx watch`. The app runs `next dev`. Both source trees are mounted.

### Notes

- `NEXT_PUBLIC_API_URL` is a **build argument** for the app image because it is inlined into the client bundle. Set it to an origin the user's browser can reach, not a Compose-internal hostname.
- `CORS_ORIGINS` must list the app origin explicitly; credentialed wildcards are rejected.
- The API exposes `/health` for orchestrator checks. A `503` means the process is alive but the database is not.

---

## Scripts

Root:

```bash
npm run dev             # API + app with hot reload
npm run build           # Build API (tsc) then app (next build)
npm run start           # Start the built Next.js app
npm run typecheck       # tsc --noEmit in both workspaces
npm run db:generate     # Generate Prisma Client
npm run db:migrate      # Apply committed migrations (deploy)
npm run db:migrate:dev  # Create/apply a development migration
npm run db:seed         # Seed demo data
npm run db:reset        # Reset and reseed
npm run db:studio       # Prisma Studio
```

API workspace:

```bash
cd api
npm run dev             # tsx watch
npm run build           # tsc
npm start               # node dist/index.js
npm run typecheck       # tsc --noEmit
```

App workspace:

```bash
cd app
npm run dev             # next dev
npm run build           # next build
npm start               # next start
npm run lint            # next lint
npm run typecheck       # tsc --noEmit
```

---

## Verification

```bash
npm run typecheck
npm run build
```

Both must pass. The API and app are TypeScript `strict`.

Static design checks:

```bash
# PowerShell
Select-String -Path app/src/**/*.tsx,app/src/**/*.css -Pattern "backdrop-blur|glass|floating-orb|gradient-mesh|bg-clip-text|from-brand|shadow-brand|hover:-translate-y|border-3"
```

Runtime checks that need a live PostgreSQL database and seeded data:

- Upload a real PDF and confirm the response contains that document's own medications.
- Upload a blank PDF and confirm `needsOcr: true`.
- Request another patient's record as a patient or unlinked doctor and confirm `404`.
- Call `/api/providers/translate` twice and confirm the second call is cached (`meta.cached`).
- Submit "chest pain, can't breathe" to the navigator with `GROQ_API_KEY` empty and confirm an emergency pathway.
- Stop the database and confirm `/health` returns `503` while the process stays up.

---

## Security

- httpOnly, `SameSite=Lax` cookies; `Secure` in production.
- Short-lived access tokens; refresh rotation; logout clears cookies.
- bcrypt password hashing and a constant-time burn for unknown emails.
- Zod validation on bodies, queries, and env; typed error envelope with request IDs.
- Helmet, compression, explicit CORS allowlist, and rate limits.
- Magic-byte upload validation, 10 MB cap, one file per request.
- Audit records for sensitive actions and `AgentActivity` for agent runs.
- No stack traces or secrets in client responses.

---

## Limitations

- This is a hackathon demonstration, not a certified clinical system.
- Password reset only acknowledges the request; no mail transport is configured.
- Reminders are in-app records only; no scheduler or notification channel is included.
- Translation results are session-only.
- The clinician access rule is relationship-based; fine-grained scopes (`AccessGrant.scope`) are modelled but not yet enforced per action.
- `DEMO_MODE` is for demos and produces labelled sample extraction. It must stay off for real documents.

---

## Contributing

1. Fork the repository.
2. Create a branch (`git checkout -b feature/amazing-feature`).
3. Keep TypeScript strict and use the existing response envelope.
4. Add access checks to every patient-scoped endpoint.
5. Never fabricate clinical data in a fallback.
6. Run `npm run typecheck` and `npm run build`.
7. Open a pull request.

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

**Built for the Product Space AI Agent Hackathon**

</div>
