# Kabmeet — Live Sessions, Virtual Classes & Community Collaboration for Kabale University

> **One campus login. One platform. Zero third-party meeting links.**  
> Built for the **Kabale University ("Kabville")** innovation ecosystem at **`ai.kab.ac.ug/indabax`**, uniting **IndabaX Kabale**, **KAB AI Club**, **Huawei Student Club**, and **AWS Cloud Club**.

---

## Table of Contents

1. [What Is Kabmeet?](#what-is-kabmeet)
2. [Why We Built It (The Problem We Solve)](#why-we-built-it-the-problem-we-solve)
3. [Key Features at a Glance](#key-features-at-a-glance)
4. [Who Uses Kabmeet (Roles & Permissions)](#who-uses-kabmeet-roles--permissions)
5. [Project & File Structure](#project--file-structure)
6. [How the Architecture Works](#how-the-architecture-works)
7. [Technology Stack](#technology-stack)
8. [How to Run the Project](#how-to-run-the-project)
   - [Option A: Quick Start (Single-Server Web + API + WebSocket App)](#option-a-quick-start-single-server-web--api--websocket-app)
   - [Option B: Full Self-Hosted Monorepo (`kabmeet/`)](#option-b-full-self-hosted-monorepo-kabmeet)
   - [Option C: Production Campus Server with Docker Compose](#option-c-production-campus-server-with-docker-compose)
9. [Environment Variables](#environment-variables)
10. [Useful Scripts & Testing](#useful-scripts--testing)
11. [Campus Hosting, Bandwidth & Data Saver Design](#campus-hosting-bandwidth--data-saver-design)
12. [Security, Privacy & Safe Use](#security-privacy--safe-use)
13. [Development Roadmap & Status](#development-roadmap--status)
14. [Contributing & Documentation](#contributing--documentation)

---

## What Is Kabmeet?

**Kabmeet** is a self-hosted live session, virtual classroom, and developer collaboration platform built directly into the Kabale University AI & tech community portal. Instead of acting as a static notice board that pushes students and lecturers away to external tools like Google Meet or Zoom, Kabmeet brings the entire live experience home:

- **Discover**: Browse every session that is **Live Now**, **Upcoming**, or saved as a **Replay**, filterable by campus club (**IndabaX Kabale**, **KAB AI**, **Huawei**, **AWS**) with one-click session reminders.
- **Watch**: A YouTube Live–inspired viewing stage with large video on the left and **Live Chat / Top Chat**, **Q&A**, **Live Polls**, pinned announcements, emoji stickers, a floating multi-emoji reaction bar (`❤️ 🔥 👏 🙌 😂 😮 🚀 💯`), double-tap `❤️` bursts, and **Shared Workspace** tabs on the right.
- **Room**: A Google Meet–inspired interactive meeting stage with dynamic video tiles, microphone and camera toggles, active-speaker detection, desktop screen sharing, **mobile slide/photo sharing**, raise-hand speaker approval, waiting room admission, and live host moderation.
- **Classes**: Private virtual classes created by lecturers where only enrolled or allowed students can enter, featuring **automatic attendance tracking** (join time + active minutes) and one-click CSV attendance exports.
- **Shared Workspace (`Work`)**: A live side-by-side coding and note-taking pad (**Python**, **TypeScript**, **Bash**), shared session notes, and collaborative tasks so students and club mentors can build together while talking.

---

## Why We Built It (The Problem We Solve)

Previously, whenever a meetup, workshop, or online lecture went live at Kabale University, the same four problems happened:

1. **People had to leave the site**: Clicking a meeting link sent members out to Google Meet or Zoom, leaving the university community website empty.
2. **Nothing was connected**: Chat messages, speaker Q&A, attendance records, and session replays lived on disconnected platforms and were never linked to the member's campus profile.
3. **Lecturers had limited control**: Restricting a live class strictly to registered students—and verifying who actually stayed—required manual roll calls or fragile link sharing.
4. **Records were scattered and expensive**: Hosted video APIs charge per minute and store university lectures off-campus. Kabmeet keeps everything on campus servers with **zero per-minute video fees**.

Kabmeet solves all four by combining **YouTube Live** (for large broadcasts), **Google Meet** (for interactive rooms), and a **Shared Developer Workspace** inside one unified campus application.

---

## Key Features at a Glance

| Area | What Kabmeet Provides |
| :--- | :--- |
| **Discover & Communities** | Live Now, Upcoming, and Replay cards; search & community filter chips (`IndabaX`, `KAB AI`, `Huawei`, `AWS`); follow clubs; set reminders. |
| **Watch Stage** | Live & Replay playback bar, captions strip, **floating multi-emoji reaction bar** with `emoji-sway-float` animation, **double-tap stage for `❤️` like**, chat stickers, pinned host banners. |
| **Interactive Room** | Mic (`M`), Camera (`V`), Raise Hand (`H`), Desktop Screen Share, Mobile Slide/Photo Share, Live Captions, Chat/Work/People side drawers, Waiting Room, and Host Controls. |
| **Chat, Q&A & Polls** | Switch between `Live chat` and `Top chat` (ranked by upvotes), pin key messages, filter blocked words, enforce slow mode, upvote Q&A questions, and run live multiple-choice polls. |
| **Shared Workspace** | Real-time shared notes, collaborative task checklist, and multi-language code editor beside the video stream. |
| **Virtual Classes** | Private lecturer-curated student allowlists (`email` or university ID), automatic attendance heartbeat logging, and CSV export. |
| **User Profiles** | Edit full name, preferred nickname (shown in chat and room tiles), department, and upload/crop a custom profile avatar (`256×256`). |
| **Low-Bandwidth & Mobile Ready** | **Data Saver mode** (360p / audio-first), PWA offline caching & install prompt, and custom **Kabmeet Signal Prism** network-aware loading states when connections are slow. |

---

## Who Uses Kabmeet (Roles & Permissions)

All permissions are **strictly enforced on the server**—never just by hiding buttons in the browser:

| Role | What They Can Do |
| :--- | :--- |
| **Visitor** | Browse public **Discover** cards and community pages; sign in to participate. |
| **Member / Student** | Watch live streams and replays, send chat messages/stickers/reactions, ask and upvote Q&A, vote in polls, edit profile/nickname/avatar, join open rooms, and raise hand to speak. |
| **Speaker** | Approved by a host or staff member to turn on microphone, camera, screen share, or slide sharing inside a room. |
| **Moderator** | Pin or delete chat messages, toggle slow mode, lock chat, manage blocked words, and review reports. |
| **Host** | Full live-room control: admit/deny waiting room guests, promote or demote speakers, mute or remove participants, and end a session for everyone. |
| **Lecturer** | Create private virtual classes, upload/manage allowed student lists, monitor live attendance, and export attendance CSVs. |
| **Admin** | Platform-wide governance: manage user accounts and roles, communities, featured sessions, and moderation reports. |

---

## Project & File Structure

The full self-hosted platform lives in `kabmeet/`, while the workspace root also provides a single-process runnable preview server (`server.ts` + `src/`):

```text
kabmeet/
├── .github/      agents, CI workflow, issue and PR templates, master prompt
├── apps/
│   ├── web/      React + Next.js (features/: discover, watch, room, chat,
│   │             classes, workspace, host-panel, admin)
│   ├── api/      NestJS server (modules/ and the Prisma database)
│   └── realtime/ Socket.IO and Yjs server
├── packages/     shared, video, config
├── infra/        docker, nginx, livekit, scripts
├── tests/        e2e, load
├── docs/         CONTRACTS, REQUESTS, REVIEWS, DEPLOYMENT, screenshots
└── docker-compose, .env.example, README, LICENSE, and config files
```

### Folder-by-Folder Breakdown

- **`kabmeet/.github/`**: GitHub Actions CI (`ci.yml` for lint, typecheck, and build verification), `CODEOWNERS`, issue/PR templates, `agents/` checklists, and `copilot-instructions.md` house rules.
- **`kabmeet/apps/web/`**: The Next.js App Router frontend styled with the IndabaX / Kabale University palette (`Indaba Deep Green #065A4B`, `Signal Green #00E676`, `KAB Blue #0072BB`, `Sun Yellow #F5EC1E`, `Night Forest #0A1F1A`) and modular `features/` folders (`auth`, `communities`, `discover`, `watch`, `room`, `chat`, `classes`, `workspace`, `host-panel`, `admin`).
- **`kabmeet/apps/api/`**: NestJS REST API with Zod validation and Prisma ORM (`schema.prisma` + SQL migrations) covering `auth`, `users`, `communities`, `sessions`, `classes`, `attendance`, `video`, and `admin`.
- **`kabmeet/apps/realtime/`**: Socket.IO server backed by Redis for sub-second chat, reactions, polls, Q&A, presence, and room signaling, plus Yjs CRDT synchronization for conflict-free collaborative notes and code.
- **`kabmeet/packages/`**:
  - `shared/`: Shared TypeScript interfaces, role enums, and Zod validation schemas reused by frontend and backend.
  - `video/`: Swappable video engine abstraction wrapping self-hosted **LiveKit** SFU and **coturn** TURN servers.
  - `config/`: Shared ESLint, TypeScript, and Tailwind presets.
- **`kabmeet/infra/`**: Production Dockerfiles (`infra/docker/`), Nginx reverse proxy configs for `ai.kab.ac.ug/indabax` (`infra/nginx/`), LiveKit + coturn configs (`infra/livekit/`), and campus bootstrap/backup scripts (`infra/scripts/`).
- **`kabmeet/tests/`**: Playwright end-to-end browser tests (`e2e/`) and k6 concurrency load tests (`load/`).
- **`kabmeet/docs/`**: Complete architecture diagrams, API/WebSocket contracts (`CONTRACTS.md`), design system tokens (`DESIGN-SYSTEM.md`), deployment runbook (`DEPLOYMENT.md`), GitHub setup guide (`GITHUB-SETUP.md`), and review notes.

---

## How the Architecture Works

Every request passes through one secure HTTPS gateway (`Nginx` / `Caddy`) into the campus backend stack:

```text
Student / Lecturer Browser or Phone (HTTPS / WSS)
                     │
         ┌───────────▼───────────┐
         │  Nginx / Caddy Proxy  │  (TLS + routing for ai.kab.ac.ug/indabax)
         └───────────┬───────────┘
      ┌──────────────┼──────────────┬───────────────┐
      ▼              ▼              ▼               ▼
  apps/web       apps/api     apps/realtime    LiveKit + coturn
 (Next.js)       (NestJS)    (Socket.IO/Yjs)   (Self-Hosted SFU)
                     │              │               │
         ┌───────────┴──────┐       │               │
         ▼                  ▼       ▼               ▼
    PostgreSQL               Redis            MinIO Storage
 (Users, Classes,       (Online Presence    (Session Replays
  Attendance, Chat)      & Pub/Sub Events)   & Slide Uploads)
```

### What Happens When Someone Joins a Session

1. A user clicks a live card on **Discover** (or **Classes** for a private lecture).
2. The web app asks the **API server** for entry; the server checks authentication, role, and class allowlist.
3. For allowed users, the API issues a scoped session pass and records attendance heartbeat timestamps in **PostgreSQL**.
4. The browser connects to **Realtime** (chat, reactions, Q&A, polls, collaborative workspace) and **LiveKit** (audio, camera, screen share).
5. If a viewer taps **Raise Hand** and the host approves, the server upgrades their token role to **Speaker** so they can publish audio/video.

---

## Technology Stack

| Layer | Technology Choice | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React, Next.js (App Router), TypeScript, Tailwind CSS, PWA | Responsive web & installable mobile app (`Oswald` + `Poppins`) |
| **Backend API** | Node.js 22, NestJS, Prisma ORM, Zod | Authentication, RBAC enforcement, sessions, classes, attendance |
| **Realtime & Workspace** | Socket.IO, Yjs, Tiptap, Monaco Editor | Live chat, floating emoji reactions, polls, collaborative code & notes |
| **Live Video** | Self-hosted **LiveKit** + **coturn** TURN | WebRTC media routing through campus firewalls with zero usage fees |
| **Databases & Storage** | PostgreSQL, Redis, MinIO | Persistent relational data, fast presence/cache, S3-compatible replays |
| **Ops & Monitoring** | Docker Compose, Nginx/Caddy, Prometheus, Grafana | Single-command campus deployment, observability, daily backups |

---

## How to Run the Project

### Option A: Quick Start (Single-Server Web + API + WebSocket App)

If you want to launch the interactive Kabmeet application immediately without Docker:

1. **Install dependencies** (from the repository root):
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   *(Optional)* Set `ADMIN_PASSCODE` in `.env`, or leave it blank to claim the initial Admin account interactively on first sign-in.
3. **Start the development server** (runs Express API + WebSocket server + Vite React UI on port `3000`):
   ```bash
   npm run dev
   ```
4. **Open in your browser**:
   Visit `http://localhost:3000` (check `/api/health` for server readiness).
5. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

---

### Option B: Full Self-Hosted Monorepo (`kabmeet/`)

To run the complete multi-service NestJS + Next.js + Socket.IO/Yjs + PostgreSQL + Redis + LiveKit monorepo:

#### Prerequisites
- **Node.js** `22.x` (see `kabmeet/.nvmrc`)
- **pnpm** `9.x`:
  ```bash
  corepack enable && corepack prepare pnpm@9.15.0 --activate
  ```
- **Docker** and **Docker Compose**

#### Setup Steps

```bash
# 1. Enter the monorepo directory
cd kabmeet

# 2. Create local environment file (never commit .env)
cp .env.example .env

# 3. Start PostgreSQL, Redis, MinIO, and LiveKit dev containers
docker compose -f docker-compose.dev.yml up -d

# 4. Install all workspace dependencies
pnpm install

# 5. Apply Prisma migrations and seed Kabale University sample communities & sessions
pnpm --filter @kabmeet/api exec prisma migrate dev
pnpm --filter @kabmeet/api exec prisma db seed

# 6. Start web (:3000), api (:4000), and realtime (:4100) in parallel
pnpm dev
```

Open **`http://localhost:3000`** once all three workspaces report ready.

---

### Option C: Production Campus Server with Docker Compose

For deploying onto Kabale University servers behind `ai.kab.ac.ug/indabax`:

```bash
cd kabmeet
cp .env.example .env
# Edit .env with strong production secrets for PostgreSQL, SESSION_SECRET, LiveKit, and MinIO

docker compose up -d --build
```

For Nginx reverse-proxy SSL setup, UDP port ranges for LiveKit/coturn, and daily database backup cron jobs, see **`kabmeet/docs/DEPLOYMENT.md`** and **`kabmeet/infra/README.md`**.

---

## Environment Variables

### Root App (`.env.example`)
| Variable | Description |
| :--- | :--- |
| `APP_URL` | Public URL where the app is hosted |
| `ADMIN_PASSCODE` | Optional passcode for claiming the first Admin user (leave empty for interactive claim) |

### Full Monorepo (`kabmeet/.env.example`)
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `APP_BASE_URL` | `http://localhost:3000` | Next.js web app URL |
| `API_BASE_URL` | `http://localhost:4000` | NestJS API server URL |
| `REALTIME_BASE_URL` | `http://localhost:4100` | Socket.IO & Yjs server URL |
| `DATABASE_URL` | `postgresql://kabmeet:...@localhost:5432/kabmeet` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis cache & Socket.IO adapter URL |
| `SESSION_SECRET` | 32+ char random string | Signing key for auth sessions |
| `LIVEKIT_URL` | `ws://localhost:7880` | Self-hosted LiveKit SFU WebSocket URL |
| `LIVEKIT_API_KEY` / `SECRET` | `devkey` / secret | LiveKit room token credentials |
| `MINIO_ENDPOINT` / keys | `http://localhost:9000` | S3-compatible replay & media bucket |

---

## Useful Scripts & Testing

### Root Quick-Start Commands
```bash
npm run dev        # Start full-stack dev server on port 3000
npm run lint       # Run TypeScript check (tsc --noEmit)
npm run build      # Build production Vite client bundle
npm start          # Run production server
```

### Monorepo Commands (`kabmeet/`)
```bash
pnpm dev           # Start web, api, and realtime together
pnpm lint          # Lint all workspaces
pnpm typecheck     # Type-check all apps and packages
pnpm test          # Run Vitest unit & integration suites
pnpm build         # Build all apps and packages
pnpm format:check  # Check formatting with Prettier
```

Playwright E2E tests and k6 load tests live in `kabmeet/tests/e2e/` and `kabmeet/tests/load/` (ensure backing services are running before executing E2E suites).

---

## Campus Hosting, Bandwidth & Data Saver Design

Kabmeet is engineered specifically for **university campus networks and mobile student connections**:

- **Estimated Pilot Server Sizing**: `8 CPU cores`, `16–32 GB RAM`, `~500 GB` disk storage (~1 GB/hour of standard recordings), one public IP (`live.kab.ac.ug` or `ai.kab.ac.ug/indabax`), and Let's Encrypt HTTPS.
- **Bandwidth Awareness**: Video uses roughly `1 Mbps` outgoing per live viewer (`100 viewers ≈ 100 Mbps`).
- **Built-in Protections**:
  - **Data Saver Mode**: Header toggle lowers stream resolution to `360p` / audio-first while keeping live chat, Q&A, polls, and workspace notes fully responsive.
  - **Slow-Network Detection**: Displays Kabmeet's animated **Signal Prism** indicator and offers one-tap Data Saver switching on weak links.
  - **Phone-Friendly Presentation**: While mobile phone browsers restrict desktop screen capture (`getDisplayMedia`), speakers on phones can tap **Share** to present **Slides / Photos** live on the stage or collaborate in **Work** (`Code & Notes`).

---

## Security, Privacy & Safe Use

- **Server-Side RBAC**: Every REST route and WebSocket event verifies the caller's role and session membership on the server (`401` when unauthenticated, `403` when unauthorized).
- **Private Virtual Classes**: Non-enrolled users cannot view, join, or fetch chat/attendance for private classes.
- **Moderation & Safety**: Hosts and moderators can lock chat, enable slow mode, block words, mute/remove disruptive peers, and handle user reports.
- **Campus Data Ownership**: User accounts, attendance logs, chat history, and recordings stay on university servers—never sold or hosted on third-party video clouds.
- **No Committed Secrets**: Keep `.env` files local; rotate `SESSION_SECRET`, `LIVEKIT_API_SECRET`, and `MINIO_SECRET_KEY` before production deployment.

---

## Development Roadmap & Status

- [x] **Phase 0**: Monorepo layout, CI/CD templates, Docker Compose stack, design tokens, theme toggle, and app shell
- [x] **Phase 1**: PostgreSQL / Prisma schema, authentication, sessions, editable user profiles (avatar + nickname), and server-side RBAC
- [x] **Phase 2**: **Discover** feed, community directories (`IndabaX`, `KAB AI`, `Huawei`, `AWS`), search, and reminders
- [x] **Phase 3**: Interactive **Room** stage, camera/mic controls, screen & mobile slide sharing, waiting room, and raise-hand promotion
- [x] **Phase 4**: **Watch** stage, Live/Top chat, Q&A, live polls, pinned banners, floating multi-emoji reactions, and double-tap likes
- [x] **Phase 5**: Private **Virtual Classes**, student allowlists, automatic attendance tracking, and CSV export
- [x] **Phase 6**: Collaborative **Workspace** (`Notes`, `Tasks`, `Code`), replay playback, and live captions
- [x] **Phase 7**: E2E & load testing scaffolds, PWA offline support, Data Saver mode, custom network loader, and deployment runbooks

---

## Contributing & Documentation

1. Read `kabmeet/CONTRIBUTING.md` and `kabmeet/.github/copilot-instructions.md` for naming conventions (`kebab-case` folders, `PascalCase` components) and folder ownership (`CODEOWNERS`).
2. Explore deeper technical references in `kabmeet/docs/`:
   - `ARCHITECTURE.md` — Detailed system diagram and data flows
   - `CONTRACTS.md` — REST endpoints and WebSocket event schemas
   - `DESIGN-SYSTEM.md` — IndabaX color tokens, typography (`Oswald` / `Poppins`), and UI accessibility rules
   - `DEPLOYMENT.md` — Production campus server & SSL guide
   - `GITHUB-SETUP.md` — Branch protection and repository workflow guide

---

**License**: See [`kabmeet/LICENSE`](./kabmeet/LICENSE).  
**Maintained for Kabale University AI Club & Deep Learning IndabaX (`ai.kab.ac.ug/indabax`).**
