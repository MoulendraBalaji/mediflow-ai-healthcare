<div align="center">

# 🩺 MediFlow
### Autonomous AI Healthcare Navigation & Patient Care Coordination Platform

**A clinical-grade, multi-agent healthcare operating system designed for deterministic safety, verifiable medical document comprehension, and patient-clinician alignment.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.1.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![LLM: Groq Llama 3.3](https://img.shields.io/badge/AI-Groq%20Llama%203.3-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)
[![Product Space](https://img.shields.io/badge/Hackathon-Product%20Space%20AI%20Agent-purple?style=for-the-badge)](https://productspace.org/)

<br />

[Explore Features](#-core-capabilities) • [Agent Architecture](#-multi-agent-system-architecture) • [Safety Framework](#-clinical-safety--zero-hallucination-policy) • [Quickstart](#-quick-start) • [Live Demo Credentials](#-demo-accounts) • [API Ecosystem](#-api-endpoints)

</div>

---

## 🌟 Executive Overview

In fragmented modern healthcare systems, patients struggle with unintelligible prescriptions, uncoordinated specialist appointments, and disjointed medical records. Meanwhile, clinicians spend hours manually piecing together medical histories before consultations.

**MediFlow** bridges this divide. Built for the **Product Space AI Agent Hackathon**, MediFlow ingests unstructured medical documents (prescriptions, lab tests, discharge summaries), transforms them into a deterministic longitudinal health record, and deploys **5 specialized clinical agents** to navigate patient care, highlight clinical anomalies, and assemble pre-consultation briefings for doctors.

> **⚠️ Clinical Demonstration Notice:** MediFlow is an assistive intelligence demonstration platform and not an FDA-certified medical diagnostic device. Every automated output is labelled with confidence markers, audit trails, and clinical disclaimers.

---

## ⚡ Core Capabilities

<table>
  <tr>
    <td width="50%">
      <h3>📄 Verified Document Intake</h3>
      <p>Upload prescriptions, lab reports, or clinical notes (PDF, PNG, JPG). MediFlow extracts structured entities (medications, dosages, frequencies, allergies) with granular per-field confidence scores. Scans without extractable text are flagged for OCR instead of guessed.</p>
    </td>
    <td width="50%">
      <h3>⏱️ Longitudinal Care Timeline</h3>
      <p>Organizes consultations, diagnoses, and treatments into a unified chronological care stream. Features algorithmic detection for overlapping medication regimens, dosage conflicts, and gaps in follow-up visits.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🧭 Red-Flag Symptom Navigator</h3>
      <p>Triage that prioritizes safety over novelty. Code-level rules screen for emergency indicators (chest pain, stroke symptoms, acute dyspnea) before any language model is invoked, guiding high-risk patients directly to emergency facilities.</p>
    </td>
    <td width="50%">
      <h3>🩺 Clinician Command Portal</h3>
      <p>Pre-consultation clinical briefings generated in seconds. Doctors review verified patient timelines, active medications, recorded allergies, and agent run histories strictly scoped to their registered patient relationships.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>💊 Intelligent Companion & Reminders</h3>
      <p>Automatically derives dosage routines and appointment reminders from validated records. Provides plain-language explanations of complex prescriptions without mutating official clinical charts.</p>
    </td>
    <td width="50%">
      <h3>📊 Hospital & Admin Telemetry</h3>
      <p>Operational health metrics, patient engagement indicators, AI agent health and latency tracking, and appointment bottleneck analytics for healthcare administration teams.</p>
    </td>
  </tr>
</table>

---

## 🧠 Multi-Agent System Architecture

MediFlow divides complex clinical operations across **five distinct, purpose-built autonomous agents**. Every agent operates on the principle of **deterministic safety first, generative polish second**:

```
                                  ┌────────────────────────┐
                                  │   Incoming Document    │
                                  │   or Clinical Event    │
                                  └───────────┬────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
            ┌──────────────────┐                             ┌──────────────────┐
            │ 01. INTAKE AGENT │                             │03.NAVIGATOR AGENT│
            │  Document Parser │                             │  Clinical Triage │
            └─────────┬────────┘                             └────────┬─────────┘
                      │                                               │
                      ▼                                               ▼
        ┌──────────────────────────┐                     ┌──────────────────────────┐
        │  02. TIMELINE CHRONOLOGY │                     │   04. COMPANION AGENT    │
        │ Overlap & Care-Gap Engine│                     │  Plan & Reminders Engine │
        └─────────────┬────────────┘                     └────────────┬─────────────┘
                      │                                               │
                      └───────────────────────┬───────────────────────┘
                                              │
                                              ▼
                                  ┌───────────────────────┐
                                  │   05. INSIGHT AGENT   │
                                  │  Pre-Consult Briefing │
                                  └───────────────────────┘
```

| Agent | Deterministic Safety Core | Model Enhancement Layer | Output Artifact |
| :--- | :--- | :--- | :--- |
| **01. Intake** | Magic-byte file validation, PDF text density checks, confidence floors | Groq Vision / LLM entity extraction (`llama-3.3-70b-versatile`) | Structured Medication & Diagnosis draft |
| **02. Timeline** | Chronological ordering, active med date overlaps, care-gap interval detection | Plain-language health journey narrative | Interactive longitudinal care record |
| **03. Navigator** | Strict code-level emergency red-flag triage (`EMERGENCY` / `HIGH` / `MEDIUM`) | Tone calibration and compassionate guidance formatting | Actionable care pathway & department routing |
| **04. Companion** | Frequency parsing, calendar derivation, engagement scoring | Simplified non-clinical medicine explanations | Automated reminder schedules & dose cards |
| **05. Insight** | Risk-factor aggregation, allergy-contraindication checks, operational counts | Concise pre-consultation clinician briefings | Structured clinical summary & hospital telemetry |

---

## 🛡️ Clinical Safety & Zero-Hallucination Policy

MediFlow enforces strict product safety constraints implemented directly into the system architecture:

```
                                   SAFETY BOUNDARIES
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  1. NO SILENT WRITES: Intake extraction operates in draft mode. Saving requires user  │
│     review and confirmation in a single ACID transaction.                              │
│                                                                                        │
│  2. NO INVENTED MEDICAL DATA: If a document cannot be read or verified, the system    │
│     surfaces needsOcr: true or an explicit error. It never hallucinates entities.     │
│                                                                                        │
│  3. CODE-LEVEL TRIAGE: Emergency red flags (e.g. chest pain, respiratory distress)   │
│     escalate to emergency protocols deterministically, even without Groq API access.   │
│                                                                                        │
│  4. RELATIONSHIP-BASED SCOPING: Clinicians can only inspect records of patients with   │
│     active care grants, appointments, or signed records. Unlinked lookups return 404. │
│                                                                                        │
│  5. HONEST DEGRADATION: If the AI inference layer is unreachable, every interface     │
│     cleanly shifts to labelled rule-based operation without crashing.                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design Philosophy: Clinical Editorial

Unlike generic AI dashboards filled with neon gradients, floating orbs, and glassmorphism, MediFlow's design follows a refined **Clinical Editorial** aesthetic:
- **Palette**: Warm paper (`#F7F4EE`), deep archival ink (`#191E25`), clinical pine (`#1E5A47`), and subdued status tones.
- **Typography**: Fraunces (editorial display headers), Instrument Sans (body readability), and JetBrains Mono (clinical telemetry).
- **Structure**: Hairline dividing rules, dense and scannable information layout, and zero distracting micro-animations in high-stakes clinical views.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 18 (Tested on Node 20 & 24)
- **PostgreSQL** >= 14 or a cloud database instance (e.g., [Supabase](https://supabase.com))
- **Groq API Key** *(Optional — fallback rule-based mode operates without it)*

### 1. Clone & Install
```bash
git clone https://github.com/MoulendraBalaji/mediflow-ai-healthcare.git
cd mediflow-ai-healthcare
npm install
```

### 2. Configure Environment
Create a `.env` file in the project root:
```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
JWT_SECRET="mediflow-super-secret-jwt-key-2024-hackathon"
NODE_ENV="development"
PORT=3001
CORS_ORIGINS="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:3001"
GROQ_API_KEY="gsk_your_groq_api_key_here"
```

> **Windows / Supabase Tip:** MediFlow includes an automatic IPv6 resolver for Supabase direct connections, preventing Windows Node/Rust DNS lookup errors out of the box.

### 3. Initialize & Seed Database
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Launch Development Servers
```bash
npm run dev
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Health Check**: [http://localhost:3001/health](http://localhost:3001/health)

---

## 👥 Demo Accounts

The database comes pre-seeded with full clinical workflows, appointments, medications, and audit trails.

| Role | Email | Password | Primary Workflow |
| :--- | :--- | :--- | :--- |
| 🩺 **Doctor** | `john.smith@mediflow.dev` | `demo1234` | Patient panel, pre-consultation summary, agent activity log |
| 🩺 **Doctor** | `sarah.johnson@mediflow.dev` | `demo1234` | Cardiology patient care coordination |
| 🧑‍💼 **Patient** | `robert.anderson@mediflow.dev` | `demo1234` | Health dashboard, timeline, prescription upload, medication reminders |
| 🧑‍💼 **Patient** | `jennifer.martinez@mediflow.dev` | `demo1234` | Symptom navigator, specialist appointment booking |
| 🧑‍💼 **Patient** | `marcus.johnson@mediflow.dev` | `demo1234` | Care-gap reviews and medication adherence |
| 🛡️ **Admin** | `admin@mediflow.dev` | `demo1234` | System health, agent telemetry, hospital operational analytics |

---

## 🔌 API Endpoints

All core API routes return standard envelopes with embedded request telemetry (`X-Request-Id`).

### Authentication & Identity
- `POST /api/auth/register` — Register a verified patient account.
- `POST /api/auth/login` — Sign in and issue `httpOnly` secure session cookies.
- `POST /api/auth/refresh` — Rotate access tokens.
- `GET  /api/auth/session` — Retrieve active authenticated session and role profile.
- `POST /api/auth/logout` — Revoke and clear session tokens.

### Clinical Document Intake
- `POST /api/medical-records/extract` — Multi-part document upload & draft entity extraction *(No database write)*.
- `POST /api/medical-records` — Atomic save of reviewed record and extracted medications.
- `GET  /api/medical-records/patient/:id` — Paginated medical record history.
- `GET  /api/medical-records/medications/:id` — Active & historical medication profiles.

### Autonomous Agents & Navigation
- `POST /api/agents/navigator/recommend` — Red-flag symptom triage and care pathway derivation.
- `POST /api/agents/timeline/analyze` — Chronological timeline analysis and interaction checks.
- `POST /api/agents/companion/generate` — Generate contextual care reminders from current records.
- `GET  /api/agents/insights/latest/:id` — Fetch latest clinical synthesis.
- `GET  /api/agent-activity?patientId=:id` — Comprehensive audit log of agent runs for a patient.

### Clinician & Provider Coordination
- `GET  /api/providers/me/patients` — List patients linked to the authenticated doctor.
- `GET  /api/providers/patient/:id/summary` — Assemble real-time pre-consultation summary.
- `POST /api/providers/translate` — Real-time translation of clinical instructions *(Cached in-memory)*.
- `POST /api/providers/explain-prescription` — Patient-accessible medication plain-language explanation.

---

## 🛠️ Technology Stack

```
Frontend Architecture
├── Next.js 14 (Pages Router)
├── React 18 & TanStack Query v5
├── Tailwind CSS (Custom Clinical Editorial Tokens)
├── Lucide React Icons
└── Axios Client with automatic session refresh

Backend Architecture
├── Node.js 20+ & Express (ESM)
├── TypeScript 5.3 (Strict Mode)
├── Prisma ORM 5.22
├── PostgreSQL (Supabase Cloud / Local Docker)
├── Pino HTTP Structured Logging
└── Zod Request & Environment Validation

Inference & Intelligence
├── Groq Cloud API
├── Meta Llama 3.3 70B Versatile (Clinical extraction & synthesis)
├── Meta Llama 3.1 8B Instant (Low-latency plain-language translation)
└── Meta Llama 4 Scout Vision (Multimodal document OCR)
```

---

## 🧪 Testing & Verification

MediFlow includes an automated testing suite built with Node's native test runner and `tsx`:

```bash
# Run unit test suite (magic-bytes, navigator red-flags, editorial design guard)
npm run test:unit

# Typecheck full monorepo
npm run typecheck

# Integration tests (against isolated test database)
npm run test:integration
```

---

## 🐳 Container Deployment

Run the complete full-stack environment with Docker:

```bash
# Production Multi-Stage Build
docker compose up --build

# Development Hot-Reload Environment
docker compose -f docker-compose.dev.yml up --build
```

---

<div align="center">

**MediFlow Healthcare Intelligence** • Built with ❤️ for the **Product Space AI Agent Hackathon**

[Report an Issue](https://github.com/MoulendraBalaji/mediflow-ai-healthcare/issues) • [Request Feature](https://github.com/MoulendraBalaji/mediflow-ai-healthcare/pulls)

</div>
