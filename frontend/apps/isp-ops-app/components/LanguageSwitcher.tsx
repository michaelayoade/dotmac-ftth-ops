"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { locales, localeNames, localeFlags, type Locale } from "../i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Button,
} from "@dotmac/ui";
import { Globe } from "lucide-react";

/**
 * LanguageSwitcher Component
 *
 * Allows users to switch between different locales.
 * Displays current locale with flag and name.
 * Updates URL to reflect selected locale.
 *
 * @example
 * ```tsx
 * import { LanguageSwitcher } from '@/components/LanguageSwitcher';
 *
 * export function Header() {
 *   return (
 *     <header>
 *       <nav>
 *         <LanguageSwitcher />
 *       </nav>
 *     </header>
 *   );
 * }
 * ```
 */
export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");

  /**
   * Change locale by updating URL path
   * Preserves current route while switching locale
   */
  function changeLocale(newLocale: Locale) {
    if (newLocale === locale) return;

    // Replace current locale in path with new locale
    // e.g., /en/dashboard -> /es/dashboard
    const segments = pathname.split("/");
    segments[1] = newLocale;
    const newPath = segments.join("/");

    router.push(newPath);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          aria-label={t("selectLanguage") || "Select language"}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline-flex items-center gap-1">
            <span>{localeFlags[locale]}</span>
            <span>{localeNames[locale]}</span>
          </span>
          <span className="sm:hidden">{localeFlags[locale]}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => changeLocale(loc)}
            className="gap-2 cursor-pointer"
          >
            <span>{localeFlags[loc]}</span>
            <span>{localeNames[loc]}</span>
            {loc === locale && <span className="ml-auto text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Compact LanguageSwitcher for mobile or tight spaces
 * Shows only flag emoji without text
 */
export function LanguageSwitcherCompact() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  function changeLocale(newLocale: Locale) {
    if (newLocale === locale) return;

    const segments = pathname.split("/");
    segments[1] = newLocale;
    const newPath = segments.join("/");

    router.push(newPath);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Select language">
          <span className="text-lg">{localeFlags[locale]}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => changeLocale(loc)}
            className="gap-2 cursor-pointer"
          >
            <span>{localeFlags[loc]}</span>
            <span>{localeNames[loc]}</span>
            {loc === locale && <span className="ml-auto text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
