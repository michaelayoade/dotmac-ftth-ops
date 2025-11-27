"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import * as React from "react";

import { cn } from "../lib/utils";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const t = useTranslations("theme");

  // Prevent hydration mismatch
  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return <div className={cn("h-9 w-9 rounded-lg bg-muted animate-pulse", className)} />;
  }

  const themes = [
    { value: "light", icon: Sun, label: t("light") },
    { value: "dark", icon: Moon, label: t("dark") },
    { value: "system", icon: Monitor, label: t("system") },
  ];

  const currentTheme = theme || "system";
  const getSwitchLabel = (label: string) => t("switchTo", { theme: label });
  const getModeTitle = (label: string) => t("modeTitle", { theme: label });

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
          aria-label={getSwitchLabel(label)}
          title={getModeTitle(label)}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export function ThemeToggleButton({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const t = useTranslations("theme");

  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return <button className={cn("h-9 w-9 rounded-lg bg-muted animate-pulse", className)} />;
  }

  const isDark = theme === "dark";
  const targetLabel = isDark ? t("light") : t("dark");

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "p-2 rounded-lg transition-all duration-200",
        "bg-secondary hover:bg-accent",
        "text-muted-foreground hover:text-foreground",
        className,
      )}
      aria-label={t("switchTo", { theme: targetLabel })}
    >
      {isDark ? (
        <Sun className="h-5 w-5 transition-transform duration-200 rotate-0 scale-100" />
      ) : (
        <Moon className="h-5 w-5 transition-transform duration-200 rotate-0 scale-100" />
      )}
    </button>
  );
}
