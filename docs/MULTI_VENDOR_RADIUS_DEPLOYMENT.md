# Multi-Vendor RADIUS Production Deployment Checklist

## Pre-Deployment Checklist

### 1. Environment Preparation

- [ ] **Backup Database**
  ```bash
  pg_dump dotmac_db > backup_pre_multivendor_$(date +%Y%m%d).sql
  ```

- [ ] **Verify Python Dependencies**
  ```bash
  pip install -r requirements.txt
  python -c "from dotmac.platform.radius.vendors import NASVendor; print('OK')"
  ```

- [ ] **Test Database Connection**
  ```bash
  python -c "from dotmac.platform.settings import settings; print(settings.database_url)"
  ```

### 2. Code Deployment

- [ ] **Pull Latest Code**
  ```bash
  git pull origin feature/bss-phase1-isp-enhancements
  git log --oneline -10  # Verify commits
  ```

- [ ] **Verify All Files Present**
  ```bash
  ls -la src/dotmac/platform/radius/vendors/
  # Should show: __init__.py, base.py, builders.py, coa_strategies.py, registry.py
  ```

- [ ] **Run Syntax Checks**
  ```bash
  python3 -m py_compile src/dotmac/platform/radius/vendors/*.py
  python3 -m py_compile src/dotmac/platform/radius/service.py
  python3 -m py_compile src/dotmac/platform/radius/coa_client.py
  ```

### 3. Database Migration

- [ ] **Review Migration**
  ```bash
  cat alembic/versions/2025_10_25_1600-add_nas_vendor_fields.py
  ```

- [ ] **Test Migration (Dry Run)**
  ```bash
  alembic upgrade head --sql > migration.sql
  cat migration.sql  # Review SQL
  ```

- [ ] **Apply Migration**
  ```bash
  alembic upgrade head
  ```

- [ ] **Verify Migration**
  ```bash
  psql -d dotmac_db -c "SELECT vendor, model, firmware_version FROM nas LIMIT 5;"
  psql -d dotmac_db -c "SELECT indexname FROM pg_indexes WHERE tablename = 'nas';"
  # Should see idx_nas_vendor
  ```

### 4. Vendor Classification

- [ ] **Run Vendor Detection Script**
  ```bash
  python scripts/radius/detect_nas_vendors.py --format console > nas_analysis.txt
  cat nas_analysis.txt  # Review suggestions
  ```

- [ ] **Generate Update Script**
  ```bash
  python scripts/radius/detect_nas_vendors.py --format sql > update_vendors.sql
  ```

- [ ] **Review and Apply Updates**
  ```bash
  cat update_vendors.sql  # Manual review
  psql -d dotmac_db -f update_vendors.sql
  ```

- [ ] **Verify Updates**
  ```bash
  psql -d dotmac_db -c "SELECT vendor, COUNT(*) FROM nas GROUP BY vendor ORDER BY count DESC;"
  ```

- [ ] **Manual Corrections** (if needed)
  ```sql
  -- Example: Manually set vendor for specific devices
  UPDATE nas SET vendor = 'cisco', model = 'ASR9000', firmware_version = '6.1.3' WHERE id = 123;
  UPDATE nas SET vendor = 'huawei', model = 'MA5800-X7', firmware_version = 'V800R022C00' WHERE id = 456;
  ```

### 5. Configuration Updates

- [ ] **Update Environment Variables**
  ```bash
  # Add to .env
  RADIUS_DEFAULT_VENDOR=mikrotik
  RADIUS_VENDOR_AWARE=true
  ```

- [ ] **Restart Application**
  ```bash
  systemctl restart dotmac-api
  # OR
  docker-compose restart api
  ```

- [ ] **Verify Settings Loaded**
  ```bash
  python -c "from dotmac.platform.settings import settings; print(f'Default vendor: {settings.radius.default_vendor}'); print(f'Vendor aware: {settings.radius.vendor_aware}')"
  ```

## Testing Checklist

### 1. Unit Tests

- [ ] **Run Vendor Builder Tests**
  ```bash
  pytest tests/radius/vendors/test_bandwidth_builders.py -v
  ```

- [ ] **Run CoA Strategy Tests**
  ```bash
  pytest tests/radius/vendors/test_coa_strategies.py -v
  ```

- [ ] **Run All RADIUS Tests**
  ```bash
  pytest tests/radius/ -v --tb=short
  ```

### 2. Integration Tests

- [ ] **Test Mikrotik (Backward Compatibility)**
  ```bash
  python scripts/radius/test_vendor_coa.py --vendor mikrotik --username test@example.com --dry-run
  ```

