/**
 * IPCIDRInput Component Tests
 *
 * Testing CIDR parsing (lines 38-158), host calculations, network info display,
 * validation logic, and accessibility
 */

import React, { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IPCIDRInput } from "../IPCIDRInput";

// Controlled wrapper component for testing validation
function ControlledIPCIDRInput(
  props: Omit<React.ComponentProps<typeof IPCIDRInput>, "value" | "onChange"> & {
    initialValue?: string;
  },
) {
  const { initialValue = "", ...restProps } = props;
  const [value, setValue] = useState(initialValue);

  return <IPCIDRInput value={value} onChange={setValue} {...restProps} />;
}

// Mock the IP utility functions
jest.mock("@/lib/utils/ip-address", () => ({
  parseCIDR: jest.fn((value: string) => {
    if (value === "192.168.1.0/24") {
      return { family: 4, cidr: 24 }; // IPv4
    }
    if (value === "2001:db8::/64") {
      return { family: 6, cidr: 64 }; // IPv6
    }
    if (value === "10.0.0.0/8") {
      return { family: 4, cidr: 8 };
    }
    return null; // Invalid
  }),
  IPFamily: {
    IPv4: 4,
    IPv6: 6,
  },
  getIPv4UsableHosts: jest.fn((cidr: number) => {
    if (cidr === 24) return 254;
    if (cidr === 8) return 16777214;
    return 0;
  }),
  getIPv4Network: jest.fn((value: string) => {
    if (value === "192.168.1.0/24") return "192.168.1.0";
    if (value === "10.0.0.0/8") return "10.0.0.0";
    return "";
  }),
  getIPv4Broadcast: jest.fn((value: string) => {
    if (value === "192.168.1.0/24") return "192.168.1.255";
    if (value === "10.0.0.0/8") return "10.255.255.255";
    return "";
  }),
}));

