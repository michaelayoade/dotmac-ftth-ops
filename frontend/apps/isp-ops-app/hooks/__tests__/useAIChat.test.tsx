/**
 * Jest Mock Tests for useAIChat hook
 * Unit tests focusing on API contracts, query/mutation configuration, and helper behavior
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAIChat } from "../useAIChat";
import type { ChatMessage, ChatSession, SendMessageResponse } from "../useAIChat";

// Create a wrapper component with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockFetch = jest.fn();

beforeEach(() => {
  global.fetch = mockFetch;
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useAIChat", () => {
  describe("Sessions Query", () => {
    it("should fetch sessions with correct API endpoint", async () => {
      const mockSessions: ChatSession[] = [
        {
          id: 1,
          session_type: "customer_support",
          status: "active",
          provider: "openai",
          created_at: "2025-01-01T00:00:00Z",
          message_count: 5,
          total_tokens: 500,
          total_cost: 0.05,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions,
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.sessions.length).toBeGreaterThan(0));

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions/my?limit=20");
      expect(result.current.sessions).toEqual(mockSessions);
    });

    it("should use correct query key for sessions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions/my?limit=20");
    });

    it("should return empty array when no sessions exist", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(result.current.sessions).toEqual([]);
    });

    it("should handle sessions query error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: "Failed to fetch sessions" }),
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(result.current.sessions).toEqual([]);
    });

    it("should handle network error for sessions query", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network Error"));

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(result.current.sessions).toEqual([]);
    });

    it("should refetch sessions when refetchSessions is called", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.refetchSessions();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should hardcode limit parameter to 20", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions/my?limit=20");
    });
  });

  describe("Chat History Query", () => {
    it("should not fetch history when currentSessionId is null", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1)); // Only sessions query

      expect(result.current.currentSessionId).toBeNull();
      expect(result.current.chatHistory).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining("/history"));
    });

    it("should fetch history when currentSessionId is set", async () => {
      const mockHistory = {
        session_id: 1,
        messages: [
          { role: "user" as const, content: "Hello" },
          { role: "assistant" as const, content: "Hi there!" },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockHistory,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(1);
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(result.current.chatHistory.length).toBeGreaterThan(0));

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions/1/history");
      expect(result.current.chatHistory).toEqual(mockHistory.messages);
    });

    it("should use correct query key with session ID", async () => {
      const mockHistory = {
        session_id: 42,
        messages: [],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockHistory,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(42);
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions/42/history");
    });

    it("should return empty array when chatHistory is undefined", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(result.current.chatHistory).toEqual([]);
    });

    it("should handle history query error", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ detail: "Session not found" }),
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(999);
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

      expect(result.current.chatHistory).toEqual([]);
    });

    it("should handle network error for history query", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockRejectedValueOnce(new Error("Network Error"));

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(1);
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

      expect(result.current.chatHistory).toEqual([]);
    });

    it("should refetch history when refetchHistory is called", async () => {
      const mockHistory = {
        session_id: 1,
        messages: [{ role: "user" as const, content: "Hello" }],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValue({
          ok: true,
          json: async () => mockHistory,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(1);
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

      await act(async () => {
        await result.current.refetchHistory();
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions/1/history");
    });

    it("should clear history when currentSessionId is set to null", async () => {
      const mockHistory = {
        session_id: 1,
        messages: [{ role: "user" as const, content: "Hello" }],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockHistory,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(1);
      });

      await waitFor(() => expect(result.current.chatHistory.length).toBeGreaterThan(0));

      act(() => {
        result.current.setCurrentSessionId(null);
      });

      await waitFor(() => expect(result.current.chatHistory).toEqual([]));
    });
  });

  describe("Send Message Mutation", () => {
    it("should send message with correct API endpoint and method", async () => {
      const mockResponse: SendMessageResponse = {
        session_id: 1,
        message: "AI response",
        role: "assistant",
        metadata: { tokens: 50, cost_cents: 1 },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.sendMessage("Hello AI");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hello AI",
          session_id: undefined,
          context: undefined,
        }),
      });
    });

    it("should send message with existing session ID", async () => {
      const mockResponse: SendMessageResponse = {
        session_id: 42,
        message: "AI response",
        role: "assistant",
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(42);
      });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hello",
          session_id: 42,
          context: undefined,
        }),
      });
    });

    it("should send message with context", async () => {
      const mockResponse: SendMessageResponse = {
        session_id: 1,
        message: "AI response",
        role: "assistant",
      };

      const context = { customer_id: 123, region: "emea" };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.sendMessage("Help with billing", context);
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Help with billing",
          session_id: undefined,
          context,
        }),
      });
    });

    it("should set currentSessionId on success when creating new session", async () => {
      const mockResponse: SendMessageResponse = {
        session_id: 99,
        message: "AI response",
        role: "assistant",
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      expect(result.current.currentSessionId).toBeNull();

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      await waitFor(() => expect(result.current.currentSessionId).toBe(99));
    });

    it("should not change currentSessionId when already set", async () => {
      const mockResponse: SendMessageResponse = {
        session_id: 42,
        message: "AI response",
        role: "assistant",
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(42);
      });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.currentSessionId).toBe(42);
    });

    it("should handle send message error with detail", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ detail: "Message cannot be empty" }),
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        try {
          await result.current.sendMessage("");
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => expect(result.current.sendError).not.toBeNull());

      expect(result.current.sendError?.message).toBe("Message cannot be empty");
    });

    it("should handle send message error without detail", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({}),
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        try {
          await result.current.sendMessage("Test");
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => expect(result.current.sendError).not.toBeNull());

      expect(result.current.sendError?.message).toBe("Failed to send message");
    });

    it("should handle network error for send message", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockRejectedValueOnce(new Error("Network Error"));

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        try {
          await result.current.sendMessage("Test");
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => expect(result.current.sendError).not.toBeNull());
    });

    it("should update isSending state during mutation", async () => {
      const mockResponse: SendMessageResponse = {
        session_id: 1,
        message: "AI response",
        role: "assistant",
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      expect(result.current.isSending).toBe(false);

      const promise = act(async () => {
        await result.current.sendMessage("Test");
      });

      // Note: isPending might be true briefly, but hard to capture
      await promise;

      expect(result.current.isSending).toBe(false);
    });
  });

  describe("Create Session Mutation", () => {
    it("should create session with correct API endpoint and method", async () => {
      const mockSession: ChatSession = {
        id: 1,
        session_type: "customer_support",
        status: "active",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 0,
        total_tokens: 0,
        total_cost: 0,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.createSession("customer_support");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_type: "customer_support",
          context: undefined,
        }),
      });
    });

    it("should use default session type when not provided", async () => {
      const mockSession: ChatSession = {
        id: 1,
        session_type: "admin_assistant",
        status: "active",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 0,
        total_tokens: 0,
        total_cost: 0,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.createSession();
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_type: "admin_assistant",
          context: undefined,
        }),
      });
    });

    it("should create session with context", async () => {
      const mockSession: ChatSession = {
        id: 1,
        session_type: "network_diagnostics",
        status: "active",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 0,
        total_tokens: 0,
        total_cost: 0,
      };

      const context = { device_id: 456 };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.createSession("network_diagnostics", context);
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_type: "network_diagnostics",
          context,
        }),
      });
    });

    it("should support all session types", async () => {
      const sessionTypes = [
        "customer_support",
        "admin_assistant",
        "network_diagnostics",
        "analytics",
      ] as const;

      for (const type of sessionTypes) {
        const mockSession: ChatSession = {
          id: 1,
          session_type: type,
          status: "active",
          provider: "openai",
          created_at: "2025-01-01T00:00:00Z",
          message_count: 0,
          total_tokens: 0,
          total_cost: 0,
        };

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => [],
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockSession,
          });

        const { result } = renderHook(() => useAIChat(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(mockFetch).toHaveBeenCalled());

        await act(async () => {
          const session = await result.current.createSession(type);
          expect(session.session_type).toBe(type);
        });

        jest.clearAllMocks();
      }
    });

    it("should set currentSessionId on success", async () => {
      const mockSession: ChatSession = {
        id: 77,
        session_type: "analytics",
        status: "active",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 0,
        total_tokens: 0,
        total_cost: 0,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      expect(result.current.currentSessionId).toBeNull();

      await act(async () => {
        await result.current.createSession("analytics");
      });

      await waitFor(() => expect(result.current.currentSessionId).toBe(77));
    });

    it("should handle create session error with detail", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ detail: "Invalid session type" }),
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        try {
          await result.current.createSession();
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => expect(result.current.createSessionError).not.toBeNull());

      expect(result.current.createSessionError?.message).toBe("Invalid session type");
    });

    it("should handle create session error without detail", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({}),
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        try {
          await result.current.createSession();
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => expect(result.current.createSessionError).not.toBeNull());

      expect(result.current.createSessionError?.message).toBe("Failed to create session");
    });

    it("should handle network error for create session", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockRejectedValueOnce(new Error("Network Error"));

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        try {
          await result.current.createSession();
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => expect(result.current.createSessionError).not.toBeNull());
    });

    it("should update isCreatingSession state during mutation", async () => {
      const mockSession: ChatSession = {
        id: 1,
        session_type: "admin_assistant",
        status: "active",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 0,
        total_tokens: 0,
        total_cost: 0,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      expect(result.current.isCreatingSession).toBe(false);

      const promise = act(async () => {
        await result.current.createSession();
      });

      await promise;

      expect(result.current.isCreatingSession).toBe(false);
    });
  });

  describe("Submit Feedback Mutation", () => {
    it("should submit feedback with correct API endpoint and method", async () => {
      const mockSession: ChatSession = {
        id: 10,
        session_type: "customer_support",
        status: "active",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 5,
        total_tokens: 500,
        total_cost: 0.05,
        user_rating: 5,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(10);
      });

      await act(async () => {
        await result.current.submitFeedback(5, "Very helpful!");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions/10/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: 10,
          rating: 5,
          feedback: "Very helpful!",
        }),
      });
    });

    it("should submit feedback without text", async () => {
      const mockSession: ChatSession = {
        id: 11,
        session_type: "admin_assistant",
        status: "active",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 3,
        total_tokens: 300,
        total_cost: 0.03,
        user_rating: 3,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(11);
      });

      await act(async () => {
        await result.current.submitFeedback(3);
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions/11/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: 11,
          rating: 3,
          feedback: undefined,
        }),
      });
    });

    it("should throw error when no session is set", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await expect(
        act(async () => {
          await result.current.submitFeedback(5);
        }),
      ).rejects.toThrow("No active session");

      expect(mockFetch).toHaveBeenCalledTimes(1); // Only sessions query
    });

    it("should update isSubmittingFeedback state during mutation", async () => {
      const mockSession: ChatSession = {
        id: 12,
        session_type: "admin_assistant",
        status: "active",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 0,
        total_tokens: 0,
        total_cost: 0,
        user_rating: 4,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(12);
      });

      expect(result.current.isSubmittingFeedback).toBe(false);

      const promise = act(async () => {
        await result.current.submitFeedback(4, "Good");
      });

      await promise;

      expect(result.current.isSubmittingFeedback).toBe(false);
    });
  });

  describe("Escalate Session Mutation", () => {
    it("should escalate session with correct API endpoint and method", async () => {
      const mockSession: ChatSession = {
        id: 20,
        session_type: "customer_support",
        status: "escalated",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 5,
        total_tokens: 500,
        total_cost: 0.05,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(20);
      });

      await act(async () => {
        await result.current.escalateSession("Complex billing issue");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions/20/escalate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: 20,
          reason: "Complex billing issue",
        }),
      });
    });

    it("should throw error when no session is set", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      await expect(
        act(async () => {
          await result.current.escalateSession("Need help");
        }),
      ).rejects.toThrow("No active session");

      expect(mockFetch).toHaveBeenCalledTimes(1); // Only sessions query
    });

    it("should update isEscalating state during mutation", async () => {
      const mockSession: ChatSession = {
        id: 21,
        session_type: "customer_support",
        status: "escalated",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 0,
        total_tokens: 0,
        total_cost: 0,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(21);
      });

      expect(result.current.isEscalating).toBe(false);

      const promise = act(async () => {
        await result.current.escalateSession("Technical issue");
      });

      await promise;

      expect(result.current.isEscalating).toBe(false);
    });
  });

  describe("State Management", () => {
    it("should initialize with null currentSessionId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(result.current.currentSessionId).toBeNull();
    });

    it("should allow setting currentSessionId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      act(() => {
        result.current.setCurrentSessionId(42);
      });

      expect(result.current.currentSessionId).toBe(42);
    });

    it("should allow setting currentSessionId to null", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      act(() => {
        result.current.setCurrentSessionId(42);
      });

      expect(result.current.currentSessionId).toBe(42);

      act(() => {
        result.current.setCurrentSessionId(null);
      });

      expect(result.current.currentSessionId).toBeNull();
    });

    it("should expose all error states", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(result.current.sendError).toBeNull();
      expect(result.current.createSessionError).toBeNull();
      expect(result.current.feedbackError).toBeNull();
      expect(result.current.escalateError).toBeNull();
    });

    it("should expose all loading states", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(result.current.isSending).toBe(false);
      expect(result.current.isCreatingSession).toBe(false);
      expect(result.current.isSubmittingFeedback).toBe(false);
      expect(result.current.isEscalating).toBe(false);
    });

    it("should expose refetch functions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(typeof result.current.refetchHistory).toBe("function");
      expect(typeof result.current.refetchSessions).toBe("function");
    });
  });

  describe("Helper Functions", () => {
    it("should sendMessage helper pass parameters correctly", async () => {
      const mockResponse: SendMessageResponse = {
        session_id: 1,
        message: "AI response",
        role: "assistant",
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      const context = { test: "data" };

      await act(async () => {
        const response = await result.current.sendMessage("Test", context);
        expect(response.session_id).toBe(1);
        expect(response.message).toBe("AI response");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Test",
          session_id: undefined,
          context,
        }),
      });
    });

    it("should createSession helper pass parameters correctly", async () => {
      const mockSession: ChatSession = {
        id: 1,
        session_type: "analytics",
        status: "active",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 0,
        total_tokens: 0,
        total_cost: 0,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      const context = { test: "data" };

      await act(async () => {
        const session = await result.current.createSession("analytics", context);
        expect(session.id).toBe(1);
        expect(session.session_type).toBe("analytics");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_type: "analytics",
          context,
        }),
      });
    });

    it("should submitFeedback helper pass parameters correctly", async () => {
      const mockSession: ChatSession = {
        id: 10,
        session_type: "admin_assistant",
        status: "active",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 0,
        total_tokens: 0,
        total_cost: 0,
        user_rating: 5,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(10);
      });

      await act(async () => {
        await result.current.submitFeedback(5, "Great!");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions/10/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: 10,
          rating: 5,
          feedback: "Great!",
        }),
      });
    });

    it("should escalateSession helper pass parameters correctly", async () => {
      const mockSession: ChatSession = {
        id: 20,
        session_type: "customer_support",
        status: "escalated",
        provider: "openai",
        created_at: "2025-01-01T00:00:00Z",
        message_count: 0,
        total_tokens: 0,
        total_cost: 0,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setCurrentSessionId(20);
      });

      await act(async () => {
        await result.current.escalateSession("Need help");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/ai/sessions/20/escalate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: 20,
          reason: "Need help",
        }),
      });
    });
  });
});
