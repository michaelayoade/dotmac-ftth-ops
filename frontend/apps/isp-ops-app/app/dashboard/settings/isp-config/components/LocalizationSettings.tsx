/**
 * Localization Settings Component
 *
 * Configures currency, language, timezone, and regional formatting settings.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocalizationSettingsProps {
  settings: {
    default_currency: string;
    supported_currencies: string[];
    currency_display_format: string;
    default_language: string;
    supported_languages: string[];
    timezone: string;
    date_format: string;
    time_format: string;
    decimal_separator: string;
    thousands_separator: string;
  };
  onChange: (settings: any) => void;
}

const COMMON_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
];

const COMMON_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "ar", name: "Arabic" },
  { code: "sw", name: "Swahili" },
];

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function LocalizationSettings({ settings, onChange }: LocalizationSettingsProps) {
  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const addCurrency = (currencyCode: string) => {
    if (!settings.supported_currencies.includes(currencyCode)) {
      updateSetting("supported_currencies", [...settings.supported_currencies, currencyCode]);
    }
  };

  const removeCurrency = (currencyCode: string) => {
    // Can't remove default currency
    if (currencyCode === settings.default_currency) return;

    updateSetting(
      "supported_currencies",
      settings.supported_currencies.filter((c) => c !== currencyCode),
    );
  };

  const addLanguage = (languageCode: string) => {
    if (!settings.supported_languages.includes(languageCode)) {
      updateSetting("supported_languages", [...settings.supported_languages, languageCode]);
    }
  };

  const removeLanguage = (languageCode: string) => {
    // Can't remove default language
    if (languageCode === settings.default_language) return;

    updateSetting(
      "supported_languages",
      settings.supported_languages.filter((l) => l !== languageCode),
    );
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Default currency and timezone are typically set during initial
          setup and may require data migration to change. Contact support if you need to modify
          these settings.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Currency Settings</CardTitle>
          <CardDescription>
            Configure default currency and supported payment currencies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Currency */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="default_currency">Default Currency</Label>
              <Badge variant="secondary">Initial Setup</Badge>
            </div>
            <Select
              value={settings.default_currency}
              onValueChange={(value) => {
                updateSetting("default_currency", value);
                // Ensure default currency is in supported list
                if (!settings.supported_currencies.includes(value)) {
                  addCurrency(value);
                }
              }}
            >
              <SelectTrigger id="default_currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name} ({currency.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Primary currency for billing and pricing
            </p>
          </div>

          {/* Supported Currencies */}
          <div className="space-y-2">
            <Label>Supported Currencies</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {settings.supported_currencies.map((code) => {
                const currency = COMMON_CURRENCIES.find((c) => c.code === code);
                const isDefault = code === settings.default_currency;

                return (
                  <Badge
                    key={code}
                    variant={isDefault ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => !isDefault && removeCurrency(code)}
                  >
                    {currency?.symbol || ""} {code}
                    {isDefault && " (Default)"}
                  </Badge>
                );
              })}
            </div>
            <Select onValueChange={addCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Add currency..." />
              </SelectTrigger>
              <SelectContent>
                {COMMON_CURRENCIES.filter(
                  (c) => !settings.supported_currencies.includes(c.code),
                ).map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name} ({currency.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Click a currency badge to remove it (except default)
            </p>
          </div>

          {/* Currency Display Format */}
          <div className="space-y-2">
            <Label htmlFor="currency_display_format">Currency Display Format</Label>
            <Input
              id="currency_display_format"
              value={settings.currency_display_format}
              onChange={(e) => updateSetting("currency_display_format", e.target.value)}
              placeholder="{symbol}{amount:,.2f}"
            />
            <div className="text-sm text-muted-foreground">
              <p>
                Variables: <code>{"{symbol}"}</code>, <code>{"{amount}"}</code>,{" "}
                <code>{"{code}"}</code>
              </p>
              <p className="mt-1">Examples:</p>
              <ul className="list-disc list-inside ml-2">
                <li>
                  <code>{"{symbol}{amount:,.2f}"}</code> → $1,234.56
                </li>
                <li>
                  <code>{"{amount:,.2f} {code}"}</code> → 1,234.56 USD
                </li>
                <li>
                  <code>{"{symbol} {amount:,.2f}"}</code> → $ 1,234.56
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language Settings</CardTitle>
          <CardDescription>Configure default language and supported languages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Language */}
          <div className="space-y-2">
            <Label htmlFor="default_language">Default Language</Label>
            <Select
              value={settings.default_language}
              onValueChange={(value) => {
                updateSetting("default_language", value);
                // Ensure default language is in supported list
                if (!settings.supported_languages.includes(value)) {
                  addLanguage(value);
                }
              }}
            >
              <SelectTrigger id="default_language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name} ({lang.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Supported Languages */}
          <div className="space-y-2">
            <Label>Supported Languages</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {settings.supported_languages.map((code) => {
                const language = COMMON_LANGUAGES.find((l) => l.code === code);
                const isDefault = code === settings.default_language;

                return (
                  <Badge
                    key={code}
                    variant={isDefault ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => !isDefault && removeLanguage(code)}
                  >
                    {language?.name || code}
                    {isDefault && " (Default)"}
                  </Badge>
                );
              })}
            </div>
            <Select onValueChange={addLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Add language..." />
              </SelectTrigger>
              <SelectContent>
                {COMMON_LANGUAGES.filter((l) => !settings.supported_languages.includes(l.code)).map(
                  (lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name} ({lang.code})
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regional Settings</CardTitle>
          <CardDescription>Configure timezone and date/time formatting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Timezone */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Badge variant="secondary">Initial Setup</Badge>
            </div>
            <Select
              value={settings.timezone}
              onValueChange={(value) => updateSetting("timezone", value)}
            >
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">Default timezone for dates and times</p>
          </div>

          {/* Date and Time Formats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date_format">Date Format</Label>
              <Select
                value={settings.date_format}
                onValueChange={(value) => updateSetting("date_format", value)}
              >
                <SelectTrigger id="date_format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2024-01-15)</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (15/01/2024)</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (01/15/2024)</SelectItem>
                  <SelectItem value="DD-MMM-YYYY">DD-MMM-YYYY (15-Jan-2024)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time_format">Time Format</Label>
              <Select
                value={settings.time_format}
                onValueChange={(value) => updateSetting("time_format", value)}
              >
                <SelectTrigger id="time_format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HH:mm:ss">24-hour (14:30:00)</SelectItem>
                  <SelectItem value="hh:mm:ss A">12-hour (02:30:00 PM)</SelectItem>
                  <SelectItem value="HH:mm">24-hour short (14:30)</SelectItem>
                  <SelectItem value="hh:mm A">12-hour short (02:30 PM)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Number Formatting */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="decimal_separator">Decimal Separator</Label>
              <Select
                value={settings.decimal_separator}
                onValueChange={(value) => updateSetting("decimal_separator", value)}
              >
                <SelectTrigger id="decimal_separator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=".">Period (123.45)</SelectItem>
                  <SelectItem value=",">Comma (123,45)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="thousands_separator">Thousands Separator</Label>
              <Select
                value={settings.thousands_separator}
                onValueChange={(value) => updateSetting("thousands_separator", value)}
              >
                <SelectTrigger id="thousands_separator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Comma (1,234,567)</SelectItem>
                  <SelectItem value=".">Period (1.234.567)</SelectItem>
                  <SelectItem value=" ">Space (1 234 567)</SelectItem>
                  <SelectItem value="">None (1234567)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
