/**
 * Shared test suite for useScheduledDeployments hook
 * Tests scheduled deployment management functionality (templates, instances, scheduling)
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  DeploymentTemplate,
  DeploymentInstance,
  ScheduledDeploymentRequest,
  ScheduledDeploymentResponse,
  DeploymentOperation,
} from "../../apps/platform-admin-app/hooks/useScheduledDeployments";

type UseDeploymentTemplatesHook = () => {
  data: DeploymentTemplate[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<any>;
};

type UseDeploymentInstancesHook = () => {
  data: DeploymentInstance[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<any>;
};

type UseScheduleDeploymentMutationHook = () => {
  mutateAsync: (request: ScheduledDeploymentRequest) => Promise<ScheduledDeploymentResponse>;
  isPending: boolean;
  error: Error | null;
};

type UseScheduledDeploymentsHook = () => {
  scheduleDeployment: (request: ScheduledDeploymentRequest) => Promise<ScheduledDeploymentResponse>;
  fetchTemplates: () => Promise<DeploymentTemplate[]>;
  fetchInstances: () => Promise<DeploymentInstance[]>;
  isLoading: boolean;
  error: Error | null;
};

export interface TestSuiteConfig {
  useDeploymentTemplates: UseDeploymentTemplatesHook;
  useDeploymentInstances: UseDeploymentInstancesHook;
  useScheduleDeploymentMutation: UseScheduleDeploymentMutationHook;
  useScheduledDeployments: UseScheduledDeploymentsHook;
  apiClient: any;
}

type ApiClientMock = {
  get: jest.Mock;
  post: jest.Mock;
};

type ApiMatcher = RegExp | ((url: URL) => boolean);

interface ApiHandler {
  matcher: ApiMatcher;
  data?: unknown;
  error?: unknown;
}

const LOCAL_BASE_URL = "http://localhost";

const parseUrl = (rawUrl: string) => new URL(rawUrl, LOCAL_BASE_URL);

const matchesHandler = (matcher: ApiMatcher, url: URL) => {
  if (typeof matcher === "function") {
    return matcher(url);
  }
  return matcher.test(url.pathname + url.search);
};

const mockApiClientHandlers = (
  client: ApiClientMock,
  handlers: {
    get?: ApiHandler[];
    post?: ApiHandler[];
  },
) => {
  const getHandlers = handlers.get ?? [];
  const postHandlers = handlers.post ?? [];

  client.get.mockImplementation((rawUrl: string) => {
    const url = parseUrl(rawUrl);
    const handler = getHandlers.find((h) => matchesHandler(h.matcher, url));
    if (!handler) {
      throw new Error(`Unhandled GET mock for ${url.pathname}${url.search}`);
    }
    if (handler.error) {
      return Promise.reject(handler.error);
    }
    return Promise.resolve({ data: handler.data });
  });

  client.post.mockImplementation((rawUrl: string, body: unknown) => {
    const url = parseUrl(rawUrl);
    const handler = postHandlers.find((h) => matchesHandler(h.matcher, url));
    if (!handler) {
      throw new Error(`Unhandled POST mock for ${url.pathname}${url.search}`);
    }
    if (handler.error) {
      return Promise.reject(handler.error);
    }
    return Promise.resolve({ data: handler.data });
  });
};

const isTemplatesEndpoint = (url: URL) => url.pathname.endsWith("/deployments/templates");
const isInstancesEndpoint = (url: URL) => url.pathname.endsWith("/deployments/instances");
const isScheduleEndpoint = (url: URL) => url.pathname.endsWith("/deployments/schedule");

/**
 * Create a wrapper with QueryClient for React Query hooks
 */