- [ ] **Test Cisco**
  ```bash
  python scripts/radius/test_vendor_coa.py --vendor cisco --username test@example.com --dry-run
  ```

- [ ] **Test Huawei**
  ```bash
  python scripts/radius/test_vendor_coa.py --vendor huawei --username test@example.com --dry-run
  ```

- [ ] **Test Juniper**
  ```bash
  python scripts/radius/test_vendor_coa.py --vendor juniper --username test@example.com --dry-run
  ```

- [ ] **Test All Vendors**
  ```bash
  python scripts/radius/test_vendor_coa.py --all --dry-run
  ```

### 3. Live Testing (Non-Production First!)

- [ ] **Test Bandwidth Profile Application**
  ```python
  # In Python shell
  from dotmac.platform.radius.service import RADIUSService
  from dotmac.platform.db import get_db_session

  async with get_db_session() as session:
      radius_svc = RADIUSService(session, "tenant-123")
      result = await radius_svc.apply_bandwidth_profile(
          username="test@example.com",
          profile_id="gold-plan",
          nas_vendor="cisco"  # Test vendor override
      )
      print(f"Applied: {result}")
  ```

- [ ] **Test CoA Bandwidth Change**
  ```bash
  # WARNING: This will affect live sessions!
  # Only run on test subscribers
  python scripts/radius/test_vendor_coa.py --vendor cisco --username test@example.com --nas-ip 10.0.1.1
  ```

- [ ] **Verify RADIUS Logs**
  ```bash
  tail -f /var/log/dotmac/radius.log | grep vendor=
  ```

### 4. Vendor-Specific Testing

For each vendor in production:

**Mikrotik**
- [ ] Verify `Mikrotik-Rate-Limit` format: `10000k/5000k`
- [ ] Test CoA bandwidth change on live Mikrotik NAS
- [ ] Verify rate limit applied correctly on device

**Cisco**
- [ ] Verify `Cisco-AVPair` format for policies
- [ ] Test CoA on live Cisco NAS
- [ ] Verify QoS policy applied on device
- [ ] Check `show subscriber session` on Cisco device

**Huawei**
- [ ] Verify `Huawei-Input-Rate-Limit` and `Huawei-Output-Rate-Limit`
- [ ] Test CoA on live Huawei NAS
- [ ] Verify bandwidth applied on OLT
- [ ] Check `display service-port` on Huawei device

**Juniper**
- [ ] Verify `Juniper-Rate-Limit-In/Out` or `ERX-Qos-Profile-Name`
- [ ] Test CoA on live Juniper NAS
- [ ] Verify QoS applied on device
- [ ] Check `show subscribers` on Juniper device

## Monitoring Setup

### 1. Real-Time Monitoring

- [ ] **Start Vendor Operations Monitor**
  ```bash
  chmod +x scripts/radius/monitor_vendor_operations.sh
  ./scripts/radius/monitor_vendor_operations.sh
  ```

- [ ] **Monitor Specific Vendor**
  ```bash
  ./scripts/radius/monitor_vendor_operations.sh --vendor cisco
  ```

- [ ] **View Statistics**
  ```bash
  ./scripts/radius/monitor_vendor_operations.sh --stats
  ```

### 2. Logging Configuration

- [ ] **Verify Structured Logging Enabled**
  ```python
  import structlog
  logger = structlog.get_logger(__name__)
  logger.info("test", vendor="mikrotik")  # Should show vendor field
  ```

- [ ] **Configure Log Rotation**
  ```bash
  # Add to /etc/logrotate.d/dotmac
  /var/log/dotmac/radius.log {
      daily
      rotate 14
      compress
      delaycompress
      notifempty
      create 0644 dotmac dotmac
  }
  ```

### 3. Metrics Collection

- [ ] **Track Vendor Operations**
  ```python
  # Verify metrics are being collected
  # Check your metrics dashboard for:
  # - radius.bandwidth.applied{vendor=cisco}
  # - radius.coa.sent{vendor=huawei}
  ```

## Post-Deployment Verification

### 1. Data Validation

- [ ] **Verify All NAS Have Vendors**
  ```sql
  SELECT COUNT(*) FROM nas WHERE vendor IS NULL;
  -- Should return 0
  ```

- [ ] **Check Vendor Distribution**
  ```sql
  SELECT vendor, COUNT(*) as count, COUNT(model) as with_model
  FROM nas
  GROUP BY vendor
  ORDER BY count DESC;
  ```

- [ ] **Identify Missing Models**
  ```sql
  SELECT id, tenant_id, shortname, nasname, vendor
  FROM nas
  WHERE vendor != 'generic' AND model IS NULL;
  ```

