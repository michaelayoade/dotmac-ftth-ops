# Portal Design System

A comprehensive theming system for the 6 distinct portals in the DotMac ISP platform.

## Overview

Each portal has its own unique visual identity with:

- **Distinct primary colors** for visual differentiation
- **Portal-specific typography scales** (customer portal uses larger fonts for accessibility)
- **Optimized spacing** (customer portal uses more generous spacing)
- **Automatic theme detection** based on current route
- **Runtime theme switching** via CSS custom properties

## The 6 Portals

### 1. Platform Admin (`/dashboard/platform-admin`)

- **Color**: Deep Blue (Authority, Trust, Technical Excellence)
- **User Type**: DotMac Staff
- **Icon**: 🏢
- **Sidebar**: Dark (preferred for long work sessions)
- **Use Case**: Manage the entire multi-tenant platform

### 2. Platform Resellers (`/partner`)

- **Color**: Orange (Energy, Sales, Action-Oriented)
- **User Type**: Channel Partner
- **Icon**: 🤝
- **Sidebar**: Light
- **Use Case**: Channel partner management and commissions

### 3. Platform Tenants (`/tenant`)

- **Color**: Purple (Premium, Business, Professional)
- **User Type**: ISP Owner
- **Icon**: 🏬
- **Sidebar**: Light
- **Use Case**: Manage ISP business relationship with platform

### 4. ISP Admin (`/dashboard`)

- **Color**: Blue (Professional, Operations, Reliable)
- **User Type**: ISP Staff
- **Icon**: 📡
- **Sidebar**: Dark (preferred for operational work)
- **Use Case**: Full ISP operations and network management

### 5. ISP Reseller (`/portal`)

- **Color**: Green (Money, Success, Growth)
- **User Type**: Sales Agent
- **Icon**: 💰
- **Sidebar**: None (bottom nav on mobile)
- **Use Case**: Generate referrals and track commissions

### 6. ISP Customer (`/customer-portal`)

- **Color**: Friendly Blue (Approachable, Trustworthy, Simple)
- **User Type**: Customer
- **Icon**: 🏠
- **Sidebar**: None (top nav on mobile)
- **Use Case**: Manage internet service subscription
- **Special**: Larger fonts (20px base vs 16px), more generous spacing for accessibility

## Usage

### Automatic Theme Detection

Themes are automatically applied based on the current route:

```tsx
// No manual setup needed - PortalThemeProvider handles this
// Just navigate to any portal route and the theme switches automatically

<Link href="/customer-portal">Customer Portal</Link>  // → Friendly Blue theme
<Link href="/dashboard">ISP Admin</Link>              // → Professional Blue theme
<Link href="/partner">Partners</Link>                 // → Orange theme
```

### Using Portal Colors in Components

#### Via Tailwind Classes

```tsx
import { Button } from '@/components/ui/button';

// Primary color - automatically uses current portal's primary
<Button className="bg-portal-primary text-white">
  Click Me
</Button>

// Accent color
<div className="border-portal-accent text-portal-accent">
  Accent element
</div>

// Status colors (shared across portals)
<div className="bg-status-online">Online</div>
<div className="bg-status-offline">Offline</div>
```

#### Via usePortalTheme Hook

```tsx
import { usePortalTheme } from "@/lib/design-system/portal-themes";

function MyComponent() {
  const { currentPortal, theme } = usePortalTheme();

  // Access theme values
  console.log(theme.metadata.name); // "Customer Portal"
  console.log(theme.colors.primary[500]); // "hsl(207, 90%, 54%)"
  console.log(theme.fontSize.base[0]); // "1.25rem" (customer portal)
  console.log(theme.spacing.componentGap); // "2rem" (customer portal)

  return <div style={{ color: theme.colors.primary[500] }}>Welcome to {theme.metadata.name}</div>;
}
```

### Portal Badge Components

Display which portal the user is currently in:

```tsx
import {
  PortalBadge,
  PortalBadgeCompact,
  PortalUserTypeBadge,
  PortalIndicatorDot,
} from '@/components/ui/portal-badge';

// Full badge with icon and name
<PortalBadge />

// Short name version
<PortalBadge shortName />

// Different sizes
<PortalBadge size="sm" />
<PortalBadge size="md" />
<PortalBadge size="lg" />

// Compact icon-only version
<PortalBadgeCompact />

// User type badge
<PortalUserTypeBadge />

// Small indicator dot
<PortalIndicatorDot />
```

### Development Tools

Portal switcher and theme debugger (only visible in development):

```tsx
import { PortalSwitcher, PortalThemeDebug } from "@/components/dev/PortalSwitcher";

// Automatically included in ClientProviders
// Appears as floating button in bottom-right corner
// Only visible when NODE_ENV === 'development'
```

## Available Tailwind Classes

### Portal Colors

```css
/* Primary color scale */
bg-portal-primary-50 to bg-portal-primary-900
text-portal-primary-50 to text-portal-primary-900
border-portal-primary-50 to border-portal-primary-900

/* Shorthand for primary-500 */
bg-portal-primary
text-portal-primary
border-portal-primary

/* Accent color */
bg-portal-accent
text-portal-accent

/* Semantic colors (shared) */
bg-portal-success
bg-portal-warning
bg-portal-error
bg-portal-info

/* Status colors (shared) */
bg-status-online
bg-status-offline
bg-status-degraded
bg-status-unknown
```

### Portal-Specific Selectors

Use the `data-portal` attribute for portal-specific CSS:

```css
/* In your CSS file */
[data-portal="ispCustomer"] .my-component {
  /* Customer portal only */
  font-size: 1.25rem;
  padding: 2rem;
}

[data-portal="platformAdmin"] .my-component {
  /* Platform admin only */
  font-size: 1rem;
  padding: 1rem;
}
```

