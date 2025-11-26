/**
 * IPAddressInput Component Tests
 *
 * Covers validation flows, badge rendering, helper/error text, and
 * accessibility wiring around Label/Input composition.
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IPAddressInput } from "../IPAddressInput";

// Mock @dotmac/ui primitives used by the component
jest.mock("@dotmac/ui", () => {
  const React = require("react");
  return {
    Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
      (props, ref) => <input ref={ref} {...props} />,
    ),
    Label: ({ children, htmlFor }: any) => (
      <label htmlFor={htmlFor} data-testid="label">
        {children}
      </label>
    ),
    Badge: ({ children }: any) => <span data-testid="family-badge">{children}</span>,
  };
});

const renderControlledInput = (
  props: Partial<React.ComponentProps<typeof IPAddressInput>> = {},
) => {
  const Wrapper = () => {
    const [value, setValue] = React.useState(props.value ?? "");
    return (
      <IPAddressInput
        label="IP Address"
        value={value}
        onChange={(next) => setValue(next)}
        {...props}
      />
    );
  };

  return render(<Wrapper />);
};

describe("IPAddressInput", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders label, placeholder and associates them correctly", () => {
    render(
      <IPAddressInput label="Gateway" placeholder="192.168.0.1" value="" onChange={jest.fn()} />,
    );

    const input = screen.getByLabelText("Gateway") as HTMLInputElement;
    expect(input.placeholder).toBe("192.168.0.1");
  });

  it("invokes onChange while the user types", async () => {
    const handleChange = jest.fn();
    const typedValue = "10.0.0.1";

    const user = userEvent.setup();
    render(<IPAddressInput label="Gateway" value="" onChange={(value) => handleChange(value)} />);

    const input = screen.getByLabelText("Gateway");
    await user.type(input, typedValue);

    expect(handleChange).toHaveBeenCalledTimes(typedValue.length);
  });

  it("shows IPv4 and IPv6 badges when showFamily is enabled", () => {
    const { rerender } = render(
      <IPAddressInput label="Address" value="192.168.0.1" onChange={jest.fn()} />,
    );
    expect(screen.getByTestId("family-badge")).toHaveTextContent("IPv4");

    rerender(<IPAddressInput label="Address" value="2001:db8::1" onChange={jest.fn()} />);
    expect(screen.getByTestId("family-badge")).toHaveTextContent("IPv6");
  });

  it("displays helper text when provided", () => {
    render(<IPAddressInput label="Address" helpText="Optional" value="" onChange={jest.fn()} />);

    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("shows provided error message and aria wiring", () => {
    render(<IPAddressInput label="Address" error="Invalid IP" value="" onChange={jest.fn()} />);

    const input = screen.getByLabelText("Address");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Invalid IP")).toHaveAttribute("role", "alert");
  });

  it("sets disabled attribute when disabled", () => {
    render(<IPAddressInput label="Address" disabled value="" onChange={jest.fn()} />);

    expect(screen.getByLabelText("Address")).toBeDisabled();
  });

  it("invokes onBlur callback and enables validation", async () => {
    const handleBlur = jest.fn();
    const user = userEvent.setup();

    renderControlledInput({
      onBlur: handleBlur,
      allowIPv4: false,
    });

    const input = screen.getByLabelText("IP Address");
    await act(async () => {
      await user.type(input, "192.168.0.1");
    });
    fireEvent.blur(input);

    expect(handleBlur).toHaveBeenCalled();
    expect(screen.getByText("IPv4 addresses are not allowed")).toBeInTheDocument();
  });

  it("displays validation error when IPv6 is disallowed", async () => {
    const user = userEvent.setup();

    renderControlledInput({
      allowIPv6: false,
    });

    const input = screen.getByLabelText("IP Address");
    await act(async () => {
      await user.type(input, "2001:db8::1");
    });
    fireEvent.blur(input);

    expect(screen.getByText("IPv6 addresses are not allowed")).toBeInTheDocument();
  });

  it("handles multiline keyboard input", async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState("");
      return (
        <IPAddressInput
          label="Address"
          value={value}
          onChange={(next) => {
            setValue(next);
            handleChange(next);
          }}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByLabelText("Address");
    await act(async () => {
      await user.type(input, "fe80::1");
    });

    expect(handleChange).toHaveBeenCalledWith(expect.stringContaining("fe80::1"));
  });
});
