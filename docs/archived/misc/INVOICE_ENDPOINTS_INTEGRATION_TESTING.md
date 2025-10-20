# Invoice Endpoints Integration Testing Guide

**Date:** October 19, 2025
**Status:** Ready for Testing
**Type:** Frontend-Backend Integration

---

## Overview

This document provides comprehensive testing procedures for the newly implemented invoice email and payment reminder endpoints. Both frontend and backend components are ready for integration testing.

---

## Pre-Testing Verification ✅

### Backend Status
- ✅ Endpoints implemented and registered
- ✅ Service methods created
- ✅ Type checking passed (0 errors)
- ✅ Server running with auto-reload
- ✅ OpenAPI schema generated

### Frontend Status
- ✅ `useInvoiceActions` hook ready
- ✅ TypeScript type checking passed (no errors in invoice-related files)
- ✅ API paths match backend exactly
- ✅ Error handling implemented
- ✅ Toast notifications configured

---

## Test Environment Setup

### 1. Start Backend Server

```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops
poetry run uvicorn dotmac.platform.main:app --host 0.0.0.0 --port 8000 --reload
```

**Verify:**
- Server starts without errors
- Endpoints registered: `/api/v1/billing/invoices/{invoice_id}/send` and `/remind`
- OpenAPI docs available at `http://localhost:8000/docs`

### 2. Configure Email Service

Ensure email service is configured in backend settings:

```python
# Check src/dotmac/platform/settings.py
SMTP_HOST = "localhost"  # or your SMTP server
SMTP_PORT = 587
SMTP_USER = "noreply@example.com"
```

**Note:** For testing, you can use a test email service like Mailtrap or configure a local SMTP server.

### 3. Start Frontend Development Server

```bash
cd frontend
pnpm dev
```

**Verify:**
- Frontend starts at `http://localhost:3000`
- No build errors
- Can navigate to billing/invoices page

---

## Test Scenarios

### Test 1: Send Invoice Email (Success Case)

**Objective:** Verify invoice email can be sent successfully

**Steps:**
1. Navigate to Billing > Invoices
2. Click on an invoice to open detail modal
3. Click "Send Email" button
4. Verify confirmation dialog appears
5. Click "Confirm"

**Expected Results:**
- ✅ Loading state shows during API call
- ✅ Toast notification: "Invoice Sent"
- ✅ Description: "Invoice has been sent successfully"
- ✅ Modal remains open
- ✅ Backend logs show email sent
- ✅ Email delivered to invoice billing_email

**Backend Verification:**
```bash
# Check server logs for:
# "Invoice email sent successfully"
# tenant_id: "demo-alpha"
# invoice_id: "inv_xxx"
# recipient: "customer@example.com"
```

**API Request:**
```http
POST /api/v1/billing/invoices/inv_123/send
Authorization: Bearer {token}
X-Tenant-ID: demo-alpha
Content-Type: application/json

{
  "email": null
}
```

**API Response:**
```json
{
  "success": true,
  "message": "Invoice email sent successfully to customer@example.com",
  "invoice_id": "inv_123"
}
```

---

### Test 2: Send Invoice Email with Custom Email

**Objective:** Verify email can be sent to a different recipient

**Steps:**
1. Open invoice detail modal
2. Click "Send Email" button
3. Enter custom email in dialog: `alternate@example.com`
4. Click "Confirm"

**Expected Results:**
- ✅ Email sent to custom address instead of billing_email
- ✅ Toast shows: "Invoice has been sent successfully to alternate@example.com"
- ✅ Backend logs show custom email recipient

---

### Test 3: Send Payment Reminder (OPEN Invoice)

**Objective:** Verify reminder can be sent for open invoice

**Steps:**
1. Open an OPEN status invoice
2. Click "Send Reminder" button
3. Optionally add custom message
4. Click "Send"

**Expected Results:**
- ✅ Loading state during API call
- ✅ Toast: "Reminder Sent"
- ✅ Description: "Payment reminder has been sent successfully"
- ✅ Email delivered with reminder template
- ✅ No urgency banner (not overdue)

