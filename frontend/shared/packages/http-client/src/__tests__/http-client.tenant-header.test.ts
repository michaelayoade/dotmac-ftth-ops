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
  const globalAny = globalThis as typeof globalThis & { location?: any; window?: any };
  const originalLocation = globalAny.location;
  const originalWindow = globalAny.window;

  beforeAll(() => {
    // Mock location.hostname used by TenantResolver.fromHostname()
    delete globalAny.location;
    globalAny.location = { hostname: "acme.isp.dotmac.local" };
    globalAny.window = {
      ...(globalAny.window || {}),
      location: {
        hostname: "acme.isp.dotmac.local",
        search: "",
      },
    };
  });

  afterAll(() => {
    globalAny.location = originalLocation;
    if (originalWindow) {
      globalAny.window = originalWindow;
    } else {
      delete globalAny.window;
    }
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
    expect(captured!.headers).toBeTruthy();
    // Expect header present with derived tenant id `acme`
    expect(captured!.headers["X-Tenant-ID"]).toBe("acme");
  });
});
