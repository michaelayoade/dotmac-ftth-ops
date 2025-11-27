# Portal Design System - Enhancements

Advanced features and capabilities for the 6-portal design system.

## Overview

The enhanced portal design system includes:

1. **Portal-Specific Animations** - Unique animation personalities per portal
2. **Portal Component Variants** - Adaptive UI components
3. **ISP Branding Overrides** - Tenant-level customization
4. **Enhanced Accessibility** - WCAG AAA compliance tools
5. **Figma Token Export** - Design-dev workflow integration

---

## 1. Portal-Specific Animations

### Concept

Each portal has a distinct animation personality that matches its user base and use case:

- **Platform Admin**: Fast, efficient, minimal (staff need speed)
- **Platform Resellers**: Energetic, bouncy (sales-focused)
- **Platform Tenants**: Smooth, professional (business users)
- **ISP Admin**: Fast, precise (operational work)
- **ISP Reseller**: Playful, elastic (mobile-optimized)
- **ISP Customer**: Gentle, accessible (non-technical users)

### Animation Tokens

```typescript
import { portalAnimations } from "@/lib/design-system/tokens/animations";

// Example: Customer portal has slower, gentler animations
portalAnimations.ispCustomer = {
  duration: 350, // Slower than admin portals (150ms)
  easing: "smooth", // Gentle cubic-bezier
  hoverScale: 1.02, // Subtle hover effect
  activeScale: 0.98, // Gentle click feedback
  reducedMotion: true, // Respects accessibility
  pageTransition: "fade", // Simple fade transitions
};

// Example: Reseller portal has energetic animations
portalAnimations.platformResellers = {
  duration: 250,
  easing: "bounce", // Bouncy cubic-bezier
  hoverScale: 1.05, // Pronounced hover
  activeScale: 0.95, // Satisfying click
  reducedMotion: false,
  pageTransition: "slideUp", // Dynamic slide transitions
};
```

### Usage in Components

```tsx
import { usePortalTheme } from "@/lib/design-system/portal-themes";
import { createTransition } from "@/lib/design-system/tokens/animations";

function MyComponent() {
  const { theme } = usePortalTheme();
  const { animations } = theme;

  return (
    <div
      style={{
        transition: `transform ${animations.duration}ms ${animations.easing}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `scale(${animations.hoverScale})`;
      }}
    >
      Hover me!
    </div>
  );
}
```

### Tailwind Animations

New animation utilities added to Tailwind:

```css
/* Fade animations */
animate-fadeIn
animate-fadeOut

/* Slide animations */
animate-slideInUp
animate-slideOutDown

/* Scale animations */
animate-scaleIn
animate-scaleOut

/* Utility animations */
animate-bounce
animate-pulse
animate-spin
animate-ping
animate-shimmer
animate-wave
```

### Custom Easing Functions

```css
/* Use in Tailwind classes */
transition-smooth    /* cubic-bezier(0.4, 0.0, 0.2, 1) */
transition-sharp     /* cubic-bezier(0.4, 0.0, 0.6, 1) */
transition-snappy    /* cubic-bezier(0.0, 0.0, 0.2, 1) */
transition-bounce    /* cubic-bezier(0.68, -0.55, 0.265, 1.55) */
transition-elastic   /* cubic-bezier(0.175, 0.885, 0.32, 1.275) */
```

### Reduced Motion Support

```typescript
import {
  shouldReduceMotion,
  getSafeAnimationDuration,
} from "@/lib/design-system/tokens/animations";

// Automatically respects user's system preference
const safeNuration = getSafeAnimationDuration(currentPortal);
// Returns 0 if user has prefers-reduced-motion: reduce
```

---

## 2. Portal Component Variants

### Portal-Aware Card

Automatically adapts spacing and animations based on current portal:

```tsx
import {
  PortalCard,
  PortalCardHeader,
  PortalCardTitle,
  PortalCardDescription,
  PortalCardContent,
  PortalCardFooter,
} from "@dotmac/ui";

function Example() {
  return (
    <PortalCard hoverable interactive variant="elevated">
      <PortalCardHeader>
        <PortalCardTitle>Card Title</PortalCardTitle>
        <PortalCardDescription>Card description</PortalCardDescription>
      </PortalCardHeader>
      <PortalCardContent>
        {/* Content automatically uses portal spacing */}
        <p>Content here</p>
      </PortalCardContent>
      <PortalCardFooter>
        <button>Action</button>
      </PortalCardFooter>
    </PortalCard>
  );
}
```

**Features:**

- **Automatic spacing**: Uses `theme.spacing.componentGap` (16px for admin, 32px for customer)
- **Portal animations**: Hover/click effects match portal personality
- **Variants**: `default`, `elevated`, `outlined`, `flat`

### Portal-Aware Button

Buttons with portal-specific animations and scaling:

```tsx
import { PortalButton } from "@dotmac/ui";

