# DotMac Platform - Deployment Topology Diagrams

**Last Updated:** November 9, 2025
**Status:** Production
**Version:** 1.0

---

## Table of Contents

1. [High-Level Deployment Topology](#high-level-deployment-topology)
2. [Control Plane Architecture](#control-plane-architecture)
3. [Tenant Namespace Layout](#tenant-namespace-layout)
4. [Shared Packages Relationship](#shared-packages-relationship)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Network Boundaries](#network-boundaries)
7. [Multi-Region Deployment](#multi-region-deployment)
8. [Build and Deployment Pipeline](#build-and-deployment-pipeline)

---

## High-Level Deployment Topology

### Kubernetes Cluster Architecture

```mermaid
graph TB
    subgraph "Kubernetes Cluster"
        subgraph "Control Plane Namespace: platform-admin"
            PA[Platform Admin App<br/>Next.js]
            PB[Platform Backend<br/>FastAPI]
            PDB[(Platform DB<br/>PostgreSQL)]
            PR[(Redis<br/>Cache)]
            PV[Vault<br/>Secrets]

            PA --> PB
            PB --> PDB
            PB --> PR
            PB --> PV
        end

        subgraph "Tenant Namespace: tenant-fast-fiber"
            TFA[ISP Ops App<br/>Next.js]
            TFB[ISP Backend<br/>FastAPI]
            TFDB[(Tenant DB<br/>PostgreSQL)]
            TFR[(Redis<br/>Cache)]
            TFRad[RADIUS]
            TFNet[NetBox<br/>IPAM]
            TFGenie[GenieACS<br/>TR-069]
            TFProm[Prometheus]

            TFA --> TFB
            TFB --> TFDB
            TFB --> TFR
            TFB --> TFRad
            TFB --> TFNet
            TFB --> TFGenie
            TFB --> TFProm
        end

        subgraph "Tenant Namespace: tenant-citynet"
            TCA[ISP Ops App<br/>Next.js]
            TCB[ISP Backend<br/>FastAPI]
            TCDB[(Tenant DB<br/>PostgreSQL)]
            TCR[(Redis<br/>Cache)]
            TCRad[RADIUS]
            TCNet[NetBox<br/>IPAM]
            TCGenie[GenieACS<br/>TR-069]
            TCProm[Prometheus]

            TCA --> TCB
            TCB --> TCDB
            TCB --> TCR
            TCB --> TCRad
            TCB --> TCNet
            TCB --> TCGenie
            TCB --> TCProm
        end

        subgraph "Shared Services Namespace: shared-services"
            Minio[MinIO<br/>Object Storage]
            Loki[Loki<br/>Log Aggregation]
            Jaeger[Jaeger<br/>Distributed Tracing]
            Backup[Velero<br/>Backup Service]
        end
    end

    subgraph "External Users"
        AdminUser[DotMac Admin]
        ISPAdmin[ISP Administrator]
        ISPStaff[ISP Staff]
        Customer[End Subscriber]
    end

    subgraph "Ingress Layer"
        IG[Ingress Controller<br/>NGINX]
        Cert[Cert Manager<br/>Let's Encrypt]
    end

    AdminUser --> IG
    ISPAdmin --> IG
    ISPStaff --> IG
    Customer --> IG

    IG --> PA
    IG --> TFA
    IG --> TCA

    IG --> Cert

    PB -.-> TFB
    PB -.-> TCB

    TFB --> Minio
    TCB --> Minio
    TFProm --> Loki
    TCProm --> Loki

    style PA fill:#4A90E2,color:#fff
    style TFA fill:#7ED321,color:#fff
    style TCA fill:#7ED321,color:#fff
    style PDB fill:#F5A623,color:#fff
    style TFDB fill:#F5A623,color:#fff
    style TCDB fill:#F5A623,color:#fff
```

### Component Distribution

```mermaid
graph LR
    subgraph "Control Plane (1 instance)"
        PA[platform-admin-app]
        PAB[platform-backend]
    end

    subgraph "Tenant Instances (N instances)"
        T1[tenant-1: isp-ops-app]
        T2[tenant-2: isp-ops-app]
        T3[tenant-3: isp-ops-app]
        TN[tenant-N: isp-ops-app]
    end

    subgraph "Shared Infrastructure"
        Packages[Shared Packages<br/>@dotmac/*]
        Images[Container Images<br/>Docker Registry]
    end

    Packages --> PA
    Packages --> T1
    Packages --> T2
    Packages --> T3
    Packages --> TN

    Images --> PA
    Images --> T1
    Images --> T2
    Images --> T3
    Images --> TN

    style PA fill:#4A90E2,color:#fff
    style T1 fill:#7ED321,color:#fff
    style T2 fill:#7ED321,color:#fff
    style T3 fill:#7ED321,color:#fff
    style TN fill:#7ED321,color:#fff
    style Packages fill:#F8E71C,color:#000
```

---

## Control Plane Architecture

### Platform Admin Components

```mermaid
graph TB
    subgraph "Platform Admin Namespace"
        subgraph "Application Layer"
            PA[platform-admin-app<br/>Port: 3000]
            PAB[platform-backend<br/>Port: 8000]
            Celery[Celery Workers<br/>Background Jobs]
        end

        subgraph "Data Layer"
            PDB[(PostgreSQL<br/>Platform DB<br/>Port: 5432)]
            PCache[(Redis<br/>Cache & Sessions<br/>Port: 6379)]
            PVault[Vault/OpenBao<br/>Secrets<br/>Port: 8200]
        end

        subgraph "Configuration"
            PCM[ConfigMap<br/>platform-config]
            PSec[Secret<br/>platform-secrets]
            PTLS[TLS Secret<br/>admin-tls]
        end

        PA --> PAB
        PAB --> PDB
        PAB --> PCache
        PAB --> PVault
        Celery --> PDB
        Celery --> PCache

        PA -.-> PCM
        PAB -.-> PCM
        PAB -.-> PSec
    end

    subgraph "External Access"
        AdminIngress[Ingress<br/>admin.dotmac.com]
        LB[Load Balancer]
    end

    LB --> AdminIngress
    AdminIngress --> PA
    AdminIngress -.-> PTLS

    subgraph "Platform Admin Features"
        TenantMgmt[Tenant Management]
        LicenseMgmt[License Management]
        FeatureFlags[Feature Flags]
        PlatformAudit[Platform Audit Logs]
        CrossTenantSearch[Cross-Tenant Search]
    end

    PA --> TenantMgmt
    PA --> LicenseMgmt
    PA --> FeatureFlags
    PA --> PlatformAudit
    PA --> CrossTenantSearch

    style PA fill:#4A90E2,color:#fff
    style PAB fill:#4A90E2,color:#fff
    style PDB fill:#F5A623,color:#fff
    style PCache fill:#BD10E0,color:#fff
```

### Platform Admin Data Model

```mermaid
erDiagram
    PLATFORM_DB {
        uuid tenant_id PK
        string tenant_slug
        string tenant_name
        string plan_tier
        int total_seats
        json feature_flags
        timestamp created_at
    }

    LICENSES {
        uuid license_id PK
        uuid tenant_id FK
        string license_type
        int allocated_seats
        int used_seats
        timestamp expires_at
    }

    FEATURE_FLAGS {
        uuid flag_id PK
        string flag_key
        boolean enabled_globally
        json tenant_overrides
        timestamp updated_at
    }

    PLATFORM_USERS {
        uuid user_id PK
        string email
        string role
        json permissions
        timestamp last_login
    }

    AUDIT_LOGS {
        uuid log_id PK
        uuid tenant_id FK
        uuid user_id FK
        string action
        json payload
        timestamp created_at
    }

    PLATFORM_DB ||--o{ LICENSES : "has many"
    PLATFORM_DB ||--o{ AUDIT_LOGS : "has many"
    PLATFORM_USERS ||--o{ AUDIT_LOGS : "performs"
```

---

## Tenant Namespace Layout

### Per-Tenant Infrastructure

```mermaid
graph TB
    subgraph "Tenant Namespace: tenant-{slug}"
        subgraph "Application Layer"
            ISP[isp-ops-app<br/>Next.js<br/>Port: 3000]
            ISPB[isp-backend<br/>FastAPI<br/>Port: 8000]
            Worker[Celery Workers<br/>Background Jobs]
        end

        subgraph "Data Layer"
            TDB[(Tenant DB<br/>PostgreSQL<br/>Port: 5432)]
            TCache[(Redis<br/>Cache & Sessions<br/>Port: 6379)]
        end

        subgraph "Network Services"
            RADIUS[FreeRADIUS<br/>Auth: 1812<br/>Acct: 1813]
            NetBox[NetBox<br/>IPAM/DCIM<br/>Port: 8080]
            GenieACS[GenieACS<br/>TR-069/CPE<br/>Port: 7547]
            WG[WireGuard<br/>VPN<br/>Port: 51820]
        end

        subgraph "Monitoring Stack"
            Prom[Prometheus<br/>Metrics<br/>Port: 9090]
            Graf[Grafana<br/>Dashboards<br/>Port: 3001]
            FB[Fluent Bit<br/>Logs]
        end

        subgraph "Configuration"
            TCM[ConfigMap<br/>tenant-config]
            TSec[Secret<br/>tenant-secrets]
            TTLS[TLS Secret<br/>tenant-tls]
        end

        ISP --> ISPB
        ISPB --> TDB
        ISPB --> TCache
        ISPB --> RADIUS
        ISPB --> NetBox
        ISPB --> GenieACS
        Worker --> TDB
        Worker --> TCache

        ISPB --> Prom
        FB --> TDB
        Prom --> Graf

        ISP -.-> TCM
        ISPB -.-> TCM
        ISPB -.-> TSec
    end

    subgraph "External Access"
        TenantIngress[Ingress<br/>{tenant}.isp.dotmac.com]
        TLB[Load Balancer]
    end

    TLB --> TenantIngress
    TenantIngress --> ISP
    TenantIngress -.-> TTLS

    subgraph "ISP Operations Features"
        Subscribers[Subscriber Management]
        Billing[Customer Billing]
        NetworkOps[Network Operations]
        Support[Support Tickets]
        CustomerPortal[Customer Self-Service]
    end

    ISP --> Subscribers
    ISP --> Billing
    ISP --> NetworkOps
    ISP --> Support
    ISP --> CustomerPortal

    style ISP fill:#7ED321,color:#fff
    style ISPB fill:#7ED321,color:#fff
    style TDB fill:#F5A623,color:#fff
    style TCache fill:#BD10E0,color:#fff
    style RADIUS fill:#50E3C2,color:#000
```

### Tenant Data Model

```mermaid
erDiagram
    TENANT_DB {
        uuid subscriber_id PK
        string account_number
        string name
        string email
        string service_plan
        timestamp created_at
    }

    DEVICES {
        uuid device_id PK
        uuid subscriber_id FK
        string serial_number
        string mac_address
        string device_type
        string status
    }

    INVOICES {
        uuid invoice_id PK
        uuid subscriber_id FK
        decimal amount
        string status
        timestamp due_date
    }

    RADIUS_SESSIONS {
        uuid session_id PK
        uuid subscriber_id FK
        string username
        string nas_ip
        timestamp start_time
        timestamp end_time
        bigint bytes_in
        bigint bytes_out
    }

    SUPPORT_TICKETS {
        uuid ticket_id PK
        uuid subscriber_id FK
        string subject
        string status
        timestamp created_at
    }

    TENANT_USERS {
        uuid user_id PK
        string email
        string role
        json permissions
    }

    TENANT_DB ||--o{ DEVICES : "has many"
    TENANT_DB ||--o{ INVOICES : "has many"
    TENANT_DB ||--o{ RADIUS_SESSIONS : "has many"
    TENANT_DB ||--o{ SUPPORT_TICKETS : "has many"
```

---

## Shared Packages Relationship

### Package Dependencies

```mermaid
graph TB
    subgraph "Applications"
        PA[platform-admin-app]
        ISP[isp-ops-app]
    end

    subgraph "Shared Packages Layer"
        subgraph "@dotmac/features"
            Analytics[analytics]
            ApiKeys[api-keys]
            Billing[billing]
            Campaigns[campaigns]
            CPE[cpe]
            CRM[crm]
            Customers[customers]
            Diagnostics[diagnostics]
            Faults[faults]
            Forms[forms]
            IPAM[ipam]
            Monitoring[monitoring]
            Network[network]
            Notifications[notifications]
            Provisioning[provisioning]
            RADIUS[radius]
            RBAC[rbac]
            Subscribers[subscribers]
        end

        subgraph "Core Packages"
            Primitives[@dotmac/primitives<br/>UI Components]
            UI[@dotmac/ui<br/>Composite UI]
            Headless[@dotmac/headless<br/>Hooks & Logic]
            GraphQL[@dotmac/graphql<br/>API Client]
            Auth[@dotmac/auth<br/>Authentication]
            DesignSystem[@dotmac/design-system<br/>Theming]
        end
    end

    PA --> Analytics
    PA --> ApiKeys
    PA --> RBAC
    PA --> Forms

    ISP --> Billing
    ISP --> Customers
    ISP --> Subscribers
    ISP --> Network
    ISP --> RADIUS
    ISP --> Provisioning
    ISP --> Faults
    ISP --> Monitoring
    ISP --> CRM
    ISP --> Campaigns

    Analytics --> UI
    Billing --> UI
    Customers --> UI
    Subscribers --> UI
    Network --> UI

    UI --> Primitives
    UI --> Headless

    PA --> Primitives
    PA --> UI
    PA --> Headless
    PA --> GraphQL
    PA --> Auth
    PA --> DesignSystem

    ISP --> Primitives
    ISP --> UI
    ISP --> Headless
    ISP --> GraphQL
    ISP --> Auth
    ISP --> DesignSystem

    GraphQL --> Headless
    Auth --> Headless

    style PA fill:#4A90E2,color:#fff
    style ISP fill:#7ED321,color:#fff
    style Primitives fill:#F8E71C,color:#000
    style UI fill:#F8E71C,color:#000
    style Headless fill:#F8E71C,color:#000
```

### Build Dependency Graph

```mermaid
graph TD
    subgraph "Build Order (Bottom-Up)"
        Level1[Level 1: Foundation]
        Level2[Level 2: Core]
        Level3[Level 3: Features]
        Level4[Level 4: Applications]
    end

    subgraph L1["Foundation Layer"]
        Primitives[@dotmac/primitives]
        DesignSystem[@dotmac/design-system]
    end

    subgraph L2["Core Layer"]
        Headless[@dotmac/headless]
        GraphQL[@dotmac/graphql]
        Auth[@dotmac/auth]
    end

    subgraph L3["Features Layer"]
        UI[@dotmac/ui]
        Features[@dotmac/features]
    end

    subgraph L4["Application Layer"]
        PlatformAdmin[platform-admin-app]
        ISPOps[isp-ops-app]
    end

    Level1 --> L1
    Level2 --> L2
    Level3 --> L3
    Level4 --> L4

    L1 --> L2
    L2 --> L3
    L3 --> L4

    Primitives --> Headless
    Primitives --> UI
    DesignSystem --> Primitives

    Headless --> GraphQL
    Headless --> Auth
    Headless --> Features

    GraphQL --> Features
    Auth --> Features
    UI --> Features

    Features --> PlatformAdmin
    Features --> ISPOps
    UI --> PlatformAdmin
    UI --> ISPOps
    Headless --> PlatformAdmin
    Headless --> ISPOps

    style Primitives fill:#F8E71C,color:#000
    style UI fill:#F8E71C,color:#000
    style Features fill:#F8E71C,color:#000
    style PlatformAdmin fill:#4A90E2,color:#fff
    style ISPOps fill:#7ED321,color:#fff
```

---

## Data Flow Diagrams

### User Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant App as App (Next.js)
    participant Backend as Backend (FastAPI)
    participant DB as Database
    participant Vault as Vault (Secrets)

    User->>Browser: Navigate to login page
    Browser->>App: GET /login
    App->>Browser: Return login form

    User->>Browser: Enter credentials
    Browser->>App: POST /api/auth/login
    App->>Backend: POST /api/v1/auth/login

    Backend->>DB: Query user credentials
    DB->>Backend: Return user data

    Backend->>Vault: Fetch JWT secret
    Vault->>Backend: Return secret

    Backend->>Backend: Generate JWT token
    Backend->>App: Return JWT + user data
    App->>Browser: Set secure cookie

    Browser->>User: Redirect to dashboard
```

### Tenant Provisioning Flow

```mermaid
sequenceDiagram
    participant Admin as Platform Admin
    participant AdminApp as platform-admin-app
    participant Backend as platform-backend
    participant K8s as Kubernetes API
    participant Helm as Helm
    participant DB as Platform DB

    Admin->>AdminApp: Create new tenant
    AdminApp->>Backend: POST /api/v1/platform/tenants

    Backend->>DB: Insert tenant metadata
    DB->>Backend: Tenant created

    Backend->>DB: Create tenant database
    DB->>Backend: Database ready

    Backend->>K8s: Create namespace
    K8s->>Backend: Namespace created

    Backend->>Helm: Install tenant chart
    Helm->>K8s: Deploy resources
    K8s->>Helm: Deployment complete
    Helm->>Backend: Installation successful

    Backend->>K8s: Create ingress
    K8s->>Backend: Ingress created

    Backend->>AdminApp: Tenant provisioned
    AdminApp->>Admin: Show tenant details

    Note over Admin,DB: Tenant URL: {tenant}.isp.dotmac.com
```

### API Request Flow (Tenant-Scoped)

```mermaid
sequenceDiagram
    participant User as ISP Staff
    participant Browser
    participant ISPApp as isp-ops-app
    participant Backend as isp-backend
    participant TenantDB as Tenant DB
    participant RADIUS

    User->>Browser: Click "View Subscribers"
    Browser->>ISPApp: GET /dashboard/subscribers

    ISPApp->>ISPApp: Check authentication
    ISPApp->>ISPApp: Get tenant context (env)

    ISPApp->>Backend: GET /api/v1/tenants/{id}/subscribers
    Note over ISPApp,Backend: Headers: X-Tenant-ID, Authorization

    Backend->>Backend: Validate JWT
    Backend->>Backend: Check permissions (customers:read)
    Backend->>Backend: Enforce tenant scope

    Backend->>TenantDB: SELECT * FROM subscribers WHERE tenant_id = ?
    TenantDB->>Backend: Return subscriber data

    Backend->>RADIUS: GET active sessions
    RADIUS->>Backend: Return session data

    Backend->>Backend: Merge subscriber + session data
    Backend->>ISPApp: Return enriched data

    ISPApp->>Browser: Render subscriber list
    Browser->>User: Display subscribers
```

### Cross-Tenant Search Flow (Platform Admin)

```mermaid
sequenceDiagram
    participant Admin as Platform Admin
    participant AdminApp as platform-admin-app
    participant Backend as platform-backend
    participant PlatformDB as Platform DB
    participant T1DB as Tenant 1 DB
    participant T2DB as Tenant 2 DB
    participant TnDB as Tenant N DB

    Admin->>AdminApp: Search for "john@example.com"
    AdminApp->>Backend: POST /api/v1/platform/search
    Note over AdminApp,Backend: Headers: X-Platform-Admin: true

    Backend->>Backend: Validate platform permissions
    Backend->>PlatformDB: Get all active tenants
    PlatformDB->>Backend: Return tenant list

    par Search Tenant 1
        Backend->>T1DB: Search subscribers
        T1DB->>Backend: Results
    and Search Tenant 2
        Backend->>T2DB: Search subscribers
        T2DB->>Backend: Results
    and Search Tenant N
        Backend->>TnDB: Search subscribers
        TnDB->>Backend: Results
    end

    Backend->>Backend: Aggregate results
    Backend->>Backend: Apply platform-level filters
    Backend->>AdminApp: Return cross-tenant results

    AdminApp->>Admin: Display results grouped by tenant
```

---

## Network Boundaries

### Network Policy Architecture

```mermaid
graph TB
    subgraph "External Traffic"
        Internet[Internet]
        LB[Load Balancer<br/>Public IP]
    end

    subgraph "Ingress Layer"
        Ingress[Ingress Controller<br/>NGINX]
        WAF[Web Application Firewall]
    end

    subgraph "Platform Admin Namespace"
        direction TB
        PA[platform-admin-app]
        PAB[platform-backend]
        PDB[(Platform DB)]
    end

    subgraph "Tenant Namespace 1"
        direction TB
        T1A[isp-ops-app]
        T1B[isp-backend]
        T1DB[(Tenant DB)]
    end

    subgraph "Tenant Namespace 2"
        direction TB
        T2A[isp-ops-app]
        T2B[isp-backend]
        T2DB[(Tenant DB)]
    end

    subgraph "Shared Services"
        Minio[MinIO]
        Loki[Loki]
    end

    Internet --> LB
    LB --> WAF
    WAF --> Ingress

    Ingress --> PA
    Ingress --> T1A
    Ingress --> T2A

    PA --> PAB
    PAB --> PDB
    PAB -.->|Can access| T1B
    PAB -.->|Can access| T2B

    T1A --> T1B
    T1B --> T1DB
    T1B --> Minio
    T1B --> Loki

    T2A --> T2B
    T2B --> T2DB
    T2B --> Minio
    T2B --> Loki

    T1B -.x|Blocked| T2B
    T1B -.x|Blocked| T2DB
    T2B -.x|Blocked| T1B
    T2B -.x|Blocked| T1DB

    style PA fill:#4A90E2,color:#fff
    style T1A fill:#7ED321,color:#fff
    style T2A fill:#7ED321,color:#fff
    style PDB fill:#F5A623,color:#fff
    style T1DB fill:#F5A623,color:#fff
    style T2DB fill:#F5A623,color:#fff
```

### Network Policy Rules

```mermaid
graph LR
    subgraph "Platform Admin Egress"
        PA[Platform Admin Pods]
        PA -->|Allow| PADB[Platform DB]
        PA -->|Allow| PARedis[Redis]
        PA -->|Allow| AllTenants[All Tenant Namespaces]
        PA -->|Allow| Internet[External Internet]
    end

    subgraph "Tenant Ingress"
        TI[Tenant Pods]
        PlatformNS[Platform Admin NS] -->|Allow| TI
        SameNS[Same Namespace] -->|Allow| TI
        OtherTenants[Other Tenant NS] -.x|Deny| TI
        ExternalInternet[External Internet] -->|Allow via Ingress| TI
    end

    subgraph "Tenant Egress"
        TE[Tenant Pods]
        TE -->|Allow| TenantDB[Tenant DB]
        TE -->|Allow| TenantRedis[Tenant Redis]
        TE -->|Allow| PlatformAPIs[Platform APIs]
        TE -->|Allow| SharedSvc[Shared Services]
        TE -->|Allow| ExternalAPI[External APIs<br/>HTTPS only]
        TE -.x|Deny| OtherTenantDBs[Other Tenant DBs]
    end

    style PA fill:#4A90E2,color:#fff
    style TI fill:#7ED321,color:#fff
    style TE fill:#7ED321,color:#fff
```

### Security Zones

```mermaid
graph TB
    subgraph "DMZ (Public Zone)"
        LB[Load Balancer]
        Ingress[Ingress Controller]
        WAF[WAF]
    end

    subgraph "Application Zone"
        PA[Platform Admin App]
        T1[Tenant 1 App]
        T2[Tenant 2 App]
    end

    subgraph "Data Zone (Restricted)"
        PDB[(Platform DB)]
        T1DB[(Tenant 1 DB)]
        T2DB[(Tenant 2 DB)]
    end

    subgraph "Secrets Zone (Highly Restricted)"
        Vault[Vault/OpenBao]
        Secrets[K8s Secrets]
    end

    Internet[Internet] --> DMZ
    DMZ --> Application Zone
    Application Zone --> Data Zone
    Application Zone -.->|TLS Only| Secrets Zone

    style DMZ fill:#FF6B6B,color:#fff
    style "Application Zone" fill:#4ECDC4,color:#fff
    style "Data Zone" fill:#F7B731,color:#fff
    style "Secrets Zone" fill:#5F27CD,color:#fff
```

---

## Multi-Region Deployment

### Geographic Distribution

```mermaid
graph TB
    subgraph "Global"
        DNS[Global DNS<br/>Route53/CloudFlare]
        CDN[CDN<br/>CloudFront/Cloudflare]
    end

    subgraph "Region: US East (Primary)"
        subgraph "us-east-1 Cluster"
            USPlatform[Platform Admin<br/>Single Instance]
            USTenant1[Tenant: US-based ISPs]
            USTenant2[Tenant: US-based ISPs]
        end
        USRDS[(RDS PostgreSQL<br/>Multi-AZ)]
    end

    subgraph "Region: Europe"
        subgraph "eu-west-1 Cluster"
            EUTenant1[Tenant: EU-based ISPs]
            EUTenant2[Tenant: EU-based ISPs]
        end
        EURDS[(RDS PostgreSQL<br/>Multi-AZ<br/>GDPR Compliant)]
    end

    subgraph "Region: Asia Pacific"
        subgraph "ap-southeast-1 Cluster"
            APTenant1[Tenant: APAC ISPs]
            APTenant2[Tenant: APAC ISPs]
        end
        APRDS[(RDS PostgreSQL<br/>Multi-AZ)]
    end

    DNS --> CDN
    CDN --> USPlatform
    CDN --> USTenant1
    CDN --> EUTenant1
    CDN --> APTenant1

    USTenant1 --> USRDS
    USTenant2 --> USRDS
    EUTenant1 --> EURDS
    EUTenant2 --> EURDS
    APTenant1 --> APRDS
    APTenant2 --> APRDS

    USPlatform -.->|Manage| EUTenant1
    USPlatform -.->|Manage| APTenant1

    style USPlatform fill:#4A90E2,color:#fff
    style USTenant1 fill:#7ED321,color:#fff
    style EUTenant1 fill:#7ED321,color:#fff
    style APTenant1 fill:#7ED321,color:#fff
```

### Data Residency Compliance

```mermaid
graph LR
    subgraph "Tenant Selection Criteria"
        Location[Tenant Location]
        Compliance[Compliance Requirements]
        Performance[Performance SLA]
    end

    subgraph "US Region"
        USCluster[US Kubernetes Cluster]
        USData[(US Data Centers<br/>- California<br/>- Virginia)]
        USCompliance[HIPAA, SOC2]
    end

    subgraph "EU Region"
        EUCluster[EU Kubernetes Cluster]
        EUData[(EU Data Centers<br/>- Ireland<br/>- Frankfurt)]
        EUCompliance[GDPR, ISO 27001]
    end

    subgraph "APAC Region"
        APCluster[APAC Kubernetes Cluster]
        APData[(APAC Data Centers<br/>- Singapore<br/>- Tokyo)]
        APCompliance[Local Regulations]
    end

    Location -->|US-based| USCluster
    Location -->|EU-based| EUCluster
    Location -->|APAC-based| APCluster

    Compliance -->|GDPR| EUCluster
    Compliance -->|HIPAA| USCluster

    Performance -->|Low latency| APCluster

    USCluster --> USData
    EUCluster --> EUData
    APCluster --> APData

    style EUCluster fill:#0052CC,color:#fff
    style EUCompliance fill:#36B37E,color:#fff
```

---

## Build and Deployment Pipeline

### CI/CD Pipeline Flow

```mermaid
graph TB
    subgraph "Source Control"
        Git[Git Repository<br/>GitHub/GitLab]
    end

    subgraph "Build Stage"
        Checkout[Checkout Code]
        InstallDeps[Install Dependencies<br/>pnpm install]
        BuildPackages[Build Shared Packages<br/>pnpm build:packages]
        BuildPlatform[Build platform-admin-app<br/>Docker Build]
        BuildISP[Build isp-ops-app<br/>Docker Build]
    end

    subgraph "Test Stage"
        Lint[Lint & Type Check<br/>ESLint + TypeScript]
        UnitTests[Unit Tests<br/>Jest]
        E2ETests[E2E Tests<br/>Playwright]
    end

    subgraph "Container Registry"
        Registry[Docker Registry<br/>ECR/GCR/ACR]
        PlatformImage[platform-admin-app:tag]
        ISPImage[isp-ops-app:tag]
    end

    subgraph "Deployment Stage"
        DeployPlatform[Deploy Platform Admin<br/>Helm upgrade]
        DeployTenants[Deploy Tenants<br/>Helm upgrade per tenant]
        HealthCheck[Health Checks<br/>Smoke Tests]
    end

    Git --> Checkout
    Checkout --> InstallDeps
    InstallDeps --> BuildPackages
    BuildPackages --> BuildPlatform
    BuildPackages --> BuildISP

    BuildPlatform --> Lint
    BuildISP --> Lint
    Lint --> UnitTests
    UnitTests --> E2ETests

    BuildPlatform --> PlatformImage
    BuildISP --> ISPImage

    PlatformImage --> Registry
    ISPImage --> Registry

    E2ETests --> DeployPlatform
    E2ETests --> DeployTenants

    DeployPlatform --> HealthCheck
    DeployTenants --> HealthCheck

    style Git fill:#F05032,color:#fff
    style Registry fill:#2496ED,color:#fff
    style HealthCheck fill:#36B37E,color:#fff
```

### Docker Build Process

```mermaid
graph LR
    subgraph "Build Context"
        Monorepo[Monorepo Root<br/>frontend/]
        Apps[apps/]
        Shared[shared/packages/]
    end

    subgraph "Multi-Stage Build"
        Base[Base Stage<br/>node:20-alpine]
        Builder[Builder Stage<br/>Install & Build]
        Runner[Runner Stage<br/>Production Runtime]
    end

    subgraph "Output Images"
        PlatformImage[platform-admin-app:tag<br/>1.2 GB compressed]
        ISPImage[isp-ops-app:tag<br/>1.5 GB compressed]
    end

    Monorepo --> Base
    Apps --> Base
    Shared --> Base

    Base --> Builder
    Builder --> Runner

    Runner --> PlatformImage
    Runner --> ISPImage

    style Monorepo fill:#F8E71C,color:#000
    style PlatformImage fill:#4A90E2,color:#fff
    style ISPImage fill:#7ED321,color:#fff
```

### Deployment Strategies

```mermaid
graph TB
    subgraph "Platform Admin Deployment (Blue-Green)"
        CurrentPA[Current Version<br/>v1.2.3]
        NewPA[New Version<br/>v1.3.0]
        Router[Router/Load Balancer]

        Router -->|100% traffic| CurrentPA
        Router -.->|0% traffic| NewPA

        NewPA -.->|Health check passes| Switch[Switch Traffic]
        Switch -->|100% traffic| NewPA
        Switch -.->|Rollback if needed| CurrentPA
    end

    subgraph "Tenant Deployment (Rolling Update)"
        Tenant1[Tenant 1<br/>v1.2.3]
        Tenant2[Tenant 2<br/>v1.2.3]
        Tenant3[Tenant 3<br/>v1.2.3]
        TenantN[Tenant N<br/>v1.2.3]

        Tenant1 --> Updated1[Tenant 1<br/>v1.3.0]
        Updated1 -.->|Wait & Verify| Tenant2
        Tenant2 --> Updated2[Tenant 2<br/>v1.3.0]
        Updated2 -.->|Wait & Verify| Tenant3
        Tenant3 --> Updated3[Tenant 3<br/>v1.3.0]
        Updated3 -.->|Continue...| TenantN
    end

    subgraph "Canary Deployment (Optional)"
        Production[Production Traffic<br/>100%]
        Stable[Stable Version<br/>v1.2.3]
        Canary[Canary Version<br/>v1.3.0]

        Production -->|95% traffic| Stable
        Production -->|5% traffic| Canary

        Canary -.->|Monitor metrics| Promote[Promote to 100%]
        Promote --> StableV2[All Traffic<br/>v1.3.0]
    end

    style CurrentPA fill:#7ED321,color:#fff
    style NewPA fill:#4A90E2,color:#fff
    style Updated1 fill:#4A90E2,color:#fff
    style Canary fill:#F5A623,color:#fff
```

---

## Summary

### Deployment Topology Key Points

1. **Control Plane**: Single `platform-admin-app` instance in dedicated namespace
2. **Tenant Instances**: One `isp-ops-app` deployment per tenant in isolated namespaces
3. **Shared Packages**: Built once, bundled into both app images
4. **Network Isolation**: Kubernetes network policies enforce tenant separation
5. **Data Isolation**: Each tenant has dedicated database (no cross-tenant data access)
6. **Geographic Distribution**: Tenants deployed in regions based on compliance and performance
7. **CI/CD Pipeline**: Monorepo build → Docker images → Helm deployments
8. **Scaling Strategy**: Platform admin (vertical), Tenants (horizontal)

### Resource Distribution

| Component | Control Plane | Per-Tenant | Shared |
|-----------|---------------|------------|--------|
| Frontend App | 1 instance | N instances | - |
| Backend API | 1 instance | N instances | - |
| PostgreSQL | 1 database | 1 database | - |
| Redis | 1 instance | 1 instance | - |
| RADIUS | - | 1 instance | - |
| NetBox | - | 1 instance | - |
| Monitoring | Platform-wide | Per-tenant | Centralized logs |
| Object Storage | - | - | Shared (bucket isolation) |

### Network Topology

- **External Access**: Load Balancer → Ingress → Apps
- **Platform to Tenants**: Allowed (management)
- **Tenant to Tenant**: Blocked (isolation)
- **Tenant to Platform**: Allowed (API calls)
- **Tenant to Internet**: Allowed (RADIUS, APIs)

### Deployment Patterns

1. **Platform Admin**: Blue-green deployment (zero downtime)
2. **Tenants**: Rolling update (staged rollout)
3. **Canary**: Optional for high-risk changes
4. **Rollback**: Automated via Helm history

---

## Related Documentation

- [DEPLOYMENT_MODEL.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/docs/architecture/DEPLOYMENT_MODEL.md) - Detailed deployment architecture
- [DEPLOYMENT_PROCESS.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/docs/deployment/DEPLOYMENT_PROCESS.md) - Step-by-step deployment guide
- [PRODUCTION_DEPLOYMENT_K8S.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/PRODUCTION_DEPLOYMENT_K8S.md) - Kubernetes manifests and Helm charts

---

**Maintained by**: DotMac Platform Engineering
**Last Review**: November 9, 2025
**Next Review**: Quarterly or when infrastructure changes occur
