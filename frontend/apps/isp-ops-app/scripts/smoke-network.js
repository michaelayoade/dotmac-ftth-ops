"use strict";

// Simple REST smoke for network monitoring endpoints.
// Usage:
//   NETWORK_BASE=http://localhost:8000/api/isp/v1/admin \
//   AUTH_TOKEN="Bearer <token>" \
//   node scripts/smoke-network.js

const axios = require("axios");

const BASE = process.env.NETWORK_BASE || "http://localhost:8000/api/isp/v1/admin";
const AUTH = process.env.AUTH_TOKEN || process.env.BEARER_TOKEN || "";

const headers = {};
if (AUTH) headers["Authorization"] = AUTH.startsWith("Bearer") ? AUTH : `Bearer ${AUTH}`;

async function run() {
  const checks = [
    { name: "overview", url: `${BASE}/network/overview` },
    { name: "devices", url: `${BASE}/network/devices` },
    { name: "alerts", url: `${BASE}/network/alerts` },
    { name: "alert-rules", url: `${BASE}/network/alert-rules` },
  ];

  for (const check of checks) {
    process.stdout.write(`Checking ${check.name}... `);
    try {
      const res = await axios.get(check.url, { headers, timeout: 10000, withCredentials: true });
      if (res.status >= 200 && res.status < 300) {
        console.log("ok");
      } else {
        console.log(`fail (status ${res.status})`);
        process.exitCode = 1;
      }
    } catch (err) {
      console.log("fail");
      console.error(err.response?.data || err.message);
      process.exitCode = 1;
    }
  }
}

run();