## CSS Custom Properties

These variables are automatically injected by `PortalThemeProvider`:

```css
/* Primary color scale */
--portal-primary-50
--portal-primary-100
--portal-primary-200
--portal-primary-300
--portal-primary-400
--portal-primary-500
--portal-primary-600
--portal-primary-700
--portal-primary-800
--portal-primary-900

/* Accent color */
--portal-accent

/* Semantic colors */
--portal-success
--portal-warning
--portal-error
--portal-info

/* Status colors */
--portal-status-online
--portal-status-offline
--portal-status-degraded
--portal-status-unknown
```

## Design Tokens

### Colors (`tokens/colors.ts`)

- 6 portal-specific color schemes
- Semantic colors (success, warning, error, info)
- Network status colors (online, offline, degraded, unknown)
- Route detection function

### Typography (`tokens/typography.ts`)

- Font families (sans, mono)
- Portal-specific font scales
- Font weights
- Reading width recommendations

**Key differences:**

- Admin portals: 12px minimum, 16px body text
- Customer portal: **16px minimum** (no smaller!), **20px body text**
- Reseller portal: 14px minimum, 18px body text

### Spacing (`tokens/spacing.ts`)

- Base spacing scale (4px grid system)
- Portal-specific spacing adjustments
- Touch target sizes (WCAG AAA compliant)

**Key differences:**

- Platform Admin: 16px component gap (dense)
- ISP Customer: 32px component gap (generous)
- Touch targets: 44px minimum (WCAG AAA)

## File Structure

```
lib/design-system/
├── README.md                    # This file
├── portal-themes.tsx            # Theme provider & hooks
└── tokens/
    ├── colors.ts                # Color palettes & route detection
    ├── typography.ts            # Font scales & weights
    └── spacing.ts               # Spacing scale & touch targets

components/ui/
└── portal-badge.tsx             # Portal badge components

components/dev/
└── PortalSwitcher.tsx           # Development tools
```

## Accessibility

### WCAG Compliance

- **All portals**: WCAG 2.1 Level AA minimum
- **Customer portal**: WCAG 2.1 Level AAA target
  - Minimum font size: 16px (vs 12px for admin)
  - Body text: 20px (vs 16px for admin)
  - Generous spacing: 32px gaps (vs 16px for admin)
  - Touch targets: 56px (vs 44px minimum)

### Color Contrast

All portal colors maintain sufficient contrast ratios:

- Primary colors: 4.5:1 minimum on white background
- Status colors: Standardized across portals for consistency
- Semantic colors: Shared palette ensures learned behavior

## Testing

### Visual Testing

Visit the theme demo page to see all portal themes:

```
http://localhost:3000/dashboard/theme-demo
```

Shows:

- Color palettes
- Typography scales
- Spacing examples
- Portal badge variants
- Navigation links to switch portals

### Manual Testing Checklist

- [ ] Navigate to each portal route
- [ ] Verify primary color changes
- [ ] Check font sizes (especially customer portal)
- [ ] Test portal badge visibility
- [ ] Use development portal switcher
- [ ] Verify CSS variables in DevTools
- [ ] Check `data-portal` attribute on `<html>`
- [ ] Test dark/light mode compatibility

## Best Practices

### Do's ✅

- Use `bg-portal-primary` for portal-specific primary colors
- Use `usePortalTheme()` hook to access theme values programmatically
- Use shared semantic colors (`bg-portal-success`) for consistent UX
- Add portal badges to help users identify where they are
- Test themes in all 6 portals before deploying

### Don'ts ❌

- Don't hardcode portal-specific colors in components
- Don't use pixel values for spacing (use theme tokens)
- Don't override customer portal font sizes to be smaller
- Don't use different status colors per portal (keep consistent)
- Don't manually set CSS variables (let PortalThemeProvider handle it)

## Troubleshooting

### Theme not switching when navigating

**Problem**: Theme stays the same across different portal routes

**Solution**:

1. Verify `PortalThemeProvider` is wrapped around app in `ClientProviders`
2. Check that routes match `detectPortalFromRoute()` logic in `tokens/colors.ts`
3. Confirm pathname detection is working with React DevTools

### Colors not showing

**Problem**: `bg-portal-primary` classes have no effect

**Solution**:

1. Verify Tailwind config includes portal color extensions
2. Run `pnpm build` to regenerate Tailwind CSS
3. Check browser DevTools for CSS custom properties on `:root`
4. Confirm `PortalThemeProvider` is mounted and applying CSS vars

### Type errors with theme hook

**Problem**: TypeScript errors when using `usePortalTheme()`

**Solution**:

1. Ensure component is marked `'use client'`
2. Import hook: `import { usePortalTheme } from '@/lib/design-system/portal-themes'`
3. Verify component is wrapped in `PortalThemeProvider`

## Future Enhancements

- [ ] Add portal-specific animations/transitions
- [ ] Implement portal-specific illustration libraries
- [ ] Create portal-specific component variants (e.g., CustomerCard vs AdminCard)
- [ ] Add branding override system per ISP tenant
- [ ] Support custom color schemes per ISP (tenant-level theming)
- [ ] Add portal-specific sound effects (optional)
- [ ] Create Figma design tokens export

## Related Documentation

- [ISP Platform Architecture](../../../docs/ISP_PLATFORM_ARCHITECTURE.md)
- [Accessibility Implementation](../../../docs/ACCESSIBILITY_IMPLEMENTATION.md)
- [Design System Tokens](./tokens/)

---

**Last Updated**: 2025-10-20
**Version**: 1.0.0
**Maintainer**: DotMac Platform Team
