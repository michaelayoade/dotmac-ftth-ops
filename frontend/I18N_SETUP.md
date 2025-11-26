# i18n Setup & Migration Guide

Complete guide for implementing internationalization in the DotMac Platform frontend.

## Table of Contents

1. [Setup](#setup)
2. [Configuration](#configuration)
3. [Usage](#usage)
4. [Migration Examples](#migration-examples)
5. [Best Practices](#best-practices)
6. [Adding New Languages](#adding-new-languages)

---

## Setup

### 1. Install Dependencies

```bash
cd frontend/apps/isp-ops-app
pnpm add next-intl
```

### 2. Update next.config.js

```javascript
const withNextIntl = require('next-intl/plugin')('./i18n.ts');

module.exports = withNextIntl({
  // Your existing Next.js config
});
```

### 3. Update app/layout.tsx

```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '../i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Validate locale
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Load messages
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### 4. Update Folder Structure

```
app/
├── [locale]/           # ✅ Add locale parameter
│   ├── dashboard/
│   │   └── page.tsx
│   ├── customers/
│   │   └── page.tsx
│   └── layout.tsx
├── layout.tsx          # Root layout
└── not-found.tsx

messages/
├── en.json             # ✅ English translations
├── es.json             # ✅ Spanish translations
├── fr.json             # ✅ French translations
├── de.json             # ✅ German translations
└── pt.json             # ✅ Portuguese translations
```

---

## Configuration

### Supported Locales

Current supported locales (configured in `i18n.ts`):

- **English** (`en`) - Default ✅ Complete
- **Spanish** (`es`) - ✅ Complete
- **French** (`fr`) - ✅ Complete
- **German** (`de`) - ✅ Complete
- **Portuguese** (`pt`) - ✅ Complete

### Adding Environment Variable

```bash
# .env.local
NEXT_PUBLIC_DEFAULT_LOCALE=en
```

---

## Usage

### Client Components

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { JobStatus, JobStatusVariants } from '@dotmac/types';
import { getStatusLabel } from '@/lib/i18n/utils';
import { Badge } from '@dotmac/ui';

export function JobsList() {
  const t = useTranslations();

  return (
    <div>
      <h1>{t('jobs.title')}</h1>

      {jobs.map((job) => (
        <div key={job.id}>
          <h3>{job.name}</h3>

          {/* ✅ Type-safe status label */}
          <Badge variant={JobStatusVariants[job.status]}>
            {getStatusLabel(t, job.status, 'jobs')}
          </Badge>

          {/* ✅ Common actions */}
          <button>{t('common.edit')}</button>
          <button>{t('common.delete')}</button>
        </div>
      ))}

      {/* ✅ No data state */}
      {jobs.length === 0 && (
        <p>{t('common.noData')}</p>
      )}
    </div>
  );
}
```

### Server Components

```typescript
import { getTranslations } from 'next-intl/server';

export default async function CustomersPage() {
  const t = await getTranslations();

  return (
    <div>
      <h1>{t('customers.title')}</h1>
      <button>{t('customers.createCustomer')}</button>
    </div>
  );
}
```

### Scoped Translations

```typescript
// Scope to specific namespace
const t = useTranslations('customers');

<h1>{t('title')}</h1>                  // customers.title
<button>{t('createCustomer')}</button>  // customers.createCustomer

// Multiple namespaces
const tCustomers = useTranslations('customers');
const tCommon = useTranslations('common');

<h1>{tCustomers('title')}</h1>
<button>{tCommon('save')}</button>
```

### Parameters & Pluralization

```typescript
const t = useTranslations('forms.validation');

// With parameters
t('minLength', { min: 8 })  // "Must be at least 8 characters"

// Pluralization (ICU MessageFormat)
t('time.minutesAgo', { count: 1 })   // "1 minute ago"
t('time.minutesAgo', { count: 5 })   // "5 minutes ago"

// Rich formatting
t('pagination.showing', {
  start: 1,
  end: 10,
  total: 100
})  // "Showing 1 to 10 of 100 results"
```

---

## Migration Examples

### Example 1: Simple Component

#### Before (Hardcoded)

```typescript
// ❌ OLD
export function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <div className="border p-4">
      <h3>{customer.name}</h3>
      <p>Status: {customer.status}</p>
      <p>Type: {customer.type}</p>

      <div className="flex gap-2">
        <button>Edit</button>
        <button>Delete</button>
        <button>View Details</button>
      </div>
    </div>
  );
}
```

#### After (i18n)

```typescript
// ✅ NEW
'use client';

import { useTranslations } from 'next-intl';
import { getStatusLabel } from '@/lib/i18n/utils';
import { CustomerStatus } from '@dotmac/types';

export function CustomerCard({ customer }: { customer: Customer }) {
  const t = useTranslations();

  return (
    <div className="border p-4">
      <h3>{customer.name}</h3>
      <p>
        {t('customers.fields.status')}: {getStatusLabel(t, customer.status, 'customers')}
      </p>
      <p>
        {t('customers.fields.type')}: {t(`customers.type.${customer.type}`)}
      </p>

      <div className="flex gap-2">
        <button>{t('common.edit')}</button>
        <button>{t('common.delete')}</button>
        <button>{t('common.viewDetails')}</button>
      </div>
    </div>
  );
}
```

### Example 2: Form Component

#### Before (Hardcoded)

```typescript
// ❌ OLD
export function CreateCustomerForm() {
  const { register, formState: { errors }, handleSubmit } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2>Create Customer</h2>

      <div>
        <label>First Name *</label>
        <input {...register('firstName', { required: true })} />
        {errors.firstName && <span>This field is required</span>}
      </div>

      <div>
        <label>Email *</label>
        <input
          type="email"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
        />
        {errors.email && <span>{errors.email.message}</span>}
      </div>

      <button type="submit">Create Customer</button>
      <button type="button">Cancel</button>
    </form>
  );
}
```

#### After (i18n)

```typescript
// ✅ NEW
'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { getValidationError } from '@/lib/i18n/utils';

export function CreateCustomerForm() {
  const t = useTranslations();
  const { register, formState: { errors }, handleSubmit } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2>{t('customers.createCustomer')}</h2>

      <div>
        <label>
          {t('customers.fields.firstName')} <span>{t('common.required')}</span>
        </label>
        <input
          {...register('firstName', {
            required: getValidationError(t, t('customers.fields.firstName'), 'required'),
          })}
        />
        {errors.firstName && <span>{errors.firstName.message}</span>}
      </div>

      <div>
        <label>
          {t('customers.fields.email')} <span>{t('common.required')}</span>
        </label>
        <input
          type="email"
          {...register('email', {
            required: getValidationError(t, t('customers.fields.email'), 'required'),
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: t('forms.validation.email'),
            },
          })}
        />
        {errors.email && <span>{errors.email.message}</span>}
      </div>

      <button type="submit">{t('customers.createCustomer')}</button>
      <button type="button">{t('common.cancel')}</button>
    </form>
  );
}
```

### Example 3: Status Badge

#### Before (Hardcoded)

```typescript
// ❌ OLD
function getStatusLabel(status: string) {
  switch (status) {
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

<Badge variant={variant}>
  {getStatusLabel(job.status)}
</Badge>
```

#### After (i18n + Shared Constants)

```typescript
// ✅ NEW
import { useTranslations } from 'next-intl';
import { JobStatus, JobStatusVariants } from '@dotmac/types';
import { getStatusLabel } from '@/lib/i18n/utils';

const t = useTranslations();

<Badge variant={JobStatusVariants[job.status]}>
  {getStatusLabel(t, job.status, 'jobs')}
</Badge>
```

### Example 4: Language Selector Component

```typescript
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@dotmac/ui';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();

  function changeLocale(newLocale: Locale) {
    // Replace current locale in path
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <span>{localeFlags[locale as Locale]} {localeNames[locale as Locale]}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => changeLocale(loc)}
          >
            <span>{localeFlags[loc]} {localeNames[loc]}</span>
            {loc === locale && <span className="ml-2">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Best Practices

### ✅ DO

1. **Use namespaces** for organization
   ```typescript
   const tCustomers = useTranslations('customers');
   const tCommon = useTranslations('common');
   ```

2. **Extract reusable translations to common**
   ```json
   {
     "common": {
       "save": "Save",
       "cancel": "Cancel",
       "delete": "Delete"
     }
   }
   ```

3. **Use parameters for dynamic content**
   ```typescript
   t('pagination.showing', { start: 1, end: 10, total: 100 })
   ```

4. **Use ICU MessageFormat for plurals**
   ```json
   {
     "items": "{count, plural, =0 {no items} =1 {1 item} other {# items}}"
   }
   ```

5. **Keep keys descriptive**
   ```json
   {
     "customers": {
       "createCustomer": "Create Customer",
       "deleteConfirm": "Are you sure you want to delete this customer?"
     }
   }
   ```

### ❌ DON'T

1. **Don't hardcode strings**
   ```typescript
   // ❌ WRONG
   <button>Save Changes</button>

   // ✅ RIGHT
   <button>{t('common.save')}</button>
   ```

2. **Don't concatenate translations**
   ```typescript
   // ❌ WRONG
   t('hello') + ' ' + t('world')

   // ✅ RIGHT
   t('helloWorld')
   ```

3. **Don't use enum values directly as labels**
   ```typescript
   // ❌ WRONG
   <span>{customer.status}</span>

   // ✅ RIGHT
   <span>{getStatusLabel(t, customer.status, 'customers')}</span>
   ```

4. **Don't nest too deeply**
   ```json
   // ❌ TOO DEEP
   {
     "pages": {
       "customers": {
         "list": {
           "table": {
             "headers": {
               "name": "Name"
             }
           }
         }
       }
     }
   }

   // ✅ BETTER
   {
     "customers": {
       "fields": {
         "name": "Name"
       }
     }
   }
   ```

---

## Adding New Languages

### 1. Create Message File

```bash
cp messages/en.json messages/fr.json
```

### 2. Translate Content

Edit `messages/fr.json` and translate all strings.

### 3. Add Locale to Config

Update `i18n.ts`:

```typescript
export const locales = ['en', 'es', 'fr', 'de', 'pt'] as const;

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',  // ✅ Add French
  de: 'Deutsch',
  pt: 'Português',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',  // ✅ Add flag
  de: '🇩🇪',
  pt: '🇧🇷',
};
```

### 4. Test Translation

```bash
# Navigate to French version
http://localhost:3000/fr/dashboard
```

---

## Tools & Scripts

### Extract Missing Keys

```bash
# TODO: Create script to find hardcoded strings
pnpm run i18n:extract
```

### Validate Translations

```bash
# TODO: Create script to validate all languages have same keys
pnpm run i18n:validate
```

### Sync Translations

```bash
# TODO: Create script to sync missing keys across languages
pnpm run i18n:sync
```

---

## Type Safety

next-intl provides full TypeScript support:

```typescript
// Auto-completion for translation keys
t('customers.title')  // ✅ Autocomplete works
t('customers.invalid') // ❌ TypeScript error

// Type-safe parameters
t('forms.validation.minLength', { min: 8 })  // ✅ Correct
t('forms.validation.minLength', { max: 8 })  // ❌ TypeScript error (wrong param)
```

---

## Performance

### Static Generation

Translations are loaded at build time for static pages:

```typescript
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
```

### Code Splitting

Each locale's messages are code-split:

```typescript
// Only loads current locale
messages: (await import(`./messages/${locale}.json`)).default
```

---

## Migration Checklist

- [x] Install `next-intl` dependency
- [x] Update `next.config.js` with plugin
- [x] Update `app/layout.tsx` with locale provider
- [ ] Move pages to `app/[locale]/` directory (TODO: needs app restructure)
- [x] Create message files for each locale (all 5 locales complete)
- [x] Add `LanguageSwitcher` component to navigation
- [ ] Replace hardcoded strings in components (in progress)
- [ ] Update forms with translated validation messages
- [x] Add type-safe status label helpers
- [ ] Test all locales
- [x] Document custom translation patterns

---

## Resources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
- [Locale Codes (ISO 639-1)](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
- [Currency Codes (ISO 4217)](https://en.wikipedia.org/wiki/ISO_4217)
