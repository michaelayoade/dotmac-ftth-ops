# Dual-Stack IPv4/IPv6 Troubleshooting Playbooks

## Table of Contents

1. [Subscriber Cannot Connect](#subscriber-cannot-connect)
2. [IPv6 Not Working (IPv4 Works)](#ipv6-not-working-ipv4-works)
3. [High Latency Issues](#high-latency-issues)
4. [IP Allocation Failures](#ip-allocation-failures)
5. [RADIUS Authentication Failures](#radius-authentication-failures)
6. [WireGuard VPN Connection Issues](#wireguard-vpn-connection-issues)
7. [NetBox Integration Issues](#netbox-integration-issues)
8. [Metrics Not Updating](#metrics-not-updating)

---

## Subscriber Cannot Connect

### Symptoms
- Customer reports no internet connection
- Both IPv4 and IPv6 not working
- RADIUS authentication may fail

### Diagnostic Steps

#### 1. Verify Subscriber Exists
```bash
# Check if subscriber exists in database
curl https://api.example.com/api/v1/radius/subscribers/{subscriber_id} \
  -H "Authorization: Bearer $API_TOKEN"

# Expected: HTTP 200 with subscriber details
# If 404: Subscriber not found → Create subscriber
```

#### 2. Check RADIUS Authentication
```bash
# Test RADIUS authentication
docker exec -it freeradius radtest \
  username password \
  localhost:1812 0 testing123

# Expected: Access-Accept
# If Access-Reject: Check password, account status
```

#### 3. Verify IP Addresses Allocated
```bash
# Get subscriber details
curl https://api.example.com/api/v1/radius/subscribers/{subscriber_id} \
  -H "Authorization: Bearer $API_TOKEN" | \
  jq '{ipv4: .framed_ipv4_address, ipv6: .framed_ipv6_address}'

# Expected: Both IPs present
# If null: IPs not allocated → Allocate IPs
```

#### 4. Test Network Connectivity
```bash
# Ping IPv4 address
ping -c 4 {subscriber_ipv4}

# Ping IPv6 address
ping6 -c 4 {subscriber_ipv6}

# Expected: 0% packet loss
# If 100% loss: Network/routing issue
```

#### 5. Check RADIUS Server Logs
```bash
# Check recent authentication attempts
docker logs freeradius --tail=100 | grep {username}

# Look for:
# - "Auth: Login OK" → Authentication successful
# - "Auth: Invalid user" → User not found
# - "Auth: Login incorrect" → Wrong password
```

### Common Causes and Fixes

| Issue | Symptoms | Fix |
|-------|----------|-----|
| **Subscriber not provisioned** | 404 Not Found | Provision subscriber with dual-stack IPs |
| **Wrong password** | Access-Reject | Reset password: `POST /api/v1/radius/subscribers/{id}/reset-password` |
| **Account suspended** | Access-Reject | Unsuspend: `POST /api/v1/radius/subscribers/{id}/unsuspend` |
| **IP conflict** | Intermittent connectivity | Check for duplicate IPs in NetBox, reallocate |
| **Firewall blocking** | Ping fails | Check firewall rules, ensure ICMP allowed |
| **RADIUS service down** | Connection timeout | Restart RADIUS: `docker restart freeradius` |

### Resolution Steps

**If Subscriber Not Provisioned:**
```bash
# Provision subscriber with auto-allocation
curl -X POST https://api.example.com/api/v1/radius/subscribers \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriber_id": "SUB-12345",
    "username": "customer@example.com",
    "password": "SecureP@ssw0rd!",
    "auto_allocate_ipv4": true,
    "auto_allocate_ipv6": true,
    "download_speed": "100M",
    "upload_speed": "50M"
  }'
```

**If Wrong Password:**
```bash
# Reset password
curl -X POST https://api.example.com/api/v1/radius/subscribers/{id}/reset-password \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_password": "NewSecureP@ssw0rd!"}'
```

**If RADIUS Service Down:**
```bash
# Check RADIUS container status
docker ps | grep freeradius

# Restart if not running
docker restart freeradius

# Check logs for errors
docker logs freeradius --tail=50
```

### Escalation
If issue persists after above steps:
1. Capture full diagnostic output
2. Create incident ticket with details
3. Escalate to senior network engineer
4. Notify customer of estimated resolution time

---

## IPv6 Not Working (IPv4 Works)

### Symptoms
- Customer can connect via IPv4
- IPv6 connectivity fails
- `ping6` to subscriber fails
- No AAAA DNS records resolving

### Diagnostic Steps

#### 1. Verify IPv6 Address Allocated
```bash
# Check subscriber has IPv6
curl https://api.example.com/api/v1/radius/subscribers/{subscriber_id} \
  -H "Authorization: Bearer $API_TOKEN" | \
  jq '.framed_ipv6_address'

# Expected: IPv6 address (e.g., "2001:db8::50")
# If null: IPv6 not allocated
```

#### 2. Test IPv6 Connectivity
```bash
# Ping IPv6 address
ping6 -c 4 {subscriber_ipv6}

# Traceroute IPv6
traceroute6 {subscriber_ipv6}

# Expected: Successful ping
# If fails: Routing or firewall issue
```

#### 3. Check IPv6 Routing
```bash
# Verify IPv6 route exists
ssh core-router.example.com
show ipv6 route {subscriber_ipv6_prefix}

# Expected: Route present
# If missing: Add route
```

#### 4. Check Firewall Rules
```bash
# Verify IPv6 not blocked
ssh firewall.example.com
show security policies | match ipv6

# Check for ICMPv6 (REQUIRED for IPv6)
show security policies | match icmpv6

# Expected: ICMPv6 allowed
# If denied: Update firewall rules
```

#### 5. Verify DNS AAAA Records
```bash
# Check AAAA record exists
dig {subscriber_dns_name} AAAA

# Expected: AAAA record with IPv6 address
# If no record: Add DNS record
```

### Common Causes and Fixes

| Issue | Diagnostic | Fix |
|-------|------------|-----|
| **IPv6 not allocated** | `framed_ipv6_address` is null | Allocate IPv6: `PATCH /subscribers/{id}` with IPv6 address |
| **ICMPv6 blocked** | ping6 fails, traceroute6 fails | Enable ICMPv6 on firewall (REQUIRED for IPv6) |
| **Missing route** | Route not in routing table | Add route: `ipv6 route {prefix} {next-hop}` |
| **MTU issues** | Large packets fail, small packets work | Adjust MTU: `ip link set dev eth0 mtu 1280` (IPv6 minimum) |
| **No AAAA record** | DNS lookup fails | Add AAAA record in DNS |
| **RA not working** | Clients don't get IPv6 | Enable RA: `ipv6 nd ra enable` on gateway |

### Resolution Steps

**If IPv6 Not Allocated:**
```bash
# Allocate IPv6 for existing subscriber
curl -X PATCH https://api.example.com/api/v1/radius/subscribers/{id} \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "framed_ipv6_address": "2001:db8::50",
    "framed_ipv6_prefix": "2001:db8:100::/64",
    "delegated_ipv6_prefix": "2001:db8:200::/56"
  }'
```

**If ICMPv6 Blocked (CRITICAL FIX):**
```bash
# ICMPv6 is MANDATORY for IPv6 to function
# Neighbor Discovery, Path MTU Discovery, etc. require ICMPv6

ssh firewall.example.com
configure
set security policies from-zone trust to-zone internet policy allow-icmpv6 \
  match source-address any destination-address any application junos-icmpv6-all
set security policies from-zone trust to-zone internet policy allow-icmpv6 then permit
commit
```

**If MTU Issues:**
```bash
# IPv6 requires minimum MTU of 1280 bytes
# Adjust interface MTU
ip link set dev eth0 mtu 1280

# Enable Path MTU Discovery
sysctl -w net.ipv6.conf.all.mtu=1280

# Or configure MSS clamping
iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN \
  -j TCPMSS --set-mss 1220
```

**If Missing AAAA Record:**
```bash
# Add AAAA record
curl -X POST https://dns-api.example.com/zones/example.com/records \
  -H "Authorization: Bearer $DNS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "customer-id",
    "type": "AAAA",
    "content": "2001:db8::50",
    "ttl": 3600
  }'
```

### Validation
```bash
# Test IPv6 connectivity
ping6 -c 4 {subscriber_ipv6}

# Test DNS resolution
dig {subscriber_dns_name} AAAA

# Test from subscriber device (if accessible)
ssh subscriber-device
ping6 google.com
curl -6 https://ipv6.google.com
```

---

## High Latency Issues

### Symptoms
- Latency > 100ms (critical)
- Latency > 50ms (warning)
- Slow page loads reported by customers
- VoIP quality issues

### Diagnostic Steps

#### 1. Check Current Latency Metrics
```bash
# Get current latency
curl https://api.example.com/api/v1/metrics/dual-stack/current \
  -H "Authorization: Bearer $API_TOKEN" | \
  jq '.performance_metrics | {ipv4_latency: .avg_ipv4_latency_ms, ipv6_latency: .avg_ipv6_latency_ms}'

# Expected: < 50ms normal, < 100ms acceptable
```

#### 2. Identify Affected Protocol
```bash
# Compare IPv4 vs IPv6 latency
# If IPv4 only: IPv4 routing issue
# If IPv6 only: IPv6 routing issue
# If both: General network congestion or upstream
```

#### 3. Test Specific Devices
```bash
# Ping test with detailed stats
ping -c 20 {subscriber_ipv4} | tail -n 2

# Example output:
# 20 packets transmitted, 20 received, 0% packet loss, time 19023ms
# rtt min/avg/max/mdev = 45.123/98.456/150.789/25.678 ms

# If avg > 50ms: Investigate further
```

#### 4. Traceroute Analysis
```bash
# IPv4 traceroute
traceroute -n {subscriber_ipv4}

# IPv6 traceroute
traceroute6 -n {subscriber_ipv6}

# Look for:
# - High latency at specific hop (network issue at that hop)
# - Timeout at specific hop (firewall blocking traceroute)
# - Latency spike near subscriber (last-mile issue)
```

#### 5. Check for Network Congestion
```bash
# Check interface utilization
ssh core-router.example.com
show interfaces | include rate

# Example output:
# ge-0/0/0: Input rate: 950 Mbps, Output rate: 980 Mbps
# If > 90% utilization: Congestion likely

# Check queue drops
show interfaces queue
# If drops increasing: QoS issue or congestion
```

#### 6. Check for Asymmetric Routing
```bash
# Trace route to subscriber
traceroute {subscriber_ipv4}

# Trace route from subscriber (if accessible)
ssh subscriber-device
traceroute 8.8.8.8

# Compare paths - should be symmetric or near-symmetric
```

### Common Causes and Fixes

| Cause | Symptom | Fix |
|-------|---------|-----|
| **Interface congestion** | Consistent high latency, > 90% utilization | Upgrade link capacity or enable QoS |
| **BGP route flap** | Intermittent spikes | Stabilize BGP session, check peer |
| **QoS misconfiguration** | Specific traffic affected | Review QoS policies, prioritize critical traffic |
| **Upstream ISP issue** | Both IPv4/IPv6 affected | Contact ISP, check SLA |
| **DNS latency** | Initial connection slow | Use faster DNS servers, enable caching |
| **IPv6 suboptimal path** | IPv6 worse than IPv4 | Check BGP advertisements, prefer shorter AS path |
| **MTU/fragmentation** | Large packets slow | Adjust MTU, enable MSS clamping |

### Resolution Steps

**If Interface Congestion:**
```bash
# Short-term: Enable QoS
ssh core-router.example.com
configure
set class-of-service interfaces ge-0/0/0 scheduler-map traffic-map
commit

# Long-term: Upgrade link or add capacity
```

**If BGP Route Flap:**
```bash
# Check BGP sessions
ssh core-router.example.com
show bgp summary

# Look for:
# - State should be "Established"
# - Flaps should be 0 or low
# - If flapping: Investigate peer connection

# Check BGP logs
show log messages | match BGP | last 100
```

**If QoS Misconfiguration:**
```bash
# Review current QoS
show class-of-service interface ge-0/0/0

# Prioritize VoIP/video traffic
configure
set class-of-service forwarding-classes class realtime-priority queue-num 0
set class-of-service forwarding-classes class expedited-forwarding queue-num 1
set class-of-service forwarding-classes class best-effort queue-num 2
commit
```

**If DNS Latency:**
```bash
# Test DNS resolution time
time dig google.com

# If > 100ms: DNS server slow
# Switch to faster DNS (Google DNS, Cloudflare DNS)

# Update subscriber DNS
curl -X PATCH https://api.example.com/api/v1/radius/subscribers/{id} \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"dns_servers": ["8.8.8.8", "8.8.4.4", "2001:4860:4860::8888"]}'
```

### Validation
```bash
# Continuous ping test
ping -i 0.2 -c 100 {subscriber_ipv4} | tail -n 2

# Should show improved latency (< 50ms)

# Monitor for 24 hours to ensure stability
```

---

## IP Allocation Failures

### Symptoms
- Subscriber provisioning fails with "No available IPs"
- NetBox API returns 400/404 errors
- Automatic IP allocation fails

### Diagnostic Steps

#### 1. Check IP Pool Availability
```bash
# Check IPv4 pool utilization
curl https://api.example.com/api/v1/metrics/dual-stack/current \
  -H "Authorization: Bearer $API_TOKEN" | \
  jq '.ip_allocation_metrics.available_ipv4_addresses'

# Expected: > 1000 addresses available
# If < 100: Pool exhaustion imminent
```

#### 2. Verify NetBox Connectivity
```bash
# Test NetBox API
curl https://netbox.example.com/api/status/ \
  -H "Authorization: Token $NETBOX_TOKEN"

# Expected: HTTP 200
# If fails: NetBox service issue
```

#### 3. Check for IP Conflicts
```bash
# Search for duplicate IPs
curl "https://netbox.example.com/api/ipam/ip-addresses/?address={ip_address}" \
  -H "Authorization: Token $NETBOX_TOKEN" | jq '.count'

# Expected: 1
# If > 1: Duplicate IP entries (data corruption)
```

#### 4. Review Recent Allocations
```bash
# List recent allocations
curl "https://netbox.example.com/api/ipam/ip-addresses/?limit=50&ordering=-created" \
  -H "Authorization: Token $NETBOX_TOKEN" | \
  jq '.results[] | {address, created, description}'
```

### Common Causes and Fixes

| Cause | Diagnostic | Fix |
|-------|------------|-----|
| **Pool exhausted** | `available_ipv4_addresses` < 100 | Allocate new prefix or reclaim unused IPs |
| **NetBox service down** | API unreachable | Restart NetBox: `docker restart netbox` |
| **Invalid prefix configuration** | Prefix not marked as pool | Mark prefix as pool: `is_pool: true` |
| **Permission denied** | HTTP 403 | Check API token permissions |
| **IP conflict** | Duplicate IPs found | Delete duplicate entries |
| **Database lock** | Timeout errors | Check database performance, restart if needed |

### Resolution Steps

**If Pool Exhausted:**
```bash
# Option 1: Reclaim unused IPs
curl "https://netbox.example.com/api/ipam/ip-addresses/?status=deprecated" \
  -H "Authorization: Token $NETBOX_TOKEN"

# Delete deprecated IPs
for ip_id in {deprecated_ids}; do
  curl -X DELETE "https://netbox.example.com/api/ipam/ip-addresses/$ip_id/" \
    -H "Authorization: Token $NETBOX_TOKEN"
done

# Option 2: Add new prefix
curl -X POST https://netbox.example.com/api/ipam/prefixes/ \
  -H "Authorization: Token $NETBOX_TOKEN" \
  -d '{
    "prefix": "100.64.64.0/18",
    "description": "Additional subscriber pool",
    "is_pool": true,
    "status": "active"
  }'
```

**If NetBox Service Down:**
```bash
# Check container status
docker ps | grep netbox

# Check logs
docker logs netbox --tail=100

# Restart if needed
docker restart netbox netbox-worker

# Wait for service to be ready
while ! curl -s https://netbox.example.com/api/status/ > /dev/null; do
  echo "Waiting for NetBox..."
  sleep 5
done

echo "NetBox is ready"
```

**If IP Conflict:**
```bash
# Find duplicate IPs
curl "https://netbox.example.com/api/ipam/ip-addresses/?address={duplicate_ip}" \
  -H "Authorization: Token $NETBOX_TOKEN" | jq '.results'

# Identify which one to keep (usually most recent)
# Delete older duplicate
curl -X DELETE "https://netbox.example.com/api/ipam/ip-addresses/{old_id}/" \
  -H "Authorization: Token $NETBOX_TOKEN"
```

### Validation
```bash
# Test IP allocation
curl -X POST https://api.example.com/api/v1/radius/subscribers \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "subscriber_id": "TEST-12345",
    "username": "test@example.com",
    "password": "TestP@ssw0rd!",
    "auto_allocate_ipv4": true,
    "auto_allocate_ipv6": true
  }'

# Expected: HTTP 201 with allocated IPs

# Clean up test subscriber
curl -X DELETE https://api.example.com/api/v1/radius/subscribers/TEST-12345 \
  -H "Authorization: Bearer $API_TOKEN"
```

---

## RADIUS Authentication Failures

### Symptoms
- Access-Reject responses
- "Invalid user" or "Login incorrect" errors
- Subscribers cannot authenticate

### Diagnostic Steps

#### 1. Test RADIUS Authentication
```bash
# Test with radtest
docker exec -it freeradius radtest \
  {username} {password} \
  localhost:1812 0 testing123

# Expected: Access-Accept
# Actual: Access-Reject → Authentication failed
```

#### 2. Check Subscriber Exists
```bash
# Verify subscriber in database
curl https://api.example.com/api/v1/radius/subscribers?username={username} \
  -H "Authorization: Bearer $API_TOKEN"

# Expected: HTTP 200 with subscriber data
# If empty: Subscriber not found
```

#### 3. Check RADIUS Logs
```bash
# View detailed authentication logs
docker logs freeradius --tail=100 | grep {username}

# Look for specific errors:
# - "User not found" → Subscriber doesn't exist
# - "Password incorrect" → Wrong password
# - "Account locked" → Account suspended/disabled
```

#### 4. Verify RADIUS Database Sync
```bash
# Check radcheck table
docker exec -it postgres psql -U dotmac_user -d dotmac -c \
  "SELECT * FROM radcheck WHERE username = '{username}';"

# Expected: Row with username and password
# If empty: Database sync issue
```

### Common Causes and Fixes

| Cause | Error Message | Fix |
|-------|--------------|-----|
| **User not found** | "User not found" | Create subscriber in database |
| **Wrong password** | "Password incorrect" | Reset password |
| **Account suspended** | "Account locked" | Unsuspend account |
| **RADIUS service down** | Connection timeout | Restart RADIUS container |
| **Database connection lost** | "Database error" | Restart database or check connection |
| **Cert expired** (EAP-TLS) | "Certificate expired" | Renew certificates |

### Resolution Steps

**If User Not Found:**
```bash
# Create subscriber
curl -X POST https://api.example.com/api/v1/radius/subscribers \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "subscriber_id": "SUB-12345",
    "username": "{username}",
    "password": "{password}",
    "auto_allocate_ipv4": true,
    "auto_allocate_ipv6": true
  }'
```

**If Wrong Password:**
```bash
# Reset password
curl -X POST https://api.example.com/api/v1/radius/subscribers/{id}/reset-password \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"new_password": "{new_password}"}'

# Test authentication again
docker exec -it freeradius radtest \
  {username} {new_password} \
  localhost:1812 0 testing123
```

**If Account Suspended:**
```bash
# Check account status
curl https://api.example.com/api/v1/radius/subscribers/{id} \
  -H "Authorization: Bearer $API_TOKEN" | jq '.status'

# If "suspended", unsuspend:
curl -X POST https://api.example.com/api/v1/radius/subscribers/{id}/unsuspend \
  -H "Authorization: Bearer $API_TOKEN"
```

**If RADIUS Service Down:**
```bash
# Restart RADIUS
docker restart freeradius

# Wait for startup
sleep 10

# Test service
docker exec -it freeradius radtest test test localhost:1812 0 testing123
```

### Validation
```bash
# Test authentication
docker exec -it freeradius radtest \
  {username} {password} \
  localhost:1812 0 testing123

# Expected output:
# Received Access-Accept Id 123 from 127.0.0.1:1812 to 0.0.0.0:0 length 84
#   Framed-IP-Address = 100.64.1.50
#   Framed-IPv6-Address = 2001:db8::50
```

---

## WireGuard VPN Connection Issues

### Symptoms
- VPN connection fails
- Handshake timeout
- Peer cannot reach network

### Diagnostic Steps

#### 1. Check WireGuard Service
```bash
# Check WireGuard status
systemctl status wg-quick@wg0

# Expected: active (exited)
# If failed: Check configuration
```

#### 2. Verify Peer Configuration
```bash
# List configured peers
wg show wg0 peers

# Check specific peer
wg show wg0 peer {peer_public_key}

# Expected: latest handshake within last 2 minutes if active
```

#### 3. Test Connectivity to Server
```bash
# Test UDP port connectivity
nc -u -v {server_ip} {listen_port}

# Expected: Connection successful
# If fails: Firewall blocking UDP
```

#### 4. Check Peer IP Allocation
```bash
# Get peer details
curl https://api.example.com/api/v1/wireguard/peers/{peer_id} \
  -H "Authorization: Bearer $API_TOKEN" | \
  jq '{ipv4: .peer_ipv4, ipv6: .peer_ipv6}'

# Expected: Both IPs allocated
# If null: IP allocation failed
```

### Common Causes and Fixes

| Cause | Symptom | Fix |
|-------|---------|-----|
| **Firewall blocking UDP** | Connection timeout | Allow UDP port on firewall |
| **Wrong endpoint** | Connection fails | Correct endpoint in config |
| **IP conflict** | Intermittent connectivity | Reallocate peer IP |
| **Missing routes** | Cannot reach network | Add routes to config |
| **MTU too high** | Large packets fail | Reduce MTU to 1280 or lower |
| **Keys mismatch** | Handshake fails | Regenerate keys |

### Resolution Steps

**If Firewall Blocking:**
```bash
# Allow WireGuard port
iptables -A INPUT -p udp --dport 51820 -j ACCEPT

# For IPv6
ip6tables -A INPUT -p udp --dport 51820 -j ACCEPT

# Save rules
iptables-save > /etc/iptables/rules.v4
ip6tables-save > /etc/iptables/rules.v6
```

**If IP Conflict:**
```bash
# Find conflicting peers
curl "https://api.example.com/api/v1/wireguard/peers?peer_ipv4={conflict_ip}" \
  -H "Authorization: Bearer $API_TOKEN"

# Reallocate IP for peer
curl -X PATCH https://api.example.com/api/v1/wireguard/peers/{peer_id} \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"peer_ipv4": null, "peer_ipv6": null}'

# System will auto-allocate new IPs
```

**If MTU Too High:**
```bash
# Edit peer configuration
# Add: MTU = 1280

# Or via API
curl -X PATCH https://api.example.com/api/v1/wireguard/servers/{server_id} \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"mtu": 1280}'

# Restart WireGuard
systemctl restart wg-quick@wg0
```

### Validation
```bash
# Check handshake
wg show wg0 latest-handshakes

# Ping through tunnel (IPv4)
ping -c 4 -I wg0 {peer_ipv4}

# Ping through tunnel (IPv6)
ping6 -c 4 -I wg0 {peer_ipv6}

# Check tunnel traffic
wg show wg0 transfer
```

---

## NetBox Integration Issues

### Symptoms
- IP allocation fails
- NetBox API returns errors
- Stale data in NetBox

### Diagnostic Steps

#### 1. Test NetBox API Connectivity
```bash
# Test API endpoint
curl https://netbox.example.com/api/status/ \
  -H "Authorization: Token $NETBOX_TOKEN"

# Expected: HTTP 200 with status info
```

#### 2. Verify API Token
```bash
# Test token permissions
curl https://netbox.example.com/api/users/me/ \
  -H "Authorization: Token $NETBOX_TOKEN"

# Expected: User details with permissions
```

#### 3. Check Prefix Configuration
```bash
# List prefixes
curl https://netbox.example.com/api/ipam/prefixes/ \
  -H "Authorization: Token $NETBOX_TOKEN" | \
  jq '.results[] | {prefix, is_pool, status}'

# Verify:
# - is_pool: true
# - status: "active"
```

### Common Causes and Fixes

| Cause | Error | Fix |
|-------|-------|-----|
| **Invalid token** | HTTP 403 | Generate new API token |
| **Prefix not pool** | "No available IPs" | Mark prefix as pool |
| **NetBox service down** | Connection timeout | Restart NetBox container |
| **Database full** | 500 errors | Increase database storage |

### Resolution Steps

**If Invalid Token:**
```bash
# Generate new token in NetBox Web UI:
# 1. Login to NetBox
# 2. Go to Profile → API Tokens
# 3. Click "Add Token"
# 4. Copy new token

# Update environment variable
export NETBOX_TOKEN="new_token_here"

# Update in secrets management
./scripts/store_netbox_token.sh "new_token_here"
```

**If Prefix Not Pool:**
```bash
# Update prefix to be pool
curl -X PATCH https://netbox.example.com/api/ipam/prefixes/{id}/ \
  -H "Authorization: Token $NETBOX_TOKEN" \
  -d '{"is_pool": true, "status": "active"}'
```

---

## Metrics Not Updating

### Symptoms
- Dashboard shows stale data
- Prometheus metrics not updating
- Grafana panels show "No Data"

### Diagnostic Steps

#### 1. Check Metrics API
```bash
# Test metrics endpoint
curl https://api.example.com/api/v1/metrics/dual-stack/current \
  -H "Authorization: Bearer $API_TOKEN"

# Check timestamp in response
jq '.meta.collected_at' response.json

# Should be recent (< 5 minutes)
```

#### 2. Check Prometheus Scraping
```bash
# Check Prometheus targets
curl https://prometheus.example.com/api/v1/targets

# Look for dual-stack-metrics target
# State should be "up"
```

#### 3. Check Metrics Exporter
```bash
# Test Prometheus metrics endpoint
curl https://api.example.com:8001/metrics

# Should return metrics in Prometheus format
```

### Common Causes and Fixes

| Cause | Symptom | Fix |
|-------|---------|-----|
| **Metrics service down** | No data | Restart API service |
| **Prometheus not scraping** | Stale data | Check scrape config |
| **Database connection lost** | Errors in collection | Restart database connection pool |

### Resolution Steps

**If Metrics Service Down:**
```bash
# Restart API service
docker restart api

# Verify metrics collection
curl https://api.example.com/api/v1/metrics/dual-stack/current \
  -H "Authorization: Bearer $API_TOKEN"
```

**If Prometheus Not Scraping:**
```bash
# Check Prometheus config
cat /etc/prometheus/prometheus.yml | grep -A 10 dual-stack

# Should have:
# - job_name: 'dual-stack-metrics'
#   static_configs:
#     - targets: ['api.example.com:8001']

# Reload Prometheus config
curl -X POST https://prometheus.example.com/-/reload
```

---

**Document Version:** 1.0
**Last Updated:** 2025-01-18
**Next Review:** 2025-04-18
