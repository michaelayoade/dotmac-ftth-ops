"use strict";

// Lightweight smoke test for tenant GraphQL (customers + metrics).
// Usage:
//   GRAPHQL_URL=http://localhost:8000/api/isp/v1/admin/graphql \
//   AUTH_TOKEN="Bearer <token>" \
//   node scripts/smoke-graphql.js
//
// Optional: CUSTOMER_ID=<uuid> to include a detail query.

const axios = require("axios");

const GRAPHQL_URL = process.env.GRAPHQL_URL || "http://localhost:8000/api/isp/v1/admin/graphql";
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.BEARER_TOKEN || "";
const CUSTOMER_ID = process.env.CUSTOMER_ID;

async function run() {
  const headers = { "Content-Type": "application/json" };
  if (AUTH_TOKEN)
    headers["Authorization"] = AUTH_TOKEN.startsWith("Bearer")
      ? AUTH_TOKEN
      : `Bearer ${AUTH_TOKEN}`;

  const queries = [
    {
      name: "customers_and_metrics",
      body: {
        query: `
          query SmokeCustomers {
            customers(limit: 5) {
              totalCount
              customers {
                id
                displayName
                status
                email
              }
            }
            customerMetrics {
              totalCustomers
              activeCustomers
              newCustomers
              churnedCustomers
              averageCustomerValue
            }
          }
        `,
      },
    },
  ];

  if (CUSTOMER_ID) {
    queries.push({
      name: "customer_detail",
      body: {
        query: `
          query SmokeCustomerDetail($id: ID!) {
            customer(id: $id) {
              id
              displayName
              status
              email
              activities { type description createdAt }
              notes { content createdAt }
            }
          }
        `,
        variables: { id: CUSTOMER_ID },
      },
    });
  }

  for (const q of queries) {
    process.stdout.write(`Running ${q.name}... `);
    try {
      const res = await axios.post(GRAPHQL_URL, q.body, { headers, timeout: 15000 });
      if (res.data.errors) {
        console.error(`failed\nGraphQL errors:`, res.data.errors);
        process.exitCode = 1;
        continue;
      }
      console.log("ok");
    } catch (err) {
      console.error(`failed\n`, err.response?.data || err.message);
      process.exitCode = 1;
    }
  }
}

run();
