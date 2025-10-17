'use client';

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = 'force-dynamic';

import TenantCustomersView from '@/components/tenant/TenantCustomersView';

export default TenantCustomersView;
