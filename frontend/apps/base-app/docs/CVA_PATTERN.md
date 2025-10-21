# Component Variant Pattern Guide

## Overview

This guide documents the variant pattern used in our UI component library. We use a type-safe approach with TypeScript union types and object lookups for managing component variants.

## Note on CVA

While CVA (class-variance-authority) is an excellent library for variant management, this monorepo currently uses a simpler pattern to avoid additional dependencies. CVA can be adopted in the future when extracting components to a shared package.

## Benefits

- **Type Safety**: Full TypeScript inference for variant props
- **Maintainability**: Centralized variant definitions
- **Zero Dependencies**: No additional libraries needed
- **Developer Experience**: IntelliSense support for all variants
- **Consistency**: Standardized pattern across all components

## Current Pattern

### Simple Component (Badge Example)

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2';

  const variants = {
    default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
    secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
    outline: 'text-foreground',
    success: 'border-transparent bg-green-500 text-white hover:bg-green-600',
    warning: 'border-transparent bg-yellow-500 text-white hover:bg-yellow-600',
    info: 'border-transparent bg-blue-500 text-white hover:bg-blue-600',
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  );
}

export { Badge };
```

### Complex Component (Button Example)

For components with multiple variant dimensions (variant + size):

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 touch-manipulation';

    const variants = {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      outline: 'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      link: 'text-primary underline-offset-4 hover:underline',
    };

    const sizes = {
      default: 'h-10 px-4 py-2 min-h-[44px]',
      sm: 'h-9 rounded-md px-3 min-h-[36px]',
      lg: 'h-11 rounded-md px-8 min-h-[44px]',
      icon: 'h-10 w-10 min-h-[44px] min-w-[44px]',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
```

## Usage Examples

### Basic Usage

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function MyComponent() {
  return (
    <>
      {/* Uses default variant */}
      <Badge>Default</Badge>

      {/* Specify variant */}
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>

      {/* Button with variant and size */}
      <Button variant="destructive" size="lg">
        Delete
      </Button>

      {/* Custom className still works */}
      <Button variant="outline" className="w-full">
        Full Width
      </Button>
    </>
  );
}
```

### TypeScript Benefits

```tsx
// ✅ TypeScript knows all valid variants
<Badge variant="success" />     // OK
<Badge variant="invalid" />     // ❌ Type error

// ✅ IntelliSense shows all options
<Button variant={/* IntelliSense shows: default, secondary, destructive, outline, ghost, link */} />

// ✅ Size is optional with default fallback
<Button variant="primary" />              // OK - uses default size
<Button variant="primary" size="sm" />    // OK - explicit size
```

## Migration Guide

### Before CVA (Old Pattern)

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  const variantClasses = {
    primary: 'bg-sky-500 text-white hover:bg-sky-600',
    secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}
```

### After CVA (New Pattern)

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'rounded-md font-medium transition-colors', // Base styles
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'px-3 py-1 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
```

## Best Practices

### 1. Use Theme Tokens

Always use theme tokens instead of hardcoded colors:

```typescript
// ✅ Good - theme-aware
variant: {
  default: 'bg-primary text-primary-foreground',
  danger: 'bg-destructive text-destructive-foreground',
}

// ❌ Bad - hardcoded colors
variant: {
  default: 'bg-sky-500 text-white',
  danger: 'bg-red-500 text-white',
}
```

### 2. Export Variants

Always export the variants function for composition:

```typescript
export { Component, componentVariants };
```

This allows other components to reuse variants:

```typescript
import { buttonVariants } from '@/components/ui/button';

// Use in another component
<Link className={buttonVariants({ variant: 'outline' })} />
```

### 3. Use forwardRef for Interactive Elements

For components that need DOM refs:

```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button ref={ref} className={...} {...props} />;
  }
);

Button.displayName = 'Button';
```

### 4. Compound Variants (Advanced)

For styles that depend on multiple variants:

```typescript
const buttonVariants = cva("base-styles", {
  variants: {
    variant: { primary: "...", secondary: "..." },
    size: { sm: "...", lg: "..." },
  },
  compoundVariants: [
    {
      variant: "primary",
      size: "lg",
      className: "uppercase tracking-wider", // Only for primary + lg
    },
  ],
  defaultVariants: {
    variant: "primary",
    size: "sm",
  },
});
```

### 5. Conditional Variants

For boolean variants:

```typescript
const alertVariants = cva("base-styles", {
  variants: {
    variant: { info: "...", warning: "...", error: "..." },
    closable: {
      true: "pr-12", // Extra padding for close button
      false: "",
    },
  },
  defaultVariants: {
    variant: "info",
    closable: false,
  },
});
```

## Component Template

Use this template for new CVA components:

```typescript
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const componentVariants = cva(
  'base-classes-here',
  {
    variants: {
      variant: {
        default: 'variant-classes',
        // Add more variants
      },
      // Add more variant dimensions (size, color, etc.)
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface ComponentProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {
  // Add custom props here
}

const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <element
        className={cn(componentVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Component.displayName = 'Component';

export { Component, componentVariants };
```

## Next Steps

1. Apply CVA pattern to remaining UI components:
   - `Input`, `Textarea`, `Select`
   - `Card`, `Alert`, `Toast`
   - `Dialog`, `Popover`, `Dropdown`

2. Create compound components using CVA variants:
   - `Card` + `CardHeader` + `CardContent` + `CardFooter`
   - `Alert` + `AlertTitle` + `AlertDescription`

3. Extract to shared package:
   - Move to `@dotmac/ui` package
   - Add comprehensive Storybook documentation
   - Publish for reuse across applications

## References

- [CVA Documentation](https://cva.style/docs)
- [clsx Documentation](https://github.com/lukeed/clsx)
- [tailwind-merge Documentation](https://github.com/dcastil/tailwind-merge)
