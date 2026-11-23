# GitHub Setup & Phase Workflow (Phase 0 Step B)

This guide sets up the Kabmeet repository on GitHub with phase labels, branch protection, and CI.

## 1. Create Private Repository & Push

```bash
git init
git add .
git commit -m "chore: Phase 0 Step A Kabmeet monorepo scaffold"
gh repo create kabmeet --private --source=. --remote=origin --push
```

## 2. Create Phase & Type Labels

```bash
for phase in phase-0 phase-1 phase-2 phase-3 phase-4 phase-5 phase-6 phase-7; do
  gh label create "$phase" --color "065A4B" --description "Kabmeet $phase deliverable" --force
done

gh label create "security" --color "E5484D" --description "Auth, RBAC, or data protection" --force
gh label create "a11y" --color "0072BB" --description "Accessibility & WCAG AA" --force
gh label create "realtime" --color "F6A623" --description "LiveKit, Socket.IO, or Yjs" --force
```

## 3. Configure `main` Branch Protection

Require pull requests, at least 1 reviewer (`@kab-ai/maintainers`), and passing `ci.yml` checks (`typecheck`, `lint`, `test`, `build`) before merging into `main`:

```bash
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  /repos/:owner/kabmeet/branches/main/protection \
  -f required_status_checks='{"strict":true,"contexts":["CI / Typecheck, Lint, Test & Build"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"dismiss_stale_reviews":true,"required_approving_review_count":1}' \
  -f restrictions=null
```
