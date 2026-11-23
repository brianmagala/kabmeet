# Contributing to Kabmeet

Thank you for helping build Kabmeet for the Kabale University community (`ai.kab.ac.ug/indabax`).

## House Rules

1. **Folder & File Naming**: Use `kebab-case` for all folders and `PascalCase` for React component files.
2. **One Owner Per Folder**: Each top-level app, package, and feature folder has a designated owner in `.github/CODEOWNERS`.
3. **No Business Logic in Components**: Keep UI components focused on rendering; place state, fetching, and domain rules in feature hooks, `api.ts`, or backend services.
4. **Alias Imports**: Always use the `@/` import alias inside `apps/*`.
5. **Secrets**: Never commit `.env` files, keys, or tokens. Use `.env.example` as the template.
6. **Accessibility & Copy**: Maintain WCAG AA contrast, keyboard navigation, and short, friendly student-authored copy.

## Workflow

1. Create a branch from `main` (e.g., `feat/phase-1-auth`).
2. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before opening a pull request.
3. Reference the phase label (`phase-0` through `phase-7`) in your PR.