**API Request:**
```http
POST /api/v1/billing/invoices/inv_123/remind
Authorization: Bearer {token}
X-Tenant-ID: demo-alpha
Content-Type: application/json

{
  "message": "Please arrange payment at your earliest convenience."
}
```

**API Response:**
```json
{
  "success": true,
  "message": "Payment reminder sent successfully for invoice INV-2025-001",
  "invoice_id": "inv_123"
}
```

---

### Test 4: Send Payment Reminder (OVERDUE Invoice)

**Objective:** Verify urgency notice appears for overdue invoices

**Steps:**
1. Open an OVERDUE status invoice
2. Click "Send Reminder" button
3. Add custom urgent message
4. Click "Send"

**Expected Results:**
- ✅ Email includes red urgency banner
- ✅ Banner text: "⚠️ URGENT: This invoice is now OVERDUE..."
- ✅ Custom message highlighted in email
- ✅ Professional tone maintained

**Email Content Verification:**
```
Subject: Payment Reminder: Invoice INV-2025-001

⚠️ URGENT: This invoice is now OVERDUE.
Please arrange payment immediately to avoid service interruption.

Message from billing team:
[Custom message here]

Invoice Number: INV-2025-001
Amount Due: USD 150.00
Due Date: 2025-10-10
Status: OVERDUE
```

---

### Test 5: Send Reminder with Custom Message

**Objective:** Verify custom message is included in email

**Steps:**
1. Open any remindable invoice (OPEN, OVERDUE, or PARTIALLY_PAID)
2. Click "Send Reminder"
3. Enter custom message: "Your payment is now 5 days overdue. Please contact us if you need payment arrangements."
4. Click "Send"

**Expected Results:**
- ✅ Custom message appears in email body
- ✅ Message highlighted in blue box (HTML version)
- ✅ Professional formatting maintained

---

### Test 6: Error Handling - Invoice Not Found

**Objective:** Verify proper error handling for non-existent invoice

**Steps:**
1. Manually call API with invalid invoice ID
2. Observe error response

**Expected Results:**
- ✅ Status code: 404
- ✅ Error message: "Invoice not found"
- ✅ Toast: "Failed to Send Invoice" (or "Failed to Send Reminder")
- ✅ Descriptive error message shown

