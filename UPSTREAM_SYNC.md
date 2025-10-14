# DotMac FTTH Operations - Upstream Sync Guide

This repository (`dotmac-ftth-ops`) is a fork configured to pull improvements from `dotmac-platform-services`.

## Repository Configuration

- **This Project (FTTH)**: `dotmac-ftth-ops`
- **Upstream (Main Platform)**: `dotmac-platform-services`

## Pulling Updates from Main Platform

```bash
cd ~/Downloads/Projects/dotmac-ftth-ops

# 1. Fetch latest from main platform
git fetch upstream

# 2. See what's new
git log HEAD..upstream/main --oneline

# 3. Merge updates
git merge upstream/main

# 4. Push to your FTTH repo
git push origin main
```

## Quick Sync Command

```bash
cd ~/Downloads/Projects/dotmac-ftth-ops && git fetch upstream && git merge upstream/main && git push origin main
```

## Remotes

- **origin** → `dotmac-ftth-ops` (your FTTH project)  
- **upstream** → `dotmac-platform-services` (main platform)
