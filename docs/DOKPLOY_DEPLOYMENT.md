# Dokploy Deployment Guide

This project is ready to run as a Docker Compose app in Dokploy using [docker-compose.yml](../docker-compose.yml).

Production deployment is image-only: Dokploy pulls prebuilt images, it does not build from source during deploy.

CI image publishing source: [.github/workflows/docker-ci.yml](../.github/workflows/docker-ci.yml)

Published image tags:
- `latest` on push to default branch
- `sha-<short-commit>` on push to default branch

## 1. Recommended Topology

Option A: Single public domain (simpler)
- Public: https://app.example.com -> frontend service (port 80)
- Configure Dokploy path routing /api/* -> backend service (port 8080)
- Set VITE_API_URL=/api/

Option B: Separate API domain
- Public: https://app.example.com -> frontend service (port 80)
- Public: https://api.example.com -> backend service (port 8080)
- Set VITE_API_URL=https://api.example.com/
- Set ALLOWED_ORIGINS=https://app.example.com

## 2. Dokploy App Setup

1. Create a new application from your Git repository.
2. Choose Docker Compose deployment mode.
3. Set compose file path to docker-compose.yml.
4. Set branch and webhook auto-deploy as needed.

If GHCR packages are private, configure Dokploy registry credentials so image pulls can authenticate.

## 3. Service Exposure in Dokploy

Option A (single domain):
- Expose frontend service only, target port 80.
- Do not expose backend service publicly.

Option B (separate API domain):
- Expose frontend service, target port 80.
- Expose backend service, target port 8080.

Database service should never be publicly exposed.

## 4. Environment Variables in Dokploy

Copy-ready presets are available in [DOKPLOY_ENV_PRESETS.md](DOKPLOY_ENV_PRESETS.md).

Minimum required:
- BACKEND_IMAGE
- FRONTEND_IMAGE
- APP_DOMAIN
- POSTGRES_DB
- POSTGRES_USER
- POSTGRES_PASSWORD
- GEMINI_API_KEY
- ALLOWED_ORIGINS
- JWT_SECRET_KEY

Recommended:
- GOOGLE_OAUTH_CLIENT_ID
- TRUSTED_PROXY_IPS
- JWT_COOKIE_SECURE=true
- JWT_COOKIE_SAME_SITE=Lax
- FREE_PLAN_RECIPE_LIMIT=75
- PAID_PLAN_RECIPE_LIMIT=-1
- FRONTEND_PORT=80
- SPRING_PROFILES_ACTIVE=prod

Notes:
- APP_DOMAIN should be hostname only (for example: app.example.com, without https://).

Frontend build-time variables are configured in GitHub Actions repository variables (not Dokploy runtime env):
- `VITE_API_URL` (default `/api/`)

Frontend Google login is runtime-configured from compose/Dokploy env:
- `GOOGLE_OAUTH_CLIENT_ID`

Frontend crawl files are runtime-generated from compose/Dokploy env:
- `PUBLIC_SITE_URL` if you want to override the canonical site origin
- otherwise the frontend falls back to `https://$APP_DOMAIN`

For immutable deploys, point image variables to SHA tags, for example:
- `BACKEND_IMAGE=ghcr.io/<namespace>/<repo>-backend:sha-abc1234`
- `FRONTEND_IMAGE=ghcr.io/<namespace>/<repo>-frontend:sha-abc1234`

The database service uses the official `postgres:17-alpine` image from `docker-compose.yml`.

## 5. First Deployment Checklist

1. Deploy once and inspect logs of frontend/backend/db.
2. Confirm backend health endpoint responds.
3. Verify frontend can call login/refresh endpoints.
4. Confirm no CORS errors in browser console.
5. Confirm cookies are set with expected attributes.
6. Confirm DB migrations and startup complete successfully.

If backend logs show `FlywaySqlException`, `PSQLException`, or `SocketTimeoutException: Connect timed out` during startup, the backend cannot reach PostgreSQL. Check these first:

- `POSTGRES_URL` resolves to a host that is reachable from the backend container.
- For bundled Docker Compose deployments, the DB host should usually be `db` on port `5432`.
- For external or managed PostgreSQL, update `POSTGRES_HOST` / `POSTGRES_PORT` and make sure firewall, network rules, and SSL requirements allow the connection.
- Confirm the `db` service is healthy before the backend starts.

Update flow after each release:
1. Push to `main` and wait for CI image publish.
2. Update `BACKEND_IMAGE` and `FRONTEND_IMAGE` to the new SHA tags in Dokploy.
3. Redeploy (Dokploy will pull new images).

## 6. Scaling Guidance

With Dokploy and Docker Compose:
- Scale frontend replicas first if traffic grows.
- Keep backend stateless and scale backend replicas next.
- Keep DB single-primary unless you add a managed DB/replication setup.
- Add external observability (logs/metrics) before increasing replicas aggressively.

For larger scale (multiple teams/services with advanced scheduling), consider k3s/Kubernetes later. For now, Dokploy is a strong operational middle ground.
