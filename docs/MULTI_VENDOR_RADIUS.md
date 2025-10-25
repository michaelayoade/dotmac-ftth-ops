# Multi-Vendor RADIUS Architecture

## Overview

The multi-vendor RADIUS system enables ISPs to manage heterogeneous NAS infrastructure (Mikrotik, Cisco, Huawei, Juniper) with vendor-specific attribute generation and CoA handling.

## Architecture

### 1. Vendor Capability Registry

**Location:** `src/dotmac/platform/radius/vendors/`

The vendor system uses a **Strategy Pattern** to generate vendor-specific RADIUS attributes and CoA payloads.

#### Supported Vendors

- **Mikrotik** (default) - Uses `Mikrotik-Rate-Limit` VSA
- **Cisco** - Uses `Cisco-AVPair` for QoS policies
- **Huawei** - Uses Huawei VSAs (`Huawei-Input-Rate-Limit`, `Huawei-Output-Rate-Limit`)
- **Juniper** - Uses Juniper/ERX VSAs (`ERX-Qos-Profile-Name`, `Juniper-Rate-Limit-*`)
- **Generic** - Falls back to Mikrotik behavior

### 2. Core Components

#### BandwidthAttributeBuilder Protocol

Generates vendor-specific RADIUS reply attributes for bandwidth control:

```python
from dotmac.platform.radius.vendors import get_bandwidth_builder, NASVendor

# Get builder for specific vendor
builder = get_bandwidth_builder(vendor=NASVendor.CISCO, tenant_id="tenant-123")

# Build RADIUS reply attributes
attributes = builder.build_radreply(
    download_rate_kbps=10000,  # 10 Mbps down
    upload_rate_kbps=5000,     # 5 Mbps up
    download_burst_kbps=15000, # 15 Mbps burst
    upload_burst_kbps=7500,    # 7.5 Mbps burst
    profile_name="gold-plan"
)

# Build CoA attributes
coa_attrs = builder.build_coa_attributes(
    download_rate_kbps=10000,
    upload_rate_kbps=5000
)
```

#### CoA Strategy Protocol

Handles vendor-specific CoA/DM packet construction:

```python
from dotmac.platform.radius.vendors import get_coa_strategy, NASVendor

# Get strategy for specific vendor
strategy = get_coa_strategy(vendor=NASVendor.HUAWEI, tenant_id="tenant-123")

# Build bandwidth change packet
packet = strategy.build_bandwidth_change_packet(
    username="user@example.com",
    download_kbps=20000,
    upload_kbps=10000,
    nas_ip="10.0.1.1"
)

# Build disconnect packet
disconnect = strategy.build_disconnect_packet(
    username="user@example.com",
    nas_ip="10.0.1.1",
    session_id="abc123"
)

# Validate response
success = strategy.validate_response(response_dict)
```

### 3. NAS Model Enhancements

The `NAS` model now includes vendor metadata:

```python
class NAS(Base):
    # ... existing fields ...
    vendor = Column(String(30), default="mikrotik")
    model = Column(String(64), nullable=True)
    firmware_version = Column(String(32), nullable=True)
```

**Database Migration:**
```bash
alembic upgrade head  # Applies 2025_10_25_1600-add_nas_vendor_fields
```

### 4. Vendor-Specific Attribute Formats

#### Mikrotik
```
Mikrotik-Rate-Limit = "10000k/5000k 15000k/7500k"
Format: "download/upload [download_burst/upload_burst]"
Units: Kbps with 'k' suffix
```

#### Cisco
```
Cisco-AVPair += "subscriber:sub-qos-policy-in=gold-plan"
Cisco-AVPair += "subscriber:sub-qos-policy-out=gold-plan"
# OR rate-based:
Cisco-AVPair += "ip:rate-limit=5000000 10000000"
Units: bps (bits per second)
```

#### Huawei
```
Huawei-Qos-Profile-Name = "gold-plan"
Huawei-Input-Rate-Limit = "5000"
Huawei-Output-Rate-Limit = "10000"
Huawei-Input-Peak-Rate = "7500"
Huawei-Output-Peak-Rate = "15000"
Units: Kbps
```

#### Juniper
```
ERX-Qos-Profile-Name = "gold-plan"
ERX-Ingress-Policy-Name = "gold-plan-in"
ERX-Egress-Policy-Name = "gold-plan-out"
# OR rate-based:
Juniper-Rate-Limit-In = "5000000"
Juniper-Rate-Limit-Out = "10000000"
Units: bps (bits per second)
```

## Usage Examples

### Creating NAS with Vendor

```python
from dotmac.platform.radius.service import RADIUSService

nas = await radius_service.create_nas(
    nasname="10.0.1.1",
    shortname="core-olt-1",
    type="other",
    vendor="huawei",  # Specify vendor
    model="MA5800-X7",
    firmware_version="V800R022C00",
    secret="radius-secret-123",
    description="Core Huawei OLT"
)
```

