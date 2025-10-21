# Portal Route Hierarchy - Visual Guide

**Date:** October 20, 2025
**Status:** ✅ COMPLETE
**Purpose:** Visual representation of portal hierarchy and route structure

---

## 3-Tier Hierarchy

The DotMac ISP platform operates on **3 distinct levels**, and the routes reflect this hierarchy:

```
┌─────────────────────────────────────────────────────────────────┐
│                       PLATFORM LEVEL                            │
│                  (DotMac Platform Operations)                   │
│                                                                 │
│  /platform/*                  /platform-reseller/*              │
│  Platform Admin Portal        Platform Reseller Portal          │
│  • DotMac admins             • MSPs selling DotMac              │
│  • Manage ISP tenants        • Manage their ISP clients         │
│  • Platform billing          • Revenue from ISPs                │
│  • System health             • Sales enablement                 │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ ISP tenants
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                          ISP LEVEL                              │
│              (Individual ISP Operations)                        │
│                                                                 │
│  /isp/*          /tenant/*           /isp-reseller/*            │
│  ISP Ops         Tenant Self-Svc     ISP Reseller               │
│  • ISP staff     • ISP admins        • Sales agents             │
│  • Subscribers   • Platform subs     • Customer referrals       │
│  • Network ops   • ISP billing       • Commissions              │
│  • Billing       • Add-ons           • Performance              │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ End subscribers
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CUSTOMER LEVEL                            │
│                      (End Users)                                │
│                                                                 │
│                    /customer/*                                  │
│                 Customer Portal                                 │
│                 • End subscribers                               │
│                 • Service details                               │
│                 • Billing & usage                               │
│                 • Support tickets                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Route to Portal Mapping

### Visual Flow Chart

```
User Type                    Portal                      Route
────────────────────────────────────────────────────────────────────

