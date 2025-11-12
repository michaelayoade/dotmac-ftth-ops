#!/bin/bash
set -e

echo "Fixing remaining TS2375 errors..."

# Fix billing/InvoiceList.tsx and ReceiptList.tsx - bulkActions
echo "Fixing InvoiceList.tsx..."
sed -i '' 's/exportOptions: exportOptions || undefined/...(exportOptions \&\& { exportOptions })/g' components/billing/InvoiceList.tsx

echo "Fixing ReceiptList.tsx..."
sed -i '' 's/exportOptions: exportOptions || undefined/...(exportOptions \&\& { exportOptions })/g' components/billing/ReceiptList.tsx

# Fix customers/CustomerEditModal.refactored.tsx - credit_limit and payment_terms
echo "Fixing CustomerEditModal.refactored.tsx..."
sed -i '' 's/credit_limit: formData\.credit_limit \? parseFloat(formData\.credit_limit) : undefined,/...(formData.credit_limit \&\& { credit_limit: parseFloat(formData.credit_limit) }),/g' components/customers/CustomerEditModal.refactored.tsx
sed -i '' 's/payment_terms: formData\.payment_terms \? parseInt(formData\.payment_terms) : undefined,/...(formData.payment_terms \&\& { payment_terms: parseInt(formData.payment_terms) }),/g' components/customers/CustomerEditModal.refactored.tsx

# Fix faults/AlarmDetailModal.examples.tsx
echo "Fixing AlarmDetailModal.examples.tsx..."
sed -i '' 's/probable_cause: undefined/\/\/ probable_cause not set/g' components/faults/AlarmDetailModal.examples.tsx
sed -i '' 's/perceived_severity_override: undefined/\/\/ perceived_severity_override not set/g' components/faults/AlarmDetailModal.examples.tsx

# Fix genieacs/CPEConfigTemplates.tsx
echo "Fixing CPEConfigTemplates.tsx..."
sed -i '' 's/wifi: wifiConfig || undefined/...(wifiConfig \&\& { wifi: wifiConfig })/g' components/genieacs/CPEConfigTemplates.tsx
sed -i '' 's/lan: lanConfig || undefined/...(lanConfig \&\& { lan: lanConfig })/g' components/genieacs/CPEConfigTemplates.tsx
sed -i '' 's/wan: wanConfig || undefined/...(wanConfig \&\& { wan: wanConfig })/g' components/genieacs/CPEConfigTemplates.tsx
sed -i '' 's/custom_parameters: customParams || undefined/...(customParams \&\& { custom_parameters: customParams })/g' components/genieacs/CPEConfigTemplates.tsx

# Fix global-command-palette.tsx
echo "Fixing global-command-palette.tsx..."
sed -i '' 's/keywords={item\.keywords}/keywords={item.keywords || undefined}/g' components/global-command-palette.tsx

# Fix ipam/AllocateIPDialog.tsx
echo "Fixing AllocateIPDialog.tsx..."
sed -i '' 's/dnsName: dnsName || undefined/...(dnsName \&\& { dnsName })/g' components/ipam/AllocateIPDialog.tsx

# Fix ipam/PrefixList.tsx
echo "Fixing PrefixList.tsx..."
sed -i '' 's/onEdit={onEdit}/\.\.\.(onEdit \&\& { onEdit })/g' components/ipam/PrefixList.tsx
sed -i '' 's/onDelete={onDelete}/\.\.\.(onDelete \&\& { onDelete })/g' components/ipam/PrefixList.tsx
sed -i '' 's/onAllocateIP={onAllocateIP}/\.\.\.(onAllocateIP \&\& { onAllocateIP })/g' components/ipam/PrefixList.tsx

# Fix monitoring/DeviceForm.tsx
echo "Fixing monitoring/DeviceForm.tsx..."
sed -i '' 's/ipv4Error={ipv4AddressError}/\.\.\.(ipv4AddressError \&\& { ipv4Error: ipv4AddressError })/g' components/monitoring/DeviceForm.tsx
sed -i '' 's/ipv6Error={ipv6AddressError}/\.\.\.(ipv6AddressError \&\& { ipv6Error: ipv6AddressError })/g' components/monitoring/DeviceForm.tsx
sed -i '' 's/error={snmpCommunityError}/\.\.\.(snmpCommunityError \&\& { error: snmpCommunityError })/g' components/monitoring/DeviceForm.tsx

# Fix monitoring/DeviceList.tsx
echo "Fixing monitoring/DeviceList.tsx..."
sed -i '' 's/onEdit={onEdit}/\.\.\.(onEdit \&\& { onEdit })/g' components/monitoring/DeviceList.tsx
sed -i '' 's/onDelete={onDelete}/\.\.\.(onDelete \&\& { onDelete })/g' components/monitoring/DeviceList.tsx
sed -i '' 's/onViewMetrics={onViewMetrics}/\.\.\.(onViewMetrics \&\& { onViewMetrics })/g' components/monitoring/DeviceList.tsx
sed -i '' 's/ipv4={device\.ipv4_address || undefined}/ipv4={device.ipv4_address || undefined}/g' components/monitoring/DeviceList.tsx
sed -i '' 's/ipv6={device\.ipv6_address || undefined}/ipv6={device.ipv6_address || undefined}/g' components/monitoring/DeviceList.tsx

