# Dokploy Environment Presets

Use one of the following presets in Dokploy for this repository.

## Option A: Single public domain with path routing

Public domains:
- App: https://app.example.com
- API: routed by Dokploy from /api/* to backend service

Set in Dokploy:
- BACKEND_IMAGE=ghcr.io/your-github-namespace/recipeai-backend:latest
- FRONTEND_IMAGE=ghcr.io/your-github-namespace/recipeai-frontend:latest
- POSTGRES_DB=recipeai
- POSTGRES_USER=recipe_user
- POSTGRES_PASSWORD=change_me
- POSTGRES_HOST=db
- POSTGRES_PORT=5432
- GEMINI_API_KEY=change_me
- GOOGLE_OAUTH_CLIENT_ID=
- APP_DOMAIN=app.example.com
- ALLOWED_ORIGINS=https://app.example.com
- SPRING_PROFILES_ACTIVE=prod
- JWT_SECRET_KEY=change_me_at_least_32_characters
- TRUSTED_PROXY_IPS=
- JWT_COOKIE_SECURE=true
- JWT_COOKIE_SAME_SITE=Lax
- FREE_PLAN_RECIPE_LIMIT=75
- PAID_PLAN_RECIPE_LIMIT=-1
- FRONTEND_PORT=80

Dokploy exposure:
- Expose frontend service on port 80
- Do not expose db service
- Backend can stay private if /api path routing is configured

## Option B: Separate public API domain

Public domains:
- App: https://app.example.com
- API: https://api.example.com

Set in Dokploy:
- BACKEND_IMAGE=ghcr.io/your-github-namespace/recipeai-backend:latest
- FRONTEND_IMAGE=ghcr.io/your-github-namespace/recipeai-frontend:latest
- POSTGRES_DB=recipeai
- POSTGRES_USER=recipe_user
- POSTGRES_PASSWORD=change_me
- POSTGRES_HOST=db
- POSTGRES_PORT=5432
- GEMINI_API_KEY=change_me
- GOOGLE_OAUTH_CLIENT_ID=
- APP_DOMAIN=app.example.com
- ALLOWED_ORIGINS=https://app.example.com
- SPRING_PROFILES_ACTIVE=prod
- JWT_SECRET_KEY=change_me_at_least_32_characters
- TRUSTED_PROXY_IPS=
- JWT_COOKIE_SECURE=true
- JWT_COOKIE_SAME_SITE=Lax
- FREE_PLAN_RECIPE_LIMIT=75
- PAID_PLAN_RECIPE_LIMIT=-1
- FRONTEND_PORT=80

Dokploy exposure:
- Expose frontend service on port 80
- Expose backend service on port 8080
- Do not expose db service

## Notes

- Keep JWT_SECRET_KEY at least 32 characters.
- In Option B, ALLOWED_ORIGINS should contain frontend domain only.
- APP_DOMAIN should be hostname only (for example: app.example.com, without https://).
- If you use both root and www frontend domains, add both to ALLOWED_ORIGINS as comma-separated values.
- Frontend build-time variables are configured in GitHub Actions repository variables: `VITE_API_URL`.
- Google login on the frontend is configured at runtime through `GOOGLE_OAUTH_CLIENT_ID` in compose/Dokploy.
- For deterministic releases, replace `latest` with SHA tags from the CI workflow.
- The database service uses the official `postgres:17-alpine` image defined in `docker-compose.yml`.
