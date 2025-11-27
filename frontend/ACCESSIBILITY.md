# Accessibility (a11y) Implementation Guide

Complete guide to implementing accessible interfaces in the DotMac FTTH Operations Platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Accessibility Hooks](#accessibility-hooks)
3. [Accessibility Components](#accessibility-components)
4. [ARIA Utilities](#aria-utilities)
5. [Best Practices](#best-practices)
6. [Testing](#testing)
7. [WCAG Compliance](#wcag-compliance)

---

## Overview

Our accessibility infrastructure provides:

- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Focus Management**: Focus traps for modals, skip links for navigation
- **Reduced Motion**: Respects user preferences for animations
- **Multi-Language**: All ARIA labels translate with i18n
- **WCAG 2.1 AA Compliance**: Meets international accessibility standards

---

## Accessibility Hooks

### useKeyboardNavigation

Handle keyboard navigation for lists, menus, and grids.

```tsx
import { useKeyboardNavigation } from "@dotmac/hooks";

function CustomerList({ customers }) {
  const { activeIndex, handleKeyDown } = useKeyboardNavigation({
    itemCount: customers.length,
    onSelect: (index) => selectCustomer(customers[index]),
    orientation: "vertical",
    loop: true,
  });

  return (
    <ul onKeyDown={handleKeyDown} role="listbox">
      {customers.map((customer, index) => (
        <li
          key={customer.id}
          role="option"
          aria-selected={index === activeIndex}
          tabIndex={index === activeIndex ? 0 : -1}
        >
          {customer.name}
        </li>
      ))}
    </ul>
  );
}
```

**Supported Keys:**

- Arrow Up/Down: Vertical navigation
- Arrow Left/Right: Horizontal navigation
- Home: Jump to first item
- End: Jump to last item
- Enter/Space: Select item

### useFocusTrap

Trap focus within a container (modals, dialogs, dropdowns).

```tsx
import { useFocusTrap } from "@dotmac/hooks";

function Modal({ isOpen, onClose, children }) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, {
    initialFocus: true,
    returnFocus: true,
  });

  if (!isOpen) return null;

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">Modal Title</h2>
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

### useReducedMotion

Detect if user prefers reduced motion.

```tsx
import { useReducedMotion } from "@dotmac/hooks";

function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.3,
      }}
    >
      Content
    </motion.div>
  );
}
```

### useAriaLive

Announce dynamic content changes to screen readers.

```tsx
import { useAriaLive } from "@dotmac/hooks";

function SaveButton() {
  const announce = useAriaLive();

  const handleSave = async () => {
    await saveData();
    announce("Changes saved successfully", "polite");
  };

  return <button onClick={handleSave}>Save</button>;
}
```

**Priorities:**

- `polite`: Announces when screen reader is idle (default)
- `assertive`: Announces immediately, interrupting current speech

### useEscapeKey

Handle Escape key press for closing modals/dropdowns.

```tsx
import { useEscapeKey } from "@dotmac/hooks";

function Dropdown({ isOpen, onClose }) {
  useEscapeKey(onClose, isOpen);

  return isOpen ? <div>Dropdown content</div> : null;
}
```

### useMediaQuery

Track media query matches for responsive accessibility.

```tsx
import { useMediaQuery } from "@dotmac/hooks";

function ResponsiveComponent() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const prefersHighContrast = useMediaQuery("(prefers-contrast: high)");

  return (
    <div className={prefersHighContrast ? "high-contrast" : ""}>
      {isMobile ? <MobileNav /> : <DesktopNav />}
    </div>
  );
}
```

---

## Accessibility Components

### SkipLink

Allow keyboard users to skip navigation.

```tsx
import { SkipLink } from "@dotmac/ui";

export function Layout({ children }) {
  return (
    <>
      <SkipLink href="#main-content" />

      <nav>{/* Navigation */}</nav>

      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
```

**Multiple Skip Links:**

```tsx
<SkipLinks
  links={[
    { href: "#main-content", label: "Skip to main content" },
    { href: "#search", label: "Skip to search" },
    { href: "#footer", label: "Skip to footer" },
  ]}
/>
```

### VisuallyHidden

Hide content visually but keep for screen readers.

```tsx
import { VisuallyHidden } from "@dotmac/ui";

function IconButton({ onClick }) {
  return (
    <button onClick={onClick}>
      <TrashIcon />
      <VisuallyHidden>Delete item</VisuallyHidden>
    </button>
  );
}
```

### LiveRegion

Announce dynamic content to screen readers.

```tsx
import { LiveRegion } from "@dotmac/ui";

function FormStatus() {
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    await saveData();
    setMessage("Changes saved successfully");
  };

  return (
    <>
      <button onClick={handleSave}>Save</button>
      <LiveRegion message={message} priority="polite" />
    </>
  );
}
```

**StatusAnnouncer (Higher-level):**

```tsx
import { StatusAnnouncer } from "@dotmac/ui";

function LoadingComponent() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  return (
    <>
      <button onClick={handleAction}>Submit</button>
      <StatusAnnouncer
        status={status}
        messages={{
          loading: "Submitting form...",
          success: "Form submitted successfully",
          error: "Failed to submit form",
        }}
        priority="assertive"
      />
    </>
  );
}
```

---

## ARIA Utilities

All ARIA utilities integrate with i18n for multi-language support.

### Status Labels

```tsx
import { useTranslations } from "next-intl";
import { getStatusAriaLabel } from "@/lib/accessibility/aria";

function JobBadge({ job }) {
  const t = useTranslations();

  return (
    <Badge
      variant={JobStatusVariants[job.status]}
      aria-label={getStatusAriaLabel(t, job.status, "jobs")}
    >
      {getStatusLabel(t, job.status, "jobs")}
    </Badge>
  );
}
```

### Action Buttons

```tsx
import { getActionAriaLabel } from "@/lib/accessibility/aria";

function CustomerActions({ customer }) {
  const t = useTranslations();

  return (
    <div>
      <button aria-label={getActionAriaLabel(t, "edit", customer.name)}>
        <EditIcon />
      </button>
      <button aria-label={getActionAriaLabel(t, "delete", customer.name)}>
        <TrashIcon />
      </button>
    </div>
  );
}
```

### Sortable Tables

```tsx
import { getSortAriaLabel } from "@/lib/accessibility/aria";

function SortableHeader({ column, sortOrder, onSort }) {
  const t = useTranslations();

  return (
    <th
      onClick={onSort}
      aria-sort={sortOrder === "asc" ? "ascending" : sortOrder === "desc" ? "descending" : "none"}
      aria-label={getSortAriaLabel(t, column, sortOrder)}
      style={{ cursor: "pointer" }}
    >
      {column}
      {sortOrder && <SortIcon direction={sortOrder} />}
    </th>
  );
}
```

### Form Fields

```tsx
import { getFieldDescription } from "@/lib/accessibility/aria";
import { useId } from "@dotmac/hooks";

function EmailField() {
  const t = useTranslations();
  const id = useId("email");
  const descriptionId = `${id}-description`;

  return (
    <div>
      <label htmlFor={id}>{t("customers.fields.email")}</label>
      <input id={id} type="email" aria-describedby={descriptionId} required />
      <span id={descriptionId} className="sr-only">
        {getFieldDescription(t, "email", {
          required: true,
          format: "email",
        })}
      </span>
    </div>
  );
}
```

### Progress Indicators

```tsx
import { getProgressAriaLabel } from "@/lib/accessibility/aria";

function UploadProgress({ progress }) {
  const t = useTranslations();

  return (
    <div
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={getProgressAriaLabel(t, "upload", progress)}
    >
      <div style={{ width: `${progress}%` }} />
    </div>
  );
}
```

---

## Best Practices

### 1. Semantic HTML

```tsx
// ❌ BAD: Using divs for everything
<div onClick={handleClick}>Click me</div>

// ✅ GOOD: Using proper semantic elements
<button onClick={handleClick}>Click me</button>
```

### 2. Keyboard Navigation

```tsx
// ✅ All interactive elements must be keyboard accessible
<button onClick={handleClick}>Click</button>
<a href="/page">Link</a>

// ❌ Avoid onClick on non-interactive elements
<div onClick={handleClick}>Bad</div>
```

### 3. Focus Indicators

```css
/* ✅ GOOD: Visible focus indicators */
button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* ❌ BAD: Removing outlines without replacement */
button:focus {
  outline: none; /* Don't do this! */
}
```

### 4. ARIA Labels

```tsx
// ✅ GOOD: Descriptive labels for icon buttons
<button aria-label="Close dialog">
  <XIcon />
</button>

// ❌ BAD: No label for screen readers
<button>
  <XIcon />
</button>
```

### 5. Form Labels

```tsx
// ✅ GOOD: Proper label association
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// ❌ BAD: No label association
<label>Email</label>
<input type="email" />
```

### 6. Loading States

```tsx
// ✅ GOOD: Announce loading states
{
  isLoading && (
    <div role="status" aria-live="polite">
      <Spinner />
      <VisuallyHidden>Loading customers...</VisuallyHidden>
    </div>
  );
}
```

### 7. Error Messages

```tsx
// ✅ GOOD: Associate errors with fields
<input
  id="email"
  aria-invalid={hasError}
  aria-describedby={hasError ? "email-error" : undefined}
/>;
{
  hasError && (
    <span id="email-error" role="alert">
      {error}
    </span>
  );
}
```

### 8. Modal Dialogs

```tsx
// ✅ GOOD: Proper dialog structure
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Delete</h2>
  <p id="dialog-description">Are you sure you want to delete this item?</p>
  <button>Cancel</button>
  <button>Delete</button>
</div>
```

---

## Testing

### Automated Testing

```tsx
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

test("component is accessible", async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Manual Testing Checklist

- [ ] **Keyboard Navigation**: Tab through all interactive elements
- [ ] **Screen Reader**: Test with NVDA (Windows) or VoiceOver (Mac)
- [ ] **Focus Indicators**: All focused elements have visible indicators
- [ ] **Color Contrast**: All text meets WCAG AA standards (4.5:1)
- [ ] **Zoom**: Interface works at 200% zoom
- [ ] **Reduced Motion**: Animations respect prefers-reduced-motion
- [ ] **Forms**: All fields have labels and error messages
- [ ] **Modals**: Focus is trapped and returns on close

### Screen Reader Testing

**VoiceOver (Mac):**

```bash
# Enable: Cmd + F5
# Navigate: VO + Arrow keys
# Click: VO + Space
```

**NVDA (Windows):**

```bash
# Navigate: Arrow keys
# Forms mode: Insert + Space
# Element list: Insert + F7
```

---

## WCAG Compliance

### Level A (Required)

- ✅ **1.1.1 Non-text Content**: All images have alt text
- ✅ **1.3.1 Info and Relationships**: Semantic HTML structure
- ✅ **2.1.1 Keyboard**: Full keyboard access
- ✅ **2.4.1 Bypass Blocks**: Skip links implemented
- ✅ **3.3.2 Labels or Instructions**: All form fields labeled
- ✅ **4.1.2 Name, Role, Value**: ARIA labels on custom controls

### Level AA (Recommended)

- ✅ **1.4.3 Contrast**: 4.5:1 for normal text, 3:1 for large text
- ✅ **1.4.5 Images of Text**: Use real text, not images
- ✅ **2.4.6 Headings and Labels**: Descriptive headings
- ✅ **2.4.7 Focus Visible**: Visible focus indicators
- ✅ **3.2.3 Consistent Navigation**: Consistent nav placement
- ✅ **3.3.3 Error Suggestion**: Helpful error messages
- ✅ **3.3.4 Error Prevention**: Confirmation for important actions

### Level AAA (Enhanced)

- ⚠️ **1.4.6 Contrast (Enhanced)**: 7:1 for normal text
- ✅ **2.4.8 Location**: Breadcrumbs showing current location
- ✅ **2.5.5 Target Size**: Touch targets at least 44x44 pixels
- ✅ **3.3.5 Help**: Context-sensitive help available

---

## Resources

### Tools

- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension for accessibility testing
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluation tool
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Chrome DevTools audits

### Documentation

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project](https://www.a11yproject.com/)

### Testing

- [Screen Reader Testing](https://www.accessibility-developer-guide.com/knowledge/screen-readers/testing/)
- [Keyboard Testing](https://webaim.org/articles/keyboard/)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

## Summary

Our accessibility implementation provides:

✅ **Complete keyboard navigation** with arrow keys, Home/End
✅ **Screen reader support** with proper ARIA labels (translated)
✅ **Focus management** for modals and complex interactions
✅ **Skip links** for efficient navigation
✅ **Live regions** for dynamic content announcements
✅ **Reduced motion** support for users with vestibular disorders
✅ **Multi-language** ARIA labels via i18n
✅ **WCAG 2.1 AA compliance** across all components

All new components should follow these patterns to maintain accessibility standards.
