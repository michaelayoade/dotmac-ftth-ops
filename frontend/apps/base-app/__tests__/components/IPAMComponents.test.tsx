/**
 * Component Tests for IPAM Management Components
 *
 * Tests prefix list, IP address list, allocation dialogs, and dashboard
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { PrefixList } from '@/components/ipam/PrefixList';
import { IPAddressList } from '@/components/ipam/IPAddressList';
import { AllocateIPDialog } from '@/components/ipam/AllocateIPDialog';
import { IPAMDashboard } from '@/components/ipam/IPAMDashboard';

// Mock data
const mockPrefixes = [
  {
    id: 1,
    prefix: '192.168.1.0/24',
    family: 'ipv4' as const,
    status: 'active' as const,
    description: 'Office Network',
    vlan_id: 100,
    tenant: 'default',
    allocated_ips: 50,
    total_ips: 254,
  },
  {
    id: 2,
    prefix: '2001:db8::/64',
    family: 'ipv6' as const,
    status: 'active' as const,
    description: 'IPv6 Network',
    allocated_ips: 10,
    total_ips: null, // IPv6 doesn't track total
  },
];

const mockIPAddresses = [
  {
    id: 100,
    address: '192.168.1.10',
    family: 'ipv4' as const,
    status: 'active' as const,
    dns_name: 'server1.example.com',
    description: 'Web Server',
    tenant: 'default',
  },
  {
    id: 200,
    address: '2001:db8::10',
    family: 'ipv6' as const,
    status: 'active' as const,
    dns_name: 'server1.example.com',
    description: 'Web Server',
    tenant: 'default',
  },
  {
    id: 101,
    address: '192.168.1.20',
    family: 'ipv4' as const,
    status: 'active' as const,
    dns_name: 'server2.example.com',
    description: 'Database Server',
    tenant: 'default',
  },
];

describe('PrefixList', () => {
  it('renders list of prefixes', () => {
    render(
      <PrefixList
        prefixes={mockPrefixes}
        onCreatePrefix={() => {}}
        onAllocateIP={() => {}}
      />
    );

    expect(screen.getByText('192.168.1.0/24')).toBeInTheDocument();
    expect(screen.getByText('2001:db8::/64')).toBeInTheDocument();
  });

  it('shows family badges for prefixes', () => {
    render(
      <PrefixList
        prefixes={mockPrefixes}
        onCreatePrefix={() => {}}
        onAllocateIP={() => {}}
      />
    );

    const ipv4Badges = screen.getAllByText('IPv4');
    const ipv6Badges = screen.getAllByText('IPv6');

    expect(ipv4Badges.length).toBeGreaterThan(0);
    expect(ipv6Badges.length).toBeGreaterThan(0);
  });

  it('displays capacity information for IPv4', () => {
    render(
      <PrefixList
        prefixes={mockPrefixes}
        onCreatePrefix={() => {}}
        onAllocateIP={() => {}}
      />
    );

    // Should show 50/254 allocated
    expect(screen.getByText(/50.*254/)).toBeInTheDocument();
  });

  it('filters prefixes by family', async () => {
    const user = userEvent.setup();

    render(
      <PrefixList
        prefixes={mockPrefixes}
        onCreatePrefix={() => {}}
        onAllocateIP={() => {}}
      />
    );

    // Initially shows both
    expect(screen.getByText('192.168.1.0/24')).toBeInTheDocument();
    expect(screen.getByText('2001:db8::/64')).toBeInTheDocument();

    // Filter to IPv4 only
    const ipv4Filter = screen.getByRole('button', { name: /IPv4/ });
    await user.click(ipv4Filter);

    expect(screen.getByText('192.168.1.0/24')).toBeInTheDocument();
    expect(screen.queryByText('2001:db8::/64')).not.toBeInTheDocument();
  });

  it('searches prefixes by description', async () => {
    const user = userEvent.setup();

    render(
      <PrefixList
        prefixes={mockPrefixes}
        onCreatePrefix={() => {}}
        onAllocateIP={() => {}}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search/i);
    await user.type(searchInput, 'Office');

    expect(screen.getByText('192.168.1.0/24')).toBeInTheDocument();
    expect(screen.queryByText('2001:db8::/64')).not.toBeInTheDocument();
  });

  it('calls onCreatePrefix when create button clicked', async () => {
    const user = userEvent.setup();
    const onCreatePrefix = jest.fn();

    render(
      <PrefixList
        prefixes={mockPrefixes}
        onCreatePrefix={onCreatePrefix}
        onAllocateIP={() => {}}
      />
    );

    const createButton = screen.getByRole('button', { name: /Create Prefix/i });
    await user.click(createButton);

    expect(onCreatePrefix).toHaveBeenCalled();
  });

  it('calls onAllocateIP when allocate button clicked', async () => {
    const user = userEvent.setup();
    const onAllocateIP = jest.fn();

    render(
      <PrefixList
        prefixes={mockPrefixes}
        onCreatePrefix={() => {}}
        onAllocateIP={onAllocateIP}
      />
    );

    const allocateButtons = screen.getAllByRole('button', { name: /Allocate IP/i });
    await user.click(allocateButtons[0]);

    expect(onAllocateIP).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('shows utilization progress bar', () => {
    render(
      <PrefixList
        prefixes={mockPrefixes}
        onCreatePrefix={() => {}}
        onAllocateIP={() => {}}
      />
    );

    // Should have progress bars for IPv4 prefixes
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBeGreaterThan(0);
  });

  it('shows warning color for high utilization', () => {
    const highUtilizationPrefix = [
      {
        id: 1,
        prefix: '10.0.0.0/24',
        family: 'ipv4' as const,
        status: 'active' as const,
        allocated_ips: 230, // >90%
        total_ips: 254,
      },
    ];

    const { container } = render(
      <PrefixList
        prefixes={highUtilizationPrefix}
        onCreatePrefix={() => {}}
        onAllocateIP={() => {}}
      />
    );

    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
  });
});

describe('IPAddressList', () => {
  it('renders list of IP addresses', () => {
    render(<IPAddressList addresses={mockIPAddresses} />);

    expect(screen.getByText('192.168.1.10')).toBeInTheDocument();
    expect(screen.getByText('2001:db8::10')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.20')).toBeInTheDocument();
  });

  it('groups dual-stack IPs by DNS name', () => {
    render(<IPAddressList addresses={mockIPAddresses} />);

    // server1.example.com should appear once (grouped)
    const server1Elements = screen.getAllByText('server1.example.com');
    expect(server1Elements.length).toBe(1);

    // Should show both IPs under same DNS name
    const container = server1Elements[0].closest('div');
    expect(container).toHaveTextContent('192.168.1.10');
    expect(container).toHaveTextContent('2001:db8::10');
  });

  it('shows dual-stack badge for grouped IPs', () => {
    render(<IPAddressList addresses={mockIPAddresses} />);

    expect(screen.getByText('Dual-Stack')).toBeInTheDocument();
  });

  it('shows copy button for each IP', () => {
    render(<IPAddressList addresses={mockIPAddresses} />);

    const copyButtons = screen.getAllByRole('button', { name: /Copy/i });
    expect(copyButtons.length).toBeGreaterThan(0);
  });

  it('copies IP to clipboard when copy button clicked', async () => {
    const user = userEvent.setup();

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(),
      },
    });

    render(<IPAddressList addresses={mockIPAddresses} />);

    const copyButtons = screen.getAllByRole('button', { name: /Copy/i });
    await user.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('filters IPs by family', async () => {
    const user = userEvent.setup();

    render(<IPAddressList addresses={mockIPAddresses} />);

    // Filter to IPv4
    const ipv4Filter = screen.getByRole('button', { name: /IPv4 Only/i });
    await user.click(ipv4Filter);

    expect(screen.getByText('192.168.1.10')).toBeInTheDocument();
    expect(screen.queryByText('2001:db8::10')).not.toBeInTheDocument();
  });

  it('searches IPs by DNS name', async () => {
    const user = userEvent.setup();

    render(<IPAddressList addresses={mockIPAddresses} />);

    const searchInput = screen.getByPlaceholderText(/Search/i);
    await user.type(searchInput, 'server2');

    expect(screen.getByText('192.168.1.20')).toBeInTheDocument();
    expect(screen.queryByText('192.168.1.10')).not.toBeInTheDocument();
  });

  it('shows status badges', () => {
    render(<IPAddressList addresses={mockIPAddresses} />);

    const activeStatus = screen.getAllByText('Active');
    expect(activeStatus.length).toBeGreaterThan(0);
  });

  it('handles empty IP list', () => {
    render(<IPAddressList addresses={[]} />);

    expect(screen.getByText(/No IP addresses/i)).toBeInTheDocument();
  });
});

describe('AllocateIPDialog', () => {
  it('renders dialog when open', () => {
    render(
      <AllocateIPDialog
        open={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        mode="single"
        prefixId={1}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Allocate IP/i)).toBeInTheDocument();
  });

  it('shows single allocation form in single mode', () => {
    render(
      <AllocateIPDialog
        open={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        mode="single"
        prefixId={1}
      />
    );

    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/DNS Name/i)).toBeInTheDocument();
  });

  it('shows dual-stack form in dual-stack mode', () => {
    render(
      <AllocateIPDialog
        open={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        mode="dual-stack"
        prefixId={1}
        ipv6PrefixId={2}
      />
    );

    expect(screen.getByText(/Dual-Stack/i)).toBeInTheDocument();
    expect(screen.getByText(/IPv4 and IPv6/i)).toBeInTheDocument();
  });

  it('shows bulk allocation form in bulk mode', () => {
    render(
      <AllocateIPDialog
        open={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        mode="bulk"
        prefixId={1}
      />
    );

    expect(screen.getByLabelText(/Number of IPs/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description Prefix/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(
      <AllocateIPDialog
        open={true}
        onClose={() => {}}
        onSubmit={onSubmit}
        mode="single"
        prefixId={1}
      />
    );

    const submitButton = screen.getByRole('button', { name: /Allocate/i });
    await user.click(submitButton);

    // Should show validation errors
    expect(screen.getByText(/required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits single allocation with correct data', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(
      <AllocateIPDialog
        open={true}
        onClose={() => {}}
        onSubmit={onSubmit}
        mode="single"
        prefixId={1}
      />
    );

    await user.type(screen.getByLabelText(/Description/i), 'Test Server');
    await user.type(screen.getByLabelText(/DNS Name/i), 'test.example.com');

    const submitButton = screen.getByRole('button', { name: /Allocate/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Test Server',
          dns_name: 'test.example.com',
        })
      );
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(
      <AllocateIPDialog
        open={true}
        onClose={() => {}}
        onSubmit={onSubmit}
        mode="single"
        prefixId={1}
      />
    );

    await user.type(screen.getByLabelText(/Description/i), 'Test');
    const submitButton = screen.getByRole('button', { name: /Allocate/i });
    await user.click(submitButton);

    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('auto-fills same DNS name for dual-stack', async () => {
    const user = userEvent.setup();

    render(
      <AllocateIPDialog
        open={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        mode="dual-stack"
        prefixId={1}
        ipv6PrefixId={2}
      />
    );

    const dnsInput = screen.getByLabelText(/DNS Name/i);
    await user.type(dnsInput, 'dual.example.com');

    // Should be used for both IPv4 and IPv6
    expect(dnsInput).toHaveValue('dual.example.com');
  });

  it('limits bulk allocation count', async () => {
    const user = userEvent.setup();

    render(
      <AllocateIPDialog
        open={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        mode="bulk"
        prefixId={1}
      />
    );

    const countInput = screen.getByLabelText(/Number of IPs/i);
    await user.type(countInput, '150'); // > max 100

    expect(screen.getByText(/maximum.*100/i)).toBeInTheDocument();
  });
});

describe('IPAMDashboard', () => {
  const mockStats = {
    total_prefixes: 25,
    ipv4_prefixes: 15,
    ipv6_prefixes: 10,
    total_ips: 5000,
    allocated_ips: 3500,
    utilization_percentage: 70,
  };

  it('renders dashboard with statistics', () => {
    render(<IPAMDashboard stats={mockStats} />);

    expect(screen.getByText('25')).toBeInTheDocument(); // total prefixes
    expect(screen.getByText('15')).toBeInTheDocument(); // IPv4 prefixes
    expect(screen.getByText('10')).toBeInTheDocument(); // IPv6 prefixes
  });

  it('shows utilization bar with correct percentage', () => {
    render(<IPAMDashboard stats={mockStats} />);

    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('shows green color for low utilization', () => {
    const lowUtilStats = { ...mockStats, utilization_percentage: 50 };
    const { container } = render(<IPAMDashboard stats={lowUtilStats} />);

    expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
  });

  it('shows yellow color for medium utilization', () => {
    const mediumUtilStats = { ...mockStats, utilization_percentage: 75 };
    const { container } = render(<IPAMDashboard stats={mediumUtilStats} />);

    expect(container.querySelector('.bg-yellow-500')).toBeInTheDocument();
  });

  it('shows red color for high utilization', () => {
    const highUtilStats = { ...mockStats, utilization_percentage: 95 };
    const { container } = render(<IPAMDashboard stats={highUtilStats} />);

    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
  });

  it('displays allocated vs total IPs', () => {
    render(<IPAMDashboard stats={mockStats} />);

    expect(screen.getByText(/3,500.*5,000/)).toBeInTheDocument();
  });
});
