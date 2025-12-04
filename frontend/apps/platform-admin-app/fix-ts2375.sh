#!/bin/bash

# Fix TS2375 exactOptionalPropertyTypes errors in platform-admin-app

BASE_DIR="/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/platform-admin-app"

echo "Fixing TS2375 errors in platform-admin-app..."

# Pattern 1: Fix Tabs/Select value prop - change value={state} to value={state || undefined}
echo "Pattern 1: Fixing Tabs/Select value props..."

# communications/send/page.tsx
sed -i '' 's/value={selectedChannel}/value={selectedChannel || undefined}/g' "$BASE_DIR/app/dashboard/communications/send/page.tsx"

# crm/contacts/[id]/page.tsx
sed -i '' 's/value={activeTab}/value={activeTab || undefined}/g' "$BASE_DIR/app/dashboard/crm/contacts/[id]/page.tsx"
sed -i '' 's/value={interactionType}/value={interactionType || undefined}/g' "$BASE_DIR/app/dashboard/crm/contacts/[id]/page.tsx"

# platform-admin/components/AuditLogFilters.tsx
sed -i '' 's/value={selectedActor}/value={selectedActor || undefined}/g' "$BASE_DIR/app/dashboard/platform-admin/components/AuditLogFilters.tsx"
sed -i '' 's/value={selectedAction}/value={selectedAction || undefined}/g' "$BASE_DIR/app/dashboard/platform-admin/components/AuditLogFilters.tsx"

# Pattern 2: Fix Switch checked prop - change checked={state} to checked={state ?? false}
echo "Pattern 2: Fixing Switch checked props..."

# settings/notifications/page.tsx - multiple Switch components
sed -i '' 's/checked={settings\.email_enabled}/checked={settings.email_enabled ?? false}/g' "$BASE_DIR/app/dashboard/settings/notifications/page.tsx"
sed -i '' 's/checked={settings\.sms_enabled}/checked={settings.sms_enabled ?? false}/g' "$BASE_DIR/app/dashboard/settings/notifications/page.tsx"
sed -i '' 's/checked={settings\.push_enabled}/checked={settings.push_enabled ?? false}/g' "$BASE_DIR/app/dashboard/settings/notifications/page.tsx"
sed -i '' 's/checked={settings\.in_app_enabled}/checked={settings.in_app_enabled ?? false}/g' "$BASE_DIR/app/dashboard/settings/notifications/page.tsx"
sed -i '' 's/checked={settings\.webhook_enabled}/checked={settings.webhook_enabled ?? false}/g' "$BASE_DIR/app/dashboard/settings/notifications/page.tsx"

# notifications/EditTemplateModal.tsx
sed -i '' 's/checked={editedTemplate\.is_active}/checked={editedTemplate.is_active ?? false}/g' "$BASE_DIR/components/notifications/EditTemplateModal.tsx"

echo "Fix script completed!"
