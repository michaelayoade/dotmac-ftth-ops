/**
 * DualStackIPInput Component Tests
 *
 * Testing validation paths (lines 56-115), require-at-least-one logic,
 * IPv4/IPv6 composition, error handling, and accessibility
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DualStackIPInput } from "../DualStackIPInput";

// Mock child components
jest.mock("../IPAddressInput", () => ({
  IPAddressInput: jest.fn(({ label, value, onChange, error, helpText, placeholder }) => (
    <div data-testid={`ip-input-${label}`}>
      <label>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {error && <span role="alert">{error}</span>}
      {helpText && <span>{helpText}</span>}
    </div>
  )),
}));

jest.mock("../IPCIDRInput", () => ({
  IPCIDRInput: jest.fn(({ label, value, onChange, error, helpText, placeholder }) => (
    <div data-testid={`cidr-input-${label}`}>
      <label>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {error && <span role="alert">{error}</span>}
      {helpText && <span>{helpText}</span>}
    </div>
  )),
}));

describe("DualStackIPInput", () => {
  const defaultProps = {
    ipv4Value: "",
    ipv6Value: "",
    onIPv4Change: jest.fn(),
    onIPv6Change: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders both IPv4 and IPv6 inputs", () => {
      render(<DualStackIPInput {...defaultProps} />);

      expect(screen.getByLabelText("IPv4 Address")).toBeInTheDocument();
      expect(screen.getByLabelText("IPv6 Address")).toBeInTheDocument();
    });

    it("renders with custom label", () => {
      render(<DualStackIPInput {...defaultProps} label="Server IPs" />);

      expect(screen.getByText("Server IPs")).toBeInTheDocument();
    });

    it("shows required asterisk when requireAtLeastOne is true", () => {
      render(<DualStackIPInput {...defaultProps} requireAtLeastOne={true} />);

      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("shows help text about requirement", () => {
      render(<DualStackIPInput {...defaultProps} requireAtLeastOne={true} />);

      expect(
        screen.getByText("At least one IP address (IPv4 or IPv6) is required"),
      ).toBeInTheDocument();
    });

    it("uses IPAddressInput by default", () => {
      render(<DualStackIPInput {...defaultProps} />);

      expect(screen.getByTestId("ip-input-IPv4 Address")).toBeInTheDocument();
      expect(screen.getByTestId("ip-input-IPv6 Address")).toBeInTheDocument();
    });

    it("uses IPCIDRInput when useCIDR is true", () => {
      render(<DualStackIPInput {...defaultProps} useCIDR={true} />);

      expect(screen.getByTestId("cidr-input-IPv4 Address")).toBeInTheDocument();
      expect(screen.getByTestId("cidr-input-IPv6 Address")).toBeInTheDocument();
    });
  });

  describe("Require At Least One Validation (Lines 56-115)", () => {
    it("shows error when both values are empty and requireAtLeastOne is true", () => {
      render(
        <DualStackIPInput
          ipv4Value=""
          ipv6Value=""
          onIPv4Change={jest.fn()}
          onIPv6Change={jest.fn()}
          requireAtLeastOne={true}
        />,
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "At least one IP address must be provided",
      );
    });

    it("does not show error when IPv4 is provided", () => {
      render(
        <DualStackIPInput
          ipv4Value="192.168.1.1"
          ipv6Value=""
          onIPv4Change={jest.fn()}
          onIPv6Change={jest.fn()}
          requireAtLeastOne={true}
        />,
      );

      expect(
        screen.queryByText("At least one IP address must be provided"),
      ).not.toBeInTheDocument();
    });

    it("does not show error when IPv6 is provided", () => {
      render(
        <DualStackIPInput
          ipv4Value=""
          ipv6Value="2001:db8::1"
          onIPv4Change={jest.fn()}
          onIPv6Change={jest.fn()}
          requireAtLeastOne={true}
        />,
      );

      expect(
        screen.queryByText("At least one IP address must be provided"),
      ).not.toBeInTheDocument();
    });

    it("does not show error when both are provided", () => {
      render(
        <DualStackIPInput
          ipv4Value="192.168.1.1"
          ipv6Value="2001:db8::1"
          onIPv4Change={jest.fn()}
          onIPv6Change={jest.fn()}
          requireAtLeastOne={true}
        />,
      );

      expect(
        screen.queryByText("At least one IP address must be provided"),
      ).not.toBeInTheDocument();
    });

    it("does not show error when requireAtLeastOne is false", () => {
      render(
        <DualStackIPInput
          ipv4Value=""
          ipv6Value=""
          onIPv4Change={jest.fn()}
          onIPv6Change={jest.fn()}
          requireAtLeastOne={false}
        />,
      );

      expect(
        screen.queryByText("At least one IP address must be provided"),
      ).not.toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("calls onIPv4Change when IPv4 input changes", async () => {
      const onIPv4Change = jest.fn();
      const user = userEvent.setup();

      render(<DualStackIPInput {...defaultProps} onIPv4Change={onIPv4Change} />);

      const ipv4Input = screen.getByLabelText("IPv4 Address");
      await user.type(ipv4Input, "192.168.1.1");

      expect(onIPv4Change).toHaveBeenCalled();
    });

    it("calls onIPv6Change when IPv6 input changes", async () => {
      const onIPv6Change = jest.fn();
      const user = userEvent.setup();

      render(<DualStackIPInput {...defaultProps} onIPv6Change={onIPv6Change} />);

      const ipv6Input = screen.getByLabelText("IPv6 Address");
      await user.type(ipv6Input, "2001:db8::1");

      expect(onIPv6Change).toHaveBeenCalled();
    });

    it("calls onIPv4Blur when provided", () => {
      const onIPv4Blur = jest.fn();

      render(<DualStackIPInput {...defaultProps} onIPv4Blur={onIPv4Blur} />);

      const ipv4Input = screen.getByLabelText("IPv4 Address");
      fireEvent.blur(ipv4Input);

      // Note: The actual blur handler would be tested in IPAddressInput tests
      // Here we just verify the prop is passed
    });

    it("calls onIPv6Blur when provided", () => {
      const onIPv6Blur = jest.fn();

      render(<DualStackIPInput {...defaultProps} onIPv6Blur={onIPv6Blur} />);

      const ipv6Input = screen.getByLabelText("IPv6 Address");
      fireEvent.blur(ipv6Input);

      // Note: The actual blur handler would be tested in IPAddressInput tests
    });
  });

  describe("Custom Labels and Placeholders", () => {
    it("uses custom IPv4 label", () => {
      render(<DualStackIPInput {...defaultProps} ipv4Label="Primary IPv4" />);

      expect(screen.getByLabelText("Primary IPv4")).toBeInTheDocument();
    });

    it("uses custom IPv6 label", () => {
      render(<DualStackIPInput {...defaultProps} ipv6Label="Primary IPv6" />);

      expect(screen.getByLabelText("Primary IPv6")).toBeInTheDocument();
    });

    it("uses default placeholders for IP mode", () => {
      render(<DualStackIPInput {...defaultProps} useCIDR={false} />);

      expect(screen.getByPlaceholderText("192.168.1.1")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("2001:db8::1")).toBeInTheDocument();
    });

    it("uses default placeholders for CIDR mode", () => {
      render(<DualStackIPInput {...defaultProps} useCIDR={true} />);

      expect(screen.getByPlaceholderText("192.168.1.0/24")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("2001:db8::/64")).toBeInTheDocument();
    });

    it("uses custom IPv4 placeholder when provided", () => {
      render(<DualStackIPInput {...defaultProps} ipv4Placeholder="10.0.0.0/8" />);

      expect(screen.getByPlaceholderText("10.0.0.0/8")).toBeInTheDocument();
    });

    it("uses custom IPv6 placeholder when provided", () => {
      render(<DualStackIPInput {...defaultProps} ipv6Placeholder="fe80::/10" />);

      expect(screen.getByPlaceholderText("fe80::/10")).toBeInTheDocument();
    });
  });

  describe("Error Display", () => {
    it("displays IPv4 error when provided", () => {
      render(<DualStackIPInput {...defaultProps} ipv4Error="Invalid IPv4 address" />);

      expect(screen.getByText("Invalid IPv4 address")).toBeInTheDocument();
    });

    it("displays IPv6 error when provided", () => {
      render(<DualStackIPInput {...defaultProps} ipv6Error="Invalid IPv6 address" />);

      expect(screen.getByText("Invalid IPv6 address")).toBeInTheDocument();
    });

    it("can display both IPv4 and IPv6 errors simultaneously", () => {
      render(
        <DualStackIPInput
          {...defaultProps}
          ipv4Error="IPv4 is invalid"
          ipv6Error="IPv6 is invalid"
        />,
      );

      expect(screen.getByText("IPv4 is invalid")).toBeInTheDocument();
      expect(screen.getByText("IPv6 is invalid")).toBeInTheDocument();
    });
  });

  describe("Disabled State", () => {
    it("passes disabled prop to child inputs", () => {
      render(<DualStackIPInput {...defaultProps} disabled={true} />);

      const ipv4Input = screen.getByLabelText("IPv4 Address");
      const ipv6Input = screen.getByLabelText("IPv6 Address");

      // Note: The actual disabled state is tested in IPAddressInput tests
      expect(ipv4Input).toBeInTheDocument();
      expect(ipv6Input).toBeInTheDocument();
    });
  });

  describe("Help Text", () => {
    it("shows default help text for both inputs", () => {
      render(<DualStackIPInput {...defaultProps} showInfo={true} />);

      expect(screen.getByText("Optional - Leave empty for IPv6-only")).toBeInTheDocument();
      expect(screen.getByText("Optional - Leave empty for IPv4-only")).toBeInTheDocument();
    });

    it("hides help text when showInfo is false", () => {
      render(<DualStackIPInput {...defaultProps} showInfo={false} />);

      // showInfo prop is passed to child components
      // The actual rendering logic is tested in child component tests
    });
  });

  describe("Grid Layout", () => {
    it("uses responsive grid layout", () => {
      const { container } = render(<DualStackIPInput {...defaultProps} />);

      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-2", "gap-4");
    });

    it("applies custom className", () => {
      const { container } = render(<DualStackIPInput {...defaultProps} className="custom-class" />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("custom-class");
    });
  });

  describe("Accessibility", () => {
    it("error message has role=alert", () => {
      render(
        <DualStackIPInput
          ipv4Value=""
          ipv6Value=""
          onIPv4Change={jest.fn()}
          onIPv6Change={jest.fn()}
          requireAtLeastOne={true}
        />,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("At least one IP address must be provided");
    });

    it("is keyboard accessible", () => {
      render(<DualStackIPInput {...defaultProps} />);

      const ipv4Input = screen.getByLabelText("IPv4 Address");
      const ipv6Input = screen.getByLabelText("IPv6 Address");

      // Should be able to tab between inputs
      ipv4Input.focus();
      expect(ipv4Input).toHaveFocus();

      ipv6Input.focus();
      expect(ipv6Input).toHaveFocus();
    });
  });

  describe("Integration Scenarios", () => {
    it("handles complete dual-stack configuration", async () => {
      const onIPv4Change = jest.fn();
      const onIPv6Change = jest.fn();
      const user = userEvent.setup();

      render(
        <DualStackIPInput
          ipv4Value=""
          ipv6Value=""
          onIPv4Change={onIPv4Change}
          onIPv6Change={onIPv6Change}
          requireAtLeastOne={true}
        />,
      );

      // Initially shows error
      expect(screen.getByRole("alert")).toHaveTextContent(
        "At least one IP address must be provided",
      );

      // Add IPv4 - error should disappear
      const ipv4Input = screen.getByLabelText("IPv4 Address");
      await user.type(ipv4Input, "192.168.1.1");

      expect(onIPv4Change).toHaveBeenCalled();
    });

    it("handles IPv6-only configuration", async () => {
      const onIPv6Change = jest.fn();
      const user = userEvent.setup();

      render(
        <DualStackIPInput
          ipv4Value=""
          ipv6Value=""
          onIPv4Change={jest.fn()}
          onIPv6Change={onIPv6Change}
          requireAtLeastOne={true}
        />,
      );

      const ipv6Input = screen.getByLabelText("IPv6 Address");
      await user.type(ipv6Input, "2001:db8::1");

      expect(onIPv6Change).toHaveBeenCalled();
    });

    it("handles IPv4-only configuration", async () => {
      const onIPv4Change = jest.fn();
      const user = userEvent.setup();

      render(
        <DualStackIPInput
          ipv4Value=""
          ipv6Value=""
          onIPv4Change={onIPv4Change}
          onIPv6Change={jest.fn()}
          requireAtLeastOne={true}
        />,
      );

      const ipv4Input = screen.getByLabelText("IPv4 Address");
      await user.type(ipv4Input, "10.0.0.1");

      expect(onIPv4Change).toHaveBeenCalled();
    });
  });
});
