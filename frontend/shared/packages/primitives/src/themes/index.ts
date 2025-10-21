// Export ISP Brand Theme System
export * from "./ISPBrandTheme";

// Export Universal Theme System (extends ISP Brand Theme)
export * from "./UniversalTheme";

// Legacy compatibility exports
export { ISPThemeProvider as ThemeProvider } from "./ISPBrandTheme";
export { useISPTheme as useTheme } from "./ISPBrandTheme";

// New universal theme exports
export {
  UniversalThemeProvider,
  useUniversalTheme,
  ThemeAware,
  PortalBrand,
} from "./UniversalTheme";
