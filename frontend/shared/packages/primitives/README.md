# @dotmac/primitives

Unstyled, composable UI primitives for the DotMac ISP Platform. Built with
accessibility, performance, and flexibility in mind.

## 🎯 Philosophy

- **Headless by Design**: Zero styling constraints - bring your own design
  system
- **Accessibility First**: Full WAI-ARIA compliance and keyboard navigation
- **Portal Agnostic**: Works across Admin, Customer, and Reseller portals
- **TypeScript Native**: Complete type safety with excellent IntelliSense
- **SSR Ready**: Server-side rendering compatible with proper hydration
- **Tree Shakable**: Import only what you need for optimal bundle sizes

## 📦 Installation

```bash
npm install @dotmac/primitives
# or
yarn add @dotmac/primitives
# or
pnpm add @dotmac/primitives
```

## 🚀 Quick Start

```tsx
import { Button, Form, useForm } from "@dotmac/primitives";

function LoginForm() {
  const form = useForm<{ email: string; password: string }>();

  return (
    <Form form={form} onSubmit={(data) => console.log(data)}>
      <FormField name="email">
        {({ value, onChange, error }) => (
          <FormItem>
            <FormLabel required>Email</FormLabel>
            <Input
              type="email"
              value={value}
              onChange={onChange}
              state={error ? "error" : "default"}
            />
            {error && <FormMessage>{error}</FormMessage>}
          </FormItem>
        )}
      </FormField>

      <Button type="submit">Sign In</Button>
    </Form>
  );
}
```

## 📋 Component Categories

### 🗂️ Data Display

Perfect for dashboards and data management interfaces.

```tsx
import { Table, Chart, MetricCard } from '@dotmac/primitives';

// Responsive data table with sorting and pagination
<DataTable
  columns={columns}
  data={customers}
  pagination={{ current: 1, pageSize: 10, total: 100 }}
  sorting={{ field: 'name', order: 'asc' }}
/>

// Real-time metrics charts
<LineChart
  data={metricsData}
  lines={[{ key: 'revenue', stroke: '#10b981' }]}
  title="Monthly Revenue"
/>

// KPI cards
<MetricCard
  title="Total Customers"
  value="2,847"
  trend={{ direction: 'up', value: 12.5 }}
/>
```

### 📝 Forms & Inputs

Comprehensive form system with React Hook Form integration.

```tsx
import { Form, Input, Select, Checkbox } from "@dotmac/primitives";

<Form form={form} layout="vertical" onSubmit={handleSubmit}>
  <FormField name="plan">
    {({ value, onChange }) => (
      <Select
        value={value}
        onValueChange={onChange}
        options={[
          { value: "basic", label: "Basic Plan" },
          { value: "premium", label: "Premium Plan" },
        ]}
      />
    )}
  </FormField>

  <Checkbox
    name="newsletter"
    label="Subscribe to newsletter"
    description="Get updates about new features"
  />
</Form>;
```

### 🧭 Navigation

Flexible navigation components for any layout.

```tsx
import { Navbar, Sidebar, Breadcrumb } from '@dotmac/primitives';

// Responsive navbar
<Navbar
  brand={<Logo />}
  actions={<UserMenu />}
>
  <NavigationMenu>
    <NavigationItem href="/dashboard">Dashboard</NavigationItem>
    <NavigationItem href="/customers">Customers</NavigationItem>
  </NavigationMenu>
</Navbar>

// Collapsible sidebar
<Sidebar
  collapsible
  collapsed={collapsed}
  onCollapsedChange={setCollapsed}
>
  <NavigationMenu orientation="vertical">
    <NavigationItem icon={<DashboardIcon />}>
      Dashboard
    </NavigationItem>
  </NavigationMenu>
</Sidebar>

// Smart breadcrumbs with overflow
<Breadcrumb maxItems={3}>
  <BreadcrumbItem>
    <BreadcrumbLink href="/">Home</BreadcrumbLink>
  </BreadcrumbItem>
  <BreadcrumbItem>
    <BreadcrumbPage>Current Page</BreadcrumbPage>
  </BreadcrumbItem>
</Breadcrumb>
```