# Fix notifications/EditTemplateModal.tsx
echo "Fixing EditTemplateModal.tsx..."
sed -i '' 's/checked={editedTemplate\.is_active}/checked={editedTemplate.is_active ?? false}/g' components/notifications/EditTemplateModal.tsx

# Fix partners/CreatePartnerModal.tsx
echo "Fixing CreatePartnerModal.tsx..."
sed -i '' 's/tier: formData\.tier || undefined/...(formData.tier \&\& { tier: formData.tier })/g' components/partners/CreatePartnerModal.tsx
sed -i '' 's/default_commission_rate: formData\.default_commission_rate \? parseFloat(formData\.default_commission_rate) : undefined/...(formData.default_commission_rate \&\& { default_commission_rate: parseFloat(formData.default_commission_rate) })/g' components/partners/CreatePartnerModal.tsx
sed -i '' 's/billing_email: formData\.billing_email || undefined/...(formData.billing_email \&\& { billing_email: formData.billing_email })/g' components/partners/CreatePartnerModal.tsx
sed -i '' 's/phone: formData\.phone || undefined/...(formData.phone \&\& { phone: formData.phone })/g' components/partners/CreatePartnerModal.tsx

# Fix provisioning forms
echo "Fixing provisioning forms..."
sed -i '' 's/error={errors\.ipv4_address}/\.\.\.(errors.ipv4_address \&\& { error: errors.ipv4_address })/g' components/provisioning/SubscriberProvisionForm.tsx
sed -i '' 's/error={errors\.ipv6_address}/\.\.\.(errors.ipv6_address \&\& { error: errors.ipv6_address })/g' components/provisioning/SubscriberProvisionForm.tsx
sed -i '' 's/error={errors\.ipv6_prefix}/\.\.\.(errors.ipv6_prefix \&\& { error: errors.ipv6_prefix })/g' components/provisioning/SubscriberProvisionForm.tsx

sed -i '' 's/error={errors\.allowed_ips_v4}/\.\.\.(errors.allowed_ips_v4 \&\& { error: errors.allowed_ips_v4 })/g' components/provisioning/WireGuardPeerForm.tsx
sed -i '' 's/error={errors\.allowed_ips_v6}/\.\.\.(errors.allowed_ips_v6 \&\& { error: errors.allowed_ips_v6 })/g' components/provisioning/WireGuardPeerForm.tsx

sed -i '' 's/ipv4Error={errors\.ipv4_subnet}/\.\.\.(errors.ipv4_subnet \&\& { ipv4Error: errors.ipv4_subnet })/g' components/provisioning/WireGuardServerForm.tsx
sed -i '' 's/ipv6Error={errors\.ipv6_subnet}/\.\.\.(errors.ipv6_subnet \&\& { ipv6Error: errors.ipv6_subnet })/g' components/provisioning/WireGuardServerForm.tsx

# Fix subscribers/SubscriberList.tsx
echo "Fixing SubscriberList.tsx..."
sed -i '' 's/exportOptions={exportOptions}/\.\.\.(exportOptions \&\& { exportOptions })/g' components/subscribers/SubscriberList.tsx

# Fix tenant/billing/CancelSubscriptionModal.tsx
echo "Fixing CancelSubscriptionModal.tsx..."
sed -i '' 's/reason: reason || undefined/...(reason \&\& { reason })/g' components/tenant/billing/CancelSubscriptionModal.tsx
sed -i '' 's/feedback: feedback || undefined/...(feedback \&\& { feedback })/g' components/tenant/billing/CancelSubscriptionModal.tsx

# Fix tenant/TenantOnboardingWizard.tsx
echo "Fixing TenantOnboardingWizard.tsx..."
sed -i '' 's/contact_email: values\.contact_email || undefined/...(values.contact_email \&\& { contact_email: values.contact_email })/g' components/tenant/TenantOnboardingWizard.tsx
sed -i '' 's/contact_phone: values\.contact_phone || undefined/...(values.contact_phone \&\& { contact_phone: values.contact_phone })/g' components/tenant/TenantOnboardingWizard.tsx
sed -i '' 's/billing_email: values\.billing_email || undefined/...(values.billing_email \&\& { billing_email: values.billing_email })/g' components/tenant/TenantOnboardingWizard.tsx
sed -i '' 's/address: values\.address || undefined/...(values.address \&\& { address: values.address })/g' components/tenant/TenantOnboardingWizard.tsx
sed -i '' 's/city: values\.city || undefined/...(values.city \&\& { city: values.city })/g' components/tenant/TenantOnboardingWizard.tsx
sed -i '' 's/state: values\.state || undefined/...(values.state \&\& { state: values.state })/g' components/tenant/TenantOnboardingWizard.tsx
sed -i '' 's/postal_code: values\.postal_code || undefined/...(values.postal_code \&\& { postal_code: values.postal_code })/g' components/tenant/TenantOnboardingWizard.tsx
sed -i '' 's/country: values\.country || undefined/...(values.country \&\& { country: values.country })/g' components/tenant/TenantOnboardingWizard.tsx

# Fix hooks/useHealth.ts
echo "Fixing useHealth.ts..."
sed -i '' 's/version: undefined/\/\/ version not set in error state/g' hooks/useHealth.ts

# Fix hooks/useInternetPlans.ts
echo "Fixing useInternetPlans.ts..."
sed -i '' 's/plan_id: planId || undefined/...(planId \&\& { plan_id: planId })/g' hooks/useInternetPlans.ts

echo "All remaining fixes applied!"
