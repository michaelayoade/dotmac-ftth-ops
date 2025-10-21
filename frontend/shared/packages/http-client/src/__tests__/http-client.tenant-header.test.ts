import { HttpClient } from "../../src/http-client";

// Minimal custom adapter to intercept axios request config
function createCaptureAdapter(capture: (config: any) => void) {
  return async (config: any) => {
    capture(config);
    return {
      data: {},
      status: 200,
      statusText: "OK",
      headers: {},
      config,
      request: {},
    } as any;
  };
}

describe("HttpClient tenant header injection", () => {
  const originalLocation = global.location;

  beforeAll(() => {
    // Mock location.hostname used by TenantResolver.fromHostname()
    // @ts-ignore
    delete (global as any).location;
    // @ts-ignore
    (global as any).location = { hostname: "acme.isp.dotmac.local" };
  });

  afterAll(() => {
    // @ts-ignore
    (global as any).location = originalLocation;
  });

  it("adds X-Tenant-ID header from hostname", async () => {
    let captured: any = null;
    const client = HttpClient.createFromHostname();
    // @ts-ignore override adapter
    client["axiosInstance"].defaults.adapter = createCaptureAdapter((cfg) => {
      captured = cfg;
    });

    await client.get("/api/test");

    expect(captured).toBeTruthy();
    expect(captured.headers).toBeTruthy();
    // Expect header present with derived tenant id `acme`
    expect(captured.headers["X-Tenant-ID"]).toBe("acme");
  });
});
