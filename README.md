<div align="center">

# MediFlow

### AI-Powered Healthcare Navigation & Patient Care Coordination Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-green.svg)]()
[![Build](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()
[![AI](https://img.shields.io/badge/AI-Groq-orange.svg)]()
[![Hackathon](https://img.shields.io/badge/Hackathon-Product%20Space-purple.svg)]()

</div>

---

MediFlow is an AI-powered healthcare navigation and patient care coordination platform built for the **Product Space AI Agent Hackathon**. It features **5 specialized AI agents** that help patients manage their medical records, navigate care options, and stay on top of their health — all from a single, intuitive dashboard.

---

## Highlights

- **Multi-Agent AI System** — 5 intelligent agents working together for comprehensive patient care
- **Smart Document Parsing** — Upload prescriptions, lab reports, and discharge summaries for instant AI extraction
- **Care Navigation** — Symptom-based specialist recommendations with care pathway guidance
- **Proactive Reminders** — AI-generated medication, appointment, and refill reminders
- **Health Analytics** — Patient-level insights and hospital-wide operational metrics
- **Medical Translation** — Translate medical documents and prescriptions into multiple languages
- **Facility Finder** — Locate nearby medical facilities and emergency services

---

## Screenshots

<div align="center">

> *Add screenshots of the dashboard, timeline, navigator, and other key screens here.*

| Dashboard | Medical Timeline | Care Navigator |
|:---------:|:----------------:|:--------------:|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Timeline](docs/screenshots/timeline.png) | ![Navigator](docs/screenshots/navigator.png) |

| Document Upload | Health Insights | Reminders |
|:---------------:|:---------------:|:---------:|
| ![Upload](docs/screenshots/upload.png) | ![Insights](docs/screenshots/insights.png) | ![Reminders](docs/screenshots/reminders.png) |

</div>

---

## Quick Start

### Prerequisites

- **Node.js** >= 18.x
- **PostgreSQL** >= 14
- **Groq API Key** (optional — the app runs with mock data if not provided)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/mediflow.git
cd mediflow
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your database credentials and API keys:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mediflow"
GROQ_API_KEY="your-groq-api-key"
JWT_SECRET="your-random-secret-string"
```

### 4. Set Up the Database

```bash
npx prisma db push
npx prisma db seed
```

### 5. Start Development Servers

```bash
npm run dev
```

This starts both the backend (`http://localhost:3001`) and frontend (`http://localhost:3000`) concurrently.

---

## Environment Variables

| Variable | Required | Description | Default |
|---|:---:|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string | — |
| `PORT` | No | Backend API port | `3001` |
| `NODE_ENV` | No | Runtime environment | `development` |
| `API_URL` | No | Backend API base URL | `http://localhost:3001` |
| `NEXT_PUBLIC_API_URL` | Yes | Frontend-facing API URL | `http://localhost:3001` |
| `JWT_SECRET` | Yes | Secret key for JWT token signing | — |
| `GROQ_API_KEY` | No | Groq API key for LLM inference | `""` (uses mock data) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins | `http://localhost:3000` |

---

## Project Structure

```
mediflow/
├── api/                            # Express.js backend
│   ├── src/
│   │   ├── index.ts                # App entry point & Express config
│   │   ├── agents/                 # AI Agent implementations
│   │   │   ├── intakeAgent.ts      # Document parsing & data extraction
│   │   │   ├── timelineAgent.ts    # Medical timeline analysis
│   │   │   ├── navigatorAgent.ts   # Symptom-based care navigation
│   │   │   ├── companionAgent.ts   # Reminder generation & adherence
│   │   │   └── insightAgent.ts     # Patient & hospital analytics
│   │   ├── routes/                 # REST API route handlers
│   │   │   ├── auth.ts             # Registration, login, session
│   │   │   ├── agents.ts           # Agent endpoint orchestrator
│   │   │   ├── agentActivity.ts    # Agent activity logging
│   │   │   ├── medicalRecords.ts   # CRUD + file upload
│   │   │   ├── appointments.ts     # Scheduling & provider lookup
│   │   │   ├── reminders.ts        # CRUD + AI generation
│   │   │   ├── facilities.ts       # Facility search & emergency
│   │   │   └── providers.ts        # Provider search + translation
│   │   ├── services/
│   │   │   └── groqService.ts      # Groq LLM API client
│   │   ├── middleware/
│   │   │   └── auth.ts             # JWT auth middleware
│   │   └── utils/
│   │       └── auth.ts             # Password hashing & token utils
│   ├── package.json
│   └── tsconfig.json
├── app/                            # Next.js 14 frontend
│   ├── src/
│   │   ├── pages/                  # Page components
│   │   │   ├── index.tsx           # Landing page
│   │   │   ├── login.tsx           # Login
│   │   │   ├── register.tsx        # Registration
│   │   │   ├── dashboard.tsx       # Patient dashboard
│   │   │   ├── timeline.tsx        # Medical timeline
│   │   │   ├── upload.tsx          # Document intake
│   │   │   ├── navigator.tsx       # Care navigator
│   │   │   ├── reminders.tsx       # Smart reminders
│   │   │   ├── appointments.tsx    # Appointment booking
│   │   │   ├── facilities.tsx      # Facility finder
│   │   │   ├── translate.tsx       # Translation tool
│   │   │   ├── doctor-portal.tsx   # Provider portal
│   │   │   └── forgot-password.tsx # Password recovery
│   │   ├── components/
│   │   │   ├── Layout.tsx          # App shell & navigation
│   │   │   └── AgentActivityLog.tsx # Agent activity display
│   │   ├── lib/
│   │   │   └── api.ts              # Axios API client
│   │   └── styles/
│   │       └── globals.css         # Global styles
│   ├── package.json
│   └── next.config.js
├── prisma/
│   ├── schema.prisma               # Database schema (9 models)
│   ├── seed.ts                     # Seed data
│   └── dev.db                      # SQLite dev database
├── package.json                    # Root workspace config
├── tsconfig.json                   # Root TypeScript config
├── .env.example                    # Environment template
└── README.md
```

---

## AI Agents

MediFlow features **5 specialized AI agents**, each designed for a specific healthcare task:

### 1. Intake Agent
- Parses uploaded medical documents (PDFs, images, text)
- Extracts medications, allergies, diagnoses, and encounters
- Validates extracted data for completeness

### 2. Timeline Agent
- Builds a chronological view of all medical records
- Detects care gaps (>180 days without documented contact)
- Identifies duplicate medications across records
- Flags drug-drug interactions and conflicts
- Generates a plain-language narrative summary

### 3. Navigator Agent
- Analyzes patient symptoms against medical history
- Recommends appropriate specialists and departments
- Suggests care pathways with urgency levels
- Leverages Groq LLM for intelligent recommendations

### 4. Companion Agent
- Generates personalized medication reminders
- Tracks upcoming and missed appointments
- Calculates patient adherence scores
- Provides AI-powered medication explanations in plain language

### 5. Insight Agent
- Produces individual patient risk assessments and recommendations
- Generates hospital-wide operational analytics
- Tracks compliance rates and treatment timelines
- Identifies appointment bottlenecks by provider

---

## API Reference

All endpoints require JWT authentication via `Authorization: Bearer <token>` header unless noted.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new patient account |
| `POST` | `/api/auth/login` | Login and receive JWT token |
| `POST` | `/api/auth/forgot-password` | Request password reset |
| `GET` | `/api/auth/session` | Verify token and get current user |

### Medical Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/medical-records/patient/:id` | Get patient's records |
| `POST` | `/api/medical-records/upload` | Upload and auto-parse a document |
| `POST` | `/api/medical-records` | Create a medical record manually |
| `GET` | `/api/medical-records/medications/:id` | Get medication history |
| `GET` | `/api/medical-records/:id/dashboard-metrics` | Get dashboard statistics |
| `GET` | `/api/medical-records/:id/timeline-preview` | Timeline preview with flags |

### AI Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/agents/intake/parse` | Parse an uploaded medical document |
| `POST` | `/api/agents/timeline/analyze` | Analyze a patient's full timeline |
| `POST` | `/api/agents/navigator/recommend` | Get care recommendations for symptoms |
| `POST` | `/api/agents/companion/generate` | Generate personalized reminders |
| `POST` | `/api/agents/insight/generate` | Generate patient health insights |
| `GET` | `/api/agents/insight/analytics` | Get hospital-wide analytics |

### Appointments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/appointments/patient/:id` | Get patient appointments |
| `POST` | `/api/appointments` | Create an appointment |
| `GET` | `/api/appointments/providers/available` | List available providers |

### Reminders

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reminders/patient/:id` | Get patient reminders |
| `POST` | `/api/reminders` | Create a reminder |
| `POST` | `/api/reminders/generate/:id` | AI-generate reminders |
| `PATCH` | `/api/reminders/:id/acknowledge` | Acknowledge a reminder |
| `DELETE` | `/api/reminders/:id` | Delete a reminder |
| `GET` | `/api/reminders/stats/:id` | Get reminder statistics |

### Facilities & Providers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/facilities` | List all facilities (with filters) |
| `GET` | `/api/facilities/nearby` | Get nearby facilities |
| `GET` | `/api/facilities/emergency/list` | List emergency facilities |
| `GET` | `/api/facilities/:id` | Get facility details |
| `GET` | `/api/providers` | List providers (filter by specialty) |
| `POST` | `/api/providers/navigator` | AI care navigation |
| `POST` | `/api/providers/translate` | Translate medical text |
| `POST` | `/api/providers/explain-prescription` | Explain a prescription in plain language |
| `GET` | `/api/providers/patient/:id/summary` | AI-generated patient summary for providers |

### Agent Activity

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agent-activity?patientId=...` | Get agent activity logs |
| `GET` | `/api/agent-activity/:id` | Get single activity detail |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS, Headless UI, Lucide Icons |
| **Backend** | Express.js, TypeScript, Multer, CORS |
| **Database** | PostgreSQL via Prisma ORM (9 models, 20+ indexes) |
| **AI/LLM** | Groq API (`llama-3.1-8b-instant`) with graceful fallback |
| **Auth** | JWT (jose) + bcryptjs |
| **State** | React Query (TanStack Query v5) |
| **Build** | npm workspaces monorepo, tsx (dev), tsc (build) |

---

## Database Schema

```
User ──┬── Patient ──┬── MedicalRecord ── Medication
       │             ├── Appointment
       │             ├── Reminder
       │             └── AgentActivity
       └── Provider ──┬── MedicalRecord
                      ├── Appointment
                      └── Facility
```

**9 models:** User, Patient, Provider, Facility, MedicalRecord, Medication, Appointment, Reminder, AgentActivity

---

## Docker Deployment

### Using Docker Compose

```bash
# Start all services (API + Database)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Docker Build

```bash
# Build the API image
docker build -t mediflow-api -f api/Dockerfile .

# Run the container
docker run -p 3001:3001 --env-file .env mediflow-api
```

### Production Deployment

| Platform | Component | Notes |
|----------|-----------|-------|
| **Vercel** | Frontend | Automatic deploys from `app/` directory |
| **Railway** | Backend | Native Prisma + PostgreSQL support |
| **Render** | Backend | Free tier available, auto-deploy from Git |
| **Fly.io** | Backend | Edge deployment with persistent volumes |

---

## Development

### Available Scripts

```bash
npm run dev          # Start both API and frontend concurrently
npm run build        # Build both projects
npm run db:push      # Push Prisma schema to database
npm run db:seed      # Seed database with sample data
npm run db:reset     # Reset database completely
npm run db:studio    # Open Prisma Studio (visual DB browser)
```

### API Backend

```bash
cd api
npm run dev          # Start API with hot-reload (tsx watch)
npm run build        # Compile TypeScript
npm start            # Run compiled output
```

### Frontend

```bash
cd app
npm run dev          # Start Next.js dev server (port 3000)
npm run build        # Production build
npm run lint         # Run ESLint
```

---

## Security

- **JWT Authentication** — Secure token-based auth with expiration
- **Patient Authorization** — Patients can only access their own medical records
- **CORS Protection** — Configurable allowed origins (no wildcard by default)
- **File Upload Validation** — MIME type whitelist (PDF, JPEG, PNG, TIFF, DOC, DOCX) and 10MB size limit
- **No Hardcoded Secrets** — All credentials loaded from environment variables
- **Password Hashing** — bcrypt with salt rounds
- **Error Sanitization** — No stack traces exposed to clients

---

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Style

- TypeScript strict mode
- ESLint + Prettier formatting
- Follow existing patterns for routes, agents, and components
- All API endpoints must include auth middleware
- All agent calls must log activity to `AgentActivity`

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built for the Product Space AI Agent Hackathon**

</div>