DotMac Admin          ──→   Platform Admin       ──→   /platform/*
                            (Manage ISP tenants)

MSP/White-label       ──→   Platform Reseller    ──→   /platform-reseller/*
                            (Sell DotMac to ISPs)

────────────────────────────────────────────────────────────────────

ISP Staff             ──→   ISP Operations       ──→   /isp/*
                            (Daily operations)

ISP Administrator     ──→   Tenant Self-Service  ──→   /tenant/*
                            (Manage ISP settings)

Sales Agent           ──→   ISP Reseller         ──→   /isp-reseller/*
                            (Sell ISP services)

────────────────────────────────────────────────────────────────────

End Subscriber        ──→   Customer Portal      ──→   /customer/*
                            (Manage account)
```

---

## Reseller Hierarchy Clarity

### Platform Reseller vs. ISP Reseller

```
┌────────────────────────────────────────────────────────────┐
│                   Platform Reseller                        │
│               /platform-reseller/*                         │
├────────────────────────────────────────────────────────────┤
│ WHO: MSPs, white-label partners                           │
│ SELLS: DotMac ISP Platform (SaaS)                         │
│ TO: New ISP businesses                                     │
│ MANAGES: ISP tenants (their clients)                      │
│ EARNS: Revenue from ISP subscriptions                     │
│                                                            │
│ Example: MSP sells DotMac to "Fiber Co ISP"               │
│   • Creates ISP tenant                                     │
│   • Gets commission on monthly subscription                │
│   • Provides support to ISP                                │
└────────────────────────────────────────────────────────────┘
                         │
                         │ Platform tenant
                         ▼
┌────────────────────────────────────────────────────────────┐
│                    ISP Reseller                            │
│                 /isp-reseller/*                            │
├────────────────────────────────────────────────────────────┤
│ WHO: Sales agents, referral partners                      │
│ SELLS: Internet services (connectivity)                   │
│ TO: End customers                                          │
│ REFERS: Customer to ISP                                   │
│ EARNS: Commission per customer                            │
│                                                            │
│ Example: Sales agent brings customer to Fiber Co ISP      │
│   • Refers customer                                        │
│   • Gets commission per signup                             │
│   • Tracks their sales performance                         │
└────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### Platform Level → ISP Level → Customer Level

```
┌──────────────────────┐
│  DotMac Platform     │   /platform/*
│  (Platform Admin)    │   Manages ISP tenants
└──────────┬───────────┘
           │
           │ Creates & manages
           ▼
┌──────────────────────┐
│  Fiber Co ISP        │   /tenant/* (ISP admin view)
│  (ISP Tenant)        │   Manages ISP subscription
└──────────┬───────────┘
           │
           │ Operates as
           ▼
┌──────────────────────┐
│  Fiber Co ISP Ops    │   /isp/* (ISP staff view)
│  (Daily Operations)  │   Manages subscribers & network
└──────────┬───────────┘
           │
           │ Serves
           ▼
┌──────────────────────┐
│  John Smith          │   /customer/*
│  (End Subscriber)    │   Views service & pays bills
└──────────────────────┘
```

---

## URL Structure Examples

### Full URL Hierarchy

```
PLATFORM LEVEL
──────────────────────────────────────────────────────────────
https://app.dotmac.com/platform
https://app.dotmac.com/platform/tenants
https://app.dotmac.com/platform/tenants/fiber-co-isp
https://app.dotmac.com/platform/audit
https://app.dotmac.com/platform/billing

https://app.dotmac.com/platform-reseller
https://app.dotmac.com/platform-reseller/tenants
https://app.dotmac.com/platform-reseller/tenants/fiber-co-isp
https://app.dotmac.com/platform-reseller/billing

ISP LEVEL
──────────────────────────────────────────────────────────────
https://app.dotmac.com/isp
https://app.dotmac.com/isp/subscribers
https://app.dotmac.com/isp/subscribers/john-smith
https://app.dotmac.com/isp/network/fiber/cables
https://app.dotmac.com/isp/billing/invoices

https://app.dotmac.com/tenant
https://app.dotmac.com/tenant/services
https://app.dotmac.com/tenant/billing/addons
https://app.dotmac.com/tenant/automation

https://app.dotmac.com/isp-reseller
https://app.dotmac.com/isp-reseller/referrals
https://app.dotmac.com/isp-reseller/commissions

CUSTOMER LEVEL
──────────────────────────────────────────────────────────────
https://app.dotmac.com/customer
https://app.dotmac.com/customer/service
https://app.dotmac.com/customer/billing/invoices
https://app.dotmac.com/customer/usage
```

---

## Route Naming Logic

### Why These Names?

```
/platform/*
├─ "platform" = DotMac platform level
├─ User: Platform administrators
└─ Scope: All ISP tenants

/platform-reseller/*
├─ "platform" = They operate at platform level
├─ "reseller" = They resell the platform
├─ User: MSPs, white-label partners
└─ Scope: ISP tenants they manage

/isp/*
├─ "isp" = ISP operations level
├─ User: ISP staff (techs, support, ops)
└─ Scope: Single ISP's operations

/tenant/*
├─ "tenant" = ISP as a tenant of the platform
├─ User: ISP administrators
└─ Scope: Their ISP's platform subscription

/isp-reseller/*
├─ "isp" = They operate at ISP level
├─ "reseller" = They resell ISP services
├─ User: Sales agents, referral partners
└─ Scope: Customers they referred

/customer/*
├─ "customer" = End subscriber level
├─ User: Residential/business customers
└─ Scope: Their own account
```

---

## Migration Path Visual

### Old Routes → New Routes

```
BEFORE                              AFTER
────────────────────────────────────────────────────────────

/dashboard/platform-admin/*   ──→   /platform/*
  ❌ Nested & unclear              ✅ Top-level & explicit

/partner/*                    ──→   /platform-reseller/*
  ❌ Which partner?                ✅ Platform-level reseller

/dashboard/*                  ──→   /isp/*
  ❌ Generic "dashboard"           ✅ Explicit ISP operations

/tenant/*                     ──→   /tenant/*
  ✅ Already perfect               ✅ No change

/portal/*                     ──→   /isp-reseller/*
  ❌ Generic "portal"              ✅ ISP-level reseller

/customer-portal/*            ──→   /customer/*
  ❌ Redundant "-portal"           ✅ Concise & clear
```

---

## Permission Scoping Visual

### Route-Based Access Control

```
┌─────────────────────────────────────────────────────────────┐
│ /platform/*                                                 │
│ Permission: platform:*:*                                    │
│ Scope: Cross-tenant (all ISP tenants)                      │
│ Users: DotMac platform administrators only                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ /platform-reseller/*                                        │
│ Permission: platform:reseller:*                             │
│ Scope: ISP tenants managed by this reseller                │
│ Users: MSPs, white-label partners                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ /isp/*                                                      │
│ Permission: isp:*:* (tenant-scoped)                        │
│ Scope: Single ISP tenant (implicit)                        │
│ Users: ISP staff (employees of that ISP)                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ /tenant/*                                                   │
│ Permission: tenants:*                                       │
│ Scope: Own ISP tenant                                       │
│ Users: ISP administrators                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ /isp-reseller/*                                             │
│ Permission: isp:reseller:* (tenant-scoped)                 │
│ Scope: Customers they referred                             │
│ Users: Sales agents, referral partners                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ /customer/*                                                 │
│ Permission: customer:self:*                                 │
│ Scope: Own account only                                     │
│ Users: End subscribers                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Business Flow Diagram

### How Different Portals Interact

```
                    ┌─────────────────────┐
                    │   Platform Admin    │
                    │   /platform/*       │
                    │ (DotMac Admins)     │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
  │ Platform       │  │ ISP Tenant 1   │  │ ISP Tenant 2   │
  │ Reseller       │  │ "Fiber Co"     │  │ "Metro ISP"    │
  │ /platform-     │  │ /tenant/*      │  │ /tenant/*      │
  │  reseller/*    │  └────────────────┘  └────────────────┘
  └────────────────┘           │                   │
       │                       │                   │
       │ Manages               │ Operates          │ Operates
       │ ISP clients           │ as                │ as
       │                       ▼                   ▼
       │              ┌────────────────┐  ┌────────────────┐
       └────────────► │ ISP Operations │  │ ISP Operations │
                      │ /isp/*         │  │ /isp/*         │
                      │ (Staff view)   │  │ (Staff view)   │
                      └────────┬───────┘  └────────┬───────┘
                               │                   │
                  ┌────────────┼────────┐         ...
                  │            │        │
                  ▼            ▼        ▼
          ┌───────────┐ ┌───────────┐ ┌───────────┐
          │ ISP       │ │ Customer  │ │ Customer  │
          │ Reseller  │ │ Portal    │ │ Portal    │
          │ /isp-     │ │ /customer │ │ /customer │
          │ reseller/*│ │   /*      │ │   /*      │
          └───────────┘ └───────────┘ └───────────┘
              │               │             │
              └───Refers──────┘             │
                                            │
                                   Manages their account
```

---

## Quick Decision Tree

### "Which Portal Am I Building For?"

```
START: Who is the user?
│
├─ DotMac employee?
│  ├─ Managing ISP tenants? ────────────► /platform/*
│  └─ Platform operations? ─────────────► /platform/*
│
├─ MSP/Partner?
│  ├─ Selling DotMac to ISPs? ──────────► /platform-reseller/*
│  └─ Selling ISP services? ────────────► /isp-reseller/*
│
├─ ISP employee?
│  ├─ Daily operations? ────────────────► /isp/*
│  ├─ Managing ISP settings? ───────────► /tenant/*
│  └─ Admin of the ISP? ────────────────► /tenant/*
│
└─ End subscriber?
   └─ Managing their account? ──────────► /customer/*
```

---

## Summary Table

| Route | Level | User | What They Manage |
|-------|-------|------|------------------|
| `/platform/*` | Platform | DotMac admins | ISP tenants |
| `/platform-reseller/*` | Platform | MSPs | ISP clients they sold DotMac to |
| `/isp/*` | ISP | ISP staff | Subscribers, network, billing |
| `/tenant/*` | ISP | ISP admins | Their ISP's platform subscription |
| `/isp-reseller/*` | ISP | Sales agents | Customers they referred |
| `/customer/*` | Customer | End users | Their own account |

---

## Related Documentation

1. [Portal Route Structure](./PORTAL_ROUTE_STRUCTURE.md) - Full route proposal
2. [Tenant Management Architecture](./TENANT_MANAGEMENT_ARCHITECTURE.md) - Tenant management patterns
3. [Portal UI Alignment Fix](./PORTAL_UI_ALIGNMENT_FIX.md) - Portal UI specifications

---

**Created:** October 20, 2025
**Purpose:** Visual guide to portal hierarchy and routes
**Status:** ✅ Complete
