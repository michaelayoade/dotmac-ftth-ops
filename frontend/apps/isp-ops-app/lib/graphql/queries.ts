/**
 * GraphQL Queries
 *
 * Centralized GraphQL query definitions
 */

import { gql } from "@apollo/client";

// ============================================================================
// Tenant Queries
// ============================================================================

export const GET_TENANT_METRICS = gql`
  query GetTenantMetrics {
    tenantMetrics {
      totalTenants
      activeTenants
      trialTenants
      suspendedTenants
      monthlyRecurringRevenue
      averageRevenuePerTenant
      churnRate
      growthRate
    }
  }
`;

export const GET_TENANT = gql`
  query GetTenant(
    $id: ID!
    $includeMetadata: Boolean = false
    $includeSettings: Boolean = false
    $includeUsage: Boolean = false
    $includeInvitations: Boolean = false
  ) {
    tenant(
      id: $id
      includeMetadata: $includeMetadata
      includeSettings: $includeSettings
      includeUsage: $includeUsage
      includeInvitations: $includeInvitations
    ) {
      id
      name
      slug
      status
      plan
      createdAt
      updatedAt
      metadata @include(if: $includeMetadata)
      settings @include(if: $includeSettings) {
        features
        limits
        branding
      }
      usage @include(if: $includeUsage) {
        activeUsers
        storageUsed
        apiCallsThisMonth
        bandwidthUsed
      }
      invitations @include(if: $includeInvitations) {
        id
        email
        role
        status
        createdAt
      }
    }
  }
`;

export const GET_TENANTS = gql`
  query GetTenants(
    $page: Int
    $pageSize: Int
    $status: TenantStatusEnum
    $plan: String
    $search: String
    $includeMetadata: Boolean = false
    $includeSettings: Boolean = false
    $includeUsage: Boolean = false
  ) {
    tenants(
      page: $page
      pageSize: $pageSize
      status: $status
      plan: $plan
      search: $search
      includeMetadata: $includeMetadata
      includeSettings: $includeSettings
      includeUsage: $includeUsage
    ) {
      edges {
        node {
          id
          name
          slug
          status
          plan
          createdAt
          metadata @include(if: $includeMetadata)
          settings @include(if: $includeSettings) {
            features
            limits
          }
          usage @include(if: $includeUsage) {
            activeUsers
            storageUsed
            apiCallsThisMonth
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
        totalCount
      }
    }
  }
`;

// ============================================================================
// Payment Queries
// ============================================================================

export const GET_PAYMENT_METRICS = gql`
  query GetPaymentMetrics($dateFrom: String, $dateTo: String) {
    paymentMetrics(dateFrom: $dateFrom, dateTo: $dateTo) {
      totalPayments
      successfulPayments
      failedPayments
      totalAmount
      averagePaymentAmount
      successRate
      topPaymentMethods {
        method
        count
        totalAmount
      }
    }
  }
`;

export const GET_PAYMENT = gql`
  query GetPayment($id: ID!, $includeCustomer: Boolean = false, $includeInvoice: Boolean = false) {
    payment(id: $id, includeCustomer: $includeCustomer, includeInvoice: $includeInvoice) {
      id
      amount
      currency
      status
      paymentMethod
      createdAt
      processedAt
      customer @include(if: $includeCustomer) {
        id
        name
        email
      }
      invoice @include(if: $includeInvoice) {
        id
        invoiceNumber
        totalAmount
      }
    }
  }
`;

export const GET_PAYMENTS = gql`
  query GetPayments(
    $limit: Int
    $offset: Int
    $status: String
    $customerId: ID
    $dateFrom: String
    $dateTo: String
    $includeCustomer: Boolean = false
  ) {
    payments(
      limit: $limit
      offset: $offset
      status: $status
      customerId: $customerId
      dateFrom: $dateFrom
      dateTo: $dateTo
      includeCustomer: $includeCustomer
    ) {
      edges {
        node {
          id
          amount
          currency
          status
          paymentMethod
          createdAt
          processedAt
          customer @include(if: $includeCustomer) {
            id
            name
            email
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        totalCount
      }
    }
  }
`;

// ============================================================================
// Customer Queries
// ============================================================================

export const GET_CUSTOMER_METRICS = gql`
  query GetCustomerMetrics {
    customerMetrics {
      totalCustomers
      activeCustomers
      churnedCustomers
      newCustomersThisMonth
      averageLifetimeValue
      customerAcquisitionCost
      retentionRate
      netPromoterScore
    }
  }
`;

export const GET_CUSTOMER = gql`
  query GetCustomer($id: ID!, $includeActivities: Boolean = false, $includeNotes: Boolean = false) {
    customer(id: $id, includeActivities: $includeActivities, includeNotes: $includeNotes) {
      id
      name
      email
      phone
      status
      createdAt
      lastActivityAt
      totalSpent
      activities @include(if: $includeActivities) {
        id
        type
        description
        createdAt
      }
      notes @include(if: $includeNotes) {
        id
        content
        createdBy
        createdAt
      }
    }
  }
`;

export const GET_CUSTOMERS = gql`
  query GetCustomers(
    $limit: Int
    $offset: Int
    $status: String
    $search: String
    $includeActivities: Boolean = false
  ) {
    customers(
      limit: $limit
      offset: $offset
      status: $status
      search: $search
      includeActivities: $includeActivities
    ) {
      edges {
        node {
          id
          name
          email
          phone
          status
          createdAt
          totalSpent
          activities @include(if: $includeActivities) {
            id
            type
            description
            createdAt
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        totalCount
      }
    }
  }
`;

// ============================================================================
// Combined Dashboard Query
// ============================================================================

export const GET_DASHBOARD_DATA = gql`
  query GetDashboardData {
    tenantMetrics {
      totalTenants
      activeTenants
      trialTenants
      suspendedTenants
      monthlyRecurringRevenue
      averageRevenuePerTenant
      growthRate
    }
    paymentMetrics {
      totalPayments
      successfulPayments
      failedPayments
      totalAmount
      successRate
    }
    customerMetrics {
      totalCustomers
      activeCustomers
      churnedCustomers
      newCustomersThisMonth
      retentionRate
    }
  }
`;
