# Installation Guide - Command Palette Dependencies

## Quick Start

Run this command to install all required dependencies for the Command Palette (⌘K):

```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/base-app
pnpm add cmdk @radix-ui/react-dialog @radix-ui/react-icons
```

## What Gets Installed

### 1. **cmdk** (~50KB)
- Command Menu for React
- Powers the keyboard-driven interface
- Provides search, filtering, and navigation
- Homepage: https://cmdk.paco.me/

### 2. **@radix-ui/react-dialog** (~15KB)
- Modal/dialog component
- Accessibility built-in
- Handles focus management and keyboard traps
- Part of Radix UI primitives

### 3. **@radix-ui/react-icons** (~5KB)
- Icon set for Radix UI
- Used for search icon in command input
- Lightweight SVG icons

## Installation Steps

### Step 1: Navigate to Project
```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/base-app
```

### Step 2: Install Dependencies
```bash
pnpm add cmdk @radix-ui/react-dialog @radix-ui/react-icons
```

### Step 3: Verify Installation
```bash
# Check package.json
grep -E "cmdk|@radix-ui/react-dialog|@radix-ui/react-icons" package.json
```

Expected output:
```json
"cmdk": "^0.2.0",
"@radix-ui/react-dialog": "^1.0.5",
"@radix-ui/react-icons": "^1.3.0"
```

### Step 4: Test the Command Palette
```bash
# Start dev server
pnpm dev

# Open browser to http://localhost:3000/dashboard
# Press ⌘K (Mac) or Ctrl+K (Windows/Linux)
```

## Troubleshooting

### Issue: "Module not found: Can't resolve 'cmdk'"

**Solution:**
```bash
rm -rf node_modules
pnpm install
```

### Issue: "Peer dependency warnings"

These are normal and can be ignored if the app runs correctly. To fix:
```bash
pnpm install --legacy-peer-deps
```

### Issue: TypeScript errors after installation

**Solution:**
```bash
# Restart TypeScript server if using VS Code
# Or rebuild the project
pnpm build
```

## Verification Checklist

After installation, verify:

- [x] Dependencies added to `package.json`
- [x] `node_modules/cmdk` directory exists
- [x] `node_modules/@radix-ui/react-dialog` exists
- [x] `node_modules/@radix-ui/react-icons` exists
- [x] Dev server starts without errors
- [x] Command palette opens with ⌘K
- [x] No console errors in browser

## Alternative: Using npm or yarn

### Using npm:
```bash
npm install cmdk @radix-ui/react-dialog @radix-ui/react-icons
```

### Using yarn:
```bash
yarn add cmdk @radix-ui/react-dialog @radix-ui/react-icons
```

## Package Versions

Recommended versions (as of January 2025):

| Package | Version | Size |
|---------|---------|------|
| cmdk | ^0.2.0 | ~50KB |
| @radix-ui/react-dialog | ^1.0.5 | ~15KB |
| @radix-ui/react-icons | ^1.3.0 | ~5KB |

**Total Bundle Impact:** ~70KB (minified)

## Next Steps

After successful installation:

1. **Read the setup guide:**
   ```bash
   cat docs/COMMAND_PALETTE_SETUP.md
   ```

2. **Run the tests:**
   ```bash
   ./scripts/test-ui-integration.sh
   ```

3. **Try the command palette:**
   - Start dev server: `pnpm dev`
   - Open dashboard
   - Press ⌘K
   - Start typing to search!

## Support

If you encounter issues:

1. Check `package.json` for correct versions
2. Clear node_modules and reinstall
3. Check console for error messages
4. Verify Node.js version (>=16.0.0 recommended)
5. Verify pnpm version (>=8.0.0 recommended)

---

**Installation complete! 🎉**

Press `⌘K` to get started with the command palette.