function Example() {
  return (
    <>
      <PortalButton variant="default">Primary Action</PortalButton>
      <PortalButton variant="outline">Secondary Action</PortalButton>
      <PortalButton variant="accent">Accent Action</PortalButton>
      <PortalButton variant="ghost">Ghost Action</PortalButton>
    </>
  );
}
```

**Features:**

- **Portal-specific scaling**: Customer portal has subtle scaling (1.02x), Reseller portal has pronounced scaling (1.08x)
- **Adaptive animations**: Duration and easing match portal personality
- **Variants**: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `accent`

---

## 3. ISP Branding Overrides

### Concept

Individual ISP tenants can customize their portal appearance while maintaining design system consistency.

### Branding Configuration

```typescript
import { ISPBrandingProvider, useISPBranding } from '@/lib/design-system/branding-overrides';

// Wrap your ISP portals with branding provider
function App() {
  return (
    <ISPBrandingProvider
      initialBranding={{
        tenantId: 'fiberco',
        brandName: 'Fiber Internet Co.',
        logoUrl: '/logos/fiberco.png',
        colors: {
          primary: 'hsl(210, 100%, 45%)',  // Custom blue
          accent: 'hsl(160, 70%, 45%)',     // Custom teal
        },
        messaging: {
          tagline: 'Lightning-Fast Fiber Internet',
          supportEmail: 'support@fiberco.com',
        },
      }}
    >
      {children}
    </ISPBrandingProvider>
  );
}
```

### Available Customizations

**Brand Identity:**

- Brand name
- Logo (URL)
- Favicon (URL)
- Tagline

**Colors:**

- Primary color override
- Accent color override

**Typography:**

- Custom font family
- Heading font weight

**Messaging:**

- Support email
- Support phone
- Help URL

**Features:**

- Show/hide "Powered by DotMac"
- Custom footer toggle

### Using Branding in Components

```tsx
import {
  useISPBranding,
  BrandedLogo,
  PoweredByFooter,
} from "@/lib/design-system/branding-overrides";

function Header() {
  const { branding } = useISPBranding();

  return (
    <header>
      <BrandedLogo className="h-12" />
      <p>{branding.messaging?.tagline}</p>
    </header>
  );
}

function Footer() {
  return (
    <footer>
      <PoweredByFooter />
    </footer>
  );
}
```

### Fetching Branding from API

```typescript
import { fetchBrandingConfig, saveBrandingConfig } from "@/lib/design-system/branding-overrides";

// Fetch branding for a tenant
const branding = await fetchBrandingConfig("tenant-123");

// Save updated branding
await saveBrandingConfig("tenant-123", {
  colors: {
    primary: "hsl(200, 90%, 50%)",
  },
});
```

### Example Configurations

Three example ISP branding configs are provided:

1. **Fiber Internet Co.** - Professional blue ISP
2. **Community Wireless** - Warm, community-focused (white-label)
3. **Metro Broadband** - Modern, tech-forward (purple/pink)

---

## 4. Enhanced Accessibility

### Accessibility Provider

Manages user accessibility preferences and applies them system-wide:

```tsx
import { AccessibilityProvider } from "@/lib/design-system/accessibility";

// Already included in ClientProviders
function App() {
  return <AccessibilityProvider>{children}</AccessibilityProvider>;
}
```

### Accessibility Preferences

Users can customize:

- **Reduced motion**: Disable/minimize animations
- **High contrast**: Enhanced contrast mode
- **Font size multiplier**: 80% to 150% (customer portal defaults to 125%)
- **Keyboard navigation**: Enhanced keyboard focus indicators
- **Screen reader announcements**: Live region updates
- **Enhanced focus**: Stronger focus indicators

### Accessibility Settings Panel

```tsx
import { AccessibilitySettingsPanel } from "@/lib/design-system/accessibility";

function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <AccessibilitySettingsPanel />
    </div>
  );
}
```

**Features:**

- Toggle reduced motion
- Toggle high contrast
- Toggle enhanced focus
- Font size slider (80%-150%)
- Reset to defaults button

### Screen Reader Announcements

```tsx
import { announce, LiveRegionAnnouncer } from "@/lib/design-system/accessibility";

