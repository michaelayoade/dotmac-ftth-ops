#!/bin/bash
set -e

echo "Fixing final batch of TS2375 errors..."

# Fix 1: communications/send/page.tsx - Select value
sed -i '' "s/value={formData\['template_id'\] || undefined}/value={formData['template_id'] || undefined}/g" app/dashboard/communications/send/page.tsx

# Fix 2: crm/contacts/[id]/page.tsx - Tabs value
sed -i '' 's/<Tabs value={activeTab} onValueChange={setActiveTab}>/<Tabs value={activeTab || undefined} onValueChange={setActiveTab}>/g' app/dashboard/crm/contacts/\[id\]/page.tsx
sed -i '' 's/<Tabs value={interactionType} onValueChange={setInteractionType}>/<Tabs value={interactionType || undefined} onValueChange={setInteractionType}>/g' app/dashboard/crm/contacts/\[id\]/page.tsx

# Fix 3: crm/leads/page.tsx - error prop
sed -i '' 's/error={metrics\.leads\.error}/error={metrics.leads.error || undefined}/g' app/dashboard/crm/leads/page.tsx

# Fix 4: platform-admin/components/AuditLogFilters.tsx - Select value
sed -i '' 's/<Select value={selectedActor} onValueChange={setSelectedActor}>/<Select value={selectedActor || undefined} onValueChange={setSelectedActor}>/g' app/dashboard/platform-admin/components/AuditLogFilters.tsx
sed -i '' 's/<Select value={selectedAction} onValueChange={setSelectedAction}>/<Select value={selectedAction || undefined} onValueChange={setSelectedAction}>/g' app/dashboard/platform-admin/components/AuditLogFilters.tsx

# Fix 5: settings/plugins/components/PluginForm.tsx - error prop
sed -i '' 's/error={errors\[field\.key\]}/error={errors[field.key] || undefined}/g' app/dashboard/settings/plugins/components/PluginForm.tsx

# Fix 6: tenant-portal/billing/subscription/page.tsx - currentPlanId
sed -i '' 's/currentPlanId={currentPlan?.id}/currentPlanId={currentPlan?.id || undefined}/g' app/tenant-portal/billing/subscription/page.tsx

echo "Fixed app files. Now fixing components..."

# Fix 7: notifications/EditTemplateModal.tsx - Switch checked
sed -i '' 's/checked={editedTemplate\.is_active}/checked={editedTemplate.is_active ?? false}/g' components/notifications/EditTemplateModal.tsx

# Fix 8: monitoring/DeviceList.tsx - IPAddressDisplay
sed -i '' 's/ipv4={device\.ipv4_address || undefined}/ipv4={device.ipv4_address || undefined}/g' components/monitoring/DeviceList.tsx
sed -i '' 's/ipv6={device\.ipv6_address || undefined}/ipv6={device.ipv6_address || undefined}/g' components/monitoring/DeviceList.tsx

echo "Fixed component files. Now fixing hooks..."

# Fix 9: hooks/useInternetPlans.ts
sed -i '' 's/plan_id: planId || undefined/...(planId \&\& { plan_id: planId })/g' hooks/useInternetPlans.ts
sed -i '' 's/customer_id: customerId || undefined/...(customerId \&\& { customer_id: customerId })/g' hooks/useInternetPlans.ts

echo "All fixes applied!"