function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export function runUseScheduledDeploymentsSuite(config: TestSuiteConfig) {
  const {
    useDeploymentTemplates,
    useDeploymentInstances,
    useScheduleDeploymentMutation,
    useScheduledDeployments,
    apiClient,
  } = config;

  describe("useScheduledDeployments", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      apiClient.get.mockReset();
      apiClient.post.mockReset();
    });

    afterEach(() => {
      apiClient.get.mockReset();
      apiClient.post.mockReset();
      jest.restoreAllMocks();
    });

    describe("useDeploymentTemplates", () => {
      it("should fetch deployment templates successfully", async () => {
        const mockTemplates: DeploymentTemplate[] = [
          {
            id: 1,
            name: "standard-deployment",
            display_name: "Standard Deployment",
            description: "Standard production deployment",
            backend: "kubernetes",
            deployment_type: "production",
            version: "1.0.0",
            cpu_cores: 4,
            memory_gb: 8,
            storage_gb: 100,
            is_active: true,
          },
          {
            id: 2,
            name: "high-availability",
            display_name: "High Availability",
            description: "High availability setup",
            backend: "kubernetes",
            deployment_type: "production",
            version: "1.1.0",
            cpu_cores: 8,
            memory_gb: 16,
            storage_gb: 200,
            is_active: true,
          },
        ];

        mockApiClientHandlers(apiClient, {
          get: [{ matcher: isTemplatesEndpoint, data: mockTemplates }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useDeploymentTemplates(), { wrapper });

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual(mockTemplates);
        expect(result.current.error).toBeNull();
        expect(apiClient.get).toHaveBeenCalledWith("/deployments/templates?is_active=true");
      });

      it("should handle template fetch errors", async () => {
        const mockError = new Error("Failed to fetch templates");
        mockApiClientHandlers(apiClient, {
          get: [{ matcher: isTemplatesEndpoint, error: mockError }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useDeploymentTemplates(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toEqual(mockError);
        expect(result.current.data).toBeUndefined();
      });

      it("should handle empty templates list", async () => {
        mockApiClientHandlers(apiClient, {
          get: [{ matcher: isTemplatesEndpoint, data: [] }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useDeploymentTemplates(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual([]);
        expect(result.current.error).toBeNull();
      });

      it("should refetch templates when requested", async () => {
        const mockTemplates: DeploymentTemplate[] = [
          {
            id: 1,
            name: "test-template",
            display_name: "Test Template",
            backend: "kubernetes",
            deployment_type: "staging",
            version: "1.0.0",
            is_active: true,
          },
        ];

        mockApiClientHandlers(apiClient, {
          get: [{ matcher: isTemplatesEndpoint, data: mockTemplates }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useDeploymentTemplates(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(apiClient.get).toHaveBeenCalledTimes(1);

        await act(async () => {
          await result.current.refetch();
        });

        expect(apiClient.get).toHaveBeenCalledTimes(2);
      });
    });

    describe("useDeploymentInstances", () => {
      it("should fetch deployment instances successfully", async () => {
        const mockInstances: DeploymentInstance[] = [
          {
            id: 1,
            tenant_id: "tenant-1",
            template_id: 1,
            environment: "production",
            region: "us-east-1",
            state: "running",
            version: "1.0.0",
            allocated_cpu: 4,
            allocated_memory_gb: 8,
            allocated_storage_gb: 100,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-10T00:00:00Z",
          },
          {
            id: 2,
            tenant_id: "tenant-2",
            template_id: 2,
            environment: "staging",
            state: "stopped",
            version: "1.1.0",
            created_at: "2025-01-05T00:00:00Z",
            updated_at: "2025-01-10T00:00:00Z",
          },
        ];

        mockApiClientHandlers(apiClient, {
          get: [{ matcher: isInstancesEndpoint, data: { instances: mockInstances } }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useDeploymentInstances(), { wrapper });

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual(mockInstances);
        expect(result.current.error).toBeNull();
        expect(apiClient.get).toHaveBeenCalledWith("/deployments/instances");
      });

      it("should handle instance fetch errors", async () => {
        const mockError = new Error("Failed to fetch instances");
        mockApiClientHandlers(apiClient, {
          get: [{ matcher: isInstancesEndpoint, error: mockError }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useDeploymentInstances(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toEqual(mockError);
        expect(result.current.data).toBeUndefined();
      });

      it("should handle empty instances list", async () => {
        mockApiClientHandlers(apiClient, {
          get: [{ matcher: isInstancesEndpoint, data: { instances: [] } }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useDeploymentInstances(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual([]);
        expect(result.current.error).toBeNull();
      });
    });

    describe("useScheduleDeploymentMutation", () => {
      it("should schedule a provision deployment successfully", async () => {
        const request: ScheduledDeploymentRequest = {
          operation: "provision",
          scheduled_at: "2025-12-01T00:00:00Z",
          provision_request: {
            template_id: 1,
            environment: "production",
            region: "us-east-1",
            config: { key: "value" },
            allocated_cpu: 4,
            allocated_memory_gb: 8,
            allocated_storage_gb: 100,
          },
        };

        const mockResponse: ScheduledDeploymentResponse = {
          schedule_id: "sched-123",
          schedule_type: "one_time",
          operation: "provision",
          scheduled_at: "2025-12-01T00:00:00Z",
          parameters: request.provision_request!,
        };

        mockApiClientHandlers(apiClient, {
          post: [{ matcher: isScheduleEndpoint, data: mockResponse }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

        let response: ScheduledDeploymentResponse | undefined;
        await act(async () => {
          response = await result.current.mutateAsync(request);
        });

        expect(response).toEqual(mockResponse);
        expect(apiClient.post).toHaveBeenCalledWith("/deployments/schedule", request);
      });

      it("should schedule an upgrade deployment successfully", async () => {
        const request: ScheduledDeploymentRequest = {
          operation: "upgrade",
          scheduled_at: "2025-12-01T02:00:00Z",
          instance_id: 1,
          upgrade_request: {
            to_version: "2.0.0",
            rollback_on_failure: true,
            maintenance_window_start: "2025-12-01T02:00:00Z",
            maintenance_window_end: "2025-12-01T04:00:00Z",
          },
        };

        const mockResponse: ScheduledDeploymentResponse = {
          schedule_id: "sched-456",
          schedule_type: "one_time",
          operation: "upgrade",
          scheduled_at: "2025-12-01T02:00:00Z",
          parameters: request.upgrade_request!,
        };

        mockApiClientHandlers(apiClient, {
          post: [{ matcher: isScheduleEndpoint, data: mockResponse }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

        let response: ScheduledDeploymentResponse | undefined;
        await act(async () => {
          response = await result.current.mutateAsync(request);
        });

        expect(response).toEqual(mockResponse);
        expect(apiClient.post).toHaveBeenCalledWith("/deployments/schedule", request);
      });

      it("should schedule a scale deployment successfully", async () => {
        const request: ScheduledDeploymentRequest = {
          operation: "scale",
          scheduled_at: "2025-12-01T03:00:00Z",
          instance_id: 1,
          scale_request: {
            cpu_cores: 8,
            memory_gb: 16,
            storage_gb: 200,
          },
        };

        const mockResponse: ScheduledDeploymentResponse = {
          schedule_id: "sched-789",
          schedule_type: "one_time",
          operation: "scale",
          scheduled_at: "2025-12-01T03:00:00Z",
          parameters: request.scale_request!,
        };

        mockApiClientHandlers(apiClient, {
          post: [{ matcher: isScheduleEndpoint, data: mockResponse }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

        let response: ScheduledDeploymentResponse | undefined;
        await act(async () => {
          response = await result.current.mutateAsync(request);
        });

        expect(response).toEqual(mockResponse);
        expect(apiClient.post).toHaveBeenCalledWith("/deployments/schedule", request);
      });

      it("should schedule recurring deployment with cron expression", async () => {
        const request: ScheduledDeploymentRequest = {
          operation: "suspend",
          scheduled_at: "2025-12-01T00:00:00Z",
          instance_id: 1,
          cron_expression: "0 2 * * 0",
        };

        const mockResponse: ScheduledDeploymentResponse = {
          schedule_id: "sched-recurring-1",
          schedule_type: "recurring",
          operation: "suspend",
          cron_expression: "0 2 * * 0",
          next_run_at: "2025-12-07T02:00:00Z",
          parameters: {},
        };

        mockApiClientHandlers(apiClient, {
          post: [{ matcher: isScheduleEndpoint, data: mockResponse }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

        let response: ScheduledDeploymentResponse | undefined;
        await act(async () => {
          response = await result.current.mutateAsync(request);
        });

        expect(response).toEqual(mockResponse);
        expect(apiClient.post).toHaveBeenCalledWith("/deployments/schedule", request);
      });

      it("should schedule recurring deployment with interval", async () => {
        const request: ScheduledDeploymentRequest = {
          operation: "resume",
          scheduled_at: "2025-12-01T00:00:00Z",
          instance_id: 1,
          interval_seconds: 3600, // Every hour
        };

        const mockResponse: ScheduledDeploymentResponse = {
          schedule_id: "sched-recurring-2",
          schedule_type: "recurring",
          operation: "resume",
          interval_seconds: 3600,
          next_run_at: "2025-12-01T01:00:00Z",
          parameters: {},
        };

        mockApiClientHandlers(apiClient, {
          post: [{ matcher: isScheduleEndpoint, data: mockResponse }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

        let response: ScheduledDeploymentResponse | undefined;
        await act(async () => {
          response = await result.current.mutateAsync(request);
        });

        expect(response).toEqual(mockResponse);
      });

      describe("Validation Errors", () => {
        it("should throw error when provision_request is missing for provision operation", async () => {
          const request: ScheduledDeploymentRequest = {
            operation: "provision",
            scheduled_at: "2025-12-01T00:00:00Z",
            // Missing provision_request
          };

          const wrapper = createQueryWrapper();
          const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

          await expect(async () => {
            await act(async () => {
              await result.current.mutateAsync(request);
            });
          }).rejects.toThrow("provision_request is required for provision operation");

          expect(apiClient.post).not.toHaveBeenCalled();
        });

        it("should throw error when instance_id is missing for upgrade operation", async () => {
          const request: ScheduledDeploymentRequest = {
            operation: "upgrade",
            scheduled_at: "2025-12-01T00:00:00Z",
            upgrade_request: {
              to_version: "2.0.0",
            },
            // Missing instance_id
          };

          const wrapper = createQueryWrapper();
          const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

          await expect(async () => {
            await act(async () => {
              await result.current.mutateAsync(request);
            });
          }).rejects.toThrow("instance_id is required for upgrade operation");

          expect(apiClient.post).not.toHaveBeenCalled();
        });

        it("should throw error when upgrade_request is missing for upgrade operation", async () => {
          const request: ScheduledDeploymentRequest = {
            operation: "upgrade",
            scheduled_at: "2025-12-01T00:00:00Z",
            instance_id: 1,
            // Missing upgrade_request
          };

          const wrapper = createQueryWrapper();
          const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

          await expect(async () => {
            await act(async () => {
              await result.current.mutateAsync(request);
            });
          }).rejects.toThrow("upgrade_request is required for upgrade operation");

          expect(apiClient.post).not.toHaveBeenCalled();
        });

        it("should throw error when instance_id is missing for scale operation", async () => {
          const request: ScheduledDeploymentRequest = {
            operation: "scale",
            scheduled_at: "2025-12-01T00:00:00Z",
            scale_request: {
              cpu_cores: 8,
            },
            // Missing instance_id
          };

          const wrapper = createQueryWrapper();
          const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

          await expect(async () => {
            await act(async () => {
              await result.current.mutateAsync(request);
            });
          }).rejects.toThrow("instance_id is required for scale operation");

          expect(apiClient.post).not.toHaveBeenCalled();
        });

        it("should throw error when scale_request is missing for scale operation", async () => {
          const request: ScheduledDeploymentRequest = {
            operation: "scale",
            scheduled_at: "2025-12-01T00:00:00Z",
            instance_id: 1,
            // Missing scale_request
          };

          const wrapper = createQueryWrapper();
          const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

          await expect(async () => {
            await act(async () => {
              await result.current.mutateAsync(request);
            });
          }).rejects.toThrow("scale_request is required for scale operation");

          expect(apiClient.post).not.toHaveBeenCalled();
        });

        it("should throw error when instance_id is missing for suspend operation", async () => {
          const request: ScheduledDeploymentRequest = {
            operation: "suspend",
            scheduled_at: "2025-12-01T00:00:00Z",
            // Missing instance_id
          };

          const wrapper = createQueryWrapper();
          const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

          await expect(async () => {
            await act(async () => {
              await result.current.mutateAsync(request);
            });
          }).rejects.toThrow("instance_id is required for suspend operation");

          expect(apiClient.post).not.toHaveBeenCalled();
        });

        it("should throw error when instance_id is missing for resume operation", async () => {
          const request: ScheduledDeploymentRequest = {
            operation: "resume",
            scheduled_at: "2025-12-01T00:00:00Z",
            // Missing instance_id
          };

          const wrapper = createQueryWrapper();
          const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

          await expect(async () => {
            await act(async () => {
              await result.current.mutateAsync(request);
            });
          }).rejects.toThrow("instance_id is required for resume operation");

          expect(apiClient.post).not.toHaveBeenCalled();
        });

        it("should throw error when instance_id is missing for destroy operation", async () => {
          const request: ScheduledDeploymentRequest = {
            operation: "destroy",
            scheduled_at: "2025-12-01T00:00:00Z",
            // Missing instance_id
          };

          const wrapper = createQueryWrapper();
          const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

          await expect(async () => {
            await act(async () => {
              await result.current.mutateAsync(request);
            });
          }).rejects.toThrow("instance_id is required for destroy operation");

          expect(apiClient.post).not.toHaveBeenCalled();
        });
      });

      it("should handle API errors when scheduling deployment", async () => {
        const request: ScheduledDeploymentRequest = {
          operation: "provision",
          scheduled_at: "2025-12-01T00:00:00Z",
          provision_request: {
            template_id: 1,
            environment: "production",
          },
        };

        const mockError = new Error("Invalid template ID");
        mockApiClientHandlers(apiClient, {
          post: [{ matcher: isScheduleEndpoint, error: mockError }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

        await expect(async () => {
          await act(async () => {
            await result.current.mutateAsync(request);
          });
        }).rejects.toThrow("Invalid template ID");
      });
    });

    describe("useScheduledDeployments (Main Hook)", () => {
      it("should fetch templates via backward-compatible API", async () => {
        const mockTemplates: DeploymentTemplate[] = [
          {
            id: 1,
            name: "test-template",
            display_name: "Test Template",
            backend: "kubernetes",
            deployment_type: "production",
            version: "1.0.0",
            is_active: true,
          },
        ];

        mockApiClientHandlers(apiClient, {
          get: [
            { matcher: isTemplatesEndpoint, data: mockTemplates },
            { matcher: isInstancesEndpoint, data: { instances: [] } },
          ],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduledDeployments(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let templates: DeploymentTemplate[] | undefined;
        await act(async () => {
          templates = await result.current.fetchTemplates();
        });

        expect(templates).toEqual(mockTemplates);
      });

      it("should fetch instances via backward-compatible API", async () => {
        const mockInstances: DeploymentInstance[] = [
          {
            id: 1,
            tenant_id: "tenant-1",
            template_id: 1,
            environment: "production",
            state: "running",
            version: "1.0.0",
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-10T00:00:00Z",
          },
        ];

        mockApiClientHandlers(apiClient, {
          get: [
            { matcher: isTemplatesEndpoint, data: [] },
            { matcher: isInstancesEndpoint, data: { instances: mockInstances } },
          ],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduledDeployments(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let instances: DeploymentInstance[] | undefined;
        await act(async () => {
          instances = await result.current.fetchInstances();
        });

        expect(instances).toEqual(mockInstances);
      });

      it("should schedule deployment via backward-compatible API", async () => {
        const request: ScheduledDeploymentRequest = {
          operation: "provision",
          scheduled_at: "2025-12-01T00:00:00Z",
          provision_request: {
            template_id: 1,
            environment: "production",
          },
        };

        const mockResponse: ScheduledDeploymentResponse = {
          schedule_id: "sched-123",
          schedule_type: "one_time",
          operation: "provision",
          scheduled_at: "2025-12-01T00:00:00Z",
          parameters: request.provision_request!,
        };

        mockApiClientHandlers(apiClient, {
          get: [
            { matcher: isTemplatesEndpoint, data: [] },
            { matcher: isInstancesEndpoint, data: { instances: [] } },
          ],
          post: [{ matcher: isScheduleEndpoint, data: mockResponse }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduledDeployments(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let response: ScheduledDeploymentResponse | undefined;
        await act(async () => {
          response = await result.current.scheduleDeployment(request);
        });

        expect(response).toEqual(mockResponse);
      });

      it("should reflect loading state from all queries", async () => {
        apiClient.get.mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 100))
        );

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduledDeployments(), { wrapper });

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        }, { timeout: 200 });
      });

      it("should reflect error state from queries", async () => {
        const mockError = new Error("Network error");
        mockApiClientHandlers(apiClient, {
          get: [
            { matcher: isTemplatesEndpoint, error: mockError },
            { matcher: isInstancesEndpoint, data: { instances: [] } },
          ],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduledDeployments(), { wrapper });

        await waitFor(() => {
          expect(result.current.error).toEqual(mockError);
        });
      });

      it("should return empty array when fetchTemplates has no data", async () => {
        mockApiClientHandlers(apiClient, {
          get: [
            { matcher: isTemplatesEndpoint, data: [] },
            { matcher: isInstancesEndpoint, data: { instances: [] } },
          ],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduledDeployments(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let templates: DeploymentTemplate[] | undefined;
        await act(async () => {
          templates = await result.current.fetchTemplates();
        });

        expect(templates).toEqual([]);
      });

      it("should return empty array when fetchInstances has no data", async () => {
        mockApiClientHandlers(apiClient, {
          get: [
            { matcher: isTemplatesEndpoint, data: [] },
            { matcher: isInstancesEndpoint, data: { instances: [] } },
          ],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduledDeployments(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let instances: DeploymentInstance[] | undefined;
        await act(async () => {
          instances = await result.current.fetchInstances();
        });

        expect(instances).toEqual([]);
      });
    });

    describe("Edge Cases", () => {
      it("should handle templates with minimal fields", async () => {
        const mockTemplates: DeploymentTemplate[] = [
          {
            id: 1,
            name: "minimal",
            display_name: "Minimal",
            backend: "docker",
            deployment_type: "dev",
            version: "0.1.0",
            is_active: true,
          },
        ];

        mockApiClientHandlers(apiClient, {
          get: [{ matcher: isTemplatesEndpoint, data: mockTemplates }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useDeploymentTemplates(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data?.[0].description).toBeUndefined();
        expect(result.current.data?.[0].cpu_cores).toBeUndefined();
        expect(result.current.data?.[0].memory_gb).toBeUndefined();
      });

      it("should handle instances with minimal fields", async () => {
        const mockInstances: DeploymentInstance[] = [
          {
            id: 1,
            tenant_id: "tenant-1",
            template_id: 1,
            environment: "dev",
            state: "running",
            version: "1.0.0",
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-10T00:00:00Z",
          },
        ];

        mockApiClientHandlers(apiClient, {
          get: [{ matcher: isInstancesEndpoint, data: { instances: mockInstances } }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useDeploymentInstances(), { wrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data?.[0].region).toBeUndefined();
        expect(result.current.data?.[0].allocated_cpu).toBeUndefined();
      });

      it("should handle scheduling with metadata", async () => {
        const request: ScheduledDeploymentRequest = {
          operation: "provision",
          scheduled_at: "2025-12-01T00:00:00Z",
          provision_request: {
            template_id: 1,
            environment: "production",
          },
          metadata: {
            created_by: "admin@example.com",
            purpose: "customer-onboarding",
          },
        };

        const mockResponse: ScheduledDeploymentResponse = {
          schedule_id: "sched-with-metadata",
          schedule_type: "one_time",
          operation: "provision",
          scheduled_at: "2025-12-01T00:00:00Z",
          parameters: request.provision_request!,
        };

        mockApiClientHandlers(apiClient, {
          post: [{ matcher: isScheduleEndpoint, data: mockResponse }],
        });

        const wrapper = createQueryWrapper();
        const { result } = renderHook(() => useScheduleDeploymentMutation(), { wrapper });

        let response: ScheduledDeploymentResponse | undefined;
        await act(async () => {
          response = await result.current.mutateAsync(request);
        });

        expect(response).toEqual(mockResponse);
        expect(apiClient.post).toHaveBeenCalledWith("/deployments/schedule", request);
      });
    });
  });
}
