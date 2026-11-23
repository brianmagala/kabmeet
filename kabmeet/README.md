# Kabmeet

**Kabmeet** is a self-hosted live session, virtual class, and community collaboration platform built for **Kabale University** (`ai.kab.ac.ug/indabax`), bringing **IndabaX**, **KAB AI**, and student tech clubs together under one login.

Instead of sending students and lecturers out to third-party meeting tools where chat, recordings, and attendance are fragmented, Kabmeet combines:
- **Discover & Communities**: Browse live, upcoming, and recorded sessions across IndabaX, KAB AI, Huawei Student Club, and AWS Cloud Club, with search, community filters, and session reminders.
- **Watch (YouTube-style Live)**: Live stream player with real-time chat (Top chat / Live chat), role badges, pinned messages, sticker tray, floating reactions, Q&A, polls, and moderation controls.
- **Room (Google Meet-style Interactive)**: Reflowing video grid, active-speaker highlight, camera/mic/screen-share controls, raise-hand speaker promotion, waiting room, and host controls.
- **Private Virtual Classes**: Lecturer-created classes restricted to selected students on the server, with automatic attendance tracking (join time and duration) and CSV export.
- **Shared Developer Workspace**: Collaborative notes, tasks, and code editing directly beside live sessions.

## User Roles (Server-Enforced)

| Role | Capabilities |
| :--- | :--- |
| **Visitor** | Browse Discover and public community pages |
| **Member** | Watch sessions, chat, vote in polls, ask Q&A, join open rooms, raise hand |
| **Speaker** | Approved by host to publish audio/video in a session |
| **Moderator** | Pin/delete messages, toggle slow mode, manage blocked words |
| **Host** | Full session control: approve speakers, mute/remove participants, lock chat, end session |
| **Lecturer** | Create private virtual classes, manage allowed students, export attendance CSV |
| **Admin** | Manage users, roles, communities, and platform reports |

## Technology Stack (100% Self-Hosted)

- **Frontend (`apps/web`)**: Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui (Radix UI), `lucide-react`, Framer Motion, TanStack Query, Oswald & Poppins (`next/font`)
- **Backend (`apps/api`)**: Node.js 22, NestJS, TypeScript, REST API with Zod validation, Prisma ORM
- **Realtime & Workspace (`apps/realtime`)**: Socket.IO with Redis adapter, Yjs CRDT with Tiptap (notes) and Monaco (code)
- **Video & Media (`packages/video`)**: Self-hosted LiveKit SFU (`livekit-client`, `@livekit/components-react`) + `coturn` behind a single swappable service layer
- **Data & Storage**: PostgreSQL, Redis, MinIO (S3-compatible recording storage)
- **Infrastructure & Ops (`infra/`)**: Docker Compose, Nginx / Caddy with HTTPS
- **Testing (`tests/`)**: Vitest (unit/integration) and Playwright (end-to-end)

## Local Setup Instructions

### Prerequisites
- **Node.js** `22.x` (see `.nvmrc`)
- **pnpm** `9.x` (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **Docker** & **Docker Compose** (for PostgreSQL, Redis, MinIO, and LiveKit)

### 1. Configure Environment Variables
Copy the example environment file inside `kabmeet/`:
```bash
cp .env.example .env
```
Update any local secrets in `.env` as needed (never commit `.env`).

### 2. Start Backing Services
Start PostgreSQL and Redis (plus MinIO and LiveKit once configured in Step C) for local development:
```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3. Install Workspace Dependencies
```bash
pnpm install
```

### 4. Run Database Setup (Available from Phase 1)
```bash
pnpm --filter @kabmeet/api exec prisma migrate dev
pnpm --filter @kabmeet/api exec prisma db seed
```

### 5. Start Development Servers
Run all workspace apps (`web` on `:3000`, `api` on `:4000`, `realtime` on `:4100`) in parallel:
```bash
pnpm dev
```

### 6. Useful Workspace Commands
```bash
pnpm lint          # Lint all workspaces
pnpm typecheck     # Run TypeScript checks across apps and packages
pnpm test          # Run test suites
pnpm build         # Build all apps and packages
pnpm format:check  # Verify Prettier formatting
```

## Directory Structure Overview

```text
kabmeet/
├── .github/
│   ├── ISSUE_TEMPLATE/          # Bug report & feature request templates
│   ├── agents/                  # Engineering agent checklists
│   ├── workflows/ci.yml         # CI pipeline (lint, typecheck)
│   ├── CODEOWNERS               # One owner per top-level folder
│   ├── copilot-instructions.md  # Repo coding conventions
│   └── pull_request_template.md
├── apps/
│   ├── web/                     # Next.js App Router frontend
│   │   ├── public/              # Static assets, club photos, PWA icons
│   │   └── src/
│   │       ├── app/             # App Router routes & layouts
│   │       ├── components/      # Shared UI primitives (ui/) & app shell (layout/)
│   │       ├── features/        # Feature modules: auth, discover, communities,
│   │       │                    # watch, room, chat, classes, workspace,
│   │       │                    # host-panel, admin (components, hooks, api, types)
│   │       ├── lib/             # Shared client helpers
│   │       ├── mocks/           # Realistic Kabale University sample data
│   │       └── styles/          # Design tokens & global CSS
│   ├── api/                     # NestJS REST API & domain backend
│   │   ├── prisma/              # PostgreSQL schema & seed scripts
│   │   └── src/modules/         # auth, users, communities, sessions,
│   │                            # classes, attendance, video, admin
│   └── realtime/                # Socket.IO + Redis + Yjs server
│       └── src/                 # chat, polls, presence, workspace channels
├── packages/
│   ├── shared/                  # Shared Zod schemas, roles, and domain types
│   ├── video/                   # Swappable LiveKit video service abstraction
│   └── config/                  # Shared TypeScript, ESLint, and Tailwind presets
├── infra/
│   ├── docker/                  # Dockerfiles for web, api, and realtime
│   ├── nginx/                   # Reverse proxy config for ai.kab.ac.ug/indabax
│   ├── livekit/                 # LiveKit SFU & coturn configuration
│   └── scripts/                 # Server bootstrap & backup scripts
├── tests/
│   ├── e2e/                     # Playwright end-to-end tests
│   └── load/                    # Concurrent viewer & room load tests
├── docs/                        # CONTRACTS.md, ARCHITECTURE.md, DESIGN-SYSTEM.md,
│                                # DEPLOYMENT.md, REQUESTS.md, REVIEWS.md, screenshots/
├── docker-compose.yml           # Production container stack
├── docker-compose.dev.yml       # Local development backing services
├── pnpm-workspace.yaml          # pnpm monorepo workspace configuration
├── tsconfig.base.json           # Shared TypeScript compiler baseline
└── .env.example                 # Environment variable template
```

## House Rules

- **Naming**: `kebab-case` folders, `PascalCase` React component files.
- **Ownership**: One owner per folder (see `.github/CODEOWNERS`).
- **Separation of Concerns**: No business logic inside UI components; keep logic in `hooks/`, `api.ts`, and backend services.
- **Imports**: Always import via the `@/` alias within apps.
- **Security**: Server-side role enforcement on every action; never commit `.env` files.

## Roadmap & Current Status

- [x] **Phase 0 — Step A**: Monorepo layout, workspace configs, and READMEs
- [ ] **Phase 0 — Step B**: GitHub repository, labels, and branch protection
- [ ] **Phase 0 — Step C**: Docker Compose stack, design tokens, theme toggle, and app shell
- [ ] **Phase 1–7**: Accounts & roles, Discover, Room, Watch, Virtual classes, Workspace & replays, Polish & release
