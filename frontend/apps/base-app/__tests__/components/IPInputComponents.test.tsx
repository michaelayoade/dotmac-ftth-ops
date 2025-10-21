/**
 * Component Tests for IP Input Components
 *
 * Tests IPv4, IPv6, CIDR, and dual-stack input components
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import { IPAddressInput } from "@/components/forms/IPAddressInput";
import { IPCIDRInput } from "@/components/forms/IPCIDRInput";
import { DualStackIPInput } from "@/components/forms/DualStackIPInput";
import { IPCalculator } from "@/components/forms/IPCalculator";
import { IPAddressDisplay, DualStackBadge } from "@/components/forms/IPAddressDisplay";

describe("IPAddressInput", () => {
  it("renders with label", () => {
    render(<IPAddressInput label="IP Address" value="" onChange={() => {}} />);

    expect(screen.getByLabelText("IP Address")).toBeInTheDocument();
  });

  it("validates IPv4 address correctly", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <IPAddressInput
        label="IP Address"
        value=""
        onChange={onChange}
        allowIPv4={true}
        allowIPv6={false}
      />,
    );

    const input = screen.getByLabelText("IP Address");

    // Valid IPv4
    await user.type(input, "192.168.1.100");
    expect(screen.getByText("IPv4")).toBeInTheDocument();

    // Invalid IPv4
    await user.clear(input);
    await user.type(input, "256.256.256.256");
    expect(screen.getByText("Invalid IPv4 address")).toBeInTheDocument();
  });

  it("validates IPv6 address correctly", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <IPAddressInput
        label="IP Address"
        value=""
        onChange={onChange}
        allowIPv4={false}
        allowIPv6={true}
      />,
    );

    const input = screen.getByLabelText("IP Address");

    // Valid IPv6
    await user.type(input, "2001:db8::1");
    expect(screen.getByText("IPv6")).toBeInTheDocument();

    // Invalid IPv6
    await user.clear(input);
    await user.type(input, "gggg::1");
    expect(screen.getByText("Invalid IPv6 address")).toBeInTheDocument();
  });

  it("allows both IPv4 and IPv6 when both enabled", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <IPAddressInput
        label="IP Address"
        value=""
        onChange={onChange}
        allowIPv4={true}
        allowIPv6={true}
      />,
    );

    const input = screen.getByLabelText("IP Address");

    // IPv4
    await user.type(input, "10.0.0.1");
    expect(screen.getByText("IPv4")).toBeInTheDocument();

    // IPv6
    await user.clear(input);
    await user.type(input, "fe80::1");
    expect(screen.getByText("IPv6")).toBeInTheDocument();
  });

  it("shows error message for custom validation", () => {
    render(
      <IPAddressInput
        label="IP Address"
        value="192.168.1.1"
        onChange={() => {}}
        error="This IP is already in use"
      />,
    );

    expect(screen.getByText("This IP is already in use")).toBeInTheDocument();
  });

  it("calls onChange with value", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<IPAddressInput label="IP Address" value="" onChange={onChange} />);

    const input = screen.getByLabelText("IP Address");
    await user.type(input, "192.168.1.1");

    expect(onChange).toHaveBeenCalled();
  });

  it("disables input when disabled prop is true", () => {
    render(
      <IPAddressInput label="IP Address" value="192.168.1.1" onChange={() => {}} disabled={true} />,
    );

    expect(screen.getByLabelText("IP Address")).toBeDisabled();
  });
});

describe("IPCIDRInput", () => {
  it("renders with label and placeholder", () => {
    render(
      <IPCIDRInput
        label="Network CIDR"
        value=""
        onChange={() => {}}
        placeholder="192.168.1.0/24"
      />,
    );

    expect(screen.getByLabelText("Network CIDR")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("192.168.1.0/24")).toBeInTheDocument();
  });

  it("validates CIDR notation for IPv4", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <IPCIDRInput
        label="Network"
        value=""
        onChange={onChange}
        allowIPv4={true}
        allowIPv6={false}
      />,
    );

    const input = screen.getByLabelText("Network");

    // Valid CIDR
    await user.type(input, "192.168.1.0/24");
    expect(onChange).toHaveBeenCalled();

    // Invalid CIDR (no prefix)
    await user.clear(input);
    await user.type(input, "192.168.1.0");
    expect(screen.getByText(/Invalid.*CIDR/i)).toBeInTheDocument();

    // Invalid CIDR (prefix > 32)
    await user.clear(input);
    await user.type(input, "192.168.1.0/33");
    expect(screen.getByText(/Invalid.*CIDR/i)).toBeInTheDocument();
  });

  it("validates CIDR notation for IPv6", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <IPCIDRInput
        label="Network"
        value=""
        onChange={onChange}
        allowIPv4={false}
        allowIPv6={true}
      />,
    );

    const input = screen.getByLabelText("Network");

    // Valid IPv6 CIDR
    await user.type(input, "2001:db8::/64");
    expect(onChange).toHaveBeenCalled();

    // Invalid CIDR (prefix > 128)
    await user.clear(input);
    await user.type(input, "2001:db8::/129");
    expect(screen.getByText(/Invalid.*CIDR/i)).toBeInTheDocument();
  });

  it("shows network information for valid IPv4 CIDR", async () => {
    const user = userEvent.setup();

    render(<IPCIDRInput label="Network" value="" onChange={() => {}} showInfo={true} />);

    const input = screen.getByLabelText("Network");
    await user.type(input, "192.168.1.0/24");

    await waitFor(() => {
      expect(screen.getByText(/Network:/)).toBeInTheDocument();
      expect(screen.getByText("192.168.1.0")).toBeInTheDocument();
      expect(screen.getByText(/Broadcast:/)).toBeInTheDocument();
      expect(screen.getByText("192.168.1.255")).toBeInTheDocument();
      expect(screen.getByText(/Usable Hosts:/)).toBeInTheDocument();
      expect(screen.getByText("254")).toBeInTheDocument();
    });
  });

  it("hides network information when showInfo is false", async () => {
    const user = userEvent.setup();

    render(<IPCIDRInput label="Network" value="" onChange={() => {}} showInfo={false} />);

    const input = screen.getByLabelText("Network");
    await user.type(input, "192.168.1.0/24");

    expect(screen.queryByText(/Network:/)).not.toBeInTheDocument();
  });
});

describe("DualStackIPInput", () => {
  it("renders both IPv4 and IPv6 inputs", () => {
    render(
      <DualStackIPInput
        label="Server IPs"
        ipv4Value=""
        ipv6Value=""
        onIPv4Change={() => {}}
        onIPv6Change={() => {}}
      />,
    );

    expect(screen.getByText("Server IPs")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/IPv4/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/IPv6/i)).toBeInTheDocument();
  });

  it("shows error when neither IP provided and requireAtLeastOne is true", () => {
    render(
      <DualStackIPInput
        label="IPs"
        ipv4Value=""
        ipv6Value=""
        onIPv4Change={() => {}}
        onIPv6Change={() => {}}
        requireAtLeastOne={true}
      />,
    );

    expect(screen.getByText(/at least one IP address/i)).toBeInTheDocument();
  });

  it("does not show error when at least one IP provided", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <DualStackIPInput
        label="IPs"
        ipv4Value=""
        ipv6Value=""
        onIPv4Change={() => {}}
        onIPv6Change={() => {}}
        requireAtLeastOne={true}
      />,
    );

    // Initially shows error
    expect(screen.getByText(/at least one IP address/i)).toBeInTheDocument();

    // After providing IPv4, error should disappear
    rerender(
      <DualStackIPInput
        label="IPs"
        ipv4Value="192.168.1.1"
        ipv6Value=""
        onIPv4Change={() => {}}
        onIPv6Change={() => {}}
        requireAtLeastOne={true}
      />,
    );

    expect(screen.queryByText(/at least one IP address/i)).not.toBeInTheDocument();
  });

  it("supports CIDR notation when useCIDR is true", () => {
    render(
      <DualStackIPInput
        label="Networks"
        ipv4Value=""
        ipv6Value=""
        onIPv4Change={() => {}}
        onIPv6Change={() => {}}
        useCIDR={true}
      />,
    );

    expect(screen.getByPlaceholderText(/CIDR/i)).toBeInTheDocument();
  });

  it("shows individual error messages for each IP", () => {
    render(
      <DualStackIPInput
        label="IPs"
        ipv4Value="invalid"
        ipv6Value="invalid"
        onIPv4Change={() => {}}
        onIPv6Change={() => {}}
        ipv4Error="Invalid IPv4"
        ipv6Error="Invalid IPv6"
      />,
    );

    expect(screen.getByText("Invalid IPv4")).toBeInTheDocument();
    expect(screen.getByText("Invalid IPv6")).toBeInTheDocument();
  });
});

describe("IPCalculator", () => {
  it("renders subnet calculator", () => {
    render(<IPCalculator />);

    expect(screen.getByText(/Subnet Calculator/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CIDR Notation/i)).toBeInTheDocument();
  });

  it("calculates subnet information for valid CIDR", async () => {
    const user = userEvent.setup();

    render(<IPCalculator />);

    const input = screen.getByLabelText(/CIDR Notation/i);
    await user.type(input, "10.0.0.0/8");

    await waitFor(() => {
      expect(screen.getByText(/Network Address/i)).toBeInTheDocument();
      expect(screen.getByText("10.0.0.0")).toBeInTheDocument();
      expect(screen.getByText(/Broadcast Address/i)).toBeInTheDocument();
      expect(screen.getByText("10.255.255.255")).toBeInTheDocument();
      expect(screen.getByText(/Subnet Mask/i)).toBeInTheDocument();
      expect(screen.getByText("255.0.0.0")).toBeInTheDocument();
    });
  });

  it("shows binary representation", async () => {
    const user = userEvent.setup();

    render(<IPCalculator />);

    const input = screen.getByLabelText(/CIDR Notation/i);
    await user.type(input, "192.168.1.0/24");

    await waitFor(() => {
      expect(screen.getByText(/Binary IP/i)).toBeInTheDocument();
      expect(screen.getByText(/Binary Mask/i)).toBeInTheDocument();
    });
  });

  it("shows usable hosts calculation", async () => {
    const user = userEvent.setup();

    render(<IPCalculator />);

    const input = screen.getByLabelText(/CIDR Notation/i);
    await user.type(input, "192.168.1.0/24");

    await waitFor(() => {
      expect(screen.getByText(/Usable Hosts/i)).toBeInTheDocument();
      expect(screen.getByText("254")).toBeInTheDocument(); // 256 - 2
    });
  });
});

describe("IPAddressDisplay", () => {
  it("displays IPv4 address with badge", () => {
    render(<IPAddressDisplay ipv4="192.168.1.100" showBadges={true} />);

    expect(screen.getByText("192.168.1.100")).toBeInTheDocument();
    expect(screen.getByText("IPv4")).toBeInTheDocument();
  });

  it("displays IPv6 address with badge", () => {
    render(<IPAddressDisplay ipv6="2001:db8::1" showBadges={true} />);

    expect(screen.getByText("2001:db8::1")).toBeInTheDocument();
    expect(screen.getByText("IPv6")).toBeInTheDocument();
  });

  it("displays both IPv4 and IPv6 in inline layout", () => {
    render(<IPAddressDisplay ipv4="10.0.0.1" ipv6="2001:db8::1" layout="inline" />);

    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("2001:db8::1")).toBeInTheDocument();
  });

  it("compresses IPv6 when compress is true", () => {
    render(<IPAddressDisplay ipv6="2001:0db8:0000:0000:0000:0000:0000:0001" compress={true} />);

    expect(screen.getByText("2001:db8::1")).toBeInTheDocument();
  });

  it("detects private IPv4 addresses", () => {
    render(<IPAddressDisplay ipv4="192.168.1.1" showBadges={true} />);

    expect(screen.getByText(/Private/i)).toBeInTheDocument();
  });

  it("detects ULA IPv6 addresses", () => {
    render(<IPAddressDisplay ipv6="fc00::1" showBadges={true} />);

    expect(screen.getByText(/ULA/i)).toBeInTheDocument();
  });

  it("uses card layout when specified", () => {
    const { container } = render(<IPAddressDisplay ipv4="10.0.0.1" layout="card" />);

    expect(container.querySelector(".card")).toBeInTheDocument();
  });
});

describe("DualStackBadge", () => {
  it('shows "Dual-Stack" when both IPs provided', () => {
    render(<DualStackBadge ipv4="192.168.1.1" ipv6="2001:db8::1" />);

    expect(screen.getByText("Dual-Stack")).toBeInTheDocument();
  });

  it('shows "IPv4 Only" when only IPv4 provided', () => {
    render(<DualStackBadge ipv4="192.168.1.1" />);

    expect(screen.getByText("IPv4 Only")).toBeInTheDocument();
  });

  it('shows "IPv6 Only" when only IPv6 provided', () => {
    render(<DualStackBadge ipv6="2001:db8::1" />);

    expect(screen.getByText("IPv6 Only")).toBeInTheDocument();
  });

  it('shows "No IP" when neither provided', () => {
    render(<DualStackBadge />);

    expect(screen.getByText("No IP")).toBeInTheDocument();
  });
});
