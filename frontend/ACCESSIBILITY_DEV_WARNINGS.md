# Accessibility Development Warnings Guide

Guide to using development-time accessibility warnings and enhanced components.

---

## Overview

The platform includes comprehensive development-time warnings to catch accessibility issues before they reach production.

**Two-Layer Approach:**
1. **Runtime Warnings** - Console warnings during development
2. **Static Analysis** - ESLint rules for build-time checks

---

## Enhanced Components

Drop-in replacements for base components with built-in accessibility checks.

### Enhanced Button

```tsx
import { Button } from '@dotmac/ui/enhanced';

// ✅ Good: Has visible text
<Button>Save Changes</Button>

// ✅ Good: Icon button with aria-label
<Button aria-label="Delete item">
  <TrashIcon />
</Button>

// ⚠️ Warning: Icon button without label
<Button>
  <TrashIcon />  {/* Console warning in development */}
</Button>
// Warning: [a11y] <Button> is missing an accessible label

// ✅ Good: Explicit type in form
<form>
  <Button type="submit">Submit</Button>
</form>

// ⚠️ Warning: No type specified in form
<form>
  <Button>Submit</Button>  {/* May trigger warning */}
</form>
```

### Enhanced Image

```tsx
import { Image } from '@dotmac/ui/enhanced';

// ✅ Good: Descriptive alt text
<Image
  src="/logo.png"
  alt="Company Logo"
  width={100}
  height={100}
/>

// ✅ Good: Decorative image
<Image
  src="/divider.png"
  decorative
  width={100}
  height={10}
/>

// ⚠️ Warning: Missing alt text
<Image
  src="/photo.jpg"
  width={100}
  height={100}
/>
// Warning: [a11y] Image is missing alt text

// ⚠️ Warning: Empty alt without decorative flag
<Image
  src="/icon.png"
  alt=""
  width={20}
  height={20}
/>
// Warning: Image has empty alt text without decorative flag
```

### Enhanced Input

```tsx
import { Input } from '@dotmac/ui/enhanced';

// ✅ Good: Associated with label
<label htmlFor="email">Email</label>
<Input id="email" type="email" />

// ✅ Good: Has aria-label
<Input
  type="search"
  aria-label="Search customers"
/>

// ⚠️ Warning: No label association
<Input
  type="text"
  placeholder="Enter name"
/>
// Warning: [a11y] Form input lacks associated label
```

### Enhanced Link

```tsx
import { Link } from '@dotmac/ui/enhanced';

// ✅ Good: Descriptive link text
<Link href="/customers">
  View all customers
</Link>

// ✅ Good: Icon link with aria-label
<Link
  href="/settings"
  aria-label="Settings"
>
  <SettingsIcon />
</Link>

// ⚠️ Warning: Icon only without label
<Link href="/profile">
  <UserIcon />
</Link>
// Warning: [a11y] <Link> is missing an accessible label

// ⚠️ Warning: Ambiguous link text
<Link href="/article">
  Click here
</Link>
// Warning: Link has ambiguous text: "Click here"
```

---

## Development Warnings

### All Available Warnings

| Warning Function | Checks For | Severity |
|-----------------|------------|----------|
| `warnMissingLabel` | Interactive elements without labels | Error |
| `warnMissingAlt` | Images without alt text | Error |
| `warnMissingFormLabel` | Form inputs without labels | Error |
| `warnMissingButtonType` | Buttons in forms without explicit type | Warning |
| `warnNotKeyboardAccessible` | onClick on non-interactive elements | Warning |
| `warnSkippedHeadingLevel` | Skipped heading levels (h1 → h3) | Warning |
| `warnLowContrast` | Insufficient color contrast | Warning |
| `warnInvalidAria` | Incorrect ARIA usage | Error |
| `warnRemovedFocusIndicator` | outline: none without replacement | Warning |
| `warnTableWithoutHeaders` | Tables missing `<th>` headers | Warning |
| `warnImproperList` | Invalid list structure | Warning |
| `warnModalWithoutFocusTrap` | Modals without focus management | Error |
| `warnMissingLandmarks` | Pages missing landmark regions | Warning |

### Using Warning Functions

```tsx
import {
  warnMissingLabel,
  warnNotKeyboardAccessible
} from '@dotmac/utils/a11y-dev-warnings';

// In your component
useEffect(() => {
  warnMissingLabel('CustomButton', {
    children,
    'aria-label': ariaLabel
  });
}, [children, ariaLabel]);
```

---

## ESLint Rules

Add to your `.eslintrc.json`:

```json
{
  "extends": [
    "./.eslintrc.a11y.json"
  ]
}
```

### Key Rules

**Enforced (Errors):**
- `jsx-a11y/alt-text` - All images must have alt text
- `jsx-a11y/aria-props` - ARIA attributes must be valid
- `jsx-a11y/label-has-associated-control` - Form labels must be associated
- `jsx-a11y/interactive-supports-focus` - Interactive elements must be focusable
- `jsx-a11y/heading-has-content` - Headings must have content
- `jsx-a11y/anchor-is-valid` - Links must have valid href

**Warnings:**
- `jsx-a11y/click-events-have-key-events` - onClick needs keyboard handler
- `jsx-a11y/no-autofocus` - Avoid autofocus
- `jsx-a11y/media-has-caption` - Media should have captions

