# Auth Migration Checklist

Use one consistent pattern across all modules:
- Frontend: import the shared auth client from `frontend/shared/lib/better-auth/auth`. Do not instantiate ad-hoc clients.
- Base URLs: rely on `NEXT_PUBLIC_API_BASE_URL` (host: `http://localhost:8001` when running platform backend locally) and `NEXT_PUBLIC_WS_URL`; avoid hardcoded `platform-backend` hostnames outside Docker.
- Session fetch: use the provided `getSession`/`useSession` helpers; never call `/api/auth/get-session` with custom fetchers.
- MFA/Session/API key metrics: hit the FastAPI endpoints already validated (`/api/v1/auth/metrics`, `/api/v1/auth/api-keys/metrics`, `/api/v1/auth/me/sessions`, `/api/v1/auth/2fa/*`).
- Runtime config: read `/api/v1/platform/runtime-config` for flags, not scattered env checks.

Per-module checks:
- Auth UI: ensure login/reset flows all use the shared client and the same base URL.
- Admin & ISP apps: confirm API calls do not hardcode `platform-backend:8000`; use `NEXT_PUBLIC_API_BASE_URL`.
- Metrics/MFA/Session pages: align schemas with the FastAPI endpoints above; rely on the shared auth client for session context.
- Feature flags: consume the runtime-config endpoint; do not gate features on ad-hoc env checks.

Operational tip:
- Start backend on host port 8001 (`make start-platform`) and set `frontend/apps/platform-admin-app/.env.local` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8001` before running the frontend so auth/session calls succeed.***