### 🔄 Feedback

User feedback and loading states.

```tsx
import { Toast, Alert, Loading, Progress } from '@dotmac/primitives';

// Toast notifications
const { addToast } = useToast();
addToast({
  title: 'Success!',
  description: 'Customer created successfully',
  variant: 'success'
});

// Alert messages
<Alert variant="warning" closable>
  <AlertTitle>Network Maintenance</AlertTitle>
  <AlertDescription>
    Scheduled maintenance tonight from 2-4 AM EST
  </AlertDescription>
</Alert>

// Loading states
<Loading variant="spinner" text="Loading customers..." />

// Progress indicators
<Progress
  value={75}
  max={100}
  label="Upload Progress"
  showValue
/>
```

### 🏗️ Layout

Flexible layout primitives for responsive designs.

```tsx
import { Container, Grid, Stack, Card } from '@dotmac/primitives';

// Responsive grid system
<Grid cols={3} gap="lg" responsive>
  <GridItem colSpan={2}>
    <Card>Main content</Card>
  </GridItem>
  <GridItem>
    <Card>Sidebar</Card>
  </GridItem>
</Grid>

// Flexbox stacks
<VStack gap="md" align="center">
  <Card>Item 1</Card>
  <Card>Item 2</Card>
</VStack>

// Dashboard layout
<Dashboard
  layout="sidebar-topbar"
  sidebar={<AppSidebar />}
  topbar={<AppTopbar />}
>
  <Container size="xl" padding="lg">
    {/* Page content */}
  </Container>
</Dashboard>
```

## 🎨 Portal Examples

### Admin Portal

High-density interface for power users.

```tsx
import { Dashboard, DataTable, MetricCard } from "@dotmac/primitives";

function AdminDashboard() {
  return (
    <Dashboard layout="sidebar-topbar" sidebar={<AdminSidebar />} topbar={<AdminTopbar />}>
      <Grid cols={4} gap="md">
        <MetricCard title="Active Customers" value="2,847" />
        <MetricCard title="Monthly Revenue" value="$124,500" />
        <MetricCard title="Support Tickets" value="23" />
        <MetricCard title="Network Uptime" value="99.9%" />
      </Grid>

      <Card>
        <CardHeader>
          <h2>Recent Customers</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={customerColumns}
            data={customers}
            selection={{ selectedKeys, onChange: setSelectedKeys }}
          />
        </CardContent>
      </Card>
    </Dashboard>
  );
}
```

### Customer Portal

Clean, focused interface for end users.

```tsx
import { Container, Card, Stack } from "@dotmac/primitives";

function CustomerDashboard() {
  return (
    <Container size="lg" padding="xl">
      <VStack gap="lg">
        <Card>
          <CardHeader>
            <h1>Welcome back, John!</h1>
          </CardHeader>
          <CardContent>
            <MetricCard
              title="Current Plan"
              value="Premium 100Mbps"
              subtitle="Renews on March 15, 2024"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2>Recent Activity</h2>
          </CardHeader>
          <CardContent>
            <DataTable columns={activityColumns} data={recentActivity} pagination={false} />
          </CardContent>
        </Card>
      </VStack>
    </Container>
  );
}
```

### Reseller Portal

Partner-focused interface with branding flexibility.

