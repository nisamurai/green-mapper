#!/usr/bin/env bash
set -euo pipefail

BACKEND_IMAGE="greenmapper-backend"
FRONTEND_IMAGE="greenmapper-frontend"
NETWORK_TEST="greenmapper-test-net"
NETWORK_APP="greenmapper-app-net"

echo "==> Building backend Docker image..."
docker build -t "${BACKEND_IMAGE}" ./backend

echo "==> Building frontend Docker image..."
docker build \
  --build-arg VITE_BETTER_AUTH_BASE_URL="http://localhost:5173/api/auth" \
  --build-arg VITE_API_BASE_URL="/api" \
  -t "${FRONTEND_IMAGE}" ./frontend

echo "==> Running backend unit tests (bun, ./backend/test)..."
docker run --rm \
  -v "$(pwd)/backend:/app" \
  -w /app \
  oven/bun:1.2.9 \
  sh -c "bun install --frozen-lockfile && bun test ./test"

echo "==> Running frontend unit tests (vitest)..."
docker run --rm \
  -v "$(pwd)/frontend:/app" \
  -w /app \
  oven/bun:1.2.10 \
  sh -c "bun install --frozen-lockfile && bun run test"

echo "==> Preparing Docker network for integration tests..."
docker network inspect "${NETWORK_TEST}" >/dev/null 2>&1 || docker network create "${NETWORK_TEST}"

echo "==> Starting PostgreSQL for integration tests..."
docker rm -f greenmapper-postgres-test >/dev/null 2>&1 || true
docker run -d --name greenmapper-postgres-test \
  --network "${NETWORK_TEST}" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=greenmapper123 \
  -e POSTGRES_DB=greenmapper \
  postgres:17.4-alpine

echo "==> Waiting for PostgreSQL to become ready..."
docker run --rm --network "${NETWORK_TEST}" \
  --entrypoint sh postgres:17.4-alpine \
  -c 'until pg_isready -h greenmapper-postgres-test -U postgres >/dev/null 2>&1; do sleep 1; done'

echo "==> Starting backend for integration tests (with migrations + seeding)..."
docker rm -f greenmapper-backend-test >/dev/null 2>&1 || true
docker run -d --name greenmapper-backend-test \
  --network "${NETWORK_TEST}" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=greenmapper123 \
  -e POSTGRES_DB=greenmapper \
  -e DATABASE_URL="postgresql://postgres:greenmapper123@greenmapper-postgres-test:5432/greenmapper" \
  -e BETTER_AUTH_SECRET="b51ec3db616755ae4070273991147f02" \
  -e BETTER_AUTH_URL="http://greenmapper-backend-test:3000" \
  -e BETTER_AUTH_DISABLE_LOGGER="true" \
  "${BACKEND_IMAGE}"

echo "==> Waiting for backend HTTP to become ready..."
docker run --rm --network "${NETWORK_TEST}" \
  curlimages/curl:8.11.1 \
  sh -c 'until curl -sSf http://greenmapper-backend-test:3000/auth/session >/dev/null 2>&1; do sleep 1; done'

echo "==> Running backend integration tests (./backend/tests)..."
docker run --rm \
  --network "${NETWORK_TEST}" \
  -v "$(pwd)/backend:/app" \
  -w /app \
  -e DATABASE_URL="postgresql://postgres:greenmapper123@greenmapper-postgres-test:5432/greenmapper" \
  -e BETTER_AUTH_SECRET="b51ec3db616755ae4070273991147f02" \
  -e BETTER_AUTH_URL="http://greenmapper-backend-test:3000" \
  -e BETTER_AUTH_DISABLE_LOGGER="true" \
  oven/bun:1.2.9 \
  sh -c "bun install --frozen-lockfile && bun test ./tests"

echo "==> Stopping test containers..."
docker rm -f greenmapper-backend-test greenmapper-postgres-test >/dev/null 2>&1 || true

echo "==> Preparing Docker network for application run..."
docker network inspect "${NETWORK_APP}" >/dev/null 2>&1 || docker network create "${NETWORK_APP}"

echo "==> Starting PostgreSQL for application..."
docker rm -f greenmapper-postgres-app >/dev/null 2>&1 || true
docker run -d --name greenmapper-postgres-app \
  --network "${NETWORK_APP}" \
  -p 5252:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=greenmapper123 \
  -e POSTGRES_DB=greenmapper \
  postgres:17.4-alpine

echo "==> Waiting for PostgreSQL (app) to become ready..."
docker run --rm --network "${NETWORK_APP}" \
  --entrypoint sh postgres:17.4-alpine \
  -c 'until pg_isready -h greenmapper-postgres-app -U postgres >/dev/null 2>&1; do sleep 1; done'

echo "==> Starting backend application container..."
docker rm -f greenmapper-backend-app >/dev/null 2>&1 || true
docker run -d --name greenmapper-backend-app \
  --network "${NETWORK_APP}" \
  -p 3000:3000 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=greenmapper123 \
  -e POSTGRES_DB=greenmapper \
  -e DATABASE_URL="postgresql://postgres:greenmapper123@greenmapper-postgres-app:5432/greenmapper" \
  -e BETTER_AUTH_SECRET="b51ec3db616755ae4070273991147f02" \
  -e BETTER_AUTH_URL="http://localhost:3000" \
  -e BETTER_AUTH_DISABLE_LOGGER="true" \
  "${BACKEND_IMAGE}"

echo "==> Starting frontend application container..."
docker rm -f greenmapper-frontend-app >/dev/null 2>&1 || true
docker run -d --name greenmapper-frontend-app \
  --network "${NETWORK_APP}" \
  -p 5173:80 \
  "${FRONTEND_IMAGE}"

echo "==> All done."
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"


