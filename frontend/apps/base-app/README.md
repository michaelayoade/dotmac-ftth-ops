# DotMac Base App

A production-ready Next.js 14 starter with full DotMac Platform Services integration.

## Features

✅ **Authentication** - JWT auth with session management & MFA support
✅ **API Client** - Type-safe HTTP client with auto token refresh
✅ **Real-time** - WebSocket support for live updates
✅ **UI Components** - 26+ pre-built packages (design system, forms, notifications)
✅ **State Management** - React Query v5 with caching
✅ **Dark Mode** - Theme switching built-in
✅ **TypeScript** - Full type safety with strict mode

## Quick Start

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Install dependencies
pnpm install

# 3. Start development server
pnpm dev          # Runs on http://localhost:3000
```

**Prerequisite**: Backend API should be running at `http://localhost:8000`

## Project Structure

```
app/                    # Next.js 14 App Router
├── page.tsx           # Homepage with API health check
├── layout.tsx         # Root layout with providers
├── auth/              # Authentication pages
└── dashboard/         # Protected dashboard pages

lib/                   # Utilities and configuration
├── config.ts          # Environment configuration
└── http-client.ts     # Pre-configured API client

providers/             # React providers
└── ClientProviders.tsx # All client-side providers
```

## Available Packages

This app has access to 26+ packages from the monorepo:

- `@dotmac/auth` - Authentication with JWT & MFA
- `@dotmac/http-client` - Type-safe API client
- `@dotmac/ui` - Component library
- `@dotmac/design-system` - Design tokens & theming
- `@dotmac/notifications` - Toast notifications
- `@dotmac/analytics` - Analytics tracking
- `@dotmac/file-upload` - File upload components
- And many more...

## Scripts

```bash
pnpm dev        # Start development server
pnpm build      # Build for production
pnpm start      # Start production server
pnpm lint       # Run ESLint
pnpm type-check # Check TypeScript types
pnpm clean      # Clean build artifacts
```

## Environment Variables

```env
# Required
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_ENVIRONMENT=development

# Optional
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_PRODUCT_NAME=DotMac Platform
NEXT_PUBLIC_PRODUCT_TAGLINE="Reusable SaaS backend and APIs to launch faster."
NEXT_PUBLIC_COMPANY_NAME=DotMac Platform
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
NEXT_PUBLIC_LOGO_LIGHT=
NEXT_PUBLIC_LOGO_DARK=
NEXT_PUBLIC_LOGO_ICON=
NEXT_PUBLIC_FAVICON=/favicon.ico
NEXT_PUBLIC_BRAND_PRIMARY=#0ea5e9
NEXT_PUBLIC_BRAND_PRIMARY_FOREGROUND=#ffffff
NEXT_PUBLIC_BRAND_PRIMARY_HOVER=#0284c7
NEXT_PUBLIC_BRAND_PRIMARY_HOVER_DARK=#38bdf8
NEXT_PUBLIC_BRAND_ACCENT=#0ea5e9
NEXT_PUBLIC_BRAND_ACCENT_FOREGROUND=#0f172a
NEXT_PUBLIC_BRAND_ACCENT_DARK=#38bdf8
NEXT_PUBLIC_BRAND_ACCENT_FOREGROUND_DARK=#0f172a
NEXT_PUBLIC_BRAND_FONT_HEADING="Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
NEXT_PUBLIC_BRAND_FONT_BODY="Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
NEXT_PUBLIC_BRAND_RADIUS_LG=0.5rem
NEXT_PUBLIC_BRAND_RADIUS_MD=0.375rem
NEXT_PUBLIC_BRAND_RADIUS_SM=0.25rem
```

### Branding Initializer

```bash
# Generate .env.branding with interactive prompts
pnpm branding:init
```

The script saves your answers in `.env.branding` (and can append to `.env.local`). Restart `pnpm dev` so Next.js picks up the updates.

## Customization

1. **Run `pnpm branding:init`** to scaffold env variables, then tweak `platformConfig.branding` / `platformConfig.theme` in `lib/config.ts` if you need token-level control.
2. **Theme Styles**: Adjust Tailwind utilities in `tailwind.config.ts` and baseline CSS variables in `app/globals.css`.
3. **Auth**: Choose provider variant in `ClientProviders.tsx` (Simple/Secure/Enterprise).
4. **API**: Update endpoints in `lib/config.ts`.
5. **Pages**: Add your routes in the `app/` directory.

## Production Deployment

### Docker

```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
```

### Vercel

```bash
vercel deploy
```

### Manual

```bash
pnpm build
pnpm start
```

## Known Issues

### Storybook Smoke Test

**Issue**: `pnpm storybook:smoke` fails with webpack compilation errors.

**Root Cause**: Known incompatibility between `@storybook/nextjs` 8.6.14 and Next.js 14.2.x webpack configuration. The error occurs during webpack's cache shutdown phase:

```
TypeError: Cannot read properties of undefined (reading 'tap')
```

**Workaround**:

- Webpack caching is disabled in `.storybook/main.ts` to mitigate the issue
- Storybook smoke test is **not** included in CI workflow
- Regular Storybook dev server (`pnpm storybook`) works for manual testing

**Resolution Timeline**:

- ✅ Short-term: Skipped in CI, documented here
- ⏳ Medium-term: Wait for Storybook 8.7+ or Next.js 15 with better compatibility
- 🔄 Alternative: Consider Storybook 7.6.x (stable with Next.js 14)

**Related**: [Storybook Issue #24708](https://github.com/storybookjs/storybook/issues/24708)

## Next Steps

1. Set up your backend API at `localhost:8000`
2. Copy `.env.example` to `.env` and configure
3. Customize branding and theme
4. Add your business logic and pages
5. Deploy to production

---

Built with the DotMac Platform Services boilerplate.
