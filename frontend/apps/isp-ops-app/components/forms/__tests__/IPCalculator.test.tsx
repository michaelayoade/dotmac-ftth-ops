/**
 * IPCalculator Component Tests
 *
 * Validates CIDR calculations, mask-to-prefix sync, error banners,
 * and accessibility of the primary inputs.
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IPCalculator } from "../IPCalculator";

// Minimal @dotmac/ui mock with Tabs behavior
jest.mock("@dotmac/ui", () => {
  const React = require("react");

  type PropsWithChildren = { children?: React.ReactNode; className?: string };

  const TabsContext = React.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

  const passthrough = (Tag: keyof JSX.IntrinsicElements) =>
    React.forwardRef<any, PropsWithChildren & Record<string, any>>((props, ref) => (
      <Tag ref={ref} {...props} />
    ));

  return {
    Card: ({ children, className }: PropsWithChildren) => (
      <div className={className} data-testid="card">
        {children}
      </div>
    ),
    CardHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    CardContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    CardTitle: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
    CardDescription: ({ children }: PropsWithChildren) => <p>{children}</p>,
    Label: passthrough("label"),
    Input: passthrough("input"),
    Badge: ({ children }: PropsWithChildren) => <span>{children}</span>,
    Tabs: ({
      value,
      onValueChange,
      children,
    }: PropsWithChildren & { value?: string; onValueChange?: (next: string) => void }) => (
      <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>
    ),
    TabsList: ({ children }: PropsWithChildren) => <div>{children}</div>,
    TabsTrigger: ({ children, value }: PropsWithChildren & { value: string }) => {
      const ctx = React.useContext(TabsContext);
      return (
        <button
          type="button"
          onClick={() => ctx.onValueChange?.(value)}
          data-active={ctx.value === value}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({ children, value }: PropsWithChildren & { value: string }) => {
      const ctx = React.useContext(TabsContext);
      if (ctx.value && ctx.value !== value) {
        return null;
      }
      return <div data-testid={`tabs-content-${value}`}>{children}</div>;
    },
  };
});

describe("IPCalculator", () => {
  it("renders primary metrics for the default CIDR", () => {
    render(<IPCalculator />);

    expect(screen.getByText("Network Address")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.0")).toBeInTheDocument();
    expect(screen.getByText("Broadcast Address")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.255")).toBeInTheDocument();
    expect(screen.getByText("Usable Hosts")).toBeInTheDocument();
    expect(screen.getByText("254")).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
  });

  it("alerts about invalid CIDR notation", async () => {
    const user = userEvent.setup();
    render(<IPCalculator />);

    const cidrInput = screen.getByLabelText("CIDR Notation") as HTMLInputElement;
    await act(async () => {
      await user.clear(cidrInput);
      await user.type(cidrInput, "invalid-input");
    });

    expect(screen.getByText("Invalid CIDR notation")).toBeInTheDocument();
  });

  it("syncs subnet mask edits back to CIDR prefix", async () => {
    const user = userEvent.setup();
    render(<IPCalculator />);

    const maskInput = screen.getByLabelText("Subnet Mask") as HTMLInputElement;
    await act(async () => {
      await user.clear(maskInput);
      await user.type(maskInput, "255.255.0.0");
    });

    const cidrInput = screen.getByLabelText("CIDR Notation") as HTMLInputElement;
    expect(cidrInput.value).toBe("192.168.1.0/16");
  });

  it("shows binary representation when calculations are available", () => {
    render(<IPCalculator />);

    expect(screen.getByText("Binary Representation")).toBeInTheDocument();
    expect(screen.getByText(/11000000\.10101000\.00000001\.00000000/i)).toBeInTheDocument();
  });
});
