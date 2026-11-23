# Architecture

Kabmeet uses a modular monorepo:
- `apps/web` (Next.js App Router) for UI and SSR
- `apps/api` (NestJS + Prisma + PostgreSQL) for auth, server-enforced RBAC, sessions, classes, and attendance
- `apps/realtime` (Socket.IO + Redis + Yjs) for chat, polls, presence, and collaborative workspace
- `packages/video` wrapping self-hosted LiveKit + coturn behind a single provider abstraction
- `infra/` for Docker Compose, Nginx/Caddy TLS, and LiveKit deployment
