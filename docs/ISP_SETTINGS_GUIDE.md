# ISP Settings Configuration Guide

## Overview

The ISP Settings system provides comprehensive configuration management for ISP-specific settings including subscriber ID generation, RADIUS defaults, network provisioning, compliance, portal customization, localization, SLA configuration, and service defaults.

## Architecture

### Backend Components

1. **Models** (`src/dotmac/platform/tenant/isp_settings_models.py`)
   - Pydantic models for all settings categories
   - Validation and schema enforcement
   - Default values

2. **Service Layer** (`src/dotmac/platform/tenant/isp_settings_service.py`)
   - Business logic for settings management
   - Validation and conflict resolution
   - Import/export functionality

3. **API Router** (`src/dotmac/platform/tenant/isp_settings_router.py`)
   - REST API endpoints
   - RBAC-protected routes
   - Full CRUD operations

### Frontend Components

1. **Settings Page** (`frontend/apps/isp-ops-app/app/dashboard/settings/isp-config/page.tsx`)
   - Tabbed interface for all settings categories
   - Real-time validation
   - Import/export functionality

2. **Section Components** (`frontend/apps/isp-ops-app/app/dashboard/settings/isp-config/components/`)
   - Individual UI components for each settings category
   - Form validation and UX

## Settings Categories

### 1. Subscriber ID Configuration

Controls how subscriber and customer IDs are generated.

**Formats:**
- **UUID**: Random unique identifiers (default)
- **Sequential**: Simple incrementing numbers (1, 2, 3...)
- **Prefix + Sequential**: Prefix with padded numbers (SUB-000001)
- **Custom Pattern**: Custom format with variables ({prefix}-{year}-{sequence})
- **Import Preserved**: Preserve existing IDs during migration

**Migration Settings:**
- Allow custom IDs for import
- Validate imported IDs against format

**Example:**
```json
{
  "subscriber_id": {
    "format": "prefix_sequential",
    "prefix": "CUST",
    "sequence_start": 10000,
    "sequence_padding": 6,
    "allow_custom_ids": true,
    "validate_imported_ids": true
  }
}
```

### 2. RADIUS Defaults

Default RADIUS settings for new subscribers.

**Settings:**
- Default password hash method (SHA256, MD5, BCRYPT, CLEARTEXT)
- Session timeout (seconds)
- Idle timeout (seconds)
- Simultaneous session limit
- Accounting interim interval
- Default bandwidth limits
- Custom RADIUS attributes
- NAS vendor-specific defaults

**Example:**
```json
{
  "radius": {
    "default_password_hash": "sha256",
    "session_timeout": 3600,
    "idle_timeout": 600,
    "simultaneous_use": 1,
    "default_download_speed": "100M",
    "default_upload_speed": "50M"
  }
}
```

### 3. Network Provisioning

Network infrastructure defaults for subscriber provisioning.

**Settings:**
- VLAN range allocation
- IPv4 and IPv6 address pools
- Static vs dynamic IP assignment
- CPE provisioning templates
- QoS policies

**Example:**
```json
{
  "network": {
    "vlan_range_start": 100,
    "vlan_range_end": 999,
    "ipv4_pool_prefix": "10.50.0.0/16",
    "ipv6_pool_prefix": "2001:db8:1234::/48",
    "auto_assign_ip": true,
    "enable_ipv6": true
  }
}
```

### 4. Compliance & Data Residency

Regulatory compliance and data protection settings.

**Settings:**
- Data residency region
- GDPR/CCPA/HIPAA compliance toggles
- Audit and data retention periods
- PII encryption requirements
- Right to deletion/access

**Example:**
```json
{
  "compliance": {
    "data_residency_region": "eu",
    "gdpr_enabled": true,
    "audit_retention_days": 90,
    "pii_encryption_required": true,
    "right_to_deletion": true
  }
}
```

### 5. Portal Customization

Customer portal branding and features.

**Settings:**
- Custom domain
- Theme colors and logo
- Custom CSS
- Feature toggles (self-service, ticketing, payments)
- Welcome message and support contact

**Example:**
```json
{
  "portal": {
    "custom_domain": "portal.myisp.com",
    "theme_primary_color": "#0066cc",
    "logo_url": "https://cdn.myisp.com/logo.png",
    "enable_self_service": true,
    "support_email": "support@myisp.com"
  }
}
```

