import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useAIChat } from "../useAIChat";

const originalFetch = global.fetch;
const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

const createResponse = <T,>(data: T, ok = true, status = ok ? 200 : 500) => ({
  ok,
  status,
  json: async () => data,
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useAIChat", () => {
  beforeAll(() => {
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(createResponse([]));
  });

  it("sends a message, stores the session id, and fetches history", async () => {
    const historyPayload = {
      session_id: 42,
      messages: [
        {
          role: "assistant" as const,
          content: "Reply",
          created_at: "2024-01-01T00:00:00Z",
        },
      ],
    };

    fetchMock
      .mockResolvedValueOnce(createResponse([])) // initial sessions query
      .mockResolvedValueOnce(
        createResponse({ session_id: 42, message: "ok", role: "assistant" }),
      )
      .mockResolvedValueOnce(createResponse(historyPayload));

    const { result } = renderHook(() => useAIChat(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendMessage("Hello", { region: "emea" });
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/ai/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          message: "Hello",
          session_id: undefined,
          context: { region: "emea" },
        }),
      }),
    );

    await waitFor(() => expect(result.current.currentSessionId).toBe(42));
    await waitFor(() => expect(result.current.chatHistory).toEqual(historyPayload.messages));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/ai/sessions/42/history");
  });

  it("creates a session and updates currentSessionId", async () => {
    const sessionPayload = {
      id: 7,
      session_type: "analytics",
      status: "active",
      provider: "mock",
      created_at: "2024-01-01T00:00:00Z",
      message_count: 0,
      total_tokens: 0,
      total_cost: 0,
    };

    fetchMock
      .mockResolvedValueOnce(createResponse([]))
      .mockResolvedValueOnce(createResponse(sessionPayload));

    const { result } = renderHook(() => useAIChat(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createSession("analytics", { foo: "bar" });
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/ai/sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          session_type: "analytics",
          context: { foo: "bar" },
        }),
      }),
    );
    expect(result.current.currentSessionId).toBe(7);
  });

  it("throws when submitting feedback without an active session", async () => {
    fetchMock.mockResolvedValueOnce(createResponse([]));

    const { result } = renderHook(() => useAIChat(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.submitFeedback(5, "Great")).rejects.toThrow("No active session");
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial sessions query
  });
});
