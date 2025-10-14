# DotMac FTTH Operations - Upstream Sync Guide

This repository (`dotmac-ftth-ops`) is configured to pull improvements from the main `dotmac-platform-services` project.

## Repository Configuration

- **This Project**: `dotmac-ftth-ops` (FTTH Operations Platform)
- **Upstream Source**: `dotmac-platform-services` (Main Platform)

## Pulling Updates from Main Platform

When improvements are made in `dotmac-platform-services`, sync them here:

```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops

# 1. Fetch latest from main platform
git fetch upstream

# 2. See what's new
git log HEAD..upstream/main --oneline

# 3. Merge updates
git merge upstream/main

# 4. Push to dotmac-ftth-ops
git push origin main
```

## Quick Sync Command

```bash
cd ~/Downloads/Projects/dotmac-ftth-ops && \
git fetch upstream && \
git merge upstream/main && \
git push origin main
```

## Current Status

- ✅ Upstream configured: `dotmac-platform-services`
- ✅ Latest commit synced: 69ade41 (Critical security fixes)
- ✅ Ready for FTTH customizations

## Making FTTH-Specific Changes

Work on your custom features:

```bash
# Create feature branch
git checkout -b feature/ftth-inventory-management

# Make changes
git add .
git commit -m "Add FTTH fiber inventory tracking"

# Push to dotmac-ftth-ops
git push origin feature/ftth-inventory-management
```

## Testing After Upstream Sync

Always test after pulling updates:

```bash
# Backend tests
make test-fast
poetry run mypy src

# Frontend tests
cd frontend && pnpm type-check && pnpm lint
```

## Remotes Configuration

```bash
origin    → dotmac-ftth-ops (your FTTH project)
upstream  → dotmac-platform-services (source of updates)
```
