# Kabmeet API & Realtime Contracts

## REST API (`/api/*`)

### Auth & Roles (Phase 1)
- `GET /api/auth/session` — Returns active user profile (`AuthUserProfile | null`), server-derived `allowedRoutes`, and `adminConfigured`.
- `POST /api/auth/register` — Registers a `MEMBER` account (role forced server-side).
- `POST /api/auth/login` — Verifies credentials via `scrypt` + `timingSafeEqual` and issues a hashed opaque session token.
- `POST /api/auth/logout` — Revokes the current session token.
- `POST /api/auth/claim-admin` — First-run Admin bootstrap (disabled automatically once an Admin exists or `ADMIN_PASSCODE` is set).

### Communities & Sessions (Phase 2)
- `GET /api/communities` & `GET /api/communities/:slug` — Lists communities, member counts, sessions, and club posts.
- `POST /api/communities/:slug/follow` — Toggles community follow for authenticated users.
- `POST /api/communities/:slug/posts` — Publishes club updates (`HOST`, `MODERATOR`, `LECTURER`, `ADMIN`).
- `GET /api/sessions` & `GET /api/sessions/:id` — Lists/fetches sessions; enforces private virtual class access (`403` if unauthorized).
- `POST /api/sessions` — Schedules or starts a session (`HOST`, `LECTURER`, `ADMIN`).
- `POST /api/sessions/:id/remind` — Saves or removes an upcoming session reminder.

### Video & Virtual Classes (Phase 3 & 5)
- `POST /api/video/token` — Issues scoped LiveKit room tokens (`canPublish` granted only to speakers/hosts).
- `GET /api/classes` & `POST /api/classes` — Lists private classes (`canJoin` computed server-side) and creates restricted rosters (`LECTURER`, `ADMIN`).
- `POST /api/classes/:id/attendance/ping` — Logs verified student attendance duration.
- `GET /api/classes/:id/attendance` & `GET /api/classes/:id/attendance.csv` — Lecturer/Admin attendance inspection and RFC-4180 CSV export.

### Admin & Safety (Phase 7)
- `POST /api/reports` — Submits moderation reports for any session.
- `GET /api/admin/overview`, `PATCH /api/admin/users/:id/role`, `POST /api/admin/communities`, `PATCH /api/admin/reports/:id` — Admin-only governance routes with audit trail.

## Realtime Events (`/ws` / Socket.IO)

- `session:init` / `presence:update` — Authoritative state sync + live/peak viewer counts.
- `chat:send`, `chat:pin`, `chat:delete`, `host:moderation` — Slow mode, blocked words, chat lock, and Sun Yellow pinned messages.
- `reaction:heart` — Floating heart stream.
- `qa:ask`, `qa:upvote`, `qa:answer` — Q&A queue & host resolution.
- `poll:create`, `poll:vote` — Live polls.
- `room:join`, `room:admit_guest`, `room:deny_guest`, `room:raise_hand`, `room:approve_speaker`, `room:demote_speaker`, `room:mute_peer`, `room:remove_peer`, `room:end_for_all` — Full waiting room & raise-hand speaker flow.
- `workspace:update_notes`, `workspace:update_code`, `workspace:add_task`, `workspace:toggle_task`, `workspace:delete_task` — Shared Notes, Code pad & Tasks sync.
- `captions:append` / `captions:line` — Live speech-to-text captions.
