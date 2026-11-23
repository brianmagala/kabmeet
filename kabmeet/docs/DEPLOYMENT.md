# Self-Hosted Kabale University Deployment Guide

Kabmeet is designed to run on Kabale University servers under `https://ai.kab.ac.ug/indabax`.

## Server Requirements

- Ubuntu 22.04 LTS or 24.04 LTS
- 4 vCPU, 8 GB RAM minimum (8 vCPU / 16 GB RAM recommended for 100+ concurrent room participants)
- Docker Engine + Docker Compose v2
- Open firewall ports:
  - `80/tcp`, `443/tcp` (Nginx HTTPS & WebSockets)
  - `7881/tcp`, `50000-50200/udp` (LiveKit SFU WebRTC media)
  - `3478/udp`, `5349/tcp` (coturn STUN/TURN)

## First-Time Deployment

1. Copy `.env.example` to `.env` and replace every placeholder secret (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `COOKIE_SECRET`, `MINIO_ROOT_PASSWORD`).
2. Run the bootstrap script:
   ```bash
   chmod +x infra/scripts/bootstrap.sh
   ./infra/scripts/bootstrap.sh
   ```
3. Start the production stack:
   ```bash
   docker compose up -d --build
   ```
4. Apply Prisma migrations against PostgreSQL:
   ```bash
   docker compose exec api pnpm --filter @kabmeet/api prisma:deploy
   ```
5. Verify health checks:
   ```bash
   curl -fsS http://localhost:4000/api/health
   curl -fsS http://localhost:4100/health
   ```

## Daily Database Backups

Add a root cron job for compressed PostgreSQL snapshots:
```cron
0 2 * * * docker compose -f /opt/kabmeet/docker-compose.yml exec -T postgres pg_dump -U kabmeet kabmeet | gzip > /var/backups/kabmeet/kabmeet_$(date +\%F).sql.gz
```
