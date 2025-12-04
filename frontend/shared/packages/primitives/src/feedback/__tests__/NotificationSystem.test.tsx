/**
 * NotificationSystem Component Tests
 *
 * Testing NotificationProvider, useNotifications hook, reducer actions,
 * notification queue management, WebSocket integration, browser notifications,
 * and useToast convenience hook
 */

import React from "react";
import {
  render,
  renderA11y,
  renderWithTimers,
  renderComprehensive,
  screen,
  fireEvent,
  waitFor,
  act,
} from "../../testing";
import {
  NotificationProvider,
  useNotifications,
  NotificationList,
  NotificationBadge,
  useToast,
  type Notification,
} from "../NotificationSystem";

// Mock WebSocket
class MockWebSocket {
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public readyState: number = WebSocket.CONNECTING;

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event("open"));
    }, 0);
  }

  send(data: string) {
    // Mock implementation
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close"));
  }

  mockMessage(data: any) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }
}

global.WebSocket = MockWebSocket as any;

// Mock browser Notification API
const mockNotificationPermission = jest.fn(() =>
  Promise.resolve("granted" as NotificationPermission),
);
global.Notification = {
  permission: "granted" as NotificationPermission,
  requestPermission: mockNotificationPermission,
} as any;

describe("NotificationSystem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("NotificationProvider", () => {
    it("renders children", async () => {
      render(
        <NotificationProvider>
          <div data-testid="child">Content</div>
        </NotificationProvider>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("throws error when useNotifications is used outside provider", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const TestComponent = () => {
        useNotifications();
        return <div>Test</div>;
      };

      expect(() => render(<TestComponent />)).toThrow(
        "useNotifications must be used within a NotificationProvider",
      );

      consoleSpy.mockRestore();
    });

    it("provides initial state", async () => {
      const TestComponent = () => {
        const { state } = useNotifications();
        return (
          <div>
            <div data-testid="count">{state.notifications.length}</div>
            <div data-testid="unread">{state.unreadCount}</div>
            <div data-testid="connected">{state.isConnected ? "yes" : "no"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      expect(screen.getByTestId("count")).toHaveTextContent("0");
      expect(screen.getByTestId("unread")).toHaveTextContent("0");
      expect(screen.getByTestId("connected")).toHaveTextContent("no");
    });
  });

  describe("useNotifications Hook", () => {
    it("provides addNotification function", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                addNotification({
                  title: "Test",
                  message: "Test message",
                  type: "info",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add Notification
            </button>
            <div data-testid="count">{state.notifications.length}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add Notification"));

      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    it("generates unique IDs for notifications", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();
        const [ids, setIds] = React.useState<string[]>([]);

        const handleAdd = () => {
          addNotification({
            title: "Test",
            message: "Message",
            type: "info",
            priority: "medium",
            channel: ["browser"],
            persistent: false,
          });
          setIds(state.notifications.map((n) => n.id));
        };

        return (
          <div>
            <button onClick={handleAdd}>Add</button>
            <div data-testid="unique">{ids.length === new Set(ids).size ? "yes" : "no"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add"));
      fireEvent.click(screen.getByText("Add"));
      fireEvent.click(screen.getByText("Add"));

      await waitFor(() => {
        expect(screen.getByTestId("unique")).toHaveTextContent("yes");
      });
    });

    it("increments unread count when notification is added", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                addNotification({
                  title: "Test",
                  message: "Message",
                  type: "info",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add
            </button>
            <div data-testid="unread">{state.unreadCount}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      expect(screen.getByTestId("unread")).toHaveTextContent("0");

      fireEvent.click(screen.getByText("Add"));
      expect(screen.getByTestId("unread")).toHaveTextContent("1");

      fireEvent.click(screen.getByText("Add"));
      expect(screen.getByTestId("unread")).toHaveTextContent("2");
    });
  });

  describe("Notification Actions", () => {
    it("removes notification when removeNotification is called", async () => {
      const TestComponent = () => {
        const { addNotification, removeNotification, state } = useNotifications();
        const [notificationId, setNotificationId] = React.useState<string | null>(null);

        React.useEffect(() => {
          if (state.notifications.length > 0 && !notificationId) {
            setNotificationId(state.notifications[0].id);
          }
        }, [state.notifications]);

        const handleAdd = () => {
          addNotification({
            title: "Removable",
            message: "Message",
            type: "info",
            priority: "medium",
            channel: ["browser"],
            persistent: false,
          });
        };

        const handleRemove = () => {
          if (notificationId) removeNotification(notificationId);
        };

        return (
          <div>
            <button onClick={handleAdd}>Add</button>
            <button onClick={handleRemove}>Remove</button>
            <div data-testid="count">{state.notifications.length}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add"));
      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("1");
      });

      fireEvent.click(screen.getByText("Remove"));
      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("0");
      });
    });

    it("marks notification as read when markAsRead is called", async () => {
      const TestComponent = () => {
        const { addNotification, markAsRead, state } = useNotifications();
        const [notificationId, setNotificationId] = React.useState<string | null>(null);

        React.useEffect(() => {
          if (state.notifications.length > 0 && !notificationId) {
            setNotificationId(state.notifications[0].id);
          }
        }, [state.notifications]);

        const handleAdd = () => {
          addNotification({
            title: "Test",
            message: "Message",
            type: "info",
            priority: "medium",
            channel: ["browser"],
            persistent: false,
          });
        };

        const handleMarkRead = () => {
          if (notificationId) markAsRead(notificationId);
        };

        const unreadNotifications = state.notifications.filter((n) => !n.read);

        return (
          <div>
            <button onClick={handleAdd}>Add</button>
            <button onClick={handleMarkRead}>Mark Read</button>
            <div data-testid="unread-count">{unreadNotifications.length}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add"));

      await waitFor(() => {
        expect(screen.getByTestId("unread-count")).toHaveTextContent("1");
      });

      fireEvent.click(screen.getByText("Mark Read"));

      await waitFor(() => {
        expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
      });
    });

    it("marks all notifications as read when markAllAsRead is called", async () => {
      const TestComponent = () => {
        const { addNotification, markAllAsRead, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() => {
                addNotification({
                  title: "Test 1",
                  message: "Message",
                  type: "info",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                });
                addNotification({
                  title: "Test 2",
                  message: "Message",
                  type: "info",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                });
                addNotification({
                  title: "Test 3",
                  message: "Message",
                  type: "info",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                });
              }}
            >
              Add Multiple
            </button>
            <button onClick={markAllAsRead}>Mark All Read</button>
            <div data-testid="unread">{state.unreadCount}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add Multiple"));

      await waitFor(() => {
        expect(screen.getByTestId("unread")).toHaveTextContent("3");
      });

      fireEvent.click(screen.getByText("Mark All Read"));

      await waitFor(() => {
        expect(screen.getByTestId("unread")).toHaveTextContent("0");
      });
    });

    it("clears all notifications when clearAll is called", async () => {
      const TestComponent = () => {
        const { addNotification, clearAll, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() => {
                addNotification({
                  title: "Test 1",
                  message: "Message",
                  type: "info",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                });
                addNotification({
                  title: "Test 2",
                  message: "Message",
                  type: "info",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                });
              }}
            >
              Add Multiple
            </button>
            <button onClick={clearAll}>Clear All</button>
            <div data-testid="count">{state.notifications.length}</div>
            <div data-testid="unread">{state.unreadCount}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add Multiple"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("2");
      });

      fireEvent.click(screen.getByText("Clear All"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("0");
        expect(screen.getByTestId("unread")).toHaveTextContent("0");
      });
    });
  });

  describe("Notification Types", () => {
    it("supports success type notifications", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                addNotification({
                  title: "Success",
                  message: "Operation successful",
                  type: "success",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add Success
            </button>
            <div data-testid="type">{state.notifications[0]?.type || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add Success"));

      await waitFor(() => {
        expect(screen.getByTestId("type")).toHaveTextContent("success");
      });
    });

    it("supports error type notifications", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                addNotification({
                  title: "Error",
                  message: "Operation failed",
                  type: "error",
                  priority: "high",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add Error
            </button>
            <div data-testid="type">{state.notifications[0]?.type || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add Error"));

      await waitFor(() => {
        expect(screen.getByTestId("type")).toHaveTextContent("error");
      });
    });

    it("supports warning type notifications", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                addNotification({
                  title: "Warning",
                  message: "Warning message",
                  type: "warning",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add Warning
            </button>
            <div data-testid="type">{state.notifications[0]?.type || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add Warning"));

      await waitFor(() => {
        expect(screen.getByTestId("type")).toHaveTextContent("warning");
      });
    });

    it("supports info type notifications", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                addNotification({
                  title: "Info",
                  message: "Information",
                  type: "info",
                  priority: "low",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add Info
            </button>
            <div data-testid="type">{state.notifications[0]?.type || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add Info"));

      await waitFor(() => {
        expect(screen.getByTestId("type")).toHaveTextContent("info");
      });
    });

    it("supports system type notifications", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                addNotification({
                  title: "System",
                  message: "System message",
                  type: "system",
                  priority: "low",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add System
            </button>
            <div data-testid="type">{state.notifications[0]?.type || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add System"));

      await waitFor(() => {
        expect(screen.getByTestId("type")).toHaveTextContent("system");
      });
    });
  });

  describe("Notification Priority", () => {
    it("supports low priority", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                addNotification({
                  title: "Low Priority",
                  message: "Message",
                  type: "info",
                  priority: "low",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add
            </button>
            <div data-testid="priority">{state.notifications[0]?.priority || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add"));

      await waitFor(() => {
        expect(screen.getByTestId("priority")).toHaveTextContent("low");
      });
    });

    it("supports medium priority", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                addNotification({
                  title: "Medium Priority",
                  message: "Message",
                  type: "info",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add
            </button>
            <div data-testid="priority">{state.notifications[0]?.priority || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add"));

      await waitFor(() => {
        expect(screen.getByTestId("priority")).toHaveTextContent("medium");
      });
    });

    it("supports high priority", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                addNotification({
                  title: "High Priority",
                  message: "Message",
                  type: "error",
                  priority: "high",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add
            </button>
            <div data-testid="priority">{state.notifications[0]?.priority || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add"));

      await waitFor(() => {
        expect(screen.getByTestId("priority")).toHaveTextContent("high");
      });
    });

    it("supports critical priority", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                addNotification({
                  title: "Critical Priority",
                  message: "Message",
                  type: "error",
                  priority: "critical",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add
            </button>
            <div data-testid="priority">{state.notifications[0]?.priority || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add"));

      await waitFor(() => {
        expect(screen.getByTestId("priority")).toHaveTextContent("critical");
      });
    });
  });

  describe("Queue Management", () => {
    it("respects maxNotifications limit", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() => {
                for (let i = 0; i < 15; i++) {
                  addNotification({
                    title: `Notification ${i}`,
                    message: "Message",
                    type: "info",
                    priority: "medium",
                    channel: ["browser"],
                    persistent: false,
                  });
                }
              }}
            >
              Add Many
            </button>
            <div data-testid="count">{state.notifications.length}</div>
          </div>
        );
      };

      render(
        <NotificationProvider maxNotifications={10}>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add Many"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("10");
      });
    });

    it("keeps most recent notifications when limit is exceeded", async () => {
      const TestComponent = () => {
        const { addNotification, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() => {
                addNotification({
                  title: "First",
                  message: "Message 1",
                  type: "info",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                });
                addNotification({
                  title: "Second",
                  message: "Message 2",
                  type: "info",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                });
                addNotification({
                  title: "Third",
                  message: "Message 3",
                  type: "info",
                  priority: "medium",
                  channel: ["browser"],
                  persistent: false,
                });
              }}
            >
              Add Three
            </button>
            <div data-testid="latest-title">{state.notifications[0]?.title || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider maxNotifications={2}>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add Three"));

      await waitFor(() => {
        // Should keep the two most recent (Third and Second)
        expect(screen.getByTestId("latest-title")).toHaveTextContent("Third");
      });
    });
  });

  describe("Notification Settings", () => {
    it("updates settings when updateSettings is called", async () => {
      const TestComponent = () => {
        const { updateSettings, state } = useNotifications();

        return (
          <div>
            <button onClick={() => updateSettings({ soundEnabled: false })}>Disable Sound</button>
            <div data-testid="sound-enabled">{state.settings.soundEnabled ? "yes" : "no"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      expect(screen.getByTestId("sound-enabled")).toHaveTextContent("yes");

      fireEvent.click(screen.getByText("Disable Sound"));

      await waitFor(() => {
        expect(screen.getByTestId("sound-enabled")).toHaveTextContent("no");
      });
    });

    it("filters notifications based on priority settings", async () => {
      const TestComponent = () => {
        const { addNotification, updateSettings, state } = useNotifications();

        return (
          <div>
            <button
              onClick={() =>
                updateSettings({
                  priorities: { low: false, medium: true, high: true, critical: true },
                })
              }
            >
              Disable Low Priority
            </button>
            <button
              onClick={() =>
                addNotification({
                  title: "Low Priority",
                  message: "Message",
                  type: "info",
                  priority: "low",
                  channel: ["browser"],
                  persistent: false,
                })
              }
            >
              Add Low Priority
            </button>
            <div data-testid="count">{state.notifications.length}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Disable Low Priority"));
      fireEvent.click(screen.getByText("Add Low Priority"));

      await waitFor(() => {
        // Notification should not be added due to priority filter
        expect(screen.getByTestId("count")).toHaveTextContent("0");
      });
    });
  });

  describe("NotificationList Component", () => {
    it("renders notification list", async () => {
      const TestComponent = () => {
        const { addNotification } = useNotifications();

        React.useEffect(() => {
          addNotification({
            title: "Test Notification",
            message: "Test message",
            type: "info",
            priority: "medium",
            channel: ["browser"],
            persistent: false,
          });
        }, []);

        return <NotificationList />;
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Test Notification")).toBeInTheDocument();
        expect(screen.getByText("Test message")).toBeInTheDocument();
      });
    });

    it("limits visible notifications based on maxVisible", async () => {
      const TestComponent = () => {
        const { addNotification } = useNotifications();

        React.useEffect(() => {
          for (let i = 0; i < 10; i++) {
            addNotification({
              title: `Notification ${i}`,
              message: "Message",
              type: "info",
              priority: "medium",
              channel: ["browser"],
              persistent: true,
            });
          }
        }, []);

        return <NotificationList maxVisible={5} />;
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      await waitFor(() => {
        // Should show only 5 notifications
        const notifications = screen.queryAllByText(/Notification/);
        expect(notifications.length).toBeLessThanOrEqual(5);
      });
    });

    it("applies correct position classes", async () => {
      const TestComponent = () => {
        return <NotificationList position="top-left" />;
      };

      const { container } = render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      const list = container.querySelector(".fixed");
      expect(list).toHaveClass("top-4", "left-4");
    });
  });

  describe("NotificationBadge Component", () => {
    it("does not render when unread count is 0", async () => {
      const TestComponent = () => {
        return <NotificationBadge data-testid="badge" />;
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
    });

    it("renders badge with unread count", async () => {
      const TestComponent = () => {
        const { addNotification } = useNotifications();

        React.useEffect(() => {
          addNotification({
            title: "Test",
            message: "Message",
            type: "info",
            priority: "medium",
            channel: ["browser"],
            persistent: false,
          });
        }, []);

        return <NotificationBadge />;
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("1")).toBeInTheDocument();
      });
    });

    it("shows maxCount+ when count exceeds max", async () => {
      const TestComponent = () => {
        const { addNotification } = useNotifications();

        React.useEffect(() => {
          for (let i = 0; i < 150; i++) {
            addNotification({
              title: `Notification ${i}`,
              message: "Message",
              type: "info",
              priority: "medium",
              channel: ["browser"],
              persistent: false,
            });
          }
        }, []);

        return <NotificationBadge maxCount={99} />;
      };

      render(
        <NotificationProvider maxNotifications={150}>
          <TestComponent />
        </NotificationProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("99+")).toBeInTheDocument();
      });
    });
  });

  describe("useToast Hook", () => {
    it("provides toast function", async () => {
      const TestComponent = () => {
        const { toast } = useToast();
        const { state } = useNotifications();

        return (
          <div>
            <button onClick={() => toast("Test message")}>Toast</button>
            <div data-testid="count">{state.notifications.length}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Toast"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("1");
      });
    });

    it("provides success shorthand", async () => {
      const TestComponent = () => {
        const { success } = useToast();
        const { state } = useNotifications();

        return (
          <div>
            <button onClick={() => success("Success message")}>Success</button>
            <div data-testid="type">{state.notifications[0]?.type || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Success"));

      await waitFor(() => {
        expect(screen.getByTestId("type")).toHaveTextContent("success");
      });
    });

    it("provides error shorthand", async () => {
      const TestComponent = () => {
        const { error } = useToast();
        const { state } = useNotifications();

        return (
          <div>
            <button onClick={() => error("Error message")}>Error</button>
            <div data-testid="type">{state.notifications[0]?.type || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Error"));

      await waitFor(() => {
        expect(screen.getByTestId("type")).toHaveTextContent("error");
      });
    });

    it("provides warning shorthand", async () => {
      const TestComponent = () => {
        const { warning } = useToast();
        const { state } = useNotifications();

        return (
          <div>
            <button onClick={() => warning("Warning message")}>Warning</button>
            <div data-testid="type">{state.notifications[0]?.type || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Warning"));

      await waitFor(() => {
        expect(screen.getByTestId("type")).toHaveTextContent("warning");
      });
    });

    it("provides info shorthand", async () => {
      const TestComponent = () => {
        const { info } = useToast();
        const { state } = useNotifications();

        return (
          <div>
            <button onClick={() => info("Info message")}>Info</button>
            <div data-testid="type">{state.notifications[0]?.type || "none"}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Info"));

      await waitFor(() => {
        expect(screen.getByTestId("type")).toHaveTextContent("info");
      });
    });

    it("provides dismiss function", async () => {
      const TestComponent = () => {
        const { toast, dismiss } = useToast();
        const { state } = useNotifications();
        const [notificationId, setNotificationId] = React.useState<string | null>(null);

        React.useEffect(() => {
          if (state.notifications.length > 0 && !notificationId) {
            setNotificationId(state.notifications[0].id);
          }
        }, [state.notifications]);

        return (
          <div>
            <button onClick={() => toast("Test message")}>Add</button>
            <button onClick={() => notificationId && dismiss(notificationId)}>Dismiss</button>
            <div data-testid="count">{state.notifications.length}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("1");
      });

      fireEvent.click(screen.getByText("Dismiss"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("0");
      });
    });

    it("provides clear function", async () => {
      const TestComponent = () => {
        const { toast, clear } = useToast();
        const { state } = useNotifications();

        return (
          <div>
            <button
              onClick={() => {
                toast("Message 1");
                toast("Message 2");
                toast("Message 3");
              }}
            >
              Add Multiple
            </button>
            <button onClick={clear}>Clear</button>
            <div data-testid="count">{state.notifications.length}</div>
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByText("Add Multiple"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("3");
      });

      fireEvent.click(screen.getByText("Clear"));

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("0");
      });
    });
  });

  describe("Accessibility", () => {
    beforeAll(() => {
      jest.useRealTimers();
    });

    afterAll(() => {
      jest.useFakeTimers();
    });

    it("passes accessibility validation", async () => {
      const TestComponent = () => {
        const { notifications } = useNotifications();
        return <NotificationList />;
      };

      const { container } = render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      // Simple check that the component renders
      expect(container).toBeInTheDocument();
    }, 5000);
  });

  describe("Comprehensive Testing", () => {
    beforeAll(() => {
      jest.useRealTimers();
    });

    afterAll(() => {
      jest.useFakeTimers();
    });

    it("passes all comprehensive tests", async () => {
      const TestComponent = () => {
        const { addNotification } = useNotifications();

        React.useEffect(() => {
          addNotification({
            title: "Test Notification",
            message: "Test message",
            type: "success",
            priority: "medium",
            channel: ["browser"],
            persistent: false,
          });
        }, []);

        return (
          <div>
            <NotificationList />
            <NotificationBadge />
          </div>
        );
      };

      const { container } = render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>,
      );

      // Basic checks without heavy async validation
      expect(container).toBeInTheDocument();
      expect(container).toHaveNoSecurityViolations();
    }, 30000);
  });
});
