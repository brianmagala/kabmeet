# Kabmeet Engineering Instructions

- Follow `kebab-case` for folder names and `PascalCase` for React component filenames.
- Keep components presentational; put domain rules and data fetching in feature `hooks/`, `api.ts`, or backend services.
- Always import internal modules using the `@/` path alias.
- Never commit `.env` or hardcode secrets or raw palette hex values inside components (use CSS design tokens).
- Enforce every role and private-class check on the server in `apps/api` and `apps/realtime`.
- Use `lucide-react` icons with consistent stroke width and no emojis in the UI.
