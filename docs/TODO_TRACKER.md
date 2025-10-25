# TODO & Stub Tracker

Consolidated list of outstanding TODOs, placeholders, and stubbed implementations that still need to be wired up. Items are grouped by area; each entry lists the source file and line number for quick reference.

## Customer Portal

- [x] **Usage history API** – ✅ Implemented `GET /api/v1/customer/usage/history` endpoint that returns daily/hourly usage data from RADIUS accounting records (`src/dotmac/platform/customer_portal/router.py:441`).
- [x] **Usage report endpoint** – ✅ Implemented `POST /api/v1/customer/usage/report` endpoint that generates PDF usage reports using ReportLab (`src/dotmac/platform/customer_portal/router.py:477`).
- [x] **Invoice PDF endpoint** – ✅ Implemented `GET /api/v1/customer/invoices/{id}/download` endpoint that generates invoice PDFs using the existing ReportLab generator (`src/dotmac/platform/customer_portal/router.py:530`).
- [x] **Add payment method tokenization** – ✅ Implemented Stripe-like card tokenization with secure `StripeCardElement` component that includes card validation (Luhn algorithm), error handling, and proper UI/UX (`frontend/apps/base-app/components/billing/StripeCardElement.tsx`, `frontend/apps/base-app/components/tenant/billing/AddPaymentMethodModal.tsx:1-189`). Includes comprehensive documentation for production Stripe.js migration.
- [x] **AutoPay toggle** – ✅ Implemented complete AutoPay workflow with backend API and frontend integration (`src/dotmac/platform/customer_portal/router.py:849`, `frontend/apps/base-app/app/customer-portal/billing/page.tsx:499-544`).

## Tenant Portal

- [x] **Usage analytics placeholder** – ✅ Implemented real API integration using `useCreateUsageRecord` hook for manual usage record creation (`frontend/apps/base-app/app/tenant/billing/usage/page.tsx:312`).
- [x] **Wireless dashboard data** – ✅ Implemented real API integration using `createAccessPoint` method from `useAccessPoints` hook (`frontend/apps/base-app/app/tenant/wireless/page.tsx:243`).

## Shared Frontend Hooks

- [x] **RADIUS hooks** – ✅ Implemented real API calls to `/api/v1/radius/subscribers` and `/api/v1/radius/sessions` in all three apps (`frontend/apps/base-app/hooks/useRADIUS.ts`, `frontend/apps/platform-admin-app/hooks/useRADIUS.ts`, `frontend/apps/isp-ops-app/hooks/useRADIUS.ts`).

## Backend / GraphQL / Services

- [x] **On-call schedule integration** – ✅ Implemented complete on-call schedule system with database models, service layer, API router, and integration with alarm notifications (`src/dotmac/platform/fault_management/oncall_service.py`, `src/dotmac/platform/fault_management/oncall_router.py`, `src/dotmac/platform/fault_management/tasks.py:124-177`).
- [x] **Wireless metrics derivation** – ✅ Implemented real data queries for 6 GHz client count and average signal strength/SNR from WirelessClient table (`src/dotmac/platform/graphql/queries/wireless.py:905-965`).

## Documentation & Tests

- [x] **Websocket campaign rate limiting** – ✅ Implemented rate limiting (30 commands/minute per user) for all WebSocket control commands including job controls (pause/cancel) and campaign controls (pause/resume/cancel) in `src/dotmac/platform/realtime/websocket_authenticated.py`. Uses sliding window algorithm with in-memory tracking.
- [x] **Billing TODO fixes test** – ✅ Test file contains comprehensive tests for billing integration invoice creation (`tests/billing/test_todo_fixes.py:1-111`). Tests verify real service usage and error handling.

Feel free to append new items as more stubs/TODOs are discovered. When you implement one, update this document to keep the tracker current.
