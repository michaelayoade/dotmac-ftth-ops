/**
 * Test script for frontend logger backend integration
 * Run with: npx tsx test-logger-backend.ts
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface FrontendLogEntry {
  level: "ERROR" | "WARNING" | "INFO" | "DEBUG";
  message: string;
  service: string;
  metadata: {
    timestamp: string;
    userAgent?: string;
    url?: string;
    [key: string]: any;
  };
}

interface FrontendLogsRequest {
  logs: FrontendLogEntry[];
}

interface FrontendLogsResponse {
  status: string;
  logs_received: number;
  logs_stored: number;
}

async function testFrontendLogsEndpoint() {
  console.log("🧪 Testing Frontend Logs Backend Integration...\n");

  // Test data
  const testLogs: FrontendLogsRequest = {
    logs: [
      {
        level: "ERROR",
        message: "Test error from frontend logger",
        service: "frontend",
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: "Mozilla/5.0 (Test Agent)",
          url: "http://localhost:3000/test",
          testContext: "integration-test",
          errorCode: 500,
        },
      },
      {
        level: "WARNING",
        message: "Test warning from frontend logger",
        service: "frontend",
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: "Mozilla/5.0 (Test Agent)",
          url: "http://localhost:3000/test",
          testContext: "integration-test",
        },
      },
      {
        level: "INFO",
        message: "Test info from frontend logger",
        service: "frontend",
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: "Mozilla/5.0 (Test Agent)",
          url: "http://localhost:3000/test",
          testContext: "integration-test",
        },
      },
    ],
  };

  try {
    console.log("📤 Sending test logs to backend...");
    console.log(`   Endpoint: ${API_BASE_URL}/api/v1/audit/frontend-logs`);
    console.log(`   Logs: ${testLogs.logs.length}\n`);

    const response = await fetch(`${API_BASE_URL}/api/v1/audit/frontend-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testLogs),
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error response:", errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result: FrontendLogsResponse = await response.json();

    console.log("✅ Success!");
    console.log(`   Status: ${result.status}`);
    console.log(`   Logs received: ${result.logs_received}`);
    console.log(`   Logs stored: ${result.logs_stored}\n`);

    if (result.logs_stored === testLogs.logs.length) {
      console.log("🎉 All logs were successfully stored in the backend!");
    } else {
      console.warn(
        `⚠️  Warning: Only ${result.logs_stored} out of ${testLogs.logs.length} logs were stored`,
      );
    }

    console.log("\n📊 You can verify the logs were stored by querying:");
    console.log(`   GET ${API_BASE_URL}/api/v1/monitoring/logs?service=frontend`);
    console.log(`   or check the audit_activities table where activity_type = 'frontend.log'\n`);

    return true;
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error("\nTroubleshooting:");
    console.error("  1. Is the backend running? (python -m uvicorn src.dotmac.platform.main:app)");
    console.error("  2. Is the database running? (docker-compose up postgres redis)");
    console.error("  3. Check the backend logs for errors");
    return false;
  }
}

// Run the test
testFrontendLogsEndpoint()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
