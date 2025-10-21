/**
 * Live chat hook with Socket.IO integration and queue management
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { getApiClient } from "@dotmac/headless/api";
import { useAuthStore } from "@dotmac/headless/auth";

export interface UseLiveChatOptions {
  portalType: PortalType;
  customerId?: string;
  agentId?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
}

export interface ChatState {
  session: ChatSession | null;
  messages: ChatMessage[];
  isConnected: boolean;
  isTyping: boolean;
  typingUsers: string[];
  unreadCount: number;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
}

export interface UseLiveChatResult extends ChatState {
  // Core chat functions
  sendMessage: (content: string, attachments?: File[]) => Promise<void>;
  startChat: (subject?: string) => Promise<void>;
  endChat: (rating?: number, feedback?: string) => Promise<void>;

  // Typing indicators
  startTyping: () => void;
  stopTyping: () => void;

  // Agent functions (admin portal)
  acceptChat: (sessionId: string) => Promise<void>;
  transferChat: (sessionId: string, agentId: string) => Promise<void>;

  // Connection management
  connect: () => void;
  disconnect: () => void;

  // Utility functions
  markAsRead: () => void;
  uploadFile: (file: File) => Promise<string>;
}

export function useLiveChat(options: UseLiveChatOptions): UseLiveChatResult {
  const { portalType, customerId, agentId, autoConnect = true, reconnectAttempts = 3 } = options;

  const queryClient = useQueryClient();
  const apiClient = getApiClient();
  const { user, _token } = useAuthStore();

  const socketRef = useRef<Socket | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");

  // Get active chat session
  const { data: activeSessions } = useQuery({
    queryKey: ["chat", "sessions", "active", portalType, customerId || agentId],
    queryFn: async () => {
      const response = await apiClient.getChatSessions({
        filters: {
          status: "active",
          ...(customerId && { customerId }),
          ...(agentId && { agentId }),
        },
      });
      return response.data;
    },
    enabled: !!user && (!!customerId || !!agentId),
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Update session when active sessions change
  useEffect(() => {
    if (activeSessions && activeSessions.length > 0) {
      const activeSession = activeSessions[0];
      setSession(activeSession);
      setMessages(activeSession.messages);
    }
  }, [activeSessions]);

  // Socket.IO connection setup
  const connect = useCallback(() => {
    if (!user || !token || socketRef.current?.connected) {
      return;
    }

    setConnectionStatus("connecting");

    const socket = io(process.env.NEXT_PUBLIC_CHAT_URL || "ws://localhost:3001", {
      auth: {
        token,
        userId: user.id,
        userType: portalType,
        tenantId: user.tenantId,
      },
      transports: ["websocket"],
      timeout: 20000,
      reconnectionAttempts: reconnectAttempts,
    });

    socketRef.current = socket;

    // Connection events
    socket.on("connect", () => {
      setIsConnected(true);
      setConnectionStatus("connected");

      console.log("Chat connected");
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      setConnectionStatus("disconnected");

      console.log("Chat disconnected:", reason);
    });

    socket.on("connect_error", (_error) => {
      setConnectionStatus("error");
    });

    // Chat events
    socket.on("message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);

      // Increment unread count if message is not from current user
      if (message.senderId !== user.id) {
        setUnreadCount((prev) => prev + 1);
      }

      // Update React Query cache
      queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
    });

    socket.on("typing_start", ({ userId, userName }: { userId: string; userName: string }) => {
      if (userId !== user.id) {
        setTypingUsers((prev) => [...prev.filter((id) => id !== userId), userName]);
      }
    });

    socket.on("typing_stop", ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => prev.filter((name) => name !== userId));
    });

    socket.on("session_updated", (updatedSession: ChatSession) => {
      setSession(updatedSession);
      queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
    });

    socket.on("session_ended", () => {
      setSession(null);
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
    });

    // Join appropriate room based on portal type
    if (session) {
      socket.emit("join_chat", { sessionId: session.id });
    }
  }, [user, portalType, reconnectAttempts, session, queryClient]);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus("disconnected");
  }, []);

  // Auto-connect when enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments?: File[] }) => {
      if (!session || !socketRef.current) {
        throw new Error("No active chat session");
      }

      // Upload attachments if any
      const uploadedAttachments = [];
      if (attachments && attachments.length > 0) {
        for (const file of attachments) {
          const response = await apiClient.uploadFile(file, "chat_attachment");
          uploadedAttachments.push({
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type,
            url: response.data.url,
          });
        }
      }

      const message: Omit<ChatMessage, "id" | "timestamp" | "status"> = {
        chatId: session.id,
        senderId: user?.id,
        senderName: user?.name,
        senderType: portalType === "admin" ? "agent" : "customer",
        content,
        attachments: uploadedAttachments,
      };

      socketRef.current.emit("send_message", message);
    },
  });

  // Start chat mutation
  const startChatMutation = useMutation({
    mutationFn: async (subject?: string) => {
      if (!user || portalType === "admin") {
        throw new Error("Only customers and resellers can start chats");
      }

      const response = await apiClient.createChatSession(user.id, subject);
      return response.data;
    },
    onSuccess: (newSession) => {
      setSession(newSession);
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });

      // Join the new chat room
      if (socketRef.current) {
        socketRef.current.emit("join_chat", { sessionId: newSession.id });
      }
    },
  });

  // End chat mutation
  const endChatMutation = useMutation({
    mutationFn: async ({ rating, feedback }: { rating?: number; feedback?: string }) => {
      if (!session) {
        throw new Error("No active chat session");
      }

      const response = await apiClient.closeChatSession(session.id, rating, feedback);
      return response.data;
    },
    onSuccess: () => {
      setSession(null);
      setMessages([]);
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });

      // Leave the chat room
      if (socketRef.current && session) {
        socketRef.current.emit("leave_chat", { sessionId: session.id });
      }
    },
  });

  // Typing functions
  const startTyping = useCallback(() => {
    if (socketRef.current && session && !isTyping) {
      setIsTyping(true);
      socketRef.current.emit("typing_start", { sessionId: session.id });
    }
  }, [session, isTyping]);

  const stopTyping = useCallback(() => {
    if (socketRef.current && session && isTyping) {
      setIsTyping(false);
      socketRef.current.emit("typing_stop", { sessionId: session.id });
    }
  }, [session, isTyping]);

  // Agent functions
  const acceptChat = useCallback(
    async (sessionId: string) => {
      if (portalType !== "admin" || !socketRef.current) {
        throw new Error("Only agents can accept chats");
      }

      socketRef.current.emit("accept_chat", { sessionId, agentId: user?.id });
    },
    [portalType, user],
  );

  const transferChat = useCallback(
    async (sessionId: string, newAgentId: string) => {
      if (portalType !== "admin" || !socketRef.current) {
        throw new Error("Only agents can transfer chats");
      }

      socketRef.current.emit("transfer_chat", {
        sessionId,
        agentId: newAgentId,
      });
    },
    [portalType],
  );

  // Utility functions
  const markAsRead = useCallback(() => {
    setUnreadCount(0);

    if (socketRef.current && session) {
      socketRef.current.emit("mark_read", { sessionId: session.id });
    }
  }, [session]);

  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const response = await apiClient.uploadFile(file, "chat_attachment");
      return response.data.url;
    },
    [apiClient],
  );

  // Exposed functions
  const sendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      await sendMessageMutation.mutateAsync({ content, attachments });
    },
    [sendMessageMutation],
  );

  const startChat = useCallback(
    async (subject?: string) => {
      await startChatMutation.mutateAsync(subject);
    },
    [startChatMutation],
  );

  const endChat = useCallback(
    async (rating?: number, feedback?: string) => {
      await endChatMutation.mutateAsync({ rating, feedback });
    },
    [endChatMutation],
  );

  return {
    // State
    session,
    messages,
    isConnected,
    isTyping,
    typingUsers,
    unreadCount,
    connectionStatus,

    // Core functions
    sendMessage,
    startChat,
    endChat,

    // Typing
    startTyping,
    stopTyping,

    // Agent functions
    acceptChat,
    transferChat,

    // Connection
    connect,
    disconnect,

    // Utilities
    markAsRead,
    uploadFile,
  };
}
