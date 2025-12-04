/**
 * Test data factories for CRM module
 */

let leadCounter = 1;
let quoteCounter = 1;
let activityCounter = 1;

/**
 * Create a mock lead
 */
export const createMockLead = (overrides?: Partial<any>) => {
  const id = leadCounter++;
  return {
    lead_id: `lead_${id}`,
    first_name: "John",
    last_name: "Doe",
    email: `john.doe${id}@example.com`,
    phone: "+1234567890",
    company: "Acme Corp",
    status: "new",
    source: "website",
    interested_in: ["fiber_100", "fiber_500"],
    address: {
      street: "123 Main St",
      city: "New York",
      state: "NY",
      postal_code: "10001",
      country: "US",
    },
    notes: "Interested in high-speed fiber",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assigned_to: "user_1",
    ...overrides,
  };
};

/**
 * Create a qualified lead
 */
export const createQualifiedLead = (overrides?: Partial<any>) => {
  return createMockLead({
    status: "qualified",
    ...overrides,
  });
};

/**
 * Create a converted lead
 */
export const createConvertedLead = (overrides?: Partial<any>) => {
  return createMockLead({
    status: "converted",
    customer_id: "cust_123",
    ...overrides,
  });
};

/**
 * Create multiple leads for list testing
 */
export const createMockLeads = (count: number = 5) => {
  return Array.from({ length: count }, (_, i) =>
    createMockLead({
      lead_id: `lead_${i + 1}`,
      email: `lead${i + 1}@example.com`,
    }),
  );
};

/**
 * Create a mock quote
 */
export const createMockQuote = (overrides?: Partial<any>) => {
  const id = quoteCounter++;
  return {
    quote_id: `quote_${id}`,
    quote_number: `QT-${String(id).padStart(5, "0")}`,
    customer_id: "cust_123",
    lead_id: "lead_1",
    total_amount: 299.99,
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "draft",
    line_items: [
      {
        id: "item_1",
        name: "Fiber 500Mbps",
        description: "High-speed fiber internet",
        quantity: 1,
        unit_price: 99.99,
        total: 99.99,
      },
      {
        id: "item_2",
        name: "Installation",
        description: "Professional installation",
        quantity: 1,
        unit_price: 200.0,
        total: 200.0,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
};

/**
 * Create a mock activity
 */
export const createMockActivity = (overrides?: Partial<any>) => {
  const id = activityCounter++;
  return {
    activity_id: `activity_${id}`,
    type: "note",
    subject: "Follow-up call",
    description: "Called customer to discuss package options",
    customer_id: "cust_123",
    lead_id: null,
    created_by: "user_1",
    created_at: new Date().toISOString(),
    ...overrides,
  };
};

/**
 * Create a phone call activity
 */
export const createPhoneCallActivity = (overrides?: Partial<any>) => {
  return createMockActivity({
    type: "call",
    subject: "Phone call",
    description: "Discussed pricing options",
    ...overrides,
  });
};

/**
 * Create an email activity
 */
export const createEmailActivity = (overrides?: Partial<any>) => {
  return createMockActivity({
    type: "email",
    subject: "Welcome email sent",
    description: "Sent welcome package and service details",
    ...overrides,
  });
};

/**
 * Create a meeting activity
 */
export const createMeetingActivity = (overrides?: Partial<any>) => {
  return createMockActivity({
    type: "meeting",
    subject: "Site survey scheduled",
    description: "Scheduled site survey for next week",
    scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  });
};

/**
 * Create multiple activities for list testing
 */
export const createMockActivities = (count: number = 5) => {
  return Array.from({ length: count }, (_, i) =>
    createMockActivity({
      activity_id: `activity_${i + 1}`,
    }),
  );
};

/**
 * Reset counters (useful between test suites)
 */
export const resetCRMCounters = () => {
  leadCounter = 1;
  quoteCounter = 1;
  activityCounter = 1;
};
