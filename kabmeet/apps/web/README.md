# @kabmeet/web

Next.js (App Router) frontend for Kabmeet (`ai.kab.ac.ug/indabax`).

## Structure

- `src/app` — App Router pages and layouts
- `src/components/ui` — Shared UI primitives (shadcn/ui / Radix)
- `src/components/layout` — App shell, navigation bar, footer, mobile bottom bar
- `src/features/*` — Domain feature modules (`auth`, `discover`, `communities`, `watch`, `room`, `chat`, `classes`, `workspace`, `host-panel`, `admin`)
- `src/lib` — Client utilities, API client, query client
- `src/mocks` — Realistic sample data for local UI development
- `src/styles` — Design tokens and global Tailwind styles
- `public` — Static assets, club photos, PWA manifest & icons

## House Rules

- Import via `@/` alias (`@/features/...`, `@/components/...`)
- `PascalCase` component files, `kebab-case` folders
- Keep business logic in `hooks/` and `api.ts`, never inside UI components
