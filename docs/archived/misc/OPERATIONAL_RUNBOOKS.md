# Dual-Stack IPv4/IPv6 Operational Runbooks

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Subscriber Management](#subscriber-management)
3. [IP Address Management](#ip-address-management)
4. [Network Monitoring](#network-monitoring)
5. [Incident Response](#incident-response)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Capacity Planning](#capacity-planning)

---

## Daily Operations

### Morning Health Check

**Frequency:** Daily (start of business day)
**Duration:** 15-20 minutes
**Owner:** Network Operations Team

#### Procedure

1. **Check System Health**
   ```bash
   # Access monitoring dashboard
   https://grafana.example.com/d/dual-stack-overview

   # Verify all services are running
   docker ps | grep -E "(postgres|redis|api|frontend)"

   # Check health endpoint
   curl https://api.example.com/health
   ```

2. **Review Metrics**
   - [ ] Total subscribers count (should match yesterday's end-of-day)
   - [ ] Dual-stack adoption percentage (should be trending up)
   - [ ] IPv4 pool utilization (< 85%)
   - [ ] IPv6 prefix utilization (< 80%)
   - [ ] IPv4/IPv6 connectivity percentages (> 95%)
   - [ ] Average latency (IPv4 < 50ms, IPv6 < 50ms)
   - [ ] Packet loss (< 1%)

3. **Review Active Alerts**
   ```bash
   # Check alerts via API
   curl -H "Authorization: Bearer $TOKEN" \
     https://api.example.com/api/v1/metrics/dual-stack/alerts
   ```

   - [ ] No critical alerts
   - [ ] Warning alerts documented and tracked
   - [ ] Alert trends reviewed

4. **Check Recent Changes**
   - [ ] Review last 24 hours of provisioning activity
   - [ ] Verify no failed subscriber creations
   - [ ] Check migration progress

5. **Documentation**
   - Log health check results in operations log
   - Escalate any critical issues to senior engineer
   - Update status page if needed

**Expected Outcome:** All systems healthy, no critical alerts, metrics within normal range.

---

## Subscriber Management

### Provision Dual-Stack Subscriber

**Frequency:** As needed
**Duration:** 5-10 minutes
**Owner:** Customer Support / NOC

#### Prerequisites
- Customer account created
- Service plan selected
- Available IPv4 and IPv6 addresses

#### Procedure

1. **Allocate IP Addresses from NetBox**

   Using Web UI:
   ```
   1. Navigate to IPAM → IP Addresses
   2. Click "Add" → "Dual-Stack Allocation"
   3. Select IPv4 prefix (e.g., 100.64.0.0/10)
   4. Select IPv6 prefix (e.g., 2001:db8::/32)
   5. Enter DNS name: customer-id.example.com
   6. Add description: "Customer: John Doe - Account: ACC-12345"
   7. Click "Create"
   8. Note allocated IPs
   ```

   Using API:
   ```bash
   curl -X POST https://netbox.example.com/api/ipam/dual-stack/ \
     -H "Authorization: Token $NETBOX_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "ipv4_prefix_id": 1,
       "ipv6_prefix_id": 2,
       "dns_name": "customer-id.example.com",
       "description": "Customer: John Doe - Account: ACC-12345",
       "tenant": 10
     }'
   ```

2. **Create RADIUS Subscriber**

   Using Web UI:
   ```
   1. Navigate to Provisioning → New Subscriber
   2. Fill in basic information:
      - Subscriber ID: SUB-12345
      - Username: customer@example.com
      - Password: (generate secure password)
   3. Go to "IP Allocation" tab
   4. Uncheck "Auto-allocate" checkboxes
   5. Enter IPv4: 100.64.1.50/24
   6. Enter IPv6 Address: 2001:db8::50
   7. Enter IPv6 Prefix: 2001:db8:100::/64
   8. Enter Delegated Prefix: 2001:db8:200::/56
   9. Click "Provision Subscriber"
   ```

   Using API:
   ```bash
   curl -X POST https://api.example.com/api/v1/radius/subscribers \
     -H "Authorization: Bearer $API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "subscriber_id": "SUB-12345",
       "username": "customer@example.com",
       "password": "SecureP@ssw0rd!",
       "framed_ipv4_address": "100.64.1.50",
       "framed_ipv6_address": "2001:db8::50",
       "framed_ipv6_prefix": "2001:db8:100::/64",
       "delegated_ipv6_prefix": "2001:db8:200::/56",
       "download_speed": "100M",
       "upload_speed": "50M"
     }'
   ```

3. **Verify Provisioning**
   ```bash
   # Check subscriber created
   curl https://api.example.com/api/v1/radius/subscribers/SUB-12345 \
     -H "Authorization: Bearer $API_TOKEN"

   # Verify RADIUS database
   docker exec -it freeradius radclient localhost:1812 auth testing123 << EOF
   User-Name = "customer@example.com"
   User-Password = "SecureP@ssw0rd!"
   EOF

   # Expected: Access-Accept with Framed-IPv6-Address attribute
   ```

4. **Test Connectivity**
   ```bash
   # Ping IPv4
   ping -c 4 100.64.1.50

   # Ping IPv6
   ping6 -c 4 2001:db8::50

   # Check DNS resolution
   dig customer-id.example.com A
   dig customer-id.example.com AAAA
   ```

5. **Customer Communication**
   - Send welcome email with connection credentials
   - Include both IPv4 and IPv6 addresses
   - Provide support contact information

**Expected Outcome:** Subscriber provisioned with dual-stack IPs, connectivity verified, customer notified.

**Rollback Procedure:**
If provisioning fails:
```bash
# Delete RADIUS subscriber
curl -X DELETE https://api.example.com/api/v1/radius/subscribers/SUB-12345 \
  -H "Authorization: Bearer $API_TOKEN"

# Release IPs in NetBox
curl -X DELETE https://netbox.example.com/api/ipam/ip-addresses/{id}/ \
  -H "Authorization: Token $NETBOX_TOKEN"
```

---

### Upgrade IPv4-Only Subscriber to Dual-Stack

**Frequency:** During migration period
**Duration:** 5-10 minutes
**Owner:** NOC / Migration Team

#### Prerequisites
- Subscriber currently has IPv4 address
- Available IPv6 prefix
- Maintenance window scheduled (optional)

#### Procedure

1. **Identify IPv4-Only Subscribers**
   ```bash
   # List IPv4-only subscribers
   curl https://api.example.com/api/v1/radius/subscribers?ipv6_only=false \
     -H "Authorization: Bearer $API_TOKEN"
   ```

2. **Allocate IPv6 Address**
   ```bash
   # Allocate from NetBox
   curl -X POST https://netbox.example.com/api/ipam/ip-addresses/ \
     -H "Authorization: Token $NETBOX_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "address": "2001:db8::50/64",
       "dns_name": "customer-id.example.com",
       "description": "Migration: IPv4 to Dual-Stack"
     }'
   ```

3. **Update RADIUS Subscriber**
   ```bash
   curl -X PATCH https://api.example.com/api/v1/radius/subscribers/SUB-12345 \
     -H "Authorization: Bearer $API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "framed_ipv6_address": "2001:db8::50",
       "framed_ipv6_prefix": "2001:db8:100::/64",
       "delegated_ipv6_prefix": "2001:db8:200::/56"
     }'
   ```

4. **Verify Dual-Stack Configuration**
   ```bash
   # Check subscriber now has both IPs
   curl https://api.example.com/api/v1/radius/subscribers/SUB-12345 \
     -H "Authorization: Bearer $API_TOKEN" | jq '.framed_ipv6_address'

   # Should return: "2001:db8::50"
   ```

5. **Test IPv6 Connectivity**
   ```bash
   ping6 -c 4 2001:db8::50

   # Check DNS AAAA record
   dig customer-id.example.com AAAA
   ```

6. **Monitor for Issues**
   - Watch for connection drops
   - Check customer support tickets
   - Monitor latency and packet loss

**Expected Outcome:** Subscriber upgraded to dual-stack, both IPv4 and IPv6 working.

---

### Deprovision Subscriber

**Frequency:** As needed
**Duration:** 5 minutes
**Owner:** Customer Support / NOC

#### Prerequisites
- Service cancellation approved
- Final bill settled
- Customer data backup (if required)

#### Procedure

1. **Suspend Service First (Optional Grace Period)**
   ```bash
   curl -X POST https://api.example.com/api/v1/radius/subscribers/SUB-12345/suspend \
     -H "Authorization: Bearer $API_TOKEN"
   ```

2. **Delete RADIUS Subscriber**
   ```bash
   curl -X DELETE https://api.example.com/api/v1/radius/subscribers/SUB-12345 \
     -H "Authorization: Bearer $API_TOKEN"
   ```

3. **Release IP Addresses in NetBox**
   ```bash
   # Find IP address IDs
   curl https://netbox.example.com/api/ipam/ip-addresses/?q=customer-id.example.com \
     -H "Authorization: Token $NETBOX_TOKEN"

   # Delete IPv4
   curl -X DELETE https://netbox.example.com/api/ipam/ip-addresses/{ipv4_id}/ \
     -H "Authorization: Token $NETBOX_TOKEN"

   # Delete IPv6
   curl -X DELETE https://netbox.example.com/api/ipam/ip-addresses/{ipv6_id}/ \
     -H "Authorization: Token $NETBOX_TOKEN"
   ```

4. **Clean Up DNS Records**
   ```bash
   # Remove A record
   curl -X DELETE https://dns-api.example.com/zones/example.com/records/customer-id \
     -H "Authorization: Bearer $DNS_TOKEN"
   ```

5. **Verify Deletion**
   ```bash
   # Verify subscriber deleted
   curl https://api.example.com/api/v1/radius/subscribers/SUB-12345 \
     -H "Authorization: Bearer $API_TOKEN"

   # Should return: 404 Not Found
   ```

**Expected Outcome:** Subscriber completely removed, IPs released back to pool.

---

## IP Address Management

### Check IPv4 Pool Utilization

**Frequency:** Daily / When approaching capacity
**Duration:** 5 minutes
**Owner:** Network Planning Team

#### Procedure

1. **Check Dashboard Metrics**
   ```bash
   # Get current metrics
   curl https://api.example.com/api/v1/metrics/dual-stack/current \
     -H "Authorization: Bearer $API_TOKEN" | jq '.ip_allocation_metrics.ipv4_pool_utilization'
   ```

2. **List IPv4 Prefixes and Utilization**
   ```bash
   curl https://netbox.example.com/api/ipam/prefixes/?family=4 \
     -H "Authorization: Token $NETBOX_TOKEN" | \
     jq '.results[] | {prefix: .prefix, utilization: .utilization}'
   ```

3. **Identify High-Utilization Prefixes**
   - Prefixes > 85% utilization = **Critical**
   - Prefixes > 70% utilization = **Warning**

4. **Action Required**

   If utilization > 85%:
   - Escalate to network planning team
   - Plan for additional IPv4 allocation
   - Accelerate IPv6-only migration for new subscribers
   - Consider implementing Carrier-Grade NAT (CGN)

5. **Document Findings**
   - Update capacity planning spreadsheet
   - Create ticket for additional IP allocation
   - Notify management of critical utilization

**Expected Outcome:** IPv4 utilization tracked, capacity planning updated.

---

### Allocate New IPv6 Prefix

**Frequency:** As needed for expansion
**Duration:** 15-30 minutes
**Owner:** Network Planning / Senior Engineer

#### Prerequisites
- IPv6 address space allocated from RIR/ISP
- Network design reviewed
- IPAM structure defined

#### Procedure

1. **Plan Prefix Hierarchy**
   ```
   Example allocation strategy:
   - RIR Allocation: 2001:db8::/32
   - Regional breakdown:
     - 2001:db8:1000::/36 - Region 1
     - 2001:db8:2000::/36 - Region 2
   - Service breakdown:
     - 2001:db8:1000::/48 - Residential
     - 2001:db8:1100::/48 - Business
     - 2001:db8:1200::/48 - Infrastructure
   ```

2. **Create Prefix in NetBox**
   ```bash
   curl -X POST https://netbox.example.com/api/ipam/prefixes/ \
     -H "Authorization: Token $NETBOX_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "prefix": "2001:db8:1000::/48",
       "description": "Residential Subscribers - Region 1",
       "status": "active",
       "is_pool": true,
       "role": "subscriber_pool",
       "tenant": 10
     }'
   ```

3. **Configure Network Equipment**
   ```bash
   # Add route to core router
   ssh core-router.example.com

   configure terminal
   ipv6 route 2001:db8:1000::/48 2001:db8::1
   exit
   write memory
   ```

4. **Test Prefix Reachability**
   ```bash
   # Allocate test IP
   curl -X POST https://netbox.example.com/api/ipam/ip-addresses/ \
     -H "Authorization: Token $NETBOX_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "address": "2001:db8:1000::1/64",
       "description": "Test IP"
     }'

   # Ping test IP
   ping6 -c 4 2001:db8:1000::1
   ```

5. **Update Documentation**
   - Add prefix to network diagram
   - Update IPAM allocation spreadsheet
   - Document in network wiki

**Expected Outcome:** New IPv6 prefix allocated, routable, and ready for use.

---

## Network Monitoring

### Investigate High Latency Alert

**Frequency:** When alert triggered
**Duration:** 15-30 minutes
**Owner:** NOC / Network Engineer

#### Trigger Conditions
- IPv4 average latency > 100ms (critical)
- IPv6 average latency > 100ms (critical)
- IPv4 average latency > 50ms (warning)
- IPv6 average latency > 50ms (warning)

#### Procedure

1. **Verify Alert**
   ```bash
   # Check current latency metrics
   curl https://api.example.com/api/v1/metrics/dual-stack/current \
     -H "Authorization: Bearer $API_TOKEN" | \
     jq '.performance_metrics | {ipv4_latency: .avg_ipv4_latency_ms, ipv6_latency: .avg_ipv6_latency_ms}'
   ```

2. **Identify Affected Protocol**
   - If only IPv4 affected: IPv4-specific routing issue
   - If only IPv6 affected: IPv6-specific routing issue
   - If both affected: General network congestion or upstream issue

3. **Check Individual Devices**
   ```bash
   # List devices with high latency
   curl https://api.example.com/api/v1/network/devices?latency_threshold=100 \
     -H "Authorization: Bearer $API_TOKEN"
   ```

4. **Perform Traceroute**
   ```bash
   # IPv4 traceroute to affected device
   traceroute 100.64.1.50

   # IPv6 traceroute
   traceroute6 2001:db8::50
   ```

5. **Check for Network Congestion**
   ```bash
   # Check interface utilization on core routers
   ssh core-router.example.com
   show interfaces | include rate

   # Check for errors
   show interfaces | include error
   ```

6. **Common Causes and Fixes**

   | Cause | Symptoms | Fix |
   |-------|----------|-----|
   | BGP route flap | Intermittent high latency | Stabilize BGP session |
   | Interface saturation | Consistent high latency | Upgrade link capacity |
   | QoS misconfiguration | Specific traffic affected | Review QoS policies |
   | Upstream provider issue | Both protocols affected | Contact ISP |
   | IPv6 MTU issues | Only IPv6 affected | Adjust MTU/MSS settings |

7. **Escalation**
   If issue persists > 30 minutes:
   - Page on-call senior engineer
   - Create incident ticket
   - Update status page

**Expected Outcome:** Latency issue identified and resolved, or escalated.

---

### Investigate Connectivity Issues

**Frequency:** When alert triggered
**Duration:** 15-45 minutes
**Owner:** NOC / Network Engineer

#### Trigger Conditions
- IPv4 connectivity < 90% (critical)
- IPv6 connectivity < 90% (critical)
- IPv4 connectivity < 95% (warning)
- IPv6 connectivity < 95% (warning)

#### Procedure

1. **Verify Alert**
   ```bash
   curl https://api.example.com/api/v1/metrics/dual-stack/current \
     -H "Authorization: Bearer $API_TOKEN" | \
     jq '.connectivity_metrics'
   ```

2. **Identify Unreachable Devices**
   ```bash
   # List unreachable IPv4 devices
   curl https://api.example.com/api/v1/network/devices?ipv4_reachable=false \
     -H "Authorization: Bearer $API_TOKEN"

   # List unreachable IPv6 devices
   curl https://api.example.com/api/v1/network/devices?ipv6_reachable=false \
     -H "Authorization: Bearer $API_TOKEN"
   ```

3. **Check Pattern**
   - Geographic clustering? (Specific region/area affected)
   - Service type clustering? (All fiber customers affected)
   - Time-based? (Started at specific time)

4. **Ping Test Sample Devices**
   ```bash
   # Test IPv4
   for ip in 100.64.1.{50,51,52,53,54}; do
     echo -n "$ip: "
     ping -c 2 -W 1 $ip > /dev/null && echo "OK" || echo "FAIL"
   done

   # Test IPv6
   for ip in 2001:db8::{50,51,52,53,54}; do
     echo -n "$ip: "
     ping6 -c 2 -W 1 $ip > /dev/null && echo "OK" || echo "FAIL"
   done
   ```

5. **Check RADIUS Server**
   ```bash
   # Verify RADIUS accepting auth
   docker logs freeradius --tail=100 | grep -E "(Auth|Accept|Reject)"

   # Check RADIUS service status
   docker ps | grep freeradius
   ```

6. **Check Firewall Rules**
   ```bash
   # Verify IPv6 not blocked by firewall
   ssh firewall.example.com
   show security policies | match ipv6

   # Check for denied connections
   show security flow session | match denied
   ```

7. **Check for Routing Issues**
   ```bash
   # Verify routes advertised
   ssh core-router.example.com
   show bgp ipv4 unicast summary
   show bgp ipv6 unicast summary
   ```

**Common Issues:**

| Issue | IPv4 | IPv6 | Fix |
|-------|------|------|-----|
| Firewall blocking | ✓ | ✓ | Update firewall rules |
| Missing ICMPv6 | ✗ | ✓ | Enable ICMPv6 (required for IPv6) |
| Route not advertised | ✓ | ✓ | Fix BGP configuration |
| DNS not resolving | ✓ | ✓ | Update DNS records |
| MTU issues | ✗ | ✓ | Adjust MTU/enable PMTUD |

**Expected Outcome:** Connectivity issue identified and resolved.

---

## Incident Response

### IPv4 Pool Exhaustion

**Severity:** Critical
**Response Time:** Immediate
**Owner:** Network Planning / Senior Engineer

#### Immediate Actions (0-15 minutes)

1. **Confirm Exhaustion**
   ```bash
   curl https://api.example.com/api/v1/metrics/dual-stack/current \
     -H "Authorization: Bearer $API_TOKEN" | \
     jq '.ip_allocation_metrics.available_ipv4_addresses'

   # If < 100 addresses: CRITICAL
   ```

2. **Stop New IPv4 Allocations**
   ```bash
   # Enable IPv6-only mode for new subscribers
   curl -X PATCH https://api.example.com/api/v1/system/settings \
     -H "Authorization: Bearer $API_TOKEN" \
     -d '{"new_subscribers_ipv6_only": true}'
   ```

3. **Notify Stakeholders**
   - Alert management team
   - Notify customer support (may impact new signups)
   - Update status page

4. **Identify Reclaimable IPs**
   ```bash
   # Find suspended/inactive subscribers
   curl https://api.example.com/api/v1/radius/subscribers?status=suspended \
     -H "Authorization: Bearer $API_TOKEN"

   # Find old allocations not in use
   curl https://netbox.example.com/api/ipam/ip-addresses/?status=deprecated \
     -H "Authorization: Token $NETBOX_TOKEN"
   ```

#### Short-Term Actions (15-60 minutes)

1. **Reclaim Unused IPs**
   ```bash
   # Delete subscribers inactive > 90 days
   # (After policy approval)

   for sub_id in $(inactive_subscriber_list); do
     curl -X DELETE https://api.example.com/api/v1/radius/subscribers/$sub_id \
       -H "Authorization: Bearer $API_TOKEN"
   done
   ```

2. **Implement Carrier-Grade NAT (CGN)**
   ```bash
   # Allocate CGN pool (100.64.0.0/10)
   curl -X POST https://netbox.example.com/api/ipam/prefixes/ \
     -H "Authorization: Token $NETBOX_TOKEN" \
     -d '{
       "prefix": "100.64.0.0/10",
       "description": "CGN Pool (RFC 6598)",
       "is_pool": true
     }'

   # Configure CGN on NAT gateway
   ssh nat-gateway.example.com
   configure
   set nat cgn pool 100.64.0.0/10
   commit
   ```

#### Long-Term Actions (1-7 days)

1. **Request Additional IPv4 Space**
   - Contact upstream ISP
   - Request allocation from RIR (if eligible)
   - Document business justification

2. **Accelerate IPv6 Migration**
   - Migrate existing IPv4-only subscribers
   - Prioritize dual-stack for business customers
   - Deploy IPv6-only for residential (with NAT64/DNS64)

3. **Implement IP Lifecycle Management**
   - Auto-reclaim IPs after 30 days suspension
   - Automated cleanup of deprecated allocations
   - Regular IP utilization audits

**Expected Outcome:** IPv4 exhaustion mitigated, long-term plan in place.

---

## Maintenance Procedures

### Monthly IP Allocation Audit

**Frequency:** Monthly (first Monday)
**Duration:** 2-4 hours
**Owner:** Network Planning Team

#### Procedure

1. **Generate Allocation Report**
   ```bash
   # Export all IP allocations
   curl https://netbox.example.com/api/ipam/ip-addresses/?limit=10000 \
     -H "Authorization: Token $NETBOX_TOKEN" \
     -o ip_allocations_$(date +%Y%m%d).json
   ```

2. **Identify Stale Allocations**
   - IPs marked "deprecated" > 30 days
   - DNS names not resolving
   - No recent activity in RADIUS logs

3. **Verify Against RADIUS Database**
   ```bash
   # Compare NetBox IPs with RADIUS subscribers
   ./scripts/audit_ip_allocations.py \
     --netbox-token $NETBOX_TOKEN \
     --api-token $API_TOKEN \
     --output audit_report_$(date +%Y%m%d).csv
   ```

4. **Reclaim Unused IPs**
   ```bash
   # After approval, delete stale allocations
   for ip_id in $(stale_ip_list); do
     curl -X DELETE https://netbox.example.com/api/ipam/ip-addresses/$ip_id/ \
       -H "Authorization: Token $NETBOX_TOKEN"
   done
   ```

5. **Update Documentation**
   - Document reclaimed IPs count
   - Update utilization trends
   - Report to management

**Expected Outcome:** IP allocation database cleaned, utilization optimized.

---

## Capacity Planning

### Quarterly Capacity Review

**Frequency:** Quarterly
**Duration:** 4-8 hours
**Owner:** Network Planning / Management

#### Procedure

1. **Collect Historical Data**
   ```bash
   # Export 90 days of metrics
   curl "https://prometheus.example.com/api/v1/query_range? \
     query=dotmac_subscribers_total&start=$(date -d '90 days ago' +%s)&end=$(date +%s)&step=3600" \
     -o subscriber_growth_90d.json
   ```

2. **Calculate Growth Rate**
   ```python
   import pandas as pd

   # Load data
   df = pd.read_json('subscriber_growth_90d.json')

   # Calculate CAGR (Compound Annual Growth Rate)
   beginning = df['value'].iloc[0]
   ending = df['value'].iloc[-1]
   periods = len(df) / 365  # Convert days to years
   cagr = ((ending / beginning) ** (1 / periods)) - 1

   print(f"Subscriber CAGR: {cagr:.2%}")
   ```

3. **Project Future Capacity Needs**
   ```
   Current IPv4 pool: 100.64.0.0/10 (4,194,304 addresses)
   Current utilization: 75% (3,145,728 used)
   Available: 1,048,576 addresses

   Monthly growth: 50,000 subscribers
   Months until exhaustion: 1,048,576 / 50,000 = 21 months

   Recommendation: Plan IPv4 expansion or IPv6 migration within 12 months
   ```

4. **Review Infrastructure Capacity**
   - [ ] Database capacity (RADIUS, NetBox)
   - [ ] API server capacity
   - [ ] Network bandwidth utilization
   - [ ] Storage capacity for logs/metrics

5. **Create Capacity Plan**
   - Document current utilization
   - Project 12-month capacity needs
   - Identify infrastructure bottlenecks
   - Budget for expansions

6. **Present to Management**
   - Prepare executive summary
   - Include cost projections
   - Recommend action items
   - Set review milestones

**Expected Outcome:** Comprehensive capacity plan, infrastructure expansion roadmap.

---

## Emergency Contacts

| Role | Name | Phone | Email | Escalation |
|------|------|-------|-------|------------|
| NOC Lead | [Name] | [Phone] | [Email] | Primary |
| Network Engineer | [Name] | [Phone] | [Email] | Secondary |
| Senior Engineer | [Name] | [Phone] | [Email] | Escalation |
| Manager | [Name] | [Phone] | [Email] | Final |

---

## Related Documentation

- [Troubleshooting Playbooks](./TROUBLESHOOTING_PLAYBOOKS.md)
- [Dual-Stack Implementation Guide](./DUAL_STACK_IPV6_IMPLEMENTATION_GUIDE.md)
- [Migration Guide](./IPV4_TO_DUAL_STACK_MIGRATION_GUIDE.md)
- [Best Practices](./DUAL_STACK_BEST_PRACTICES.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-01-18
**Next Review:** 2025-04-18
