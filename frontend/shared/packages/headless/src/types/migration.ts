/**
 * Type Migration Utilities
 * Helpers for transitioning between legacy and ISP Framework types
 */

import type {
  Customer,
  Address,
  BillingInfo,
  CustomerService,
  LegacyPaginatedResponse,
  LegacyApiResponse,
  NetworkDevice,
  DeviceMetrics,
} from "./index";

import type {
  CustomerData,
  AddressData,
  BillingInfoData,
  ServiceData,
  PaginatedResponse,
  ApiResponse,
  UserData,
} from "../api/types/api";

import type { ISPTenant, TenantUser } from "./tenant";

/**
 * Migration utilities for converting between legacy and API types
 */
export class TypeMigration {
  // Customer migrations
  static customerToCustomerData(customer: Customer): CustomerData {
    return {
      id: customer.id,
      portal_id: `CUST${customer.id.slice(-6).toUpperCase()}`, // Generate portal ID
      company_name:
        customer.name.includes(" Inc") || customer.name.includes(" LLC")
          ? customer.name
          : undefined,
      contact_name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address
        ? this.addressToAddressData(customer.address)
        : {
            street: "",
            city: "",
            state: "",
            zip: "",
            country: "US",
          },
      status: customer.status,
      account_type: "RESIDENTIAL", // Default, should be determined by business logic
      billing_info: customer.billing_info
        ? this.billingInfoToBillingInfoData(customer.billing_info)
        : undefined,
      services: customer.services.map(this.customerServiceToServiceData),
      created_at: customer.created_at,
      updated_at: customer.updated_at,
    };
  }

  static customerDataToCustomer(customerData: CustomerData): Customer {
    return {
      id: customerData.id,
      tenant_id: "default", // Should come from context
      email: customerData.email,
      name: customerData.contact_name,
      phone: customerData.phone,
      address: customerData.address ? this.addressDataToAddress(customerData.address) : undefined,
      status: customerData.status,
      services: customerData.services.map(this.serviceDataToCustomerService),
      billing_info: customerData.billing_info
        ? this.billingInfoDataToBillingInfo(customerData.billing_info)
        : {
            customer_id: customerData.id,
            billing_cycle: "MONTHLY",
            payment_method: "credit_card",
            next_billing_date: new Date().toISOString(),
            balance: 0,
            credit_limit: 1000,
          },
      created_at: customerData.created_at,
      updated_at: customerData.updated_at,
    };
  }

  // Address migrations
  static addressToAddressData(address: Address): AddressData {
    return {
      street: address.street,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      coordinates: address.coordinates,
    };
  }

  static addressDataToAddress(addressData: AddressData): Address {
    return {
      street: addressData.street,
      city: addressData.city,
      state: addressData.state,
      zip: addressData.zip,
      country: addressData.country,
      coordinates: addressData.coordinates,
    };
  }

  // Billing info migrations
  static billingInfoToBillingInfoData(billingInfo: BillingInfo): BillingInfoData {
    return {
      billing_cycle: billingInfo.billing_cycle,
      auto_pay: false, // Default, should be determined by business logic
    };
  }

  static billingInfoDataToBillingInfo(billingInfoData: BillingInfoData): BillingInfo {
    return {
      customer_id: "", // Should be provided by context
      billing_cycle: billingInfoData.billing_cycle,
      payment_method: "credit_card", // Default
      next_billing_date: new Date().toISOString(),
      balance: 0,
      credit_limit: 1000,
    };
  }

  // Service migrations
  static customerServiceToServiceData(service: CustomerService): ServiceData {
    return {
      id: service.id,
      name: service.service_name,
      type: "INTERNET", // Default, should be determined by business logic
      status: service.status,
      plan: {
        id: service.service_id,
        name: service.plan,
        description: "",
        monthly_price: service.monthly_rate,
        setup_fee: 0,
      },
      installed_date: service.installation_date,
      monthly_cost: service.monthly_rate,
    };
  }

