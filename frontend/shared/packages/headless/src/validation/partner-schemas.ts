/**
 * Zod validation schemas for Partner Portal
 * Provides both client and server-side validation
 */

import { z } from "zod";

// Base Partner Schema
export const PartnerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(100),
  partnerCode: z
    .string()
    .min(3)
    .max(10)
    .regex(/^[A-Z0-9]+$/),
  territory: z.string().min(2).max(50),
  joinDate: z.string().datetime(),
  status: z.enum(["active", "inactive", "suspended", "pending"]),
  tier: z.enum(["Bronze", "Silver", "Gold", "Platinum"]),
  contact: z.object({
    name: z.string().min(2).max(50),
    email: z.string().email(),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/), // E.164 format
  }),
});

// Customer Schema with validation
export const CustomerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  address: z.string().min(10).max(200),
  plan: z.enum(["residential_basic", "residential_premium", "business_pro", "enterprise"]),
  mrr: z.number().min(0).max(10000),
  status: z.enum(["active", "pending", "suspended", "cancelled"]),
  joinDate: z.string().datetime(),
  lastPayment: z.string().datetime().nullable(),
  connectionStatus: z.enum(["online", "offline"]),
  usage: z.number().min(0).max(100),
});

// Partner Login Schema
export const PartnerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  partnerCode: z.string().min(3).max(10).optional(),
  territory: z.string().max(50).optional(),
  rememberMe: z.boolean().optional(),
  mfaCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(), // 6-digit MFA code
});

// Territory Validation Schema
export const TerritoryValidationSchema = z.object({
  address: z.string().min(10).max(200),
  partnerId: z.string().min(1),
});

// Customer Creation Schema (subset for new customers)
export const CreateCustomerSchema = CustomerSchema.omit({
  id: true,
  joinDate: true,
  lastPayment: true,
  connectionStatus: true,
  usage: true,
}).extend({
  initialPlan: z.string().optional(),
  promotionalCode: z.string().max(20).optional(),
});

// Customer Update Schema (allows partial updates)
export const UpdateCustomerSchema = CustomerSchema.partial().omit({
  id: true,
  joinDate: true,
});

// Commission Record Schema
export const CommissionRecordSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  customerName: z.string().min(2).max(100),
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
  revenue: z.number().min(0),
  commissionRate: z.number().min(0).max(1), // 0-100% as decimal
  commissionAmount: z.number().min(0),
  status: z.enum(["pending", "paid", "disputed"]),
  payoutDate: z.string().datetime().optional(),
});

// API Query Parameters Schema
export const CustomerQueryParamsSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().max(100).optional(),
  status: z.enum(["active", "pending", "suspended", "cancelled"]).optional(),
});

export const CommissionQueryParamsSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  period: z
    .string()
    .regex(/^\d{4}(-\d{2})?$/)
    .optional(), // YYYY or YYYY-MM
  status: z.enum(["pending", "paid", "disputed"]).optional(),
});

// Dashboard Data Schema
export const DashboardDataSchema = z.object({
  partner: PartnerSchema,
  performance: z.object({
    customersTotal: z.number().min(0),
    customersActive: z.number().min(0),
    customersThisMonth: z.number().min(0),
    revenue: z.object({
      total: z.number().min(0),
      thisMonth: z.number().min(0),
      lastMonth: z.number().min(0),
      growth: z.number(),
    }),
    commissions: z.object({
      earned: z.number().min(0),
      pending: z.number().min(0),
      thisMonth: z.number().min(0),
      lastPayout: z.number().min(0),
      nextPayoutDate: z.string().datetime(),
    }),
    targets: z.object({
      monthlyCustomers: z.object({
        current: z.number().min(0),
        target: z.number().min(0),
        unit: z.literal("customers"),
      }),
      monthlyRevenue: z.object({
        current: z.number().min(0),
        target: z.number().min(0),
        unit: z.literal("revenue"),
      }),
      quarterlyGrowth: z.object({
        current: z.number(),
        target: z.number(),
        unit: z.literal("percentage"),
      }),
    }),
  }),
  recentCustomers: z
    .array(
      CustomerSchema.extend({
        service: z.string().min(1).max(50),
        commission: z.number().min(0),
      }),
    )
    .max(10),
  salesGoals: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(2).max(100),
        target: z.number().min(0),
        current: z.number().min(0),
        progress: z.number().min(0).max(100),
        deadline: z.string().datetime(),
        status: z.enum(["active", "completed", "overdue"]),
      }),
    )
    .max(20),
});

// Error Response Schema
export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.any().optional(),
  timestamp: z.string().datetime(),
  requestId: z.string().optional(),
});

// Success Response Schema (generic)
export const ApiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.literal(true),
    timestamp: z.string().datetime(),
    requestId: z.string().optional(),
  });

// Paginated Response Schema
export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.object({
      items: z.array(itemSchema),
      total: z.number().min(0),
      page: z.number().min(1),
      limit: z.number().min(1),
      totalPages: z.number().min(1),
    }),
    success: z.literal(true),
    timestamp: z.string().datetime(),
  });

// Input Sanitization Helpers
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, "") // Basic XSS prevention
    .slice(0, 1000); // Prevent extremely long inputs
};

export const sanitizeSearchTerm = (term: string): string => {
  return term
    .trim()
    .replace(/[^\w\s@.-]/g, "") // Allow alphanumeric, spaces, email chars, and basic punctuation
    .slice(0, 100);
};

// Type exports
export type Partner = z.infer<typeof PartnerSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type PartnerLogin = z.infer<typeof PartnerLoginSchema>;
export type CreateCustomer = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomer = z.infer<typeof UpdateCustomerSchema>;
export type CommissionRecord = z.infer<typeof CommissionRecordSchema>;
export type CustomerQueryParams = z.infer<typeof CustomerQueryParamsSchema>;
export type CommissionQueryParams = z.infer<typeof CommissionQueryParamsSchema>;
export type DashboardData = z.infer<typeof DashboardDataSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
