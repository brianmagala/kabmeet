# Security Policy

## Reporting a Vulnerability

If you discover a security issue in Kabmeet (such as role bypass, private class access leakage, or authentication flaws), please do **not** open a public GitHub issue.

Report privately to the Kabale University AI Club / IndabaX engineering maintainers at `security@ai.kab.ac.ug` with:
- A clear description of the vulnerability and affected route or module
- Steps to reproduce
- Potential impact on student or lecturer accounts

## Security Baselines

- All role and private-class permissions are enforced on the server (`apps/api` and `apps/realtime`).
- Never commit `.env` files, database credentials, or LiveKit secrets.
- Input payloads are validated with Zod before reaching business logic.
