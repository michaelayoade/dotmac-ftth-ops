import type { Meta, StoryObj } from "@storybook/react";
import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@dotmac/primitives";

// Mock WebSocket hook for demonstration
interface UseWebSocketOptions {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  protocols?: string[];
}

interface UseWebSocketReturn {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  lastMessage: MessageEvent<any> | null;
  connectionState: "connecting" | "connected" | "disconnected" | "error";
  sendMessage: (message: string | object) => void;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

// Mock implementation for demo purposes
function useWebSocket(url: string, options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<MessageEvent<any> | null>(null);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");

  const sendMessage = useCallback(
    (message: string | object) => {
      if (socket && isConnected) {
        const messageStr = typeof message === "string" ? message : JSON.stringify(message);
        socket.send(messageStr);
      }
    },
    [socket, isConnected],
  );

  const connect = useCallback(() => {
    if (!socket) {
      setIsConnecting(true);
      setConnectionState("connecting");

      // Simulate connection delay
      setTimeout(() => {
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionState("connected");
        options.onConnect?.();
      }, 1000);
    }
  }, [socket, options]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setSocket(null);
    setConnectionState("disconnected");
    options.onDisconnect?.();
  }, [options]);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 500);
  }, [connect, disconnect]);

  return {
    socket,
    isConnected,
    isConnecting,
    lastMessage,
    connectionState,
    sendMessage,
    connect,
    disconnect,
    reconnect,
  };
}

