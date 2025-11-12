#!/bin/bash

# Fix TS2375 exactOptionalPropertyTypes errors in platform-admin-app
set -e

echo "Starting TS2375 fixes..."

# Fix 1: app/dashboard/billing-revenue/pricing/page.tsx - Lines 324 and 352
# Change undefined values to use conditional spread
echo "Fixing pricing/page.tsx..."
sed -i '' 's/min_quantity: formData\.min_quantity ? parseInt(formData\.min_quantity) : undefined,/...(formData.min_quantity \&\& { min_quantity: parseInt(formData.min_quantity) }),/g' app/dashboard/billing-revenue/pricing/page.tsx
sed -i '' 's/max_uses: formData\.max_uses ? parseInt(formData\.max_uses) : undefined,/...(formData.max_uses \&\& { max_uses: parseInt(formData.max_uses) }),/g' app/dashboard/billing-revenue/pricing/page.tsx

# Fix 2: app/dashboard/billing-revenue/pricing/simulator/page.tsx - Line 133
echo "Fixing pricing/simulator/page.tsx..."
sed -i '' 's/customer_segments: customerSegments || undefined/...(customerSegments \&\& { customer_segments: customerSegments })/g' app/dashboard/billing-revenue/pricing/simulator/page.tsx

# Fix 3: app/dashboard/communications/send/page.tsx - Line 380
echo "Fixing communications/send/page.tsx..."
sed -i '' "s/value={formData\['template_id'\]}/value={formData['template_id'] || undefined}/g" app/dashboard/communications/send/page.tsx

# Fix 4: app/dashboard/crm/contacts/[id]/page.tsx - Lines 351 and 370
echo "Fixing crm/contacts/[id]/page.tsx..."
sed -i '' 's/value={activeTab}/value={activeTab || undefined}/g' app/dashboard/crm/contacts/\[id\]/page.tsx
sed -i '' 's/value={interactionType}/value={interactionType || undefined}/g' app/dashboard/crm/contacts/\[id\]/page.tsx

# Fix 5: app/dashboard/crm/leads/page.tsx - Line 408
echo "Fixing crm/leads/page.tsx..."
sed -i '' 's/error: metrics\.leads\.error/...(metrics.leads.error \&\& { error: metrics.leads.error })/g' app/dashboard/crm/leads/page.tsx

# Fix 6: app/dashboard/notifications/send/page.tsx - Line 156
echo "Fixing notifications/send/page.tsx..."
sed -i '' 's/subscriber_ids: filters\.subscriberIds || undefined/...(filters.subscriberIds \&\& { subscriber_ids: filters.subscriberIds })/g' app/dashboard/notifications/send/page.tsx
sed -i '' 's/customer_ids: filters\.customerIds || undefined/...(filters.customerIds \&\& { customer_ids: filters.customerIds })/g' app/dashboard/notifications/send/page.tsx
sed -i '' 's/status: filters\.status || undefined/...(filters.status \&\& { status: filters.status })/g' app/dashboard/notifications/send/page.tsx
sed -i '' 's/connection_type: filters\.connectionType || undefined/...(filters.connectionType \&\& { connection_type: filters.connectionType })/g' app/dashboard/notifications/send/page.tsx

# Fix 7: app/dashboard/notifications/templates/page.tsx - Line 465
echo "Fixing notifications/templates/page.tsx..."
sed -i '' 's/bulkActions: bulkActions || undefined/...(bulkActions \&\& { bulkActions })/g' app/dashboard/notifications/templates/page.tsx

# Fix 8: app/dashboard/platform-admin/components/AuditLogFilters.tsx - Lines 89 and 137
echo "Fixing AuditLogFilters.tsx..."
sed -i '' 's/value={selectedActor}/value={selectedActor || undefined}/g' app/dashboard/platform-admin/components/AuditLogFilters.tsx
sed -i '' 's/value={selectedAction}/value={selectedAction || undefined}/g' app/dashboard/platform-admin/components/AuditLogFilters.tsx

# Fix 9: app/dashboard/settings/notifications/page.tsx - Multiple Switch components
echo "Fixing settings/notifications/page.tsx..."
sed -i '' 's/checked={preferences\.email\.categories\[category\.id as keyof typeof preferences\.email\.categories\]}/checked={preferences.email.categories[category.id as keyof typeof preferences.email.categories] ?? false}/g' app/dashboard/settings/notifications/page.tsx
sed -i '' 's/checked={preferences\.push\.categories\[category\.id as keyof typeof preferences\.push\.categories\]}/checked={preferences.push.categories[category.id as keyof typeof preferences.push.categories] ?? false}/g' app/dashboard/settings/notifications/page.tsx
sed -i '' 's/checked={preferences\.inApp\.categories\[category\.id as keyof typeof preferences\.inApp\.categories\]}/checked={preferences.inApp.categories[category.id as keyof typeof preferences.inApp.categories] ?? false}/g' app/dashboard/settings/notifications/page.tsx
sed -i '' 's/checked={preferences\.sms\.categories\[category\.id as keyof typeof preferences\.sms\.categories\]}/checked={preferences.sms.categories[category.id as keyof typeof preferences.sms.categories] ?? false}/g' app/dashboard/settings/notifications/page.tsx
sed -i '' 's/checked={preferences\.slack\.categories\[category\.id as keyof typeof preferences\.slack\.categories\]}/checked={preferences.slack.categories[category.id as keyof typeof preferences.slack.categories] ?? false}/g' app/dashboard/settings/notifications/page.tsx

# Fix 10: app/dashboard/settings/plugins/components/PluginForm.tsx - Line 653
echo "Fixing PluginForm.tsx..."
sed -i '' 's/error={errors\[field\.key\]}/error={errors[field.key] || undefined}/g' app/dashboard/settings/plugins/components/PluginForm.tsx

# Fix 11: app/tenant-portal/billing/subscription/page.tsx - Line 199
echo "Fixing tenant-portal/billing/subscription/page.tsx..."
sed -i '' 's/currentPlanId: currentPlan?.id/currentPlanId: currentPlan?.id || undefined/g' app/tenant-portal/billing/subscription/page.tsx

echo "All fixes applied!"