function MyComponent() {
  const handleAction = () => {
    // Perform action
    announce("Action completed successfully", "polite");
    // or
    announce("Critical error occurred!", "assertive");
  };

  return (
    <>
      <button onClick={handleAction}>Do Something</button>
      <LiveRegionAnnouncer />
    </>
  );
}
```

### Skip to Main Content

```tsx
import { SkipToMainContent } from "@/lib/design-system/accessibility";

function Layout() {
  return (
    <>
      <SkipToMainContent />
      <nav>...</nav>
      <main id="main-content">{children}</main>
    </>
  );
}
```

### Keyboard Shortcuts Helper

```tsx
import { KeyboardShortcuts } from "@/lib/design-system/accessibility";

// Already included in ClientProviders
// Users can press Shift+? to see available shortcuts
```

### Focus Trap Hook

```tsx
import { useFocusTrap } from "@/lib/design-system/accessibility";

function Modal({ isOpen }: { isOpen: boolean }) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Trap focus within modal when open
  useFocusTrap(modalRef, isOpen);

  return (
    <div ref={modalRef} role="dialog">
      {/* Modal content */}
    </div>
  );
}
```

### Automatic Detection

The system automatically detects:

- `prefers-reduced-motion: reduce`
- `prefers-contrast: high`

And applies appropriate settings.

---

## 5. Figma Design Token Export

### Concept

Export design tokens in formats compatible with Figma, CSS, and SCSS for seamless design-dev workflow.

### Export Formats

**1. Figma JSON** - Compatible with Figma Tokens plugin:

```typescript
import { exportFigmaTokens } from "@/lib/design-system/figma-export";

const tokens = exportFigmaTokens();
// Returns complete token set for all 6 portals
```

**2. CSS Variables**:

```typescript
import { exportCSSVariables } from "@/lib/design-system/figma-export";

// Export all portals
const globalCSS = exportCSSVariables();

// Export specific portal
const customerCSS = exportCSSVariables("ispCustomer");
```

**3. SCSS Variables**:

```typescript
import { exportSCSSVariables } from "@/lib/design-system/figma-export";

const scss = exportSCSSVariables("ispAdmin");
```

### Token Exporter UI Component

Development tool for easy token export:

```tsx
import { DesignTokenExporter } from "@/components/dev/DesignTokenExporter";

// Already included in ClientProviders (dev mode only)
// Appears as floating buttons in bottom-right corner
```

**Features:**

- Download tokens as JSON/CSS/SCSS
- Copy tokens to clipboard
- Export all portals or current portal only
- Only visible in development mode

### Using Exported Tokens

#### In Figma (via Figma Tokens Plugin)

1. Export tokens as JSON
2. Install Figma Tokens plugin
3. Import JSON into plugin
4. Tokens sync to Figma styles

#### In CSS

```css
/* Import generated CSS variables */
@import "./design-tokens.css";

/* Use in stylesheets */
.my-element {
  background-color: var(--portal-primary-500);
  padding: var(--spacing-4);
  animation-duration: var(--animation-duration);
}
```

#### In SCSS

```scss
// Import generated SCSS variables
@import "./design-tokens.scss";

// Use in stylesheets
.my-element {
  background-color: $portal-primary-500;
  padding: $spacing-4;
}
```

### Token Structure

The exported JSON includes:

```json
{
  "global": {
    "spacing": { ... },
    "fontFamily": { ... },
    "fontWeight": { ... },
    "duration": { ... },
    "easing": { ... }
  },
  "semantic": {
    "success": { "value": "hsl(...)", "type": "color" },
    "warning": { ... },
    "error": { ... },
    "info": { ... }
  },
  "status": {
    "online": { "value": "hsl(...)", "type": "color" },
    "offline": { ... },
    "degraded": { ... },
    "unknown": { ... }
  },
  "platformAdmin": {
    "metadata": { ... },
    "colors": { ... },
    "fontSize": { ... },
    "spacing": { ... },
    "animations": { ... }
  },
  // ... other 5 portals
}
```

---

## Development Tools

All development tools are automatically available in development mode:

### 1. Portal Switcher

- Floating button (bottom-right)
- Quick navigation between all 6 portals
- Shows current portal with indicator dot

### 2. Portal Theme Debugger

- Collapsible panel showing current theme values
- Real-time color previews
- Font size and spacing display

### 3. Design Token Exporter

- Download/copy buttons
- Multiple format support (JSON/CSS/SCSS)
- Per-portal or global export

### 4. Keyboard Shortcuts Helper

- Press `Shift+?` to view shortcuts
- Lists all available keyboard shortcuts

---

## Migration Guide

### From Standard Components to Portal Components

**Before:**

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@dotmac/ui";

<Card className="p-4">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>;
```

**After:**