**API Request:**
```bash
curl -X POST http://localhost:8000/api/v1/billing/invoices/invalid_id/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: demo-alpha" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**API Response:**
```json
{
  "detail": "Invoice not found"
}
```

---

### Test 7: Error Handling - Invalid Status for Reminder

**Objective:** Verify reminders can't be sent for paid/void invoices

**Steps:**
1. Open a PAID status invoice
2. Attempt to send reminder

**Expected Results:**
- ✅ Status code: 400
- ✅ Error message: "Cannot send reminder for invoice with status: paid"
- ✅ Toast: "Failed to Send Reminder"
- ✅ Descriptive error message

**Frontend Implementation:**
The frontend should disable the "Send Reminder" button for non-remindable statuses:
- PAID
- VOID
- CANCELLED
- DRAFT

---

### Test 8: Error Handling - Email Service Failure

**Objective:** Verify proper handling of email service failures

**Steps:**
1. Temporarily misconfigure email service (e.g., wrong SMTP host)
2. Attempt to send invoice email
3. Observe error handling

**Expected Results:**
- ✅ Status code: 500
- ✅ Error message: "Failed to send invoice email"
- ✅ Toast: "Failed to Send Invoice"
- ✅ Backend logs error details
- ✅ User-friendly error message (not internal details)

---

### Test 9: Loading States

**Objective:** Verify UI shows appropriate loading states

**Steps:**
1. Click "Send Email" button
2. Observe button state during API call
3. Wait for response

**Expected Results:**
- ✅ Button shows loading spinner
- ✅ Button text changes to "Sending..."
- ✅ Button is disabled during request
- ✅ Other actions disabled
- ✅ Loading state clears on success/error

---

### Test 10: Concurrent Requests

**Objective:** Verify system handles multiple simultaneous requests

**Steps:**
1. Open multiple invoices in different tabs
2. Send emails from all tabs simultaneously
3. Observe results

**Expected Results:**
- ✅ All requests processed independently
- ✅ No race conditions
- ✅ Each request gets correct response
- ✅ Toast notifications for each action
- ✅ No server errors

---

## Email Template Verification

### Invoice Email Template Checklist

**Text Version:**
- [ ] Invoice number displayed
- [ ] Amount due shown
- [ ] Due date formatted correctly
- [ ] Status displayed
- [ ] Notes included (if any)
- [ ] Professional closing
- [ ] App name in signature

**HTML Version:**
- [ ] Invoice details in structured table
- [ ] Professional styling
- [ ] Mobile-responsive
- [ ] No broken images
- [ ] Correct colors and fonts

### Payment Reminder Template Checklist

**Text Version:**
- [ ] Invoice number and status
- [ ] Amount due vs original amount
- [ ] Due date
- [ ] Urgency notice (if overdue)
- [ ] Custom message (if provided)
- [ ] Professional tone
- [ ] Disclaimer about duplicate payments

**HTML Version:**
- [ ] Structured table with invoice details
- [ ] Red urgency banner (overdue only)
- [ ] Blue highlighted box for custom message
- [ ] Professional styling
- [ ] Mobile-responsive

---

## Performance Testing

### Response Time Benchmarks

**Expected Response Times:**
- Send Invoice Email: < 2 seconds
- Send Payment Reminder: < 2 seconds
- Invoice Not Found: < 100ms
- Invalid Status: < 100ms

**Load Testing:**
```bash
# Test 100 concurrent requests
ab -n 100 -c 10 -T 'application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: demo-alpha" \
  http://localhost:8000/api/v1/billing/invoices/inv_123/send
```

**Expected:**
- ✅ All requests succeed
- ✅ Average response time < 2s
- ✅ No 500 errors
- ✅ No memory leaks

---

## Security Testing

### Authentication Tests

**Test 1: No Token**
```bash
curl -X POST http://localhost:8000/api/v1/billing/invoices/inv_123/send \
  -H "X-Tenant-ID: demo-alpha" \
  -H "Content-Type: application/json"
```
**Expected:** 401 Unauthorized

**Test 2: Invalid Token**
```bash
curl -X POST http://localhost:8000/api/v1/billing/invoices/inv_123/send \
  -H "Authorization: Bearer invalid_token" \
  -H "X-Tenant-ID: demo-alpha"
```
**Expected:** 401 Unauthorized

**Test 3: Missing Tenant ID**
```bash
curl -X POST http://localhost:8000/api/v1/billing/invoices/inv_123/send \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 400 Bad Request or 401 Unauthorized

### Tenant Isolation Tests

**Test:** Access invoice from different tenant
1. Login as Tenant A
2. Try to send email for Tenant B's invoice