### 6. Localization

Currency, language, timezone, and regional formatting.

**Settings:**
- Default and supported currencies (⚠️ Initial setup)
- Currency display format
- Default and supported languages
- Timezone (⚠️ Initial setup)
- Date and time formats
- Number formatting (decimal/thousands separators)

**Example:**
```json
{
  "localization": {
    "default_currency": "USD",
    "supported_currencies": ["USD", "EUR", "GBP"],
    "default_language": "en",
    "supported_languages": ["en", "fr", "es"],
    "timezone": "America/New_York",
    "date_format": "YYYY-MM-DD",
    "time_format": "HH:mm:ss"
  }
}
```

### 7. SLA Configuration

Service level agreement and support settings.

**Settings:**
- Response time SLAs by priority
- Resolution time SLAs
- Business hours and days
- Auto-escalation policies

**Example:**
```json
{
  "sla": {
    "priority_urgent_response_hours": 0.5,
    "priority_high_response_hours": 1.0,
    "priority_medium_response_hours": 4.0,
    "business_hours_start": "09:00:00",
    "business_hours_end": "17:00:00",
    "auto_escalate": true
  }
}
```

### 8. Service Defaults

Default service plan and credit settings.

**Settings:**
- Trial period defaults
- Data cap defaults
- Throttle policies
- Credit limits
- Auto-suspend thresholds
- Reconnection fees

**Example:**
```json
{
  "service_defaults": {
    "default_trial_days": 30,
    "default_data_cap_gb": 1000,
    "throttle_policy": "warn_only",
    "default_credit_limit": 100.0,
    "grace_period_days": 7
  }
}
```

## API Endpoints

### Get All Settings
```http
GET /isp-settings
Authorization: Bearer {token}
```

**Response:**
```json
{
  "is_initial_setup": false,
  "settings_version": 1,
  "subscriber_id": {...},
  "radius": {...},
  "network": {...},
  ...
}
```

### Update Settings
```http
PUT /isp-settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "updates": {
    "radius": {
      "session_timeout": 7200
    }
  },
  "validate_only": false
}
```

### Get Specific Section
```http
GET /isp-settings/radius
Authorization: Bearer {token}
```

### Update Specific Section
```http
PUT /isp-settings/radius
Authorization: Bearer {token}
Content-Type: application/json

{
  "updates": {
    "session_timeout": 7200,
    "idle_timeout": 900
  }
}
```

### Validate Settings
```http
POST /isp-settings/validate
Authorization: Bearer {token}
Content-Type: application/json

{
  "settings": {
    "subscriber_id": {
      "format": "uuid"
    }
  }
}
```

**Response:**
```json
{
  "is_valid": true,
  "errors": []
}
```

### Export Settings
```http
GET /isp-settings/export
Authorization: Bearer {token}
```

### Import Settings
```http
POST /isp-settings/import
Authorization: Bearer {token}
Content-Type: application/json

{
  "settings": {...},
  "validate_only": false
}
```

### Reset to Defaults
```http
POST /isp-settings/reset?confirm=true
Authorization: Bearer {token}
```

### Get Metadata
```http
GET /isp-settings/metadata
```

**Response:**
```json
{
  "initial_setup_fields": [
    "localization.default_currency",
    "localization.timezone",
    "compliance.data_residency_region",
    ...
  ],
  "runtime_changeable_fields": [
    "radius",
    "network",
    ...
  ],
  "settings_version": 1
}
```

## Initial Setup vs Runtime Configuration

### Initial Setup Fields (⚠️ Difficult to change)

These settings should be configured during tenant provisioning:

- **Default Currency**: Primary billing currency
- **Timezone**: Default timezone for all operations
- **Data Residency Region**: Where data is stored
- **Subscriber ID Format**: How IDs are generated
- **Subscriber ID Prefix**: Prefix for sequential IDs
- **Sequence Start**: Starting number for sequences

**Why they're locked:** Changing these settings after data exists requires complex migrations.

### Runtime Changeable Fields (✅ Safe to change)

These can be modified anytime through the settings UI:

- All RADIUS settings
- All network provisioning settings
- All portal customization
- All SLA settings
- All service defaults
- Most compliance settings (except data residency)
- Most localization settings (except currency/timezone)

## Usage Examples

### Example 1: Configure for New ISP (Initial Setup)