**Stricter Rules for Forms:**
```json
{
  "files": ["**/forms/**/*.tsx"],
  "rules": {
    "jsx-a11y/label-has-associated-control": "error",
    "jsx-a11y/no-autofocus": "error"
  }
}
```

---

## Accessibility Audit Script

Run comprehensive accessibility audit:

```bash
# Scan entire codebase
pnpm audit:a11y

# Example output:
# 🔍 Scanning codebase for accessibility issues...
#
# 📊 Accessibility Audit Results
# Total files scanned: 245
# Total issues found: 12
#
# ❌ Errors: 3
# ⚠️  Warnings: 9
#
# 📋 Issues by Rule:
#   missing-alt-text: 5 issues
#   missing-button-label: 3 issues
#   missing-form-label: 2 issues
#   non-interactive-click: 2 issues
```

### Add to package.json

```json
{
  "scripts": {
    "audit:a11y": "ts-node scripts/audit-accessibility.ts",
    "lint:a11y": "eslint . --ext .tsx --config .eslintrc.a11y.json"
  }
}
```

### Issues Detected

1. **Missing Alt Text** - Images without alt attributes
2. **Missing Button Labels** - Icon buttons without aria-label
3. **Missing Form Labels** - Inputs without labels/aria-label
4. **Non-Interactive Click** - div/span with onClick
5. **Skipped Heading Levels** - h1 → h3 (skipping h2)
6. **Missing Modal Attributes** - Dialog without aria-modal

---

## Suppressing Warnings

When you intentionally want to bypass warnings (rare):

```tsx
// Suppress all a11y warnings for this component
<Button suppressA11yWarnings>
  <Icon />
</Button>

// Or for images
<Image
  src="/bg.png"
  suppressA11yWarnings
  width={100}
  height={100}
/>
```

**⚠️ Use sparingly!** Suppressing warnings should be rare and documented.

---

## Best Practices

### 1. Use Enhanced Components in Development

```tsx
// In development
import { Button, Image, Input, Link } from '@dotmac/ui/enhanced';

// In production (if you want to skip runtime checks)
import { Button, Image, Input, Link } from '@dotmac/ui';
```

### 2. Fix Warnings as You Go

Don't let warnings accumulate. Fix them immediately:

```tsx
// ❌ Ignoring warning
<Button>
  <TrashIcon />  // Warning appears but not fixed
</Button>

// ✅ Fixed immediately
<Button aria-label="Delete item">
  <TrashIcon />
</Button>
```

### 3. Run Audit Before Commits

Add pre-commit hook:

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "pnpm lint:a11y && pnpm audit:a11y"
    }
  }
}
```

### 4. Monitor Warning Count

Track accessibility warnings in CI:

```yaml
# .github/workflows/accessibility.yml
- name: Accessibility Audit
  run: pnpm audit:a11y
  continue-on-error: true

- name: Upload Report
  uses: actions/upload-artifact@v3
  with:
    name: a11y-report
    path: a11y-report.json
```

---

## Common Patterns

### Icon Buttons

```tsx
// ❌ Wrong
<Button>
  <DeleteIcon />
</Button>

// ✅ Right
<Button aria-label={getActionAriaLabel(t, 'delete', item.name)}>
  <DeleteIcon />
</Button>
```

### Decorative Images

```tsx
// ❌ Wrong
<Image src="/decoration.png" />

// ✅ Right
<Image src="/decoration.png" decorative />
// or
<Image src="/decoration.png" alt="" />
```

### Interactive Divs

```tsx
// ❌ Wrong
<div onClick={handleClick}>
  Click me
</div>

// ✅ Right
<button onClick={handleClick}>
  Click me
</button>
```

### Form Inputs

```tsx
// ❌ Wrong
<Input placeholder="Email" />

// ✅ Right
<label htmlFor="email">Email</label>
<Input id="email" />
```

---

## Integration with CI/CD

### GitHub Actions

```yaml
name: Accessibility Check

on: [pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint:a11y
      - run: pnpm audit:a11y
```

### Pre-Push Hook

```bash
#!/bin/bash
# .git/hooks/pre-push

echo "Running accessibility checks..."
pnpm lint:a11y || exit 1
pnpm audit:a11y || exit 1
echo "✅ Accessibility checks passed"
```

---

## Debugging Tips

### 1. Enable Verbose Warnings

```tsx
// Add to development environment
process.env.A11Y_VERBOSE = 'true';
```

### 2. Component-Specific Debugging

```tsx
<Button
  onClick={handleClick}
  ref={(node) => {
    if (node && !node.getAttribute('aria-label')) {
      console.trace('Button without aria-label');
    }
  }}
>
  <Icon />
</Button>
```

### 3. Browser DevTools

Use React DevTools to inspect component props:
- Check for aria-* attributes
- Verify accessible labels
- Inspect role attributes

---

## Summary

✅ **Enhanced Components** with built-in accessibility warnings
✅ **20+ development warnings** for common issues
✅ **ESLint rules** for static analysis
✅ **Audit script** for codebase-wide checks
✅ **Multi-language support** for ARIA labels
✅ **CI/CD integration** for automated checks

All warnings are **development-only** and stripped from production builds for zero runtime overhead.