```tsx
import { PortalCard, PortalCardHeader, PortalCardTitle, PortalCardContent } from "@dotmac/ui";

<PortalCard hoverable>
  {/* Spacing automatically adapts to portal */}
  <PortalCardHeader>
    <PortalCardTitle>Title</PortalCardTitle>
  </PortalCardHeader>
  <PortalCardContent>Content</PortalCardContent>
</PortalCard>;
```

**Benefits:**

- Automatic spacing (customer portal gets 2x spacing)
- Portal-specific animations
- Consistent UX across portal

---

## Best Practices

### 1. Animations

✅ **Do:**

- Use portal animations for consistency
- Respect reduced motion preferences
- Keep animations subtle for admin portals
- Make animations more pronounced for customer/reseller portals

❌ **Don't:**

- Override portal animation settings arbitrarily
- Use complex animations in admin portals
- Ignore accessibility preferences

### 2. Branding

✅ **Do:**

- Use branding overrides for tenant customization
- Maintain design system constraints (color contrast, spacing)
- Fetch branding from API for production
- Provide sensible defaults

❌ **Don't:**

- Allow arbitrary branding that breaks WCAG compliance
- Bypass design system for custom styling
- Hardcode tenant-specific styling

### 3. Accessibility

✅ **Do:**

- Use AccessibilityProvider in all apps
- Provide accessibility settings to users
- Test with screen readers
- Support keyboard navigation
- Maintain WCAG AA minimum (AAA for customer portal)

❌ **Don't:**

- Ignore reduced motion preferences
- Remove skip links
- Disable keyboard navigation
- Use insufficient color contrast

### 4. Design Tokens

✅ **Do:**

- Export tokens for design team regularly
- Keep Figma and code tokens in sync
- Version control token exports
- Document token changes

❌ **Don't:**

- Manually edit generated token files
- Create tokens outside the system
- Skip token documentation

---

## Performance Considerations

### Animation Performance

- Animations use `transform` and `opacity` (GPU-accelerated)
- Reduced motion automatically disables animations
- Portal-specific durations prevent animation overload

### Branding Overrides

- CSS variables update via `style.setProperty` (efficient)
- Branding config cached in localStorage
- Minimal re-renders on branding changes

### Token Export

- Export happens client-side (no server load)
- Large JSON files are chunked for download
- Clipboard API used for copy (faster than downloads)

---

## Browser Support

All enhancements support modern browsers:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Features:**

- CSS custom properties ✅
- Reduced motion detection ✅
- High contrast detection ✅
- Clipboard API ✅
- Local Storage ✅

**Fallbacks:**

- Browsers without reduced motion detection get default animations
- Browsers without clipboard API get download-only
- CSS variables have sensible fallbacks

---

## Testing

### Animation Testing

```tsx
import { render, screen } from "@testing-library/react";
import { PortalButton } from "@dotmac/ui";

test("button scales on hover in reseller portal", async () => {
  // Mock portal context to reseller
  render(<PortalButton>Click me</PortalButton>);

  const button = screen.getByText("Click me");
  fireEvent.mouseEnter(button);

  // Check transform scale matches reseller config (1.08)
  expect(button.style.transform).toBe("scale(1.08)");
});
```

### Accessibility Testing

```tsx
import { render } from "@testing-library/react";
import { AccessibilityProvider } from "@/lib/design-system/accessibility";

test("reduced motion disables animations", () => {
  // Mock prefers-reduced-motion
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));

  render(
    <AccessibilityProvider>
      <App />
    </AccessibilityProvider>,
  );

  // Check that animations are disabled
  expect(document.documentElement).toHaveAttribute("data-reduced-motion", "true");
});
```

---

## Changelog

### Version 2.0.0 (Current)

**Added:**

- Portal-specific animations with personality-based configurations
- PortalCard and PortalButton components with adaptive styling
- ISP branding override system with API integration
- Enhanced accessibility features (reduced motion, high contrast, font scaling)
- Figma design token export (JSON/CSS/SCSS)
- Development tools (DesignTokenExporter)
- Keyboard shortcuts helper
- Focus trap hook
- Live region announcer for screen readers

**Changed:**

- Extended Tailwind config with animation keyframes
- Added AccessibilityProvider to app
- Enhanced PortalTheme interface with animations

**Fixed:**

- TypeScript type errors in component variants
- CSS custom property injection order

---

## Support

For questions or issues:

- Create an issue in the repository
- Contact the platform team
- Check the [main README](./README.md) for basics

---

**Last Updated**: 2025-10-20
**Version**: 2.0.0
**Maintainer**: DotMac Platform Team
