# Quick Fix Guide - Critical ESLint Warnings

## 🔴 Priority 1: Fix React Hooks Dependencies

### Issue 1: banking/page.tsx (Line 144)

**Current Problem:**
```typescript
useEffect(() => {
  // Uses loadBankAccounts and loadManualPayments
}, []); // Empty dependency array - WRONG
```

**Solution A: Add to dependency array**
```typescript
useEffect(() => {
  loadBankAccounts();
  loadManualPayments();
}, [loadBankAccounts, loadManualPayments]);
```

**Solution B: Wrap functions in useCallback (RECOMMENDED)**
```typescript
const loadBankAccounts = useCallback(async () => {
  // function body
}, [/* dependencies of this function */]);

const loadManualPayments = useCallback(async () => {
  // function body
}, [/* dependencies of this function */]);

useEffect(() => {
  loadBankAccounts();
  loadManualPayments();
}, [loadBankAccounts, loadManualPayments]);
```

**Solution C: Move functions inside useEffect**
```typescript
useEffect(() => {
  async function loadBankAccounts() {
    // function body
  }
  
  async function loadManualPayments() {
    // function body
  }
  
  loadBankAccounts();
  loadManualPayments();
}, []); // Now empty array is correct
```

---

### Issue 2: subscribers/page.tsx (Line 386)

**Current Problem:**
```typescript
const bulkActions = useMemo(() => {
  return [
    { label: "Activate", onClick: handleBulkActivate },
    { label: "Delete", onClick: handleBulkDelete },
    { label: "Suspend", onClick: handleBulkSuspend },
  ];
}, []); // Missing function dependencies
```

**Solution A: Add all handlers to dependency array**
```typescript
const bulkActions = useMemo(() => {
  return [
    { label: "Activate", onClick: handleBulkActivate },
    { label: "Delete", onClick: handleBulkDelete },
    { label: "Suspend", onClick: handleBulkSuspend },
  ];
}, [handleBulkActivate, handleBulkDelete, handleBulkSuspend]);
```

**Solution B: Wrap handlers in useCallback first (RECOMMENDED)**
```typescript
const handleBulkActivate = useCallback(() => {
  // implementation
}, [/* deps */]);

const handleBulkDelete = useCallback(() => {
  // implementation
}, [/* deps */]);

const handleBulkSuspend = useCallback(() => {
  // implementation
}, [/* deps */]);

const bulkActions = useMemo(() => {
  return [
    { label: "Activate", onClick: handleBulkActivate },
    { label: "Delete", onClick: handleBulkDelete },
    { label: "Suspend", onClick: handleBulkSuspend },
  ];
}, [handleBulkActivate, handleBulkDelete, handleBulkSuspend]);
```

**Solution C: Remove useMemo if not needed**
```typescript
// If the array doesn't change often, useMemo might be overkill
const bulkActions = [
  { label: "Activate", onClick: handleBulkActivate },
  { label: "Delete", onClick: handleBulkDelete },
  { label: "Suspend", onClick: handleBulkSuspend },
];
```

---

## 🟡 Priority 2: Fix Image Optimization

### Issue: branding-overrides.tsx (Line 212)

**Current Problem:**
```typescript
<img src="/logo.png" alt="Logo" />
```

**Solution:**
```typescript
import Image from 'next/image';

// Then replace <img> with:
<Image 
  src="/logo.png" 
  alt="Logo"
  width={100}  // Add explicit width
  height={50}  // Add explicit height
  priority={true}  // Optional: if above fold
/>
```

**Or if dimensions are dynamic:**
```typescript
<div style={{ position: 'relative', width: '100%', height: '50px' }}>
  <Image 
    src="/logo.png" 
    alt="Logo"
    fill
    style={{ objectFit: 'contain' }}
  />
</div>
```

---

## 🟢 Priority 3: Batch Fix Unescaped Entities

### Automated Fix Script

Create this script: `scripts/fix-unescaped-entities.sh`

```bash
#!/bin/bash

# Fix apostrophes in JSX
find apps/platform-admin-app/app/dashboard -name "*.tsx" -type f -exec sed -i '' \
  -e "s/doesn't exist\"/doesn\&apos;t exist\"/g" \
  -e "s/can't find\"/can\&apos;t find\"/g" \
  -e "s/wasn't found\"/wasn\&apos;t found\"/g" \
  -e "s/won't load\"/won\&apos;t load\"/g" \
  {} +

# Fix double quotes in JSX text
find apps/platform-admin-app/app/dashboard -name "*.tsx" -type f -exec sed -i '' \
  -e 's/>\([^<]*\)"\([^"]*\)"\([^<]*\)</>\1\&quot;\2\&quot;\3</g' \
  {} +

echo "Fixed unescaped entities"
```

### Or Manual Patterns to Find/Replace

**In VS Code:**
1. Open Find & Replace (Cmd+Shift+F)
2. Enable Regex mode
3. Search in: `apps/platform-admin-app/app/dashboard`

**Pattern 1: Apostrophes in error messages**
```
Find:    (doesn't|can't|wasn't|won't)
Replace: doesn&apos;t (or can&apos;t, etc.)
```

**Pattern 2: Quotes around variable names**
```
Find:    "(\{[^}]+\})"
Replace: &quot;$1&quot;
```

---

## 📋 Copy-Paste Fix Commands

```bash
# Navigate to project
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/platform-admin-app

# Open files to fix
code app/dashboard/banking/page.tsx:144
code app/dashboard/subscribers/page.tsx:386
code lib/design-system/branding-overrides.tsx:212

# After fixing, verify build
pnpm build
```

---

## ✅ Verification Checklist

After making fixes:

```bash
# 1. Run ESLint
pnpm lint

# 2. Type check
pnpm type-check

# 3. Build
pnpm build

# 4. Check for specific warnings
pnpm build 2>&1 | grep -E "(exhaustive-deps|no-unescaped-entities|no-img-element)"
```

Expected output after fixes:
- No "exhaustive-deps" warnings
- No "no-img-element" warnings
- Reduced or zero "no-unescaped-entities" warnings

