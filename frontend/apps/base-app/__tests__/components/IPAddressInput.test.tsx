/**
 * Tests for IPAddressInput Component
 */

import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { IPAddressInput } from '@/components/forms/IPAddressInput';

describe('IPAddressInput', () => {
  it('should render with label', () => {
    render(
      <IPAddressInput
        value=""
        onChange={() => {}}
        label="IP Address"
      />
    );

    expect(screen.getByText('IP Address')).toBeInTheDocument();
  });

  it('should show IPv4 badge for valid IPv4 address', () => {
    render(
      <IPAddressInput
        value="192.168.1.1"
        onChange={() => {}}
        label="IP Address"
        showFamily={true}
      />
    );

    expect(screen.getByText('IPv4')).toBeInTheDocument();
  });

  it('should show IPv6 badge for valid IPv6 address', () => {
    render(
      <IPAddressInput
        value="2001:db8::1"
        onChange={() => {}}
        label="IP Address"
        showFamily={true}
      />
    );

    expect(screen.getByText('IPv6')).toBeInTheDocument();
  });

  it('should call onChange when input changes', () => {
    const handleChange = jest.fn();

    render(
      <IPAddressInput
        value=""
        onChange={handleChange}
        label="IP Address"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '192.168.1.1' } });

    expect(handleChange).toHaveBeenCalledWith('192.168.1.1');
  });

  it('should show validation error for invalid IP', () => {
    render(
      <IPAddressInput
        value="invalid"
        onChange={() => {}}
        label="IP Address"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(screen.getByText('Invalid IP address format')).toBeInTheDocument();
  });

  it('should show custom error message', () => {
    render(
      <IPAddressInput
        value="192.168.1.1"
        onChange={() => {}}
        label="IP Address"
        error="Custom error message"
      />
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('should reject IPv6 when allowIPv6 is false', () => {
    render(
      <IPAddressInput
        value="2001:db8::1"
        onChange={() => {}}
        label="IP Address"
        allowIPv4={true}
        allowIPv6={false}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(screen.getByText('IPv6 addresses are not allowed')).toBeInTheDocument();
  });

  it('should reject IPv4 when allowIPv4 is false', () => {
    render(
      <IPAddressInput
        value="192.168.1.1"
        onChange={() => {}}
        label="IP Address"
        allowIPv4={false}
        allowIPv6={true}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(screen.getByText('IPv4 addresses are not allowed')).toBeInTheDocument();
  });

  it('should show required indicator', () => {
    render(
      <IPAddressInput
        value=""
        onChange={() => {}}
        label="IP Address"
        required={true}
      />
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('should show help text', () => {
    const helpText = 'Enter a valid IP address';

    render(
      <IPAddressInput
        value=""
        onChange={() => {}}
        label="IP Address"
        helpText={helpText}
      />
    );

    expect(screen.getByText(helpText)).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <IPAddressInput
        value="192.168.1.1"
        onChange={() => {}}
        label="IP Address"
        disabled={true}
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });
});
