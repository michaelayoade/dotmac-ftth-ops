# Quick Start Guide - Multi-App Architecture

## Overview

The DotMac FTTH platform now has **two separate frontend applications**:

1. **ISP Operations App** - For ISP tenant users
2. **Platform Admin App** - For platform super-administrators

## Installation

```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend

# Install all dependencies
pnpm install
```

## Development

### Run Both Apps Simultaneously

```bash
# Start backend + both frontend apps
pnpm dev
```

This will start:
- Backend API: http://localhost:8000
- ISP Operations App: http://localhost:3001
- Platform Admin App: http://localhost:3002

### Run Apps Individually

```bash
# ISP Operations App only
pnpm dev:isp

# Platform Admin App only
pnpm dev:admin

# Backend API only
pnpm dev:backend

# Legacy base-app (for comparison)
pnpm dev:base-app
```

## Environment Setup

### ISP Operations App

```bash
cd apps/isp-ops-app
cp .env.local.example .env.local
# Edit .env.local with your settings
```

### Platform Admin App

```bash
cd apps/platform-admin-app
cp .env.local.example .env.local
# Edit .env.local with your settings
```

## Build

```bash
# Build both apps
pnpm build

# Build individually
pnpm build:isp      # ISP Operations App
pnpm build:admin    # Platform Admin App
```

## Testing

### Type Checking

```bash
# Check all apps
pnpm type-check

# Check specific app
cd apps/isp-ops-app && pnpm type-check
cd apps/platform-admin-app && pnpm type-check
```

### Linting

```bash
# Lint all apps
pnpm lint

# Lint specific app
cd apps/isp-ops-app && pnpm lint
cd apps/platform-admin-app && pnpm lint
```

### Bundle Analysis

```bash
# Analyze ISP app
cd apps/isp-ops-app
pnpm analyze

# Analyze Platform Admin app
cd apps/platform-admin-app
pnpm analyze
```

## Key Differences

### ISP Operations App

**Purpose**: Tenant-facing operational dashboard

**Routes** (23):
- Analytics, Automation, Billing, CRM
- Devices, Diagnostics, Network Monitoring
- PON, RADIUS, Subscribers, Ticketing
- Wireless, Workflows, Sales, etc.

**NOT Included**:
- Feature flags
- Plugin management
- Licensing controls
- Platform-wide settings
- Deployment tools

**Bundle Size**: ~2.5 MB (52% smaller than base-app)

### Platform Admin App

**Purpose**: Super-admin platform management

**Routes** (42):
- All ISP routes (for visibility)
- Feature flags, Plugins, Licensing
- Jobs, Integrations, Audit
- Security, Orchestration, etc.

**Bundle Size**: ~5.8 MB (includes ISP visibility)

## Security Verification

```bash
# Verify NO admin routes in ISP app
ls apps/isp-ops-app/app/dashboard/ | grep -E "feature-flags|plugins|licensing"
# Should return nothing (exit code 1)

# Verify admin routes in Platform Admin app
ls apps/platform-admin-app/app/dashboard/ | grep -E "feature-flags|plugins|licensing"
# Should list: feature-flags, licensing, plugins
```

## Common Commands

```bash
# Clean build artifacts
pnpm clean

# Format code
pnpm format

# Check formatting
pnpm format:check

# Generate API types
pnpm generate:api-client
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on ISP app port
lsof -ti:3001 | xargs kill -9

# Kill process on Admin app port
lsof -ti:3002 | xargs kill -9
```

### Shared Packages Not Resolving

```bash
# Rebuild shared packages
pnpm -r --filter ./shared/packages/** run build

# Clear Next.js cache
pnpm clean
```

### TypeScript Errors

```bash
# Clear cache and rebuild
pnpm clean
rm -rf node_modules
pnpm install
pnpm build
```

## File Locations

### ISP Operations App
```
/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/isp-ops-app/
```

### Platform Admin App
```
/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/platform-admin-app/
```

### Legacy Base App (for comparison)
```
/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/base-app/
```

## Documentation

- **DEPLOYMENT-ARCHITECTURE.md** - Full deployment guide
- **MULTI-APP-ARCHITECTURE.md** - Implementation details
- **QUICK-START-MULTI-APP.md** - This file

## Quick Reference

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Run both apps + backend |
| `pnpm dev:isp` | Run ISP app only |
| `pnpm dev:admin` | Run admin app only |
| `pnpm build` | Build both apps |
| `pnpm build:isp` | Build ISP app |
| `pnpm build:admin` | Build admin app |
| `pnpm lint` | Lint all apps |
| `pnpm type-check` | Type check all apps |
| `pnpm clean` | Clean build artifacts |

## Next Steps

1. Create `.env.local` files for both apps
2. Run `pnpm dev` to test both apps
3. Verify ISP app runs on port 3001
4. Verify Platform Admin app runs on port 3002
5. Build both apps with `pnpm build`
6. Deploy to staging environment

## Support

For issues or questions:
1. Check DEPLOYMENT-ARCHITECTURE.md for detailed troubleshooting
2. Check MULTI-APP-ARCHITECTURE.md for architecture details
3. Review logs in `.next/` directory of each app
