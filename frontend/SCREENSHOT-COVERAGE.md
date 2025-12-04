# UI/UX Screenshot Coverage

## 📊 Coverage Summary

| Application            | Port | Pages  | Auth Pages | Public Pages |
| ---------------------- | ---- | ------ | ---------- | ------------ |
| **ISP Ops App**        | 3001 | 49     | 40         | 9            |
| **Platform Admin App** | 3002 | 27     | 25         | 2            |
| **TOTAL**              | -    | **76** | **65**     | **11**       |

---

## 🎯 ISP Ops App (Port 3001)

### Authenticated Pages (40)

1. **Dashboard** (`/dashboard`)
2. **Subscribers** (`/dashboard/subscribers`)
3. **Network** (`/dashboard/network`)
4. **Billing Revenue** (`/dashboard/billing-revenue`)
5. **Billing** (`/dashboard/billing`)
6. **RADIUS** (`/dashboard/radius`)
7. **Devices** (`/dashboard/devices`)
8. **Settings** (`/dashboard/settings`)
9. **Analytics** (`/dashboard/analytics`)
10. **Automation** (`/dashboard/automation`)
11. **Banking** (`/dashboard/banking`)
12. **Banking v2** (`/dashboard/banking-v2`)
13. **Communications** (`/dashboard/communications`)
14. **CRM** (`/dashboard/crm`)
15. **DCIM** (`/dashboard/dcim`)
16. **Diagnostics** (`/dashboard/diagnostics`)
17. **Enhanced** (`/dashboard/enhanced`)
18. **Infrastructure** (`/dashboard/infrastructure`)
19. **IPAM** (`/dashboard/ipam`)
20. **Map** (`/dashboard/map`)
21. **Network Monitoring** (`/dashboard/network-monitoring`)
22. **Operations** (`/dashboard/operations`)
23. **Orchestration** (`/dashboard/orchestration`)
24. **Partners** (`/dashboard/partners`)
25. **PON** (`/dashboard/pon`)
26. **Profile** (`/dashboard/profile`)
27. **Projects** (`/dashboard/projects`)
28. **Resources** (`/dashboard/resources`)
29. **Sales** (`/dashboard/sales`)
30. **Scheduling** (`/dashboard/scheduling`)
31. **Security Access** (`/dashboard/security-access`)
32. **Services** (`/dashboard/services`)
33. **Support** (`/dashboard/support`)
34. **Technician** (`/dashboard/technician`)
35. **Ticketing** (`/dashboard/ticketing`)
36. **Time Tracking** (`/dashboard/time-tracking`)
37. **UI Showcase** (`/dashboard/ui-showcase`)
38. **Webhooks** (`/dashboard/webhooks`)
39. **Wireless** (`/dashboard/wireless`)
40. **Workflows** (`/dashboard/workflows`)

### Unauthenticated Pages (9)

1. **Homepage** (`/`)
2. **Login** (`/login`)
3. **Customer Portal** (`/customer-portal`)
4. **Customer Portal - Service** (`/customer-portal/service`)
5. **Customer Portal - Settings** (`/customer-portal/settings`)
6. **Customer Portal - Support** (`/customer-portal/support`)
7. **Customer Portal - Billing** (`/customer-portal/billing`)
8. **Customer Portal - Usage** (`/customer-portal/usage`)
9. **Tools - IP Calculator** (`/tools/ip-calculator`)

---

## 🏢 Platform Admin App (Port 3002)

### Authenticated Pages (25)

1. **Dashboard** (`/dashboard`) - Main overview
2. **Platform Admin** (`/dashboard/platform-admin`) - Admin home
3. **Tenants** (`/dashboard/platform-admin/tenants`) - Tenant management
4. **Licensing** (`/dashboard/platform-admin/licensing`) - License management
5. **Audit** (`/dashboard/platform-admin/audit`) - System audit logs
6. **System** (`/dashboard/platform-admin/system`) - System health
7. **Billing** (`/dashboard/billing-revenue`) - Global billing
8. **Analytics** (`/dashboard/analytics`) - Platform analytics
9. **CRM** (`/dashboard/crm`) - Customer relationships
10. **Partners** (`/dashboard/partners`) - Partner management
11. **Security** (`/dashboard/security-access`) - Access control
12. **Settings** (`/dashboard/settings`) - Global settings
13. **Integrations** (`/dashboard/integrations`) - External integrations
14. **Feature Flags** (`/dashboard/feature-flags`) - Feature toggles
15. **Jobs** (`/dashboard/jobs`) - Background jobs
16. **Plugins** (`/dashboard/plugins`) - Plugin management
17. **Workflows** (`/dashboard/workflows`) - Workflow orchestration
18. **Communications** (`/dashboard/communications`) - Messaging
19. **Notifications** (`/dashboard/notifications`) - Alerting
20. **Data Transfer** (`/dashboard/data-transfer`) - Import/Export
21. **Orchestration** (`/dashboard/orchestration`) - Service orchestration
22. **Banking** (`/dashboard/banking`) - Financial integrations
23. **Diagnostics** (`/dashboard/diagnostics`) - System diagnostics
24. **Webhooks** (`/dashboard/webhooks`) - Event hooks

### Unauthenticated Pages (2)

1. **Homepage** (`/`) - Landing page
2. **Login** (`/login`) - Authentication

---

## 🚀 How to Run

```bash
cd frontend

# Run all (3 browsers = 228 screenshots)
pnpm playwright test screenshot-capture.spec.ts

# Run a single browser (76 screenshots per browser)
pnpm playwright test screenshot-capture.spec.ts --project=chromium

# Run specific app filters
pnpm playwright test screenshot-capture.spec.ts --grep "isp-"
pnpm playwright test screenshot-capture.spec.ts --grep "platform-"
```

## 📁 Output

Screenshots are saved to: `/root/dotmac-ftth-ops/ui-ux-screenshots-intercept/`
Naming format: `{page-name}-{browser}.png`
