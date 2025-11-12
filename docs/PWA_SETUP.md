# PWA Setup Guide

Complete guide to setting up Progressive Web App features for both ISP Ops and Platform Admin applications.

## Table of Contents

1. [Overview](#overview)
2. [Icon Generation](#icon-generation)
3. [VAPID Keys for Push Notifications](#vapid-keys)
4. [Environment Variables](#environment-variables)
5. [Testing PWA Features](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Overview

Both applications (`isp-ops-app` and `platform-admin-app`) are PWA-enabled with:

- ✅ Service workers for offline support
- ✅ Web app manifests
- ✅ Install prompts
- ✅ Push notifications (requires VAPID keys)
- ✅ Background sync (ISP Ops only)
- ✅ Offline fallback pages

---

## Icon Generation

### Option 1: Using pwa-asset-generator (Recommended)

```bash
# Install globally
npm install -g pwa-asset-generator

# Generate icons for ISP Ops app
pwa-asset-generator \
  logo.svg \
  frontend/apps/isp-ops-app/public/assets \
  --icon-only \
  --maskable \
  --background "#3b82f6" \
  --index index.html

# Generate icons for Platform Admin app
pwa-asset-generator \
  logo-admin.svg \
  frontend/apps/platform-admin-app/public/assets \
  --icon-only \
  --maskable \
  --background "#0ea5e9" \
  --index index.html
```

### Option 2: Using ImageMagick

```bash
# Install ImageMagick
# macOS: brew install imagemagick
# Ubuntu: sudo apt-get install imagemagick

# Generate icons
for size in 72 96 128 144 152 192 384 512; do
  magick logo.svg \
    -resize ${size}x${size} \
    frontend/apps/isp-ops-app/public/assets/icon-${size}x${size}.png
done

# Generate notification badges
for size in 72 96; do
  magick logo.svg \
    -resize ${size}x${size} \
    frontend/apps/isp-ops-app/public/assets/badge-${size}x${size}.png
done
```

### Option 3: Using the Helper Script

```bash
# Run the icon generation helper
node frontend/scripts/generate-pwa-icons.mjs logo.svg frontend/apps/isp-ops-app/public/assets --app=isp
```

### Required Icon Sizes

Both apps need:
- **App Icons**: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
- **Notification Badges**: 72x72, 96x96
- **Screenshots**: 1280x720 (wide), 750x1334 (narrow)

---

## VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for push notifications.

### Generate Keys

#### Python (Backend)

```bash
# Using pywebpush
pip install pywebpush

# Generate keys
python3 << 'PYTHON'
from pywebpush import webpush

keys = webpush.generate_vapid_keys()
print("Public Key:", keys['public_key'])
print("Private Key:", keys['private_key'])
PYTHON
```

#### Node.js (Alternative)

```bash
npm install -g web-push

# Generate keys
web-push generate-vapid-keys
```

### Store Keys Securely

Add to your `.env` file:

```bash
# Backend
VAPID_PRIVATE_KEY="<your-private-key>"
VAPID_PUBLIC_KEY="<your-public-key>"

# Frontend (ISP Ops)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="<your-public-key>"

# Frontend (Platform Admin)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="<your-public-key>"
```

**⚠️ Important:**
- Never commit private keys to version control
- Use different keys for development and production
- Store production keys in secure environment variable managers (AWS Secrets Manager, etc.)

---

## Environment Variables

### Backend (.env)

```bash
# Push Notifications
VAPID_PRIVATE_KEY="<generated-private-key>"
VAPID_PUBLIC_KEY="<generated-public-key>"
VAPID_SUBJECT="mailto:admin@yourdomain.com"

# Optional: Configure notification settings
PUSH_NOTIFICATION_ENABLED=true
PUSH_TTL=86400  # Time to live (seconds)
```

### Frontend - ISP Ops App (.env.local)

```bash
# PWA
NEXT_PUBLIC_VAPID_PUBLIC_KEY="<generated-public-key>"
NEXT_PUBLIC_APP_NAME="dotmac FTTH Operations"
NEXT_PUBLIC_FAVICON="/favicon.ico"

# API
NEXT_PUBLIC_API_BASE_URL="http://localhost:8001"
```

### Frontend - Platform Admin App (.env.local)

```bash
# PWA
NEXT_PUBLIC_VAPID_PUBLIC_KEY="<generated-public-key>"
NEXT_PUBLIC_APP_NAME="dotmac Platform Admin"
NEXT_PUBLIC_FAVICON="/favicon.ico"

# API
NEXT_PUBLIC_API_BASE_URL="http://localhost:8001"
```

---

## Testing PWA Features

### 1. Test Service Worker Registration

```bash
# Start the application
cd frontend
pnpm dev:isp  # or pnpm dev:admin

# Open browser DevTools (F12)
# Go to Application > Service Workers
# Verify service worker is registered and activated
```

### 2. Test Offline Mode

```bash
# In Chrome DevTools:
# 1. Go to Network tab
# 2. Check "Offline" checkbox
# 3. Reload the page
# 4. Should see offline fallback page

# Or toggle network in Application > Service Workers > Offline
```

### 3. Test Install Prompt

```bash
# Desktop Chrome:
# 1. Open the app
# 2. Wait 30 seconds or meet engagement criteria
# 3. Install prompt should appear
# 4. Click Install

# Mobile:
# 1. Open in Chrome/Safari
# 2. Tap browser menu
# 3. Select "Add to Home Screen"
```

### 4. Test Push Notifications

```bash
# 1. Grant notification permission when prompted
# 2. Subscribe to push notifications
# 3. Send test notification from backend:

curl -X POST http://localhost:8001/api/v1/push/test \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "body": "Hello from PWA"}'
```

### 5. Test Background Sync (ISP Ops Only)

```bash
# 1. Go offline
# 2. Clock in/out or update location
# 3. Data saved to IndexedDB
# 4. Go online
# 5. Data syncs automatically
```

### 6. Lighthouse Audit

```bash
# Install Lighthouse
npm install -g lighthouse

# Run audit
lighthouse https://localhost:3001 \
  --view \
  --only-categories=pwa,performance,accessibility

# Or use Chrome DevTools > Lighthouse tab
```

---

## Troubleshooting

### Service Worker Not Registering

**Check:**
- HTTPS or localhost (required for service workers)
- No JavaScript errors in console
- Service worker file accessible at `/sw.js`
- Browser supports service workers

**Fix:**
```bash
# Unregister existing workers
# DevTools > Application > Service Workers > Unregister

# Clear cache
# DevTools > Application > Clear storage > Clear site data
```

### Install Prompt Not Showing

**Requirements:**
- Service worker registered
- Web app manifest linked
- HTTPS (or localhost)
- User engagement criteria met
- Not already installed

**Check manifest:**
```bash
# DevTools > Application > Manifest
# Verify all fields are correct
```

### Push Notifications Not Working

**Check:**
1. VAPID keys configured correctly
2. Notification permission granted
3. Service worker active
4. Subscription endpoint valid

**Debug:**
```javascript
// In browser console
navigator.serviceWorker.ready.then(reg => {
  return reg.pushManager.getSubscription();
}).then(sub => {
  console.log('Subscription:', sub);
});
```

### Offline Page Not Showing

**Check:**
1. `/offline` route exists
2. Service worker precaches `/offline`
3. Network request fails (not cached)

**Test:**
```bash
# Force offline mode
# DevTools > Network > Offline

# Try navigating to uncached page
```

### Icons Not Displaying

**Check:**
1. Icons exist in `/public/assets/`
2. Correct sizes (72x72, 96x96, etc.)
3. PNG format
4. Manifest references correct paths

**Verify:**
```bash
ls -la frontend/apps/*/public/assets/icon-*.png
```

---

## Production Checklist

Before deploying to production:

- [ ] Generate production VAPID keys
- [ ] Create all required icon sizes
- [ ] Take app screenshots
- [ ] Test install on multiple devices
- [ ] Test offline functionality
- [ ] Run Lighthouse audit (score > 80)
- [ ] Configure CSP headers for service workers
- [ ] Set up push notification backend
- [ ] Test push notifications end-to-end
- [ ] Monitor service worker errors
- [ ] Set up analytics for PWA metrics

---

## Additional Resources

- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)

---

## Support

For issues or questions:
1. Check troubleshooting section
2. Review browser console for errors
3. Test in Chrome DevTools Lighthouse
4. Open GitHub issue with details