### 2. Attribute Verification

- [ ] **Check Existing Subscribers**
  ```sql
  SELECT rr.attribute, COUNT(*) as count
  FROM radreply rr
  WHERE rr.attribute IN (
      'Mikrotik-Rate-Limit',
      'Cisco-AVPair',
      'Huawei-Input-Rate-Limit',
      'Huawei-Output-Rate-Limit',
      'Juniper-Rate-Limit-In',
      'Juniper-Rate-Limit-Out'
  )
  GROUP BY rr.attribute;
  ```

- [ ] **Verify No Orphaned Attributes**
  ```sql
  SELECT username, attribute, value
  FROM radreply
  WHERE attribute LIKE '%Rate%'
  ORDER BY username;
  ```

### 3. Performance Testing

- [ ] **Measure Vendor Detection Overhead**
  ```bash
  # Benchmark vendor resolution
  time python -c "
  from dotmac.platform.radius.vendors import get_bandwidth_builder
  for i in range(1000):
      builder = get_bandwidth_builder(vendor='cisco')
  "
  # Should be <100ms for 1000 lookups
  ```

- [ ] **Test Concurrent Operations**
  ```bash
  # Run load test with multiple vendors
  # Monitor CPU and memory usage
  ```

## Rollback Procedure

If issues are encountered:

### 1. Emergency Rollback

- [ ] **Disable Vendor-Aware Mode**
  ```bash
  # In .env
  RADIUS_VENDOR_AWARE=false

  # Restart
  systemctl restart dotmac-api
  ```

- [ ] **Revert to Mikrotik-Only**
  ```sql
  BEGIN;
  UPDATE nas SET vendor = 'mikrotik';
  COMMIT;
  ```

### 2. Full Database Rollback

- [ ] **Rollback Migration**
  ```bash
  alembic downgrade -1
  ```

- [ ] **Restore Backup**
  ```bash
  pg_restore -d dotmac_db backup_pre_multivendor_YYYYMMDD.sql
  ```

### 3. Partial Rollback

- [ ] **Revert Specific Vendor**
  ```sql
  -- Revert Cisco to Mikrotik temporarily
  UPDATE nas SET vendor = 'mikrotik' WHERE vendor = 'cisco';
  ```

## Success Criteria

### Deployment is successful when:

- [x] All database migrations applied without errors
- [x] All NAS devices have correct `vendor` classification
- [x] Unit tests pass: `pytest tests/radius/vendors/ -v`
- [x] Integration tests pass for all vendors
- [x] Live CoA operations work on at least one device per vendor type
- [x] Monitoring shows vendor-specific operations in logs
- [x] No regressions in existing Mikrotik functionality
- [x] Performance metrics are within acceptable range

### Production readiness indicators:

- [ ] **Week 1**: Mikrotik operations unchanged (backward compatibility verified)
- [ ] **Week 2**: Cisco/Huawei/Juniper operations tested on staging
- [ ] **Week 3**: Multi-vendor operations in production with monitoring
- [ ] **Week 4**: All vendors operational, performance metrics stable

## Troubleshooting

### Common Issues

**Issue: Vendor detection returns 'generic' for known devices**
```bash
# Solution: Review detection patterns
python scripts/radius/detect_nas_vendors.py --format console | grep "NEEDS UPDATE"

# Manually update
UPDATE nas SET vendor = 'cisco', model = 'ASR9000' WHERE shortname = 'cisco-core-1';
```

**Issue: CoA not working on specific vendor**
```bash
# Solution: Test packet construction
python scripts/radius/test_vendor_coa.py --vendor cisco --dry-run

# Check RADIUS server dictionary
grep "Cisco-AVPair" /etc/raddb/dictionary.cisco
```

**Issue: Attributes not applied correctly**
```bash
# Solution: Check builder output
python -c "
from dotmac.platform.radius.vendors import get_bandwidth_builder
builder = get_bandwidth_builder(vendor='huawei')
attrs = builder.build_radreply(download_rate_kbps=10000, upload_rate_kbps=5000)
for a in attrs:
    print(f'{a.attribute} {a.op} {a.value}')
"
```

## Documentation

- [ ] Update internal wiki with vendor configurations
- [ ] Document per-vendor CoA testing procedures
- [ ] Create runbook for vendor-specific troubleshooting
- [ ] Train support team on multi-vendor operations

## Sign-Off

**Deployment Date**: _________________

**Deployed By**: _________________

**Verified By**: _________________

**Production Ready**: [ ] YES  [ ] NO  [ ] WITH NOTES

**Notes**:
_______________________________________________
_______________________________________________
_______________________________________________