```python
from dotmac.platform.tenant.isp_settings_service import ISPSettingsService

service = ISPSettingsService(session)

# Configure during tenant provisioning
await service.update_settings(
    tenant_id="isp-001",
    updates={
        "localization": {
            "default_currency": "NGN",
            "timezone": "Africa/Lagos"
        },
        "subscriber_id": {
            "format": "prefix_sequential",
            "prefix": "CUST",
            "sequence_start": 1000
        },
        "compliance": {
            "data_residency_region": "africa"
        }
    },
    is_initial_setup=True  # Allows changing locked fields
)
```

### Example 2: Update RADIUS Defaults

```python
# Update RADIUS settings at runtime
await service.update_setting_section(
    tenant_id="isp-001",
    section="radius",
    updates={
        "default_password_hash": "bcrypt",
        "session_timeout": 7200,
        "default_download_speed": "200M"
    }
)
```

### Example 3: Migrate Settings from Another ISP

```python
# Export from old ISP
old_settings = await service.export_settings("old-isp")

# Import to new ISP
await service.import_settings(
    tenant_id="new-isp",
    settings_dict=old_settings,
    validate_only=False
)
```

### Example 4: Frontend Usage

```typescript
// Get all settings
const { data: settings } = useQuery({
  queryKey: ["isp-settings"],
  queryFn: async () => {
    const response = await http.get("/isp-settings");
    return response.data;
  }
});

// Update a section
const updateMutation = useMutation({
  mutationFn: async (updates) => {
    const response = await http.put("/isp-settings/radius", { updates });
    return response.data;
  }
});

// Save changes
await updateMutation.mutateAsync({
  session_timeout: 7200,
  idle_timeout: 900
});
```

## Permissions Required

- `settings:read` - View settings
- `settings:write` - Modify settings
- `settings:reset` - Reset to defaults
- `settings:import` - Import settings
- `settings:export` - Export settings (read permission sufficient)

## Best Practices

1. **Always validate before saving:** Use `validate_only=true` to check settings before applying

2. **Export before major changes:** Create a backup before modifying critical settings

3. **Use sections for focused updates:** Update specific sections rather than all settings at once

4. **Test in staging first:** Test setting changes in a staging environment before production

5. **Document custom patterns:** Document any custom ID patterns or special configurations

6. **Review compliance requirements:** Ensure compliance settings match your regulatory obligations

7. **Monitor after changes:** Monitor system behavior after changing network or RADIUS defaults

## Troubleshooting

### Settings validation fails
- Check the `errors` array in the validation response
- Ensure required fields are provided
- Verify data types match schema

### Cannot change currency/timezone
- These are initial setup fields - contact support if you must change them
- Changing these requires data migration

### Import fails
- Validate the JSON structure matches the schema
- Check settings version compatibility
- Ensure all required fields are present

### Settings not applying
- Check if settings are saved (not just validated)
- Verify cache is cleared (if caching is enabled)
- Check if service restarts are required (some settings may need restart)

## Migration Guide

### Migrating from Existing ISP System

1. **Export current configuration** from your existing system

2. **Map to ISP settings schema:**
   ```python
   mapped_settings = {
       "subscriber_id": {
           "format": "import_preserved",  # Keep existing IDs
           "allow_custom_ids": True
       },
       "localization": {
           "default_currency": current_currency,
           "timezone": current_timezone
       },
       ...
   }
   ```

3. **Import during tenant provisioning:**
   ```python
   await service.import_settings(
       tenant_id=new_tenant_id,
       settings_dict=mapped_settings,
       validate_only=False
   )
   ```

4. **Verify settings:** Check all sections are correctly imported

5. **Test with sample data:** Create test subscribers to verify ID generation and defaults

## Future Enhancements

- [ ] Settings versioning and rollback
- [ ] Settings templates (copy from one tenant to another)
- [ ] Audit trail for settings changes
- [ ] Scheduled settings changes
- [ ] A/B testing for different settings
- [ ] Settings validation hooks for custom logic
- [ ] Email template customization per ISP
- [ ] Invoice template customization per ISP
- [ ] Multi-currency pricing rules

## Support

For questions or issues with ISP settings:

1. Check this documentation
2. Review API error messages
3. Check backend logs for validation details
4. Contact support with tenant ID and settings JSON