  static serviceDataToCustomerService(serviceData: ServiceData): CustomerService {
    return {
      id: serviceData.id,
      customer_id: "", // Should be provided by context
      service_id: serviceData.plan.id,
      service_name: serviceData.name,
      status: serviceData.status,
      plan: serviceData.plan.name,
      bandwidth: "", // Should be derived from plan
      ip_address: undefined,
      installation_date: serviceData.installed_date,
      monthly_rate: serviceData.monthly_cost,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Pagination response migrations
  static legacyPaginatedToApi<T>(legacy: LegacyPaginatedResponse<T>): PaginatedResponse<T> {
    return {
      data: legacy.data,
      pagination: {
        page: legacy.pagination.page,
        limit: legacy.pagination.limit,
        total: legacy.pagination.total,
        total_pages: legacy.pagination.totalPages,
        has_next: legacy.pagination.hasNext,
        has_previous: legacy.pagination.hasPrev,
      },
    };
  }

  static apiToLegacyPaginated<T>(api: PaginatedResponse<T>): LegacyPaginatedResponse<T> {
    return {
      data: api.data,
      pagination: {
        page: api.pagination.page,
        limit: api.pagination.limit,
        total: api.pagination.total,
        totalPages: api.pagination.total_pages,
        hasNext: api.pagination.has_next,
        hasPrev: api.pagination.has_previous,
      },
    };
  }

  // API response migrations
  static legacyApiToApi<T>(legacy: LegacyApiResponse<T>): ApiResponse<T> {
    return {
      data: legacy.data,
      timestamp: legacy.timestamp,
    };
  }

  static apiToLegacyApi<T>(api: ApiResponse<T>): LegacyApiResponse<T> {
    return {
      data: api.data,
      timestamp: api.timestamp,
    };
  }

  // Network device migrations
  static convertNetworkDeviceToApiFormat(device: NetworkDevice): any {
    return {
      id: device.id,
      name: device.name,
      type: device.type,
      ip_address: device.ip_address,
      mac_address: device.mac_address,
      status: device.status,
      location: device.location,
      last_seen: device.last_seen,
      uptime: device.uptime,
      metrics: this.convertDeviceMetricsToApiFormat(device.metrics),
      created_at: device.created_at,
      updated_at: device.updated_at,
    };
  }

  static convertDeviceMetricsToApiFormat(metrics: DeviceMetrics): any {
    return {
      cpu_usage: metrics.cpu_usage,
      memory_usage: metrics.memory_usage,
      disk_usage: metrics.disk_usage,
      network_utilization: metrics.network_utilization,
      temperature: metrics.temperature,
      power_status: metrics.power_status,
    };
  }
}

/**
 * Type guards for runtime type checking
 */
export class TypeGuards {
  static isLegacyPaginatedResponse<T>(obj: any): obj is LegacyPaginatedResponse<T> {
    return (
      obj &&
      Array.isArray(obj.data) &&
      obj.pagination &&
      typeof obj.pagination.hasNext === "boolean" &&
      typeof obj.pagination.hasPrev === "boolean"
    );
  }

  static isApiPaginatedResponse<T>(obj: any): obj is PaginatedResponse<T> {
    return (
      obj &&
      Array.isArray(obj.data) &&
      obj.pagination &&
      typeof obj.pagination.has_next === "boolean" &&
      typeof obj.pagination.has_previous === "boolean"
    );
  }

  static isLegacyCustomer(obj: any): obj is Customer {
    return (
      obj &&
      typeof obj.id === "string" &&
      typeof obj.tenant_id === "string" &&
      typeof obj.email === "string" &&
      Array.isArray(obj.services)
    );
  }

  static isApiCustomerData(obj: any): obj is CustomerData {
    return (
      obj &&
      typeof obj.id === "string" &&
      typeof obj.portal_id === "string" &&
      typeof obj.email === "string" &&
      Array.isArray(obj.services)
    );
  }

  static isISPTenant(obj: any): obj is ISPTenant {
    return (
      obj && typeof obj.id === "string" && obj.isp_config && obj.features && obj.limits && obj.usage
    );
  }
}

/**
 * Field name conversion utilities
 */
export class FieldNameConverter {
  /**
   * Convert camelCase to snake_case
   */
  static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert snake_case to camelCase
   */
  static snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert object field names from camelCase to snake_case
   */
  static objectCamelToSnake<T extends Record<string, any>>(obj: T): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = this.camelToSnake(key);

      if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        result[snakeKey] = this.objectCamelToSnake(value);
      } else if (Array.isArray(value)) {
        result[snakeKey] = value.map((item) =>
          item && typeof item === "object" ? this.objectCamelToSnake(item) : item,
        );
      } else {
        result[snakeKey] = value;
      }
    }

    return result;
  }

  /**
   * Convert object field names from snake_case to camelCase
   */
  static objectSnakeToCamel<T extends Record<string, any>>(obj: T): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const camelKey = this.snakeToCamel(key);

      if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        result[camelKey] = this.objectSnakeToCamel(value);
      } else if (Array.isArray(value)) {
        result[camelKey] = value.map((item) =>
          item && typeof item === "object" ? this.objectSnakeToCamel(item) : item,
        );
      } else {
        result[camelKey] = value;
      }
    }

    return result;
  }
}

/**
 * Validation utilities for type consistency
 */
export class TypeValidator {
  /**
   * Validate that an object has required fields for a given type
   */
  static validateCustomerData(obj: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!obj.id) errors.push("Missing required field: id");
    if (!obj.portal_id) errors.push("Missing required field: portal_id");
    if (!obj.contact_name) errors.push("Missing required field: contact_name");
    if (!obj.email) errors.push("Missing required field: email");
    if (!obj.address) errors.push("Missing required field: address");
    if (!obj.status) errors.push("Missing required field: status");
    if (!obj.account_type) errors.push("Missing required field: account_type");

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate enum values
   */
  static validateEnumValue<T extends string>(value: string, validValues: T[]): value is T {
    return validValues.includes(value as T);
  }

  /**
   * Validate status values are uppercase
   */
  static validateStatusFormat(status: string): boolean {
    return status === status.toUpperCase();
  }
}