describe("IPCIDRInput", () => {
  const defaultProps = {
    value: "",
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders input field", () => {
      render(<IPCIDRInput {...defaultProps} label="Network CIDR" />);

      expect(screen.getByLabelText("Network CIDR")).toBeInTheDocument();
    });

    it("renders with placeholder", () => {
      render(<IPCIDRInput {...defaultProps} />);

      expect(
        screen.getByPlaceholderText("Enter CIDR notation (e.g., 192.168.1.0/24)"),
      ).toBeInTheDocument();
    });

    it("renders with custom placeholder", () => {
      render(<IPCIDRInput {...defaultProps} placeholder="Enter subnet" />);

      expect(screen.getByPlaceholderText("Enter subnet")).toBeInTheDocument();
    });

    it("shows required asterisk when required is true", () => {
      render(<IPCIDRInput {...defaultProps} label="Network" required={true} />);

      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("renders with initial value", () => {
      render(<IPCIDRInput {...defaultProps} value="192.168.1.0/24" label="Network" />);

      const input = screen.getByLabelText("Network") as HTMLInputElement;
      expect(input.value).toBe("192.168.1.0/24");
    });
  });

  describe("CIDR Parsing and Validation (Lines 38-158)", () => {
    it("validates IPv4 CIDR format", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();

      render(<IPCIDRInput value="" onChange={onChange} label="CIDR" />);

      const input = screen.getByLabelText("CIDR");
      await user.type(input, "192.168.1.0/24");
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalled();
      // Valid CIDR should not show error
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows error for invalid CIDR format", async () => {
      const user = userEvent.setup();

      render(<ControlledIPCIDRInput label="CIDR" />);

      const input = screen.getByLabelText("CIDR");
      await user.type(input, "invalid");
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Invalid CIDR notation format");
      });
    });

    it("validates IPv6 CIDR format", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();

      render(<IPCIDRInput value="" onChange={onChange} label="CIDR" />);

      const input = screen.getByLabelText("CIDR");
      await user.type(input, "2001:db8::/64");
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalled();
    });

    it("shows error when IPv4 not allowed", async () => {
      const user = userEvent.setup();

      render(<ControlledIPCIDRInput label="CIDR" allowIPv4={false} allowIPv6={true} />);

      const input = screen.getByLabelText("CIDR");
      await user.type(input, "192.168.1.0/24");
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("IPv4 CIDR is not allowed");
      });
    });

    it("shows error when IPv6 not allowed", async () => {
      const user = userEvent.setup();

      render(<ControlledIPCIDRInput label="CIDR" allowIPv4={true} allowIPv6={false} />);

      const input = screen.getByLabelText("CIDR");
      await user.type(input, "2001:db8::/64");
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("IPv6 CIDR is not allowed");
      });
    });

    it("shows IPv4-specific error message when only IPv4 allowed", async () => {
      const user = userEvent.setup();

      render(<ControlledIPCIDRInput label="CIDR" allowIPv4={true} allowIPv6={false} />);

      const input = screen.getByLabelText("CIDR");
      await user.type(input, "invalid");
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Invalid IPv4 CIDR format (e.g., 192.168.1.0/24)",
        );
      });
    });

    it("shows IPv6-specific error message when only IPv6 allowed", async () => {
      const user = userEvent.setup();

      render(<ControlledIPCIDRInput label="CIDR" allowIPv4={false} allowIPv6={true} />);

      const input = screen.getByLabelText("CIDR");
      await user.type(input, "invalid");
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Invalid IPv6 CIDR format (e.g., 2001:db8::/64)",
        );
      });
    });

    it("does not show validation error before blur (touched)", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();

      render(<IPCIDRInput value="" onChange={onChange} label="CIDR" />);

      const input = screen.getByLabelText("CIDR");
      await user.type(input, "invalid");

      // Error should not appear until blur
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Network Info Display (Lines 92-100, 135-150)", () => {
    it("displays network info for valid IPv4 CIDR", () => {
      render(
        <IPCIDRInput value="192.168.1.0/24" onChange={jest.fn()} label="CIDR" showInfo={true} />,
      );

      expect(screen.getByText("Network:")).toBeInTheDocument();
      expect(screen.getByText("192.168.1.0")).toBeInTheDocument();
      expect(screen.getByText("Broadcast:")).toBeInTheDocument();
      expect(screen.getByText("192.168.1.255")).toBeInTheDocument();
      expect(screen.getByText("Usable Hosts:")).toBeInTheDocument();
      expect(screen.getByText("254")).toBeInTheDocument();
    });

    it("calculates large network correctly", () => {
      render(<IPCIDRInput value="10.0.0.0/8" onChange={jest.fn()} label="CIDR" showInfo={true} />);

      expect(screen.getByText("10.0.0.0")).toBeInTheDocument();
      expect(screen.getByText("10.255.255.255")).toBeInTheDocument();
      expect(screen.getByText("16,777,214")).toBeInTheDocument(); // With locale formatting
    });

    it("does not show network info for IPv6", () => {
      render(
        <IPCIDRInput value="2001:db8::/64" onChange={jest.fn()} label="CIDR" showInfo={true} />,
      );

      // IPv6 doesn't show network info
      expect(screen.queryByText("Network:")).not.toBeInTheDocument();
      expect(screen.queryByText("Broadcast:")).not.toBeInTheDocument();
    });

    it("hides network info when showInfo is false", () => {
      render(
        <IPCIDRInput value="192.168.1.0/24" onChange={jest.fn()} label="CIDR" showInfo={false} />,
      );

      expect(screen.queryByText("Network:")).not.toBeInTheDocument();
    });

    it("does not show network info when there is an error", () => {
      render(
        <IPCIDRInput
          value="192.168.1.0/24"
          onChange={jest.fn()}
          label="CIDR"
          error="Custom error"
          showInfo={true}
        />,
      );

      expect(screen.queryByText("Network:")).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Custom error");
    });
  });

  describe("Badge Display", () => {
    it("shows IPv4 badge for valid IPv4 CIDR", () => {
      render(<IPCIDRInput value="192.168.1.0/24" onChange={jest.fn()} label="CIDR" />);

      expect(screen.getByText("IPv4 /24")).toBeInTheDocument();
    });

    it("shows IPv6 badge for valid IPv6 CIDR", () => {
      render(<IPCIDRInput value="2001:db8::/64" onChange={jest.fn()} label="CIDR" />);

      expect(screen.getByText("IPv6 /64")).toBeInTheDocument();
    });

    it("does not show badge for invalid CIDR", () => {
      render(<IPCIDRInput value="invalid" onChange={jest.fn()} label="CIDR" />);

      expect(screen.queryByText(/IPv[46]/)).not.toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("calls onChange when user types", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();

      render(<IPCIDRInput value="" onChange={onChange} label="CIDR" />);

      const input = screen.getByLabelText("CIDR");
      await user.type(input, "192");

      expect(onChange).toHaveBeenCalled();
    });

    it("calls onBlur when input loses focus", () => {
      const onBlur = jest.fn();

      render(<IPCIDRInput value="" onChange={jest.fn()} onBlur={onBlur} label="CIDR" />);

      const input = screen.getByLabelText("CIDR");
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error Display", () => {
    it("displays custom error prop", () => {
      render(
        <IPCIDRInput value="" onChange={jest.fn()} label="CIDR" error="Custom error message" />,
      );

      expect(screen.getByRole("alert")).toHaveTextContent("Custom error message");
    });

    it("custom error overrides validation error", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();

      render(<IPCIDRInput value="" onChange={onChange} label="CIDR" error="Custom error" />);

      const input = screen.getByLabelText("CIDR");
      await user.type(input, "invalid");
      fireEvent.blur(input);

      expect(screen.getByRole("alert")).toHaveTextContent("Custom error");
    });

    it("applies error styling to input", () => {
      render(<IPCIDRInput value="" onChange={jest.fn()} label="CIDR" error="Error" />);

      const input = screen.getByLabelText("CIDR");
      expect(input).toHaveClass("border-red-500");
    });

    it("sets aria-invalid when error exists", () => {
      render(<IPCIDRInput value="" onChange={jest.fn()} label="CIDR" error="Error" />);

      const input = screen.getByLabelText("CIDR");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("sets aria-describedby to error id when error exists", () => {
      render(<IPCIDRInput value="" onChange={jest.fn()} label="Network" error="Error" />);

      const input = screen.getByLabelText("Network");
      expect(input).toHaveAttribute("aria-describedby", "Network-error");
    });
  });

  describe("Help Text", () => {
    it("displays help text when provided", () => {
      render(
        <IPCIDRInput
          value=""
          onChange={jest.fn()}
          label="CIDR"
          helpText="Enter the network range"
        />,
      );

      expect(screen.getByText("Enter the network range")).toBeInTheDocument();
    });

    it("hides help text when error is present", () => {
      render(
        <IPCIDRInput
          value=""
          onChange={jest.fn()}
          label="CIDR"
          helpText="Help text"
          error="Error message"
        />,
      );

      expect(screen.queryByText("Help text")).not.toBeInTheDocument();
      expect(screen.getByText("Error message")).toBeInTheDocument();
    });

    it("hides help text when network info is displayed", () => {
      render(
        <IPCIDRInput
          value="192.168.1.0/24"
          onChange={jest.fn()}
          label="CIDR"
          helpText="Help text"
          showInfo={true}
        />,
      );

      expect(screen.queryByText("Help text")).not.toBeInTheDocument();
      expect(screen.getByText("Network:")).toBeInTheDocument();
    });
  });

  describe("Disabled State", () => {
    it("disables input when disabled prop is true", () => {
      render(<IPCIDRInput value="" onChange={jest.fn()} label="CIDR" disabled={true} />);

      expect(screen.getByLabelText("CIDR")).toBeDisabled();
    });

    it("prevents changes when disabled", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();

      render(<IPCIDRInput value="" onChange={onChange} label="CIDR" disabled={true} />);

      const input = screen.getByLabelText("CIDR");
      await user.type(input, "192.168.1.0/24");

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("associates label with input", () => {
      render(<IPCIDRInput value="" onChange={jest.fn()} label="Network Range" />);

      const input = screen.getByLabelText("Network Range");
      expect(input).toBeInTheDocument();
    });

    it("error has role=alert", () => {
      render(<IPCIDRInput value="" onChange={jest.fn()} label="CIDR" error="Error message" />);

      expect(screen.getByRole("alert")).toHaveTextContent("Error message");
    });

    it("is keyboard accessible", () => {
      render(<IPCIDRInput value="" onChange={jest.fn()} label="CIDR" />);

      const input = screen.getByLabelText("CIDR");
      input.focus();
      expect(input).toHaveFocus();
    });
  });

  describe("Custom Styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <IPCIDRInput value="" onChange={jest.fn()} label="CIDR" className="custom-class" />,
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  describe("Integration Scenarios", () => {
    it("handles complete input flow", async () => {
      const onBlur = jest.fn();
      const user = userEvent.setup();

      render(<ControlledIPCIDRInput onBlur={onBlur} label="Network" showInfo={true} />);

      const input = screen.getByLabelText("Network");

      // Type valid CIDR
      await user.type(input, "192.168.1.0/24");

      // Blur to trigger validation
      await user.tab();
      expect(onBlur).toHaveBeenCalled();

      // Should show network info
      await waitFor(() => {
        expect(screen.getByText("Network:")).toBeInTheDocument();
        expect(screen.getByText("192.168.1.0")).toBeInTheDocument();
        expect(screen.getByText("Usable Hosts:")).toBeInTheDocument();
      });
    });
  });
});