```tsx
import { Navbar, Container, Grid } from "@dotmac/primitives";

function ResellerDashboard() {
  return (
    <>
      <Navbar brand={<PartnerLogo />}>
        <NavigationMenu>
          <NavigationItem href="/dashboard">Dashboard</NavigationItem>
          <NavigationItem href="/customers">My Customers</NavigationItem>
          <NavigationItem href="/commissions">Commissions</NavigationItem>
        </NavigationMenu>
      </Navbar>

      <Container size="xl" padding="lg">
        <Grid cols={3} gap="lg">
          <Card>
            <CardHeader>Customer Stats</CardHeader>
            <CardContent>
              <MetricCard title="Total Customers" value="156" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>Commission</CardHeader>
            <CardContent>
              <MetricCard title="This Month" value="$2,430" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>Growth</CardHeader>
            <CardContent>
              <MetricCard title="New Signups" value="12" trend={{ direction: "up", value: 8.3 }} />
            </CardContent>
          </Card>
        </Grid>
      </Container>
    </>
  );
}
```

## ♿ Accessibility Features

All components follow WAI-ARIA guidelines and include:

- **Keyboard Navigation**: Full keyboard support with arrow keys, Enter, Escape
- **Screen Reader Support**: Proper ARIA labels, descriptions, and live regions
- **Focus Management**: Logical focus order and visible focus indicators
- **High Contrast**: Respects user's contrast preferences
- **Reduced Motion**: Honors prefers-reduced-motion settings

```tsx
// Example: Accessible data table
<DataTable
  columns={columns}
  data={data}
  aria-label="Customer data table"
  aria-describedby="table-description"
/>
<p id="table-description">
  Navigate with arrow keys, press Enter to sort columns
</p>
```

## 🔧 Advanced Usage

### Custom Validation

```tsx
import { createValidationRules, validationPatterns } from "@dotmac/primitives";

const emailValidation = createValidationRules({
  required: "Email is required",
  pattern: validationPatterns.email,
});

<FormField name="email" rules={emailValidation}>
  {/* Field content */}
</FormField>;
```

### SSR-Safe Usage

```tsx
import { useIsHydrated, useLocalStorage } from "@dotmac/primitives";

function ClientOnlyFeature() {
  const isHydrated = useIsHydrated();
  const [theme, setTheme] = useLocalStorage("theme", "light");

  if (!isHydrated) {
    return <div>Loading...</div>;
  }

  return <ThemeToggle theme={theme} onChange={setTheme} />;
}
```

### Theme Integration

```tsx
// The primitives use semantic CSS classes that you can style
.btn {
  /* Base button styles */
}

.btn.variant-primary {
  /* Primary button styles */
}

.btn.size-lg {
  /* Large button styles */
}

/* Portal-specific overrides */
.admin-portal .btn.variant-primary {
  /* Admin-specific primary button */
}

.customer-portal .btn.variant-primary {
  /* Customer-specific primary button */
}
```

## 📚 API Reference

### Core Utilities

#### `useToast()`

Manages toast notifications across the application.

```tsx
const { addToast, removeToast, removeAllToasts } = useToast();
```

#### `useModal()`

Controls modal state with convenient handlers.

```tsx
const { open, openModal, closeModal, toggleModal } = useModal();
```

#### `useKeyboardNavigation()`

Handles keyboard navigation in lists and menus.

```tsx
const { focusedIndex, handleKeyDown } = useKeyboardNavigation(items, {
  orientation: "vertical",
  loop: true,
  onSelect: handleSelect,
});
```

## 🚦 Production Checklist

✅ **Accessibility**: Full WAI-ARIA compliance  
✅ **Keyboard Navigation**: Arrow keys, Tab, Enter, Escape  
✅ **SSR Compatible**: No hydration errors  
✅ **Tree Shakable**: Optimal bundle sizes  
✅ **TypeScript**: Complete type safety  
✅ **Documentation**: JSDoc comments for IntelliSense  
✅ **Testing**: Unit tests for core functionality  
✅ **Performance**: Optimized for large datasets

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run type checking
pnpm type-check

# Run linting
pnpm lint

# Run tests
pnpm test
```

## 📄 License

MIT © DotMac Platform

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Built with ❤️ for ISP platforms worldwide**