### Applying Bandwidth Profile (Vendor-Aware)

The system automatically detects the NAS vendor and applies the correct attributes:

```python
# Service layer automatically uses vendor from NAS
subscriber = await radius_service.apply_bandwidth_profile(
    username="user@example.com",
    profile_id="gold-plan",
    nas_vendor="cisco"  # Optional override
)
```

### Sending Vendor-Specific CoA

```python
from dotmac.platform.radius.coa_client import CoAClient
from dotmac.platform.radius.vendors import get_coa_strategy, NASVendor

# Initialize CoA client with vendor strategy
coa_client = CoAClient(
    radius_server="10.0.1.1",
    coa_port=3799,
    radius_secret="coa-secret"
)

# Get vendor-specific strategy
strategy = get_coa_strategy(vendor=NASVendor.CISCO)

# Build and send CoA packet
result = await coa_client.change_bandwidth(
    username="user@example.com",
    download_kbps=20000,
    upload_kbps=10000,
    vendor_strategy=strategy  # Pass vendor strategy
)
```

### Tenant-Specific Overrides

MSPs can register custom builders per tenant without code changes:

```python
from dotmac.platform.radius.vendors import register_vendor_override, NASVendor
from my_custom_module import CustomCiscoBuilder, CustomCiscoCoAStrategy

# Register tenant-specific override
register_vendor_override(
    tenant_id="tenant-special",
    vendor=NASVendor.CISCO,
    bandwidth_builder=CustomCiscoBuilder,
    coa_strategy=CustomCiscoCoAStrategy
)

# Now all Cisco operations for tenant-special use custom implementations
builder = get_bandwidth_builder(vendor=NASVendor.CISCO, tenant_id="tenant-special")
# Returns CustomCiscoBuilder instance
```

## Integration Points

### 1. Provisioning Workflows

Workflows automatically use vendor from NAS:

```python
# In provision_subscriber workflow
context["nas_vendor"] = "cisco"  # Set from NAS lookup

# RADIUS handler uses vendor from context
tenant_id = context["tenant_id"]
nas_vendor = context.get("nas_vendor", "mikrotik")

builder = get_bandwidth_builder(vendor=nas_vendor, tenant_id=tenant_id)
attributes = builder.build_radreply(...)
```

### 2. Service Layer

RADIUSService determines vendor from subscriber's NAS:

```python
class RADIUSService:
    async def apply_bandwidth_profile(
        self,
        username: str,
        profile_id: str,
        nas_vendor: str | None = None
    ):
        # Auto-detect vendor from subscriber's NAS if not provided
        if not nas_vendor:
            nas_vendor = await self._get_subscriber_nas_vendor(username)

        # Get vendor-specific builder
        builder = get_bandwidth_builder(vendor=nas_vendor, tenant_id=self.tenant_id)

        # Build and store attributes
        attributes = builder.build_radreply(...)
        for attr in attributes:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                username=username,
                attribute=attr.attribute,
                value=attr.value,
                op=attr.op
            )
```

### 3. CoA Client

CoA operations use vendor-specific strategies:

```python
class CoAClient:
    async def change_bandwidth(
        self,
        username: str,
        download_kbps: int,
        upload_kbps: int,
        nas_vendor: str | None = None,
        **kwargs
    ):
        # Get vendor-specific strategy
        vendor = nas_vendor or self.default_vendor
        strategy = get_coa_strategy(vendor=vendor, tenant_id=self.tenant_id)

        # Build vendor-specific packet
        packet_attrs = strategy.build_bandwidth_change_packet(
            username=username,
            download_kbps=download_kbps,
            upload_kbps=upload_kbps,
            **kwargs
        )

        # Send CoA packet
        packet = self._create_client().CreateCoAPacket(code=self._coa_request_code)
        for key, value in packet_attrs.items():
            packet[key] = value

        response = await self._send_packet(client, packet)
        return strategy.validate_response(response.to_dict())
```

## Configuration

### Settings

Add to `.env` or settings:

```bash
# Default NAS vendor for new deployments
RADIUS_DEFAULT_VENDOR=mikrotik

# Enable vendor-specific attribute generation
RADIUS_VENDOR_AWARE=true
```

### Feature Flags

```python
from dotmac.platform.settings import settings

# Check if multi-vendor support is enabled
if settings.features.radius_enabled:
    vendor = settings.radius.default_vendor or "mikrotik"
    builder = get_bandwidth_builder(vendor=vendor)
```

## Migration Guide

### For Existing Deployments

1. **Run Database Migration**
   ```bash
   alembic upgrade head
   ```

2. **Update NAS Records**
   ```sql
   -- Set vendor for existing NAS devices
   UPDATE nas SET vendor = 'cisco' WHERE shortname LIKE '%cisco%';
   UPDATE nas SET vendor = 'huawei' WHERE shortname LIKE '%hua%';
   UPDATE nas SET vendor = 'juniper' WHERE shortname LIKE '%juniper%';
   -- Default is already 'mikrotik'
   ```

