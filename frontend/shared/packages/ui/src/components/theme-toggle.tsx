"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { cn } from "../lib/utils";

// Default labels used when next-intl is not available
const defaultLabels = {
  light: "Light",
  dark: "Dark",
  system: "System",
  switchTo: (theme: string) => `Switch to ${theme} mode`,
  modeTitle: (theme: string) => `${theme} mode`,
};

interface ThemeToggleProps {
  className?: string;
  labels?: {
    light?: string;
    dark?: string;
    system?: string;
    switchTo?: (theme: string) => string;
    modeTitle?: (theme: string) => string;
  };
}

export function ThemeToggle({ className = "", labels }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Merge provided labels with defaults
  const t = {
    light: labels?.light ?? defaultLabels.light,
    dark: labels?.dark ?? defaultLabels.dark,
    system: labels?.system ?? defaultLabels.system,
    switchTo: labels?.switchTo ?? defaultLabels.switchTo,
    modeTitle: labels?.modeTitle ?? defaultLabels.modeTitle,
  };

  // Prevent hydration mismatch
  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return <div className={cn("h-9 w-9 rounded-lg bg-muted animate-pulse", className)} />;
  }

  const themes = [
    { value: "light", icon: Sun, label: t.light },
    { value: "dark", icon: Moon, label: t.dark },
    { value: "system", icon: Monitor, label: t.system },
  ];

  const currentTheme = theme || "system";

  return (
    <div className={cn("flex items-center gap-1 p-1 rounded-lg bg-secondary", className)}>
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            "p-2 rounded-md transition-all duration-200",
            "hover:bg-accent",
            currentTheme === value
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={t.switchTo(label)}
          title={t.modeTitle(label)}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

interface ThemeToggleButtonProps {
  className?: string;
  labels?: {
    light?: string;
    dark?: string;
    switchTo?: (theme: string) => string;
  };
}

export function ThemeToggleButton({ className = "", labels }: ThemeToggleButtonProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Merge provided labels with defaults
  const t = {
    light: labels?.light ?? defaultLabels.light,
    dark: labels?.dark ?? defaultLabels.dark,
    switchTo: labels?.switchTo ?? defaultLabels.switchTo,
  };

  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return <button className={cn("h-9 w-9 rounded-lg bg-muted animate-pulse", className)} />;
  }

  const isDark = theme === "dark";
  const targetLabel = isDark ? t.light : t.dark;

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "p-2 rounded-lg transition-all duration-200",
        "bg-secondary hover:bg-accent",
        "text-muted-foreground hover:text-foreground",
        className,
      )}
      aria-label={t.switchTo(targetLabel)}
    >
      {isDark ? (
        <Sun className="h-5 w-5 transition-transform duration-200 rotate-0 scale-100" />
      ) : (
        <Moon className="h-5 w-5 transition-transform duration-200 rotate-0 scale-100" />
      )}
    </button>
  );
}
