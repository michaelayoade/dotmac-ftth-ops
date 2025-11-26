# Bundle Analysis

Use Next.js bundle analyzer already wired into each app:
- Admin app: `pnpm analyze:admin` (or `:server` / `:browser` for per-target reports).
- ISP app: `pnpm analyze:isp` (or `:server` / `:browser`).

Notes:
- Set `NEXT_PUBLIC_API_BASE_URL` to a reachable backend before running builds; analyzer still works if the backend is down, but mock data may be needed.
- Reports emit in the app directory (`.next/analyze`). Review both client and server bundles and keep critical pages under size budgets.***