const meta: Meta = {
  title: "Headless/Hooks/useWebSocket",
  component: () => null,
  parameters: {
    docs: {
      description: {
        component: `
# useWebSocket Hook

Real-time WebSocket connection management with automatic reconnection and message handling.

## Features

- 🔌 **Connection Management**: Connect, disconnect, reconnect
- 🔄 **Auto Reconnection**: Configurable retry attempts and intervals
- 📨 **Message Handling**: Send/receive with JSON support
- 📊 **Connection State**: Real-time connection status tracking
- 🛡️ **Error Handling**: Graceful error recovery and notifications
- 🎯 **Protocol Support**: Multiple WebSocket protocols
- 📱 **Portal Integration**: Portal-specific WebSocket endpoints

## Use Cases

- Real-time notifications and alerts
- Live chat and messaging
- Live data updates (metrics, status)
- Collaborative features
- System monitoring and logs

## Portal-Specific Endpoints

Each portal connects to specialized WebSocket endpoints for targeted real-time features.

## Connection States

- **connecting**: Establishing connection
- **connected**: Active WebSocket connection
- **disconnected**: No active connection
- **error**: Connection failed or encountered error
        `,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;
type Story = StoryObj;

// Basic WebSocket Connection Demo
export const BasicConnection: Story = {
  name: "Basic WebSocket Connection",
  render: () => {
    const url = "wss://api.dotmac.com/ws";
    const {
      isConnected,
      isConnecting,
      connectionState,
      sendMessage,
      connect,
      disconnect,
      reconnect,
      lastMessage,
    } = useWebSocket(url, {
      onConnect: () => console.log("Connected to WebSocket"),
      onDisconnect: () => console.log("Disconnected from WebSocket"),
      onError: (error) => console.error("WebSocket error:", error),
    });

    const [messageHistory, setMessageHistory] = useState<string[]>([]);
    const [inputMessage, setInputMessage] = useState("");

    // Simulate receiving messages
    useEffect(() => {
      if (isConnected) {
        const interval = setInterval(() => {
          const simulatedMessage = `Server message at ${new Date().toLocaleTimeString()}`;
          setMessageHistory((prev) => [...prev.slice(-9), simulatedMessage]);
        }, 3000);

        return () => clearInterval(interval);
      }
    }, [isConnected]);

    const handleSendMessage = () => {
      if (inputMessage.trim()) {
        sendMessage(inputMessage);
        setMessageHistory((prev) => [...prev.slice(-9), `You: ${inputMessage}`]);
        setInputMessage("");
      }
    };

    return (
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">WebSocket Connection Demo</h3>

        <div className="flex items-center space-x-4">
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              connectionState === "connected"
                ? "bg-green-100 text-green-800"
                : connectionState === "connecting"
                  ? "bg-yellow-100 text-yellow-800"
                  : connectionState === "error"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
            }`}
          >
            {connectionState.toUpperCase()}
          </div>
          <div className="text-sm text-gray-600">{url}</div>
        </div>

        <div className="flex space-x-2">
          <Button
            onClick={connect}
            disabled={isConnected || isConnecting}
            className={isConnecting ? "opacity-50" : ""}
          >
            {isConnecting ? "Connecting..." : "Connect"}
          </Button>
          <Button onClick={disconnect} disabled={!isConnected} variant="secondary">
            Disconnect
          </Button>
          <Button onClick={reconnect} disabled={isConnecting} variant="secondary">
            Reconnect
          </Button>
        </div>

        {/* Message Interface */}
        <div className="space-y-2">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Enter message..."
              disabled={!isConnected}
              className="flex-1 px-3 py-2 border rounded-md disabled:bg-gray-100"
            />
            <Button onClick={handleSendMessage} disabled={!isConnected || !inputMessage.trim()}>
              Send
            </Button>
          </div>
        </div>

        {/* Message History */}
        <div className="space-y-2">
          <h4 className="font-medium">Message History</h4>
          <div className="h-48 border rounded-lg p-3 bg-gray-50 overflow-y-auto">
            {messageHistory.length === 0 ? (
              <div className="text-gray-500 text-sm">No messages yet...</div>
            ) : (
              <div className="space-y-1">
                {messageHistory.map((message, index) => (
                  <div
                    key={index}
                    className={`text-sm p-2 rounded ${
                      message.startsWith("You:")
                        ? "bg-blue-100 text-blue-800 ml-8"
                        : "bg-white text-gray-800 mr-8"
                    }`}
                  >
                    {message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
};

// Portal-Specific WebSocket Demo
export const PortalWebSockets: Story = {
  name: "Portal-Specific WebSocket Endpoints",
  render: () => {
    const [selectedPortal, setSelectedPortal] = useState<string>("admin");

    const portalEndpoints = {
      admin: {
        url: "wss://api.dotmac.com/ws/admin",
        features: ["User Activity", "System Alerts", "Performance Metrics", "Security Events"],
        color: "blue",
      },
      customer: {
        url: "wss://api.dotmac.com/ws/customer",
        features: ["Service Updates", "Billing Alerts", "Support Messages", "Usage Notifications"],
        color: "green",
      },
      reseller: {
        url: "wss://api.dotmac.com/ws/reseller",
        features: ["Commission Updates", "New Leads", "Customer Activity", "Sales Alerts"],
        color: "purple",
      },
      technician: {
        url: "wss://api.dotmac.com/ws/technician",
        features: ["Job Assignments", "Location Updates", "Status Changes", "Emergency Alerts"],
        color: "orange",
      },
      management: {
        url: "wss://api.dotmac.com/ws/management",
        features: ["Tenant Metrics", "Global Alerts", "Resource Status", "Compliance Events"],
        color: "red",
      },
    };

    const currentConfig = portalEndpoints[selectedPortal];
    const { isConnected, connectionState, connect, disconnect } = useWebSocket(currentConfig.url);

    const [simulatedEvents, setSimulatedEvents] = useState<string[]>([]);

    // Simulate portal-specific events
    useEffect(() => {
      if (isConnected) {
        const events = currentConfig.features;
        const interval = setInterval(() => {
          const randomEvent = events[Math.floor(Math.random() * events.length)];
          const timestamp = new Date().toLocaleTimeString();
          setSimulatedEvents((prev) => [
            ...prev.slice(-4),
            `${randomEvent}: Event at ${timestamp}`,
          ]);
        }, 2000);

        return () => clearInterval(interval);
      } else {
        setSimulatedEvents([]);
      }
    }, [isConnected, currentConfig.features]);

    return (
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Portal-Specific WebSocket Connections</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Select Portal</label>
            <select
              value={selectedPortal}
              onChange={(e) => {
                setSelectedPortal(e.target.value);
                if (isConnected) {
                  disconnect();
                }
              }}
              className="w-full px-3 py-2 border rounded-md"
            >
              {Object.entries(portalEndpoints).map(([portal, config]) => (
                <option key={portal} value={portal}>
                  {portal.charAt(0).toUpperCase() + portal.slice(1)} Portal
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">WebSocket Endpoint</label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-sm font-mono">
              {currentConfig.url}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium bg-${currentConfig.color}-100 text-${currentConfig.color}-800`}
          >
            {connectionState.toUpperCase()}
          </div>
          <Button
            onClick={isConnected ? disconnect : connect}
            className={`bg-${currentConfig.color}-600 hover:bg-${currentConfig.color}-700`}
          >
            {isConnected ? "Disconnect" : "Connect"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Available Event Types</h4>
            <div className="space-y-1">
              {currentConfig.features.map((feature) => (
                <div
                  key={feature}
                  className={`p-2 rounded text-sm bg-${currentConfig.color}-50 text-${currentConfig.color}-800`}
                >
                  • {feature}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Live Events</h4>
            <div
              className={`h-32 border rounded-lg p-3 bg-${currentConfig.color}-50 overflow-y-auto`}
            >
              {simulatedEvents.length === 0 ? (
                <div className="text-gray-500 text-sm">
                  {isConnected ? "Waiting for events..." : "Connect to see live events"}
                </div>
              ) : (
                <div className="space-y-1">
                  {simulatedEvents.map((event, index) => (
                    <div
                      key={index}
                      className={`text-sm p-1 rounded bg-${currentConfig.color}-100`}
                    >
                      {event}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
};

// Real-time Notifications Demo
export const RealTimeNotifications: Story = {
  name: "Real-time Notifications",
  render: () => {
    const [notifications, setNotifications] = useState<
      Array<{
        id: string;
        type: "info" | "success" | "warning" | "error";
        title: string;
        message: string;
        timestamp: Date;
      }>
    >([]);

    const [isAutoMode, setIsAutoMode] = useState(false);

    const { isConnected, connectionState, sendMessage, connect, disconnect } = useWebSocket(
      "wss://api.dotmac.com/ws/notifications",
      {
        onConnect: () => {
          addNotification(
            "success",
            "WebSocket Connected",
            "Successfully connected to notification service",
          );
        },
        onDisconnect: () => {
          addNotification(
            "warning",
            "WebSocket Disconnected",
            "Connection to notification service lost",
          );
        },
      },
    );

    const addNotification = (
      type: "info" | "success" | "warning" | "error",
      title: string,
      message: string,
    ) => {
      const notification = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        title,
        message,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev.slice(0, 4)]);
    };

    const removeNotification = (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    // Simulate different types of notifications
    const simulateNotification = (type: "info" | "success" | "warning" | "error") => {
      const messages = {
        info: {
          title: "Info Update",
          message: "New system information available",
        },
        success: {
          title: "Operation Successful",
          message: "Your request has been processed successfully",
        },
        warning: {
          title: "System Warning",
          message: "High CPU usage detected on server",
        },
        error: {
          title: "Error Occurred",
          message: "Failed to process billing transaction",
        },
      };

      addNotification(type, messages[type].title, messages[type].message);
      if (isConnected) {
        sendMessage({ type: "notification", ...messages[type] });
      }
    };

    // Auto-generate notifications
    useEffect(() => {
      if (isAutoMode && isConnected) {
        const interval = setInterval(() => {
          const types: Array<"info" | "success" | "warning" | "error"> = [
            "info",
            "success",
            "warning",
            "error",
          ];
          const randomType = types[Math.floor(Math.random() * types.length)];
          simulateNotification(randomType);
        }, 3000);

        return () => clearInterval(interval);
      }
    }, [isAutoMode, isConnected]);

    return (
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Real-time Notifications</h3>

        <div className="flex items-center space-x-4">
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              connectionState === "connected"
                ? "bg-green-100 text-green-800"
                : connectionState === "connecting"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-800"
            }`}
          >
            {connectionState.toUpperCase()}
          </div>
          <Button onClick={isConnected ? disconnect : connect}>
            {isConnected ? "Disconnect" : "Connect"}
          </Button>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isAutoMode}
              onChange={(e) => setIsAutoMode(e.target.checked)}
              disabled={!isConnected}
            />
            <span className="text-sm">Auto-generate notifications</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Trigger Notifications</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => simulateNotification("info")}
                disabled={!isConnected}
                className="bg-blue-600"
                size="sm"
              >
                Info
              </Button>
              <Button
                onClick={() => simulateNotification("success")}
                disabled={!isConnected}
                className="bg-green-600"
                size="sm"
              >
                Success
              </Button>
              <Button
                onClick={() => simulateNotification("warning")}
                disabled={!isConnected}
                className="bg-yellow-600"
                size="sm"
              >
                Warning
              </Button>
              <Button
                onClick={() => simulateNotification("error")}
                disabled={!isConnected}
                className="bg-red-600"
                size="sm"
              >
                Error
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Live Notifications</h4>
              <Button onClick={() => setNotifications([])} variant="secondary" size="sm">
                Clear All
              </Button>
            </div>
            <div className="h-64 space-y-2 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-8">No notifications yet</div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border-l-4 ${
                      notification.type === "success"
                        ? "bg-green-50 border-green-400"
                        : notification.type === "error"
                          ? "bg-red-50 border-red-400"
                          : notification.type === "warning"
                            ? "bg-yellow-50 border-yellow-400"
                            : "bg-blue-50 border-blue-400"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div
                          className={`font-medium text-sm ${
                            notification.type === "success"
                              ? "text-green-800"
                              : notification.type === "error"
                                ? "text-red-800"
                                : notification.type === "warning"
                                  ? "text-yellow-800"
                                  : "text-blue-800"
                          }`}
                        >
                          {notification.title}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {notification.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      <Button
                        onClick={() => removeNotification(notification.id)}
                        size="sm"
                        variant="secondary"
                        className="text-xs ml-2"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
};

// Connection Recovery Demo
export const ConnectionRecovery: Story = {
  name: "Connection Recovery & Error Handling",
  render: () => {
    const [reconnectAttempts, setReconnectAttempts] = useState(3);
    const [reconnectInterval, setReconnectInterval] = useState(1000);
    const [connectionLogs, setConnectionLogs] = useState<string[]>([]);

    const addLog = (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setConnectionLogs((prev) => [...prev.slice(-9), `[${timestamp}] ${message}`]);
    };

    const { isConnected, connectionState, connect, disconnect, reconnect } = useWebSocket(
      "wss://api.dotmac.com/ws/recovery-demo",
      {
        reconnectAttempts,
        reconnectInterval,
        onConnect: () => addLog("✅ Connected successfully"),
        onDisconnect: () => addLog("⚠️ Disconnected from server"),
        onError: (error) => addLog("❌ Connection error occurred"),
      },
    );

    const simulateConnectionFailure = () => {
      addLog("🔧 Simulating connection failure...");
      disconnect();
      setTimeout(() => {
        addLog("🔄 Attempting automatic reconnection...");
        reconnect();
      }, 1000);
    };

    const simulateNetworkIssue = () => {
      addLog("📶 Simulating network instability...");
      // Simulate intermittent connection
      let attempts = 0;
      const interval = setInterval(() => {
        if (attempts < 3) {
          disconnect();
          setTimeout(() => {
            connect();
            addLog(`🔄 Reconnection attempt ${attempts + 1}`);
          }, 500);
          attempts++;
        } else {
          clearInterval(interval);
          addLog("✅ Network stability restored");
        }
      }, 2000);
    };

    return (
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Connection Recovery & Error Handling</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Reconnect Attempts</label>
            <input
              type="number"
              value={reconnectAttempts}
              onChange={(e) => setReconnectAttempts(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-md"
              min="0"
              max="10"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Reconnect Interval (ms)</label>
            <input
              type="number"
              value={reconnectInterval}
              onChange={(e) => setReconnectInterval(parseInt(e.target.value) || 1000)}
              className="w-full px-3 py-2 border rounded-md"
              min="500"
              step="500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              connectionState === "connected"
                ? "bg-green-100 text-green-800"
                : connectionState === "connecting"
                  ? "bg-yellow-100 text-yellow-800"
                  : connectionState === "error"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
            }`}
          >
            {connectionState.toUpperCase()}
          </div>
          <Button onClick={isConnected ? disconnect : connect}>
            {isConnected ? "Disconnect" : "Connect"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Failure Simulation</h4>
            <div className="space-y-2">
              <Button
                onClick={simulateConnectionFailure}
                disabled={!isConnected}
                className="w-full bg-orange-600"
                size="sm"
              >
                Simulate Connection Failure
              </Button>
              <Button
                onClick={simulateNetworkIssue}
                disabled={!isConnected}
                className="w-full bg-red-600"
                size="sm"
              >
                Simulate Network Instability
              </Button>
              <Button onClick={reconnect} className="w-full" size="sm" variant="secondary">
                Manual Reconnect
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Connection Logs</h4>
              <Button onClick={() => setConnectionLogs([])} size="sm" variant="secondary">
                Clear
              </Button>
            </div>
            <div className="h-48 bg-gray-900 text-green-400 p-3 rounded-lg overflow-y-auto font-mono text-xs">
              {connectionLogs.length === 0 ? (
                <div className="text-gray-500">No logs yet...</div>
              ) : (
                <div className="space-y-1">
                  {connectionLogs.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800">Recovery Features</h4>
          <ul className="mt-2 text-sm text-blue-700 space-y-1">
            <li>• Automatic reconnection with exponential backoff</li>
            <li>• Configurable retry attempts and intervals</li>
            <li>• Connection state tracking and error handling</li>
            <li>• Manual reconnection capabilities</li>
            <li>• Real-time connection logging</li>
          </ul>
        </div>
      </div>
    );
  },
};

// Performance and Memory Demo
export const PerformanceDemo: Story = {
  name: "Performance & Memory Management",
  render: () => {
    const [activeConnections, setActiveConnections] = useState<number>(1);
    const [messageRate, setMessageRate] = useState<number>(1);
    const [memoryUsage, setMemoryUsage] = useState<number>(0);

    // Simulate multiple connections
    const connections = Array.from({ length: activeConnections }, (_, index) => {
      const url = `wss://api.dotmac.com/ws/perf-${index}`;
      return useWebSocket(url);
    });

    // Simulate memory usage calculation
    useEffect(() => {
      const baseMemory = 50; // KB base usage
      const connectionMemory = activeConnections * 25; // KB per connection
      const messageMemory = messageRate * 10; // KB per message/second
      setMemoryUsage(baseMemory + connectionMemory + messageMemory);
    }, [activeConnections, messageRate]);

    const connectAll = () => {
      connections.forEach((conn) => conn.connect());
    };

    const disconnectAll = () => {
      connections.forEach((conn) => conn.disconnect());
    };

    const connectedCount = connections.filter((conn) => conn.isConnected).length;

    return (
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Performance & Memory Management</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Active Connections</label>
            <input
              type="range"
              min="1"
              max="10"
              value={activeConnections}
              onChange={(e) => setActiveConnections(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-sm text-gray-600">{activeConnections} connection(s)</div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Message Rate (per second)</label>
            <input
              type="range"
              min="1"
              max="100"
              value={messageRate}
              onChange={(e) => setMessageRate(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-sm text-gray-600">{messageRate} msg/sec</div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button onClick={connectAll}>
            Connect All ({connectedCount}/{activeConnections})
          </Button>
          <Button onClick={disconnectAll} variant="secondary">
            Disconnect All
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800">Active Connections</h4>
            <div className="text-2xl font-bold text-blue-900">{connectedCount}</div>
            <div className="text-sm text-blue-600">of {activeConnections} total</div>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-medium text-green-800">Message Rate</h4>
            <div className="text-2xl font-bold text-green-900">{messageRate}</div>
            <div className="text-sm text-green-600">messages/second</div>
          </div>

          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 className="font-medium text-purple-800">Est. Memory</h4>
            <div className="text-2xl font-bold text-purple-900">{memoryUsage}</div>
            <div className="text-sm text-purple-600">KB estimated</div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Connection Status</h4>
          <div className="grid gap-2">
            {connections.map((connection, index) => (
              <div
                key={index}
                className={`p-2 rounded text-sm ${
                  connection.isConnected
                    ? "bg-green-100 text-green-800"
                    : connection.isConnecting
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                Connection {index + 1}: {connection.connectionState}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800">Performance Tips</h4>
          <ul className="mt-2 text-sm text-yellow-700 space-y-1">
            <li>• Limit concurrent connections to essential endpoints only</li>
            <li>• Use connection pooling for multiple portal endpoints</li>
            <li>• Implement message throttling for high-frequency updates</li>
            <li>• Monitor memory usage and close idle connections</li>
            <li>• Use compression for large message payloads</li>
          </ul>
        </div>
      </div>
    );
  },
};
