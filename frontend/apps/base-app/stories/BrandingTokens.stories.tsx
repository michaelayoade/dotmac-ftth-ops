import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { BrandingConfig, ThemeTokens } from "@/lib/config";
import { defaultBranding, defaultThemeTokens } from "@/lib/config";
import { applyBrandingConfig, applyThemeTokens } from "@/lib/theme";

type BrandingPreviewProps = {
  branding: BrandingConfig;
  theme: ThemeTokens;
};

function BrandingPreview({ branding, theme }: BrandingPreviewProps) {
  useEffect(() => {
    applyThemeTokens(theme);
    applyBrandingConfig(branding);

    return () => {
      applyThemeTokens(defaultThemeTokens);
      applyBrandingConfig(defaultBranding);
    };
  }, [branding, theme]);

  return (
    <div className="space-y-8 max-w-4xl">
      <section className="space-y-3">
        <span className="badge-brand inline-flex w-fit items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)]" />
          {branding.productName}
        </span>
        <h1 className="text-4xl font-bold text-foreground">{branding.productName}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">{branding.productTagline}</p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="p-6 space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Buttons & States</h2>
            <p className="text-sm text-muted-foreground">
              Buttons pull from brand primary + hover tokens.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button type="button" className="btn-brand px-4 py-2">
                Primary Action
              </button>
              <button type="button" className="btn-ghost border border-border px-4 py-2">
                Secondary
              </button>
              <span className="badge-brand">Badge sample</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="p-6 space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Typography & Radii</h2>
            <p className="text-sm text-muted-foreground">
              Fonts and rounded corners respond to brand tokens.
            </p>
            <div className="space-y-3 pt-2">
              <div className="rounded-[var(--radius-lg)] border border-dashed border-border p-4">
                <p className="text-sm text-muted-foreground mb-1">Heading font</p>
                <p
                  className="text-xl font-semibold"
                  style={{ fontFamily: "var(--brand-font-heading)" }}
                >
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-dashed border-border p-4">
                <p className="text-sm text-muted-foreground mb-1">Body font</p>
                <p style={{ fontFamily: "var(--brand-font-body)" }}>
                  Flexible SaaS primitives with ready-to-use admin experiences.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const meta: Meta<typeof BrandingPreview> = {
  title: "Design System/Branding Tokens",
  component: BrandingPreview,
  parameters: {
    layout: "fullscreen",
    backgrounds: { disable: true },
  },
};

export default meta;

type Story = StoryObj<typeof BrandingPreview>;

export const DefaultBranding: Story = {
  args: {
    branding: defaultBranding,
    theme: defaultThemeTokens,
  },
};

export const SunsetBranding: Story = {
  args: {
    branding: {
      ...defaultBranding,
      productName: "Sunset Analytics",
      productTagline: "Insights for modern customer lifecycle teams.",
      companyName: "Sunset Labs Inc.",
      supportEmail: "support@sunsetlabs.io",
      logo: {
        light: "",
        dark: "",
        icon: "",
      },
      favicon: "/favicon.ico",
    },
    theme: {
      ...defaultThemeTokens,
      light: {
        ...defaultThemeTokens.light,
        brandPrimary: "#f97316",
        brandPrimaryHover: "#ea580c",
        brandPrimaryForeground: "#ffffff",
        brandAccent: "#facc15",
        brandAccentForeground: "#311b09",
      },
      dark: {
        ...defaultThemeTokens.dark,
        brandPrimary: "#fb923c",
        brandPrimaryHover: "#f97316",
        brandPrimaryForeground: "#1c1917",
        brandAccent: "#facc15",
        brandAccentForeground: "#1c1917",
      },
      fonts: {
        heading: '"Sora", var(--brand-font-heading)',
        body: '"Inter", var(--brand-font-body)',
      },
      radii: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
};
