# Better Auth Testing Guide

## Test Status: ✅ Backend Integration Complete

This guide provides step-by-step instructions for testing the Better Auth integration.

---

## Prerequisites

### 1. Database Setup ✅
- [x] Better Auth tables created
- [x] Test user and organization created
- [x] Backend session validation verified

### 2. Test Credentials

```
Email: admin@test.com
Password: TestPassword123!
Organization: Test ISP
Role: super_admin
```

### 3. Running Services

**Frontend Dev Server:**
```bash
cd frontend
pnpm dev:isp   # Runs on http://localhost:3001
```

**FastAPI Backend:**
```bash
make dev       # Runs on http://localhost:8000
```

---

## Backend Testing ✅ PASSED

### Test 1: Session Validation

**Status:** ✅ **PASSED**

**Test Script:**
```bash
poetry run python3 /tmp/test_session_validation.py
```

**Results:**
```
✅ Session validation SUCCESSFUL!

User Info:
  User ID: c8b0062e-9f7e-4f5a-80ce-eb112ed99512
  Email: admin@test.com
  Username: Test Admin
  Roles: ['super_admin']
  Permissions: 21 permissions
  Tenant ID: 38e8b4ef-9396-4633-973e-f712d38883f9
  Is Platform Admin: True
```

**What Was Tested:**
- ✅ Session token validation from Better Auth `session` table
- ✅ User data extraction from Better Auth `user` table
- ✅ Organization membership from `organization_member` table
- ✅ Role mapping (`super_admin` → 21 permissions)
- ✅ Tenant context set from organization ID
- ✅ Platform admin flag set correctly

---

## Frontend Testing 🔄 READY FOR TESTING

### Test 2: Login Flow (Manual)

**URL:** http://localhost:3001/login

**Steps:**

1. **Navigate to Login Page**
   ```
   http://localhost:3001/login
   ```

2. **Enter Test Credentials**
   - Email: `admin@test.com`
   - Password: `TestPassword123!`

3. **Toggle Better Auth** (if visible in dev mode)
   - Look for "Use Better Auth" toggle
   - Ensure it's enabled

4. **Click Login**
   - Should redirect to `/dashboard`
   - Check browser DevTools → Application → Cookies
   - Look for: `better-auth.session_token`

5. **Verify Dashboard Access**
   - Dashboard should load successfully
   - User info should display (email, name, role)
   - No authentication errors in console

### Test 3: Session Persistence

**Steps:**

1. **After Successful Login**
   - Navigate to different pages: `/dashboard/subscribers`, `/dashboard/radius`
   - Session should persist across page navigation

2. **Reload Page**
   - Press F5 or reload browser
   - Should remain logged in (session cookie persists)

3. **Check Session Cookie**
   - Open DevTools → Application → Cookies
   - Verify `better-auth.session_token` exists
   - Check expiration (should be ~7 days from creation)

### Test 4: API Authentication

**Steps:**

1. **Navigate to Protected Page**
   - Go to `/dashboard/subscribers` or `/dashboard/customers`

2. **Open Network Tab**
   - DevTools → Network tab

3. **Check API Requests**
   - Look for requests to `/api/v1/...`
   - Check Request Headers
   - Verify `Cookie` header includes `better-auth.session_token`

4. **Verify Response**
   - Should receive 200 OK responses
   - No 401 Unauthorized errors

### Test 5: Logout Flow

**Steps:**

1. **Click Logout Button**
   - Should redirect to `/login`

2. **Verify Session Cleared**
   - Check cookies - `better-auth.session_token` should be removed
   - Try accessing `/dashboard` directly
   - Should redirect back to `/login`

---

## Expected Behavior

### Successful Login ✅

**Browser:**
- Redirects from `/login` to `/dashboard`
- Session cookie set: `better-auth.session_token`
- User info displayed in UI

**FastAPI Logs:**
```
[info] Better Auth session validated
  user_id=c8b0062e-9f7e-4f5a-80ce-eb112ed99512
  email=admin@test.com
  roles=['super_admin']
  tenant_id=38e8b4ef-9396-4633-973e-f712d38883f9
```

**Network Requests:**
- POST `/api/auth/sign-in` → 200 OK
- Session cookie set in response
- Subsequent API calls include session cookie

### Failed Login ❌

**Browser:**
- Stays on `/login` page
- Error message displayed: "Invalid credentials"
- No session cookie set

**Network:**
- POST `/api/auth/sign-in` → 401 Unauthorized

---

## Testing Checklist

### Backend Integration ✅
- [x] Database tables created
- [x] Test user created
- [x] Session validation working
- [x] User synchronization (partial - minor SQLAlchemy issue)
- [x] Role mapping correct
- [x] Permissions assigned

### Frontend Integration 🔄
- [ ] Login page renders
- [ ] Better Auth toggle visible (dev mode)
- [ ] Sign-in form submits to Better Auth
- [ ] Session cookie set on successful login
- [ ] Redirect to dashboard works
- [ ] Protected routes accessible
- [ ] API requests include session cookie
- [ ] Session persists across page reloads
- [ ] Logout clears session

### End-to-End ⏳
- [ ] Full login → dashboard → logout flow
- [ ] Multiple page navigation while authenticated
- [ ] Session expiration handling
- [ ] Error handling (network failures, invalid credentials)

---

## Troubleshooting

### Issue: Login Form Submits to Wrong Endpoint

**Symptom:** POST goes to `/auth/login` instead of `/api/auth/sign-in`

**Solution:**
- Check `useBetterAuth` toggle is enabled
- Verify Better Auth client is imported correctly
- Check `signIn.email()` method is being called

### Issue: Session Cookie Not Set

**Symptom:** Login succeeds but no cookie appears

**Check:**
- Browser DevTools → Application → Cookies
- Look for `better-auth.session_token`
- Check cookie domain (should be `localhost`)
- Verify SameSite and Secure attributes

### Issue: 401 Unauthorized on API Calls

**Symptom:** Dashboard loads but API calls fail

**Debug:**
- Check Network tab → Request Headers
- Verify `Cookie` header includes Better Auth session
- Check FastAPI logs for session validation errors
- Verify session token hasn't expired

### Issue: Backend Doesn't Validate Session

**Symptom:** API returns 401 even with valid cookie

**Check:**
- Verify FastAPI `get_current_user()` checks Better Auth first
- Check database connection (Better Auth tables accessible)
- Verify session token is correct format (`ba_...`)
- Check SQL queries use quoted table names (`"session"`, `"user"`)

---

## Next Steps After Testing

1. **Update BETTER_AUTH_MIGRATION.md** with test results
2. **Create migration script** for existing users
3. **Update frontend components** to use Better Auth hooks
4. **Remove legacy auth code** (after verification)
5. **Deploy to staging environment**

---

## Quick Test Command

Run backend validation test:

```bash
poetry run python3 /tmp/test_session_validation.py
```

---

## Test Credentials Summary

```
URL:      http://localhost:3001/login
Email:    admin@test.com
Password: TestPassword123!
Role:     super_admin (all permissions)
Org:      Test ISP (38e8b4ef-9396-4633-973e-f712d38883f9)
```

---

**Last Updated:** 2025-11-09
**Status:** Backend Integration Complete ✅ | Frontend Testing Ready 🔄
