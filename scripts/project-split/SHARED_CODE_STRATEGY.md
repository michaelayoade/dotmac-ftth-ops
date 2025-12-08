# Shared Code Delivery Strategy

## Decision: Git Submodule + Editable Install

### Rationale

1. **Platform Services (Backend)**: Use as **editable pip install** from local path
   - Allows development without publishing
   - Changes reflect immediately
   - Version pinning via git commit SHA

2. **Shared Frontend Packages**: Use **pnpm workspace** with packages in each repo
   - Initially: Copy packages to each project
   - Later: Extract to separate repo as git submodule

### Implementation

#### Backend: dotmac-platform-services

```bash
# In both control-plane and isp-app pyproject.toml:
dependencies = [
    "dotmac-platform-services @ file:///${PROJECT_ROOT}/../dotmac-platform-services",
]

# Or for production, use git:
dependencies = [
    "dotmac-platform-services @ git+https://github.com/michaelayoade/dotmac-platform-services.git@v1.0.0",
]
```

#### Development Setup

```bash
# Clone all three repos side by side
cd ~/Downloads/Projects
git clone <platform-services-repo>
git clone <control-plane-repo>  # After extraction
git clone <isp-app-repo>        # After extraction

# Install platform-services in editable mode
cd dotmac-platform-services
pip install -e .

# Install control-plane with platform-services as dep
cd ../dotmac-control-plane
pip install -e .

# Install isp-app with platform-services as dep
cd ../dotmac-isp-app
pip install -e .
```

### Frontend Packages

For now, shared packages are **copied** to each project. Future options:

1. **Option A: Separate npm packages** (recommended for production)
   - Publish @dotmac/* packages to private npm registry
   - Version independently
   - Better for CI/CD

2. **Option B: Git submodule** (simpler)
   - Single `dotmac-shared-packages` repo
   - Submodule in each project under `frontend/shared/packages`
   - Shared source, single update point

3. **Option C: Turborepo with remote caching**
   - Keep packages in monorepo
   - Use Turborepo remote cache for builds

### Current Approach (Phase 1)

```
dotmac-control-plane/
├── frontend/
│   ├── apps/
│   │   ├── platform-admin-app/
│   │   └── ...
│   └── shared/
│       └── packages/          # COPIED from ftth-ops
│           ├── headless/
│           ├── primitives/
│           └── ...
└── pyproject.toml             # References platform-services

dotmac-isp-app/
├── frontend/
│   ├── apps/
│   │   ├── isp-ops-app/
│   │   └── ...
│   └── shared/
│       └── packages/          # COPIED from ftth-ops (same)
│           ├── headless/
│           ├── primitives/
│           └── ...
└── pyproject.toml             # References platform-services
```

### Migration to Submodule (Future)

```bash
# 1. Create shared packages repo
cd ~/Downloads/Projects
mkdir dotmac-shared-packages
cd dotmac-shared-packages
git init
cp -r ../dotmac-ftth-ops/frontend/shared/packages/* .
git add . && git commit -m "Initial shared packages"
git remote add origin <repo-url>
git push -u origin main

# 2. Replace copied packages with submodule in each project
cd ../dotmac-control-plane
rm -rf frontend/shared/packages
git submodule add <repo-url> frontend/shared/packages

cd ../dotmac-isp-app
rm -rf frontend/shared/packages
git submodule add <repo-url> frontend/shared/packages
```

### Version Management

| Component | Versioning Strategy |
|-----------|---------------------|
| platform-services | Git tags (v1.0.0, v1.1.0) |
| control-plane | Semantic versioning |
| isp-app | Semantic versioning |
| shared-packages | Git commit SHA (submodule) or npm semver |

### CI/CD Considerations

```yaml
# Example GitHub Actions for control-plane
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive  # If using submodules

      - name: Clone platform-services
        run: |
          git clone https://github.com/michaelayoade/dotmac-platform-services.git ../dotmac-platform-services
          cd ../dotmac-platform-services && git checkout v1.0.0

      - name: Install dependencies
        run: |
          pip install -e ../dotmac-platform-services
          pip install -e .

      - name: Run tests
        run: pytest
```

### Secrets and API Keys

- Platform services pulls secrets from **Vault/SSM**
- Each project has its own secret namespace:
  - `secret/control-plane/*`
  - `secret/isp/{tenant_id}/*`
- API keys for inter-service communication stored in Vault
- Never hardcoded, always injected via environment or sidecar
