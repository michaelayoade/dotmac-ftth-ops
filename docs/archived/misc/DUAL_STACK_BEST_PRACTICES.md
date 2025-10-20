# Dual-Stack IPv4/IPv6 Best Practices

## Table of Contents

1. [Architecture Best Practices](#architecture-best-practices)
2. [IP Address Planning](#ip-address-planning)
3. [Security Considerations](#security-considerations)
4. [Performance Optimization](#performance-optimization)
5. [Operational Guidelines](#operational-guidelines)
6. [Monitoring and Alerting](#monitoring-and-alerting)
7. [Common Pitfalls](#common-pitfalls)

## Architecture Best Practices

### 1. Prefer Dual-Stack Over Single-Stack

**✅ DO:**
```python
# Provision new subscribers with dual-stack by default
subscriber_data = RADIUSSubscriberCreate(
    subscriber_id="sub123",
    username="user@example.com",
    password="secure_password",
    framed_ipv4_address="100.64.1.50",
    framed_ipv6_address="2001:db8::50",
    framed_ipv6_prefix="2001:db8::/64",
)
```

**❌ DON'T:**
```python
# Don't provision IPv4-only for new subscribers
subscriber_data = RADIUSSubscriberCreate(
    subscriber_id="sub123",
    username="user@example.com",
    password="secure_password",
    framed_ipv4_address="100.64.1.50",  # IPv4 only
)
```

**Reason:** IPv4 addresses are scarce. Dual-stack provides future-proofing and better connectivity options.

### 2. Use Automatic IP Allocation

**✅ DO:**
```python
# Let the system allocate IPs automatically
ipv4, ipv6 = await netbox.allocate_dual_stack_ips(
    ipv4_prefix_id=1,
    ipv6_prefix_id=2,
    description="Auto-allocated for subscriber",
)
```

**❌ DON'T:**
```python
# Manually specify IPs unless necessary
ipv4, ipv6 = await netbox.allocate_dual_stack_ips(
    ipv4_prefix_id=1,
    ipv6_prefix_id=2,
    manual_ipv4="100.64.1.X",  # Prone to conflicts
    manual_ipv6="2001:db8::X",
)
```

**Reason:** Automatic allocation prevents IP conflicts and optimizes prefix utilization.

### 3. Link Dual-Stack IPs with DNS Names

**✅ DO:**
```python
# Use same DNS name for both IPv4 and IPv6
ipv4, ipv6 = await netbox.allocate_dual_stack_ips(
    ipv4_prefix_id=1,
    ipv6_prefix_id=2,
    dns_name="subscriber123.isp.com",  # Same for both
)
```

**❌ DON'T:**
```python
# Don't use different DNS names
ipv4 = await netbox.allocate_ip(
    prefix_id=1,
    dns_name="subscriber123-ipv4.isp.com",  # Different
)
ipv6 = await netbox.allocate_ip(
    prefix_id=2,
    dns_name="subscriber123-ipv6.isp.com",  # Different
)
```

**Reason:** Same DNS name enables proper dual-stack operation and automatic A/AAAA record creation.

### 4. Handle Errors Gracefully

**✅ DO:**
```python
async def provision_subscriber_with_fallback(data: SubscriberData):
    """Provision with fallback to IPv4-only if IPv6 fails."""
    try:
        # Try dual-stack first
        ipv4, ipv6 = await allocate_dual_stack_ips(...)
        return create_subscriber(ipv4, ipv6)
    except IPv6AllocationError:
        # Fallback to IPv4 if IPv6 unavailable
        logger.warning("IPv6 allocation failed, using IPv4 only")
        ipv4 = await allocate_ipv4_only(...)
        return create_subscriber(ipv4, None)
```

**❌ DON'T:**
```python
# Don't fail entirely if IPv6 unavailable
async def provision_subscriber_strict(data: SubscriberData):
    ipv4, ipv6 = await allocate_dual_stack_ips(...)
    # Raises exception if IPv6 fails, blocking provisioning
    return create_subscriber(ipv4, ipv6)
```

**Reason:** IPv6 may not be available in all locations. Graceful degradation ensures service continuity.

## IP Address Planning

### 1. IPv6 Prefix Allocation Strategy

**Recommended Prefix Sizes:**

| Use Case | IPv4 Prefix | IPv6 Prefix | Rationale |
|----------|-------------|-------------|-----------|
| **Residential Subscribers** | /32 (1 IP) | /64 (18 quintillion) | Supports multiple devices, IoT |
| **Business Subscribers** | /29 (8 IPs) | /56 (256 subnets) | Multiple VLANs, subnetting |
| **Point-to-Point Links** | /30 (2 IPs) | /127 (2 IPs) | Conserve addresses |
| **Server Infrastructure** | /24 (254 IPs) | /48 (65,536 subnets) | Large-scale deployment |

**Example Allocation Hierarchy:**

```
ISP IPv6 Allocation: 2001:db8::/32
│
├─► Region A: 2001:db8:0::/40
│   ├─► City 1: 2001:db8:0:0::/44
│   │   ├─► Residential: 2001:db8:0:0::/48 (/64 per subscriber)
│   │   └─► Business: 2001:db8:0:1::/48 (/56 per subscriber)
│   └─► City 2: 2001:db8:0:10::/44
│
└─► Region B: 2001:db8:1::/40
    └─► ...
```

### 2. IPv4 Conservation with IPv6

**✅ DO:**
```python
# Use Carrier-Grade NAT (CGN) IPv4 with public IPv6
subscriber_data = RADIUSSubscriberCreate(
    framed_ipv4_address="100.64.1.50",  # CGN (RFC 6598)
    framed_ipv6_address="2001:db8::50",  # Public IPv6
)
```

**Benefits:**
- Conserve public IPv4 addresses
- Provide native IPv6 connectivity
- Support IPv4-only applications via NAT

### 3. Prefix Delegation for CPE

**✅ DO:**
```python
# Delegate /56 or /64 to customer's router
subscriber_data = RADIUSSubscriberCreate(
    framed_ipv6_address="2001:db8:100::1/128",  # WAN interface
    delegated_ipv6_prefix="2001:db8:100::/56",  # LAN subnets
)
```

**Customer Router Can Then:**
- Assign 2001:db8:100:1::/64 to LAN 1
- Assign 2001:db8:100:2::/64 to LAN 2
- Assign 2001:db8:100:3::/64 to Guest WiFi

## Security Considerations

### 1. Firewall Rules for Dual-Stack

**IPv4 Firewall:**
```bash
# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Block direct access to CPE management
iptables -A INPUT -p tcp --dport 22 -s 100.64.0.0/16 -j DROP
```

**IPv6 Firewall (Don't Forget!):**
```bash
# Allow HTTP/HTTPS
ip6tables -A INPUT -p tcp --dport 80 -j ACCEPT
ip6tables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow ICMPv6 (required for IPv6!)
ip6tables -A INPUT -p ipv6-icmp -j ACCEPT

# Block direct access to CPE management
ip6tables -A INPUT -p tcp --dport 22 -s 2001:db8::/32 -j DROP
```

**⚠️ WARNING:** Always configure **both** IPv4 and IPv6 firewalls! A common mistake is securing IPv4 while leaving IPv6 wide open.

### 2. Rate Limiting

**✅ DO:**
```python
# Apply rate limits to both protocols
rate_limits = {
    "ipv4": {
        "download": "100M",
        "upload": "50M",
    },
    "ipv6": {
        "download": "100M",
        "upload": "50M",
    },
}
```

### 3. Prefix Filtering

**Prevent Spoofing:**
```bash
# Only allow customer's assigned prefix
ip6tables -A INPUT -s 2001:db8:100::/56 -j ACCEPT
ip6tables -A INPUT -j DROP  # Block all other sources
```

### 4. Disable IPv6 Privacy Extensions on Servers

```bash
# On server interfaces, use static addresses
net.ipv6.conf.all.use_tempaddr = 0
net.ipv6.conf.default.use_tempaddr = 0
```

**Reason:** Privacy extensions randomize addresses, breaking monitoring and access control.

## Performance Optimization

### 1. DNS Optimization

**Use Happy Eyeballs (RFC 8305):**
- Return both A (IPv4) and AAAA (IPv6) records
- Let client choose fastest protocol

```python
# DNS Configuration
dns_records = {
    "subscriber123.isp.com": {
        "A": "100.64.1.50",
        "AAAA": "2001:db8::50",
    }
}
```

**Client Behavior:**
- Tries IPv6 first (if available)
- Falls back to IPv4 if IPv6 fails within 250ms
- Results in better user experience

### 2. MTU Configuration

**IPv6 Requires Larger MTU:**

```python
# WireGuard dual-stack configuration
wireguard_config = {
    "mtu": 1420,  # Safe for both IPv4 and IPv6
}
```

**Path MTU Discovery:**
```bash
# Enable PMTUD for IPv6
net.ipv6.conf.all.mtu = 1500
```

### 3. Connection Tracking

**Optimize Conntrack for Dual-Stack:**

```bash
# Increase conntrack table size
net.netfilter.nf_conntrack_max = 262144

# Separate conntrack for IPv4 and IPv6
net.netfilter.nf_conntrack_ipv4_hashsize = 65536
net.netfilter.nf_conntrack_ipv6_hashsize = 65536
```

### 4. Routing Optimization

**Use Equal-Cost Multipath (ECMP):**

```bash
# Balance traffic across IPv4 and IPv6 uplinks
ip route add default \
  nexthop via 10.0.0.1 weight 1 \
  nexthop via 10.0.0.2 weight 1

ip -6 route add default \
  nexthop via 2001:db8::1 weight 1 \
  nexthop via 2001:db8::2 weight 1
```

## Operational Guidelines

### 1. Monitoring Both Protocols

**✅ DO:**
```python
# Monitor connectivity for both protocols
async def check_subscriber_connectivity(subscriber_id: str):
    """Check both IPv4 and IPv6 connectivity."""

    subscriber = await get_subscriber(subscriber_id)

    results = {
        "ipv4": await ping(subscriber.framed_ipv4_address),
        "ipv6": await ping6(subscriber.framed_ipv6_address),
    }

    return results
```

**Dashboard Metrics:**
- IPv4 packet loss %
- IPv6 packet loss %
- IPv4 latency (ms)
- IPv6 latency (ms)
- Dual-stack adoption %

### 2. Logging and Debugging

**Log Both IP Versions:**
```python
logger.info(
    f"Subscriber {subscriber_id} connected",
    extra={
        "ipv4": subscriber.framed_ipv4_address,
        "ipv6": subscriber.framed_ipv6_address,
        "protocol": "dual-stack" if both else "single-stack",
    }
)
```

**Troubleshooting Commands:**
```bash
# Test IPv4 connectivity
ping -c 3 100.64.1.50

# Test IPv6 connectivity
ping6 -c 3 2001:db8::50

# Trace IPv6 route
traceroute6 2001:db8::50

# Check IPv6 neighbors
ip -6 neigh show
```

### 3. Change Management

**Document All Changes:**

```markdown
# Change Request: Enable Dual-Stack for Region A

**Date:** 2025-01-15
**Region:** Region A (Cities 1-5)
**Impact:** 10,000 subscribers

**Changes:**
- Allocate IPv6 prefix: 2001:db8:0::/40
- Enable dual-stack provisioning
- Update RADIUS configuration
- Deploy WireGuard dual-stack

**Rollback Plan:**
- Disable IPv6 provisioning
- Continue IPv4-only operation
- No customer impact

**Validation:**
- Monitor IPv6 adoption for 48 hours
- Check for connectivity issues
- Verify firewall rules applied
```

### 4. Customer Communication

**Notify Customers About IPv6:**

```
Subject: Your Internet Connection Now Supports IPv6

Dear Customer,

We're pleased to announce that your internet connection now supports
IPv6, the next generation of internet protocol.

What this means for you:
✓ Better connectivity to modern websites and services
✓ Improved performance for IPv6-enabled applications
✓ Future-proof internet access

Your services:
- IPv4 Address: 100.64.1.50
- IPv6 Address: 2001:db8::50
- IPv6 Prefix: 2001:db8:100::/64

No action required. Your devices will automatically use IPv6 when available.

For questions, contact support@isp.com

Best regards,
Your ISP Team
```

## Monitoring and Alerting

### 1. Key Metrics to Monitor

```python
# Dual-Stack Adoption Metrics
metrics = {
    "dual_stack_subscribers": 5432,
    "ipv4_only_subscribers": 2100,
    "ipv6_only_subscribers": 50,
    "dual_stack_percentage": 69.4,

    "ipv6_traffic_percentage": 45.2,  # % of total traffic
    "ipv6_prefix_utilization": 12.5,  # % of /32 used

    "avg_ipv6_latency_ms": 15.2,
    "avg_ipv4_latency_ms": 18.7,

    "ipv6_connectivity_uptime": 99.95,
    "ipv4_connectivity_uptime": 99.93,
}
```

### 2. Alert Thresholds

```python
# Alert Configuration
alerts = {
    "ipv6_prefix_utilization_high": {
        "threshold": 80,  # Alert at 80% utilization
        "severity": "warning",
    },
    "ipv6_connectivity_down": {
        "threshold": 95,  # Alert if uptime < 95%
        "severity": "critical",
    },
    "dual_stack_provisioning_failure_rate": {
        "threshold": 5,  # Alert if >5% fail
        "severity": "warning",
    },
}
```

### 3. Health Check Endpoints

```python
@app.get("/health/ipv6")
async def ipv6_health_check():
    """Check IPv6 system health."""

    health = {
        "status": "healthy",
        "checks": {
            "ipv6_prefix_available": True,
            "netbox_ipv6_responsive": True,
            "radius_ipv6_attributes": True,
            "wireguard_ipv6_enabled": True,
        },
        "metrics": {
            "ipv6_allocations_last_hour": 42,
            "ipv6_provisioning_success_rate": 99.2,
        },
    }

    return health
```

## Common Pitfalls

### 1. Forgetting to Update Firewall Rules

**Problem:** IPv6 enabled but firewall not updated, exposing services.

**Solution:** Always update both IPv4 and IPv6 firewalls together.

### 2. Not Enabling ICMPv6

**Problem:** IPv6 connectivity broken because ICMPv6 is blocked.

**Solution:** Always allow ICMPv6 (it's required for IPv6 operation):
```bash
ip6tables -A INPUT -p ipv6-icmp -j ACCEPT
```

### 3. Using Link-Local Addresses Incorrectly

**Problem:** Assigning fe80::/10 addresses to subscribers.

**Solution:** Link-local addresses (fe80::/10) are for local network only. Use:
- Public IPv6 (2000::/3) for internet-routable addresses
- ULA (fc00::/7) for private networks

### 4. Not Planning for Prefix Exhaustion

**Problem:** Running out of IPv6 prefixes (yes, it can happen!).

**Solution:** Plan prefix hierarchy carefully:
```python
# Monitor prefix utilization
if ipv6_prefix_utilization > 80:
    alert("Request additional IPv6 allocation from RIR")
```

### 5. Mixing IPv4 and IPv6 DNS Names

**Problem:** Different DNS names for IPv4 and IPv6, breaking dual-stack.

**Solution:** Always use same DNS name for both protocols.

### 6. Not Testing IPv6-Only Networks

**Problem:** Assuming IPv4 will always be available.

**Solution:** Test on IPv6-only networks (many mobile carriers):
```python
# Test subscriber can work with IPv6 only
test_subscriber = create_subscriber(
    framed_ipv4_address=None,  # No IPv4
    framed_ipv6_address="2001:db8::100",
)
```

### 7. Ignoring Path MTU Discovery

**Problem:** IPv6 packets larger than MTU get dropped silently.

**Solution:** Enable PMTUD and use appropriate MTU:
```python
wireguard_server = create_server(
    mtu=1420,  # Safe for both protocols
)
```

## Summary Checklist

**Before Deploying Dual-Stack:**

- [ ] IPv6 prefix allocated from RIR
- [ ] NetBox configured with IPv6 prefixes
- [ ] Both IPv4 and IPv6 firewall rules configured
- [ ] ICMPv6 allowed in firewall
- [ ] DNS returns both A and AAAA records
- [ ] Monitoring configured for both protocols
- [ ] Alert thresholds configured
- [ ] Rollback plan documented
- [ ] Customer communication prepared
- [ ] Staff trained on IPv6 troubleshooting

**After Deploying Dual-Stack:**

- [ ] Monitor IPv6 adoption metrics
- [ ] Check for connectivity issues
- [ ] Verify firewall rules effective
- [ ] Review prefix utilization
- [ ] Gather customer feedback
- [ ] Update documentation
- [ ] Schedule regular IPv6 audits

---

**Last Updated:** January 2025
**Version:** 1.0.0
