#!/usr/bin/env bash
set -euo pipefail

echo "Bootstrapping Kabmeet self-hosted environment..."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Populate secrets before running in production."
fi

mkdir -p /var/backups/kabmeet || true

docker compose up -d postgres redis minio livekit coturn
echo "Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-kabmeet}" >/dev/null 2>&1; do
  sleep 2
done

pnpm --filter @kabmeet/api prisma:generate
pnpm --filter @kabmeet/api prisma:deploy
pnpm --filter @kabmeet/api prisma:seed

echo "Kabmeet infrastructure is initialized."
