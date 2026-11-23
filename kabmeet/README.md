# Kabmeet — Live Sessions, Virtual Classes & Community Collaboration for Kabale University

> **One campus login. One platform. Zero third-party meeting links.**  
> Built for the **Kabale University ("Kabville")** innovation community at **`ai.kab.ac.ug/indabax`**, uniting **IndabaX Kabale**, **KAB AI Club**, **Huawei Student Club**, and **AWS Cloud Club**.

---

## Table of Contents

1. [What Is Kabmeet?](#what-is-kabmeet)
2. [Why We Built It (The Problem We Solve)](#why-we-built-it-the-problem-we-solve)
3. [Main Features](#main-features)
4. [Who Uses Kabmeet (Roles & Permissions)](#who-uses-kabmeet-roles--permissions)
5. [Directory Structure](#directory-structure)
6. [How the Architecture Works](#how-the-architecture-works)
7. [Technology Stack (100% Self-Hosted)](#technology-stack-100-self-hosted)
8. [Local Setup Instructions](#local-setup-instructions)
9. [Production Deployment (Docker Compose)](#production-deployment-docker-compose)
10. [Environment Variables](#environment-variables)
11. [Useful Workspace Commands & Testing](#useful-workspace-commands--testing)
12. [Campus Bandwidth, Mobile & Data Saver Design](#campus-bandwidth-mobile--data-saver-design)
13. [Security, Privacy & Campus Governance](#security-privacy--campus-governance)
14. [House Rules & Documentation](#house-rules--documentation)
15. [Roadmap Status](#roadmap-status)

---

## What Is Kabmeet?

**Kabmeet** is a self-hosted live session, virtual classroom, and developer collaboration platform built directly into the Kabale University website (`ai.kab.ac.ug/indabax`). Instead of acting as a static notice board that sends students and lecturers out to third-party tools like Google Meet or Zoom, Kabmeet brings the full experience home under one campus login:

- **Discover**: The front door listing every session that is **Live Now**, **Upcoming**, or saved as a **Replay**, with search, community filters (**IndabaX**, **KAB AI**, **Huawei**, **AWS**), and session reminders.
- **Watch**: A YouTube Live–style viewing page with a large video stage on the left and **Live Chat / Top Chat**, **Q&A**, **Live Polls**, pinned messages, emoji stickers, a floating multi-emoji reaction bar (`❤️ 🔥 👏 🙌 😂 😮 🚀 💯`), double-tap `❤️` bursts, and **Shared Workspace** tabs on the right.
- **Room**: A Google Meet–style interactive room where approved speakers and members switch on their camera and microphone, share their screen (or share **Slides / Photos** from mobile), raise a hand to speak, and collaborate side-by-side.
- **Classes**: Private virtual classrooms where lecturers choose exactly which students may enter, with **automatic attendance tracking** (join timestamp + duration) and CSV export.
- **Shared Workspace (`Work`)**: Real-time collaborative **Notes**, **Tasks**, and **Code** (`Python`, `TypeScript`, `Bash`) right beside the live video.

---

## Why We Built It (The Problem We Solve)

When a meetup, class, or study jam relied on external meeting links, four things broke:

1. **People left the university site** — Every live session sent members to another app, leaving the campus portal empty.
2. **Nothing was connected** — Chat, Q&A, attendance, and replays were scattered across separate platforms instead of tied to one student account.
3. **Lecturers lacked enrollment control** — Restricting attendance strictly to registered students or checking who actually participated was tedious.
4. **External video tools are costly and off-campus** — Hosted meeting services charge per minute and keep recordings on external clouds. Kabmeet runs on campus hardware with **zero per-minute usage fees**.

---

## Main Features

| Feature | What It Does |
| :--- | :--- |
| **Live Now, Upcoming & Replays** | Clear session cards with `LIVE` badges, live viewer counts, speaker details, and replay playback. |
| **Live Chat & Top Chat** | Instant messages with role badges (`HOST`, `LECTURER`, `MODERATOR`, `SPEAKER`), message upvotes, pinned banners, and emoji stickers. |
| **Floating Multi-Emoji Reactions** | In-player floating reaction bar (`❤️ 🔥 👏 🙌 😂 😮 🚀 💯`) using `emoji-sway-float` plus double-tap stage for `❤️` like bursts. |
| **Polls & Q&A** | Quick live votes and organized, upvotable student questions that hosts can mark answered. |
| **Raise Hand & Waiting Room** | Audience members can request the stage; hosts admit waiting guests and promote/demote speakers. |
| **Camera, Mic & Screen/Slide Share** | Independent browser camera/microphone toggles, active-speaker glow ring, desktop screen sharing, and mobile photo/slide sharing. |
| **Host & Moderator Controls** | Mute or remove participants, lock chat, set slow mode intervals, block words, and end a room for everyone. |
| **Private Classes & Attendance** | Lecturer-managed student allowlists with automatic heartbeat attendance logging and CSV reports. |
| **Shared Developer Workspace** | Live collaborative notes, tasks, and code editing (`Yjs` + `Tiptap` + `Monaco`) beside the stream. |
| **Custom Profiles & Data Saver** | Editable name, nickname, department, and cropped avatar; `360p` / audio-first Data Saver mode for weak links. |

---

## Who Uses Kabmeet (Roles & Permissions)

All roles and permissions are **enforced on the server**—never just hidden in the UI:

| Role | Capabilities |
| :--- | :--- |
| **Visitor** | Browse **Discover** and public community pages. |
| **Member** | Watch sessions, chat, send reactions/stickers, vote in polls, ask/upvote Q&A, edit profile, join open rooms, and raise hand. |
| **Speaker** | Approved by host/staff to publish microphone, camera, screen share, or slide images in a session. |
| **Moderator** | Pin/delete messages, toggle slow mode, manage blocked words, and review reports. |
| **Host** | Full session control: admit waiting guests, approve/demote speakers, mute/remove participants, lock chat, and end session. |
| **Lecturer** | Create private virtual classes, manage allowed student lists, monitor attendance, and export attendance CSVs. |
| **Admin** | Manage user accounts, roles, communities, featured sessions, and platform moderation reports. |

---

## Directory Structure

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

### Detailed Tree

```text
kabmeet/
├── .github/
│   ├── ISSUE_TEMPLATE/          # Bug report & feature request templates
│   ├── agents/                  # Engineering agent checklists
│   ├── workflows/ci.yml         # CI pipeline (lint, typecheck, build)
│   ├── CODEOWNERS               # Folder ownership assignments
│   ├── copilot-instructions.md  # Repo coding conventions & master prompt rules
│   └── pull_request_template.md
├── apps/
│   ├── web/                     # React + Next.js App Router frontend
│   │   ├── public/              # Static assets, club photos, PWA manifest & icons
│   │   └── src/
│   │       ├── app/             # App Router routes & global layout
│   │       ├── components/      # Shared UI primitives (ui/) & app shell (layout/)
│   │       ├── features/        # discover, watch, room, chat, classes, workspace,
│   │       │                    # host-panel, admin, auth, communities
│   │       ├── lib/             # Shared API & realtime client helpers
│   │       └── styles/          # IndabaX design tokens & Tailwind CSS
│   ├── api/                     # NestJS REST API & Prisma backend
│   │   ├── prisma/              # schema.prisma, migrations/, and seed scripts
│   │   └── src/modules/         # auth, users, communities, sessions,
│   │                            # classes, attendance, video, admin
│   └── realtime/                # Socket.IO + Redis + Yjs server
│       └── src/                 # chat, reactions, polls, presence, workspace sync
├── packages/
│   ├── shared/                  # Shared Zod schemas, RBAC roles, and types
│   ├── video/                   # Swappable LiveKit + coturn video adapter
│   └── config/                  # Shared TypeScript, ESLint, and Tailwind presets
├── infra/
│   ├── docker/                  # Dockerfiles for web, api, and realtime
│   ├── nginx/                   # Reverse proxy config for ai.kab.ac.ug/indabax
│   ├── livekit/                 # LiveKit SFU & coturn TURN configuration
│   └── scripts/                 # Server bootstrap & scheduled backup scripts
├── tests/
│   ├── e2e/                     # Playwright end-to-end tests
│   └── load/                    # Concurrent viewer & room load tests
├── docs/                        # CONTRACTS.md, ARCHITECTURE.md, DESIGN-SYSTEM.md,
│                                # DEPLOYMENT.md, GITHUB-SETUP.md, REQUESTS.md,
│                                # REVIEWS.md, screenshots/
├── docker-compose.yml           # Full production container stack
├── docker-compose.dev.yml       # Local development backing services
├── pnpm-workspace.yaml          # pnpm monorepo workspace configuration
├── tsconfig.base.json           # Shared TypeScript compiler baseline
├── .env.example                 # Environment variable template
├── LICENSE                      # Project license
└── README.md                    # This documentation file
```

---

## How the Architecture Works

All browser and phone traffic enters through one HTTPS reverse proxy (`Nginx` or `Caddy`), routing cleanly to each service behind it:

1. **Member clicks a session** on **Discover** or **Classes**.
2. **`apps/web`** requests room/session access from **`apps/api`** (`NestJS`).
3. **`apps/api`** checks the user's authentication, role, and class allowlist in **PostgreSQL**, logs join/attendance state, and returns scoped tokens.
4. **`apps/web`** connects to **`apps/realtime`** (`Socket.IO` + `Redis` + `Yjs`) for live chat, emoji reactions, Q&A, polls, and shared code/notes, and to **LiveKit** (`packages/video` + `coturn`) for encrypted WebRTC audio, camera, and screen share.
5. **Recordings & uploads** are stored locally on campus in **MinIO** so replays remain available right on the session page.

---

## Technology Stack (100% Self-Hosted)

- **Frontend (`apps/web`)**: Next.js (App Router), React, TypeScript, Tailwind CSS, `lucide-react`, Framer Motion, TanStack Query, PWA (`Oswald` & `Poppins`).
- **Backend (`apps/api`)**: Node.js 22, NestJS, TypeScript, Zod validation, Prisma ORM.
- **Realtime & Workspace (`apps/realtime`)**: Socket.IO with Redis adapter, Yjs CRDT with Tiptap (notes) and Monaco (code).
- **Video & Media (`packages/video`)**: Self-hosted **LiveKit** SFU + **coturn** TURN server behind a clean swappable service layer.
- **Data & Storage**: PostgreSQL, Redis, MinIO (S3-compatible object storage).
- **Infrastructure & Ops (`infra/`)**: Docker Compose, Nginx/Caddy with Let's Encrypt HTTPS, Prometheus/Grafana monitoring & backup scripts.
- **Testing (`tests/`)**: Vitest, Playwright (E2E), and k6 (load testing).

---

## Local Setup Instructions

### Prerequisites
- **Node.js** `22.x` (see `.nvmrc`)
- **pnpm** `9.x`:
  ```bash
  corepack enable && corepack prepare pnpm@9.15.0 --activate
  ```
- **Docker** & **Docker Compose** (for PostgreSQL, Redis, MinIO, and LiveKit)

### Step-by-Step Setup

1. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   Update local passwords/secrets in `.env` as needed (never commit `.env`).

2. **Start Backing Services**:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

3. **Install Workspace Dependencies**:
   ```bash
   pnpm install
   ```

4. **Run Database Migrations & Seed Sample Data**:
   ```bash
   pnpm --filter @kabmeet/api exec prisma migrate dev
   pnpm --filter @kabmeet/api exec prisma db seed
   ```

5. **Start All Development Servers** (`web` on `:3000`, `api` on `:4000`, `realtime` on `:4100`):
   ```bash
   pnpm dev
   ```
   Open **`http://localhost:3000`** in your browser.

---

## Production Deployment (Docker Compose)

To launch the full containerized stack on a Kabale University server:

```bash
cp .env.example .env
# Set production values for DATABASE_URL, SESSION_SECRET, LIVEKIT_API_SECRET, and MINIO_SECRET_KEY

docker compose up -d --build
```

For Nginx HTTPS setup (`ai.kab.ac.ug/indabax`), firewall UDP port ranges (`LiveKit` + `coturn`), and daily backup schedules, consult **`docs/DEPLOYMENT.md`** and **`infra/README.md`**.

---

## Environment Variables

| Variable | Description |
| :--- | :--- |
| `APP_BASE_URL` | Frontend origin (`http://localhost:3000` in dev) |
| `API_BASE_URL` | NestJS API origin (`http://localhost:4000` in dev) |
| `REALTIME_BASE_URL` | Socket.IO / Yjs origin (`http://localhost:4100` in dev) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | Secret used to sign session tokens (32+ characters) |
| `KABMEET_SEED_PASSWORD` | Optional password for local seeded demo accounts |
| `LIVEKIT_URL` | LiveKit WebSocket endpoint (`ws://localhost:7880`) |
| `LIVEKIT_API_KEY` / `SECRET` | LiveKit credentials for issuing room access tokens |
| `MINIO_ENDPOINT` / keys | S3-compatible MinIO server and bucket (`kabmeet-recordings`) |

---

## Useful Workspace Commands & Testing

```bash
pnpm dev           # Start web, api, and realtime in parallel
pnpm lint          # Lint all workspaces
pnpm typecheck     # Run TypeScript checks across apps and packages
pnpm test          # Run unit and integration test suites
pnpm build         # Build all apps and packages
pnpm format:check  # Verify Prettier code formatting
```

End-to-end Playwright tests (`tests/e2e/`) and load tests (`tests/load/`) verify authentication, role permissions, private classes, live chat, and concurrent viewers.

---

## Campus Bandwidth, Mobile & Data Saver Design

- **Pilot Hardware Target**: 1 server with ~8 CPU cores, 16–32 GB RAM, ~500 GB storage (~1 GB/hour of recordings), 1 public IP + HTTPS certificate, and ~1 Mbps outgoing bandwidth per viewer (`100 viewers ≈ 100 Mbps`).
- **Data Saver Mode**: One-click header toggle drops video to `360p` / audio-only while keeping live chat, Q&A, polls, and workspace sync fast.
- **Mobile Phone Support**: Designed for responsive mobile viewing, chat, audio participation, double-tap `❤️` reactions, and mobile **Slide / Photo** stage sharing when phone browsers disallow `getDisplayMedia`.

---

## Security, Privacy & Campus Governance

- **Server-Side Role Checks**: Roles and private-class allowlists are verified on every REST endpoint and WebSocket message.
- **Encrypted Campus Traffic**: HTTPS for web/API and WSS/WebRTC encryption for real-time video and chat.
- **Data Stays on Campus**: Accounts, attendance records, chat logs, and video replays stay on Kabale University servers.
- **Consent & Safety**: Sessions indicate recording status clearly, and moderators/hosts have immediate tools to mute, remove, lock chat, or handle reports.

---

## House Rules & Documentation

- **Naming**: `kebab-case` folders, `PascalCase` React component files.
- **Ownership**: One owner per folder (see `.github/CODEOWNERS`).
- **Separation of Concerns**: Keep business logic in `hooks/`, `api.ts`, and backend modules—never inside UI components.
- **Imports**: Always use `@/` path aliases within apps.
- **Docs Reference**: See `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/DESIGN-SYSTEM.md`, `docs/DEPLOYMENT.md`, `docs/GITHUB-SETUP.md`, `docs/REQUESTS.md`, and `docs/REVIEWS.md`.

---

## Roadmap Status

- [x] **Phase 0**: Monorepo layout, CI workflows, Docker Compose stack, design tokens, theme toggle, and app shell
- [x] **Phase 1**: PostgreSQL/Prisma schema, authentication, profiles (avatar & nickname), and RBAC enforcement
- [x] **Phase 2**: Discover feed, community pages (`IndabaX`, `KAB AI`, `Huawei`, `AWS`), search, and reminders
- [x] **Phase 3**: Interactive Room stage, camera/mic controls, screen & mobile slide sharing, waiting room, and raise hand
- [x] **Phase 4**: Watch stage, Live/Top chat, Q&A, polls, pinned messages, floating emoji reactions, and double-tap likes
- [x] **Phase 5**: Private Virtual Classes, student allowlists, automatic attendance tracking, and CSV export
- [x] **Phase 6**: Shared developer workspace (`Notes`, `Tasks`, `Code`), session replays, and live captions
- [x] **Phase 7**: E2E & load test suites, PWA offline support, Data Saver mode, network-aware loaders, and deployment docs