**Expected:**
- ✅ 404 Not Found (invoice doesn't exist in tenant context)
- ✅ No cross-tenant data leakage

### Input Validation Tests

**Test 1: Extremely Long Custom Message**
```json
{
  "message": "A".repeat(2000)
}
```
**Expected:** 400 Bad Request (max 1000 chars)

**Test 2: SQL Injection Attempt**
```json
{
  "email": "test@example.com'; DROP TABLE invoices; --"
}
```
**Expected:** Email validation fails or safely escaped

---

## Integration Testing Checklist

### Pre-Deployment Verification

**Backend:**
- [ ] All endpoints return correct status codes
- [ ] Error messages are user-friendly
- [ ] Logging captures all events
- [ ] Email service is configured
- [ ] SMTP connection successful
- [ ] Email templates render correctly
- [ ] No database errors
- [ ] Tenant isolation working

**Frontend:**
- [ ] TypeScript compiles without errors (invoice-related files)
- [ ] Build succeeds
- [ ] UI elements render correctly
- [ ] Loading states work
- [ ] Error messages display
- [ ] Toast notifications appear
- [ ] Modal behavior correct
- [ ] Button states correct

**End-to-End:**
- [ ] Send invoice email (default recipient)
- [ ] Send invoice email (custom recipient)
- [ ] Send reminder (OPEN invoice)
- [ ] Send reminder (OVERDUE invoice)
- [ ] Send reminder with custom message
- [ ] Error handling (404)
- [ ] Error handling (400)
- [ ] Error handling (500)
- [ ] Concurrent requests
- [ ] Authentication required
- [ ] Tenant isolation enforced

---

## Known Issues and Limitations

### Current Limitations
1. **No Email Queue**: Emails sent synchronously (could timeout on large volumes)
2. **No Preview**: Can't preview email before sending
3. **No Scheduling**: Can't schedule emails for later
4. **No Bulk Send**: One invoice at a time
5. **No PDF Attachment**: Invoice PDF not attached to emails (future enhancement)
6. **No Email Tracking**: Open/click tracking not implemented

### Workarounds
1. **Email Queue**: For production, consider implementing background task queue (Celery, Redis)
2. **Preview**: Show email content in modal before sending (future enhancement)
3. **Bulk Send**: Frontend can send multiple requests in parallel

---

## Troubleshooting Guide

### Issue: Email Not Received

**Possible Causes:**
1. Email service not configured
2. SMTP connection failed
3. Email marked as spam
4. Invalid recipient email

**Debug Steps:**
1. Check backend logs for email send confirmation
2. Verify SMTP configuration
3. Test SMTP connection manually
4. Check spam folder
5. Use test email service (Mailtrap) to verify email content

### Issue: 500 Error When Sending

**Possible Causes:**
1. Email service down
2. Database connection lost
3. Invoice data corrupt

**Debug Steps:**
1. Check backend logs for stack trace
2. Verify email service connectivity
3. Check database connection
4. Test with different invoice

### Issue: "Cannot send reminder for invoice with status: X"

**Cause:** Invoice status not remindable

**Solution:**
- Only OPEN, OVERDUE, and PARTIALLY_PAID invoices can receive reminders
- Frontend should disable button for other statuses
- Check invoice status before attempting to send

---

## Success Criteria

### Definition of Done

**Backend:**
- ✅ Both endpoints implemented and functional
- ✅ All error cases handled gracefully
- ✅ Emails sent successfully
- ✅ Templates render correctly
- ✅ Logging comprehensive
- ✅ No type errors
- ✅ Performance acceptable (< 2s response)

**Frontend:**
- ✅ Hook implemented and working
- ✅ UI integration complete
- ✅ Error handling robust
- ✅ Loading states implemented
- ✅ Toast notifications working
- ✅ No TypeScript errors
- ✅ Build succeeds

**Integration:**
- ✅ End-to-end flow works
- ✅ Errors handled gracefully
- ✅ User experience smooth
- ✅ Security requirements met
- ✅ Performance acceptable

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Deploy to staging environment
2. Conduct user acceptance testing (UAT)
3. Gather user feedback
4. Fix any issues found in UAT
5. Deploy to production
6. Monitor error rates and performance
7. Plan future enhancements

### If Tests Fail ❌
1. Document failing tests
2. Prioritize by severity
3. Fix critical issues first
4. Retest after fixes
5. Repeat until all pass

---

## Monitoring in Production

### Metrics to Track
- Email send success rate
- Email delivery rate
- Average response time
- Error rate by endpoint
- User adoption (how often feature is used)
- Bounce rate
- Spam complaints

### Alerts to Configure
- Email send failure rate > 5%
- Response time > 3 seconds
- Error rate > 1%
- SMTP connection failures

---

**Document Status:** ✅ READY FOR TESTING
**Date:** October 19, 2025
**Next Action:** Begin integration testing following test scenarios above