3. **Verify Backward Compatibility**
   - Existing Mikrotik deployments continue working (default vendor)
   - RADIUS attributes remain unchanged for Mikrotik
   - CoA packets maintain same format for Mikrotik

### Adding New Vendor

1. **Create Builder Class**
   ```python
   # src/dotmac/platform/radius/vendors/builders.py
   class NewVendorBandwidthBuilder:
       vendor = NASVendor.NEWVENDOR

       def build_radreply(self, ...):
           # Implement vendor-specific logic
           return [RadReplySpec(...)]

       def build_coa_attributes(self, ...):
           # Implement CoA attributes
           return {...}
   ```

2. **Create CoA Strategy**
   ```python
   # src/dotmac/platform/radius/vendors/coa_strategies.py
   class NewVendorCoAStrategy:
       vendor = NASVendor.NEWVENDOR

       def build_bandwidth_change_packet(self, ...):
           # Implement packet building
           return {...}

       def build_disconnect_packet(self, ...):
           return {...}

       def validate_response(self, response):
           return response.get("code") in [41, 44]
   ```

3. **Register in Registry**
   ```python
   # src/dotmac/platform/radius/vendors/registry.py
   _BANDWIDTH_BUILDERS[NASVendor.NEWVENDOR] = NewVendorBandwidthBuilder
   _COA_STRATEGIES[NASVendor.NEWVENDOR] = NewVendorCoAStrategy
   ```

4. **Update Enum**
   ```python
   # src/dotmac/platform/radius/vendors/base.py
   class NASVendor(str, Enum):
       MIKROTIK = "mikrotik"
       CISCO = "cisco"
       HUAWEI = "huawei"
       JUNIPER = "juniper"
       NEWVENDOR = "newvendor"  # Add new vendor
       GENERIC = "generic"
   ```

## Testing

### Unit Tests

```python
def test_cisco_bandwidth_builder():
    builder = CiscoBandwidthBuilder()
    attrs = builder.build_radreply(
        download_rate_kbps=10000,
        upload_rate_kbps=5000,
        profile_name="gold"
    )

    assert len(attrs) == 3  # 2 AVPairs + profile ID
    assert attrs[0].attribute == "Cisco-AVPair"
    assert "gold" in attrs[0].value
```

### Integration Tests

```python
async def test_multi_vendor_provisioning():
    # Test Mikrotik
    mikrotik_attrs = await provision_with_vendor("mikrotik", ...)
    assert "Mikrotik-Rate-Limit" in [a.attribute for a in mikrotik_attrs]

    # Test Cisco
    cisco_attrs = await provision_with_vendor("cisco", ...)
    assert "Cisco-AVPair" in [a.attribute for a in cisco_attrs]
```

## Observability

### Structured Logging

All vendor operations log with structured metadata:

```python
logger.info(
    "Applied bandwidth profile",
    vendor="cisco",
    username="user@example.com",
    profile="gold-plan",
    attributes=["Cisco-AVPair", "X-Bandwidth-Profile-ID"]
)
```

### Metrics

Track vendor-specific operations:

```python
metrics.increment("radius.bandwidth.applied", tags={"vendor": "cisco"})
metrics.increment("radius.coa.sent", tags={"vendor": "huawei", "type": "bandwidth"})
```

## Troubleshooting

### Common Issues

1. **CoA Not Working on Cisco**
   - Verify Cisco-AVPair format matches your policy configuration
   - Check CoA is enabled on NAS: `aaa server radius dynamic-author`

2. **Huawei Rate Limits Not Applied**
   - Ensure Huawei dictionaries are loaded in FreeRADIUS
   - Verify units (Kbps vs bps)

3. **Vendor Detection Failing**
   - Check NAS `vendor` field is set correctly
   - Verify vendor is in supported list
   - Check logs for vendor resolution

### Debug Mode

Enable verbose vendor logging:

```python
import structlog
structlog.configure(wrapper_class=structlog.BoundLogger, context_class=dict)

# Logs will show vendor selection and attribute generation
```

## Performance Considerations

- **Vendor lookup**: O(1) dictionary lookup, negligible overhead
- **Attribute generation**: <1ms per profile
- **CoA packet building**: <1ms per packet
- **Tenant overrides**: Cached in memory, no database lookups

## Security

- Vendor builders don't have access to secrets (handled by CoAClient)
- Tenant overrides are in-memory only (no persistent storage)
- All vendor-specific attributes follow RADIUS RFC standards
- CoA packets include authentication via shared secret

## Future Enhancements

- [ ] Database-backed tenant override configuration
- [ ] Web UI for vendor-specific attribute preview
- [ ] Vendor capability negotiation/detection
- [ ] Custom RADIUS dictionary loader per vendor
- [ ] Vendor-specific burst time/threshold configuration
- [ ] Policy-based routing hints per vendor
- [ ] VLAN assignment per vendor
