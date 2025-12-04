# Theming Guide

This project standardizes on `next-themes` for runtime theme switching and exposes a small set of helpers for branding and portal styling.

## Theme Providers
- Wrap client trees with `ThemeProvider` from `next-themes` (`attribute="class"`), then `PortalThemeProvider` to inject portal-specific CSS variables, and finally your app providers (`frontend/apps/*/providers/ClientProviders.tsx`).
- Avoid using legacy helpers like `getCurrentTheme`/`setTheme`; rely on `useTheme` from `next-themes` and the shared `ThemeToggle` components.

## Theme Toggle (with i18n)
- Component: `frontend/shared/packages/ui/src/components/theme-toggle.tsx`.
- Requires a `NextIntlProvider` ancestor; translations live under the `theme` namespace (`light`, `dark`, `system`, `switchTo`, `modeTitle`).
- Use `<ThemeToggle />` for a three-option pill or `<ThemeToggleButton />` for a single toggle button.

## Branding (Light/Dark)
- Branding config now supports per-theme palettes: `colors.light` and `colors.dark` (see `frontend/apps/*/lib/config.ts`).
- Tenant overrides may supply both light and dark color fields (e.g., `primary_color`, `primary_color_dark`).
- `BrandingProvider` applies branding tokens reactively on theme changes and writes CSS vars for both modes:
  - Active vars: `--brand-primary`, `--brand-secondary`, `--brand-accent`, `--brand-background`, `--brand-foreground`.
  - Mode-scoped vars: `--brand-primary-light|dark`, `--brand-secondary-light|dark`, `--brand-accent-light|dark`, `--brand-background-light|dark`, `--brand-foreground-light|dark`.
- Logos remain theme-aware via `--brand-logo-light` and `--brand-logo-dark`.

## Portal Themes
- Portal CSS variables now react to light/dark mode. `PortalThemeProvider` derives palette values from `colorTokens` and updates on `resolvedTheme` changes.
- Exposed vars include the primary scale (`--portal-primary-50..900`), `--portal-accent`, and new surface tokens: `--portal-surface`, `--portal-surface-foreground`, `--portal-surface-muted`, `--portal-surface-border`.
- Use `usePortalTheme()` to read the current portal metadata, palette, and mode for runtime styling.

## Customization Quick Start
- Environment overrides (light): `NEXT_PUBLIC_PRIMARY_COLOR`, `NEXT_PUBLIC_PRIMARY_HOVER_COLOR`, `NEXT_PUBLIC_SECONDARY_COLOR`, `NEXT_PUBLIC_ACCENT_COLOR`, `NEXT_PUBLIC_BACKGROUND_COLOR`, `NEXT_PUBLIC_FOREGROUND_COLOR`.
- Environment overrides (dark): `NEXT_PUBLIC_PRIMARY_COLOR_DARK`, `NEXT_PUBLIC_PRIMARY_HOVER_COLOR_DARK`, `NEXT_PUBLIC_SECONDARY_COLOR_DARK`, `NEXT_PUBLIC_ACCENT_COLOR_DARK`, `NEXT_PUBLIC_BACKGROUND_COLOR_DARK`, `NEXT_PUBLIC_FOREGROUND_COLOR_DARK`.
- Tenant API overrides: include the `_dark` and hover/foreground fields when available to keep contrast strong in dark mode.

## Testing Notes
- UI tests mock `next-themes` and `next-intl`; when adding new themed components, wrap them with both providers in tests.
- Portal/branding CSS variables are applied in effects; prefer testing rendered styles via computed styles or the `cssVars` exposed by `usePortalTheme`.
